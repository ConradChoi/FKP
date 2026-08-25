-- =============================================================================
-- FKP v0.2 Phase 3 — Admin access request queue ("가입요청 -> 승인" flow)
-- =============================================================================
--
-- Design Ref:
--   docs/01-plan/features/fkp-v0.2-privacy-review-phase3-rbac.md (roles/menu/RBAC model
--   this depends on — apply 20260825120000_phase3_admin_rbac.sql first)
--
-- Context: the representative asked for self-service "request access, super_admin
-- approves" instead of purely admin-initiated invites. This does NOT reopen Supabase
-- Auth's public sign-up (that stays OFF, per E3-R1) — a request row here creates no
-- auth.users row and grants zero access by itself. Only an authenticated super_admin
-- approving a request (via the service_role-backed API route, never SQL alone — creating
-- an auth.users row is an Auth Admin API operation, not something a migration can do)
-- results in a real account.
--
-- STATUS: not yet applied. Apply the same way as the other Phase 3 migration (Dashboard
-- SQL Editor or `supabase db push`), after 20260825120000_phase3_admin_rbac.sql.
-- =============================================================================

create table if not exists public.admin_access_request (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254),
  reason text not null check (char_length(reason) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_role_code text, -- set by the approver at approval time, not the requester
  reviewed_by uuid references public.admin_user(id),
  reviewed_at timestamptz,
  rejection_reason text check (char_length(rejection_reason) <= 1000),
  created_admin_user_id uuid references public.admin_user(id),
  created_at timestamptz not null default now()
);

comment on table public.admin_access_request is
  'Public "request Admin access" queue. Insert-only from anon (via submit_access_request
   RPC, mirrors Phase 1''s submit_request pattern). Never grants access by itself — only
   an app/api/admin/access-requests/[id]/approve route call (super_admin session +
   service_role) turns a row into a real Supabase Auth account + admin_user.';

create index if not exists admin_access_request_status_idx
  on public.admin_access_request (status, created_at desc);

create unique index if not exists admin_access_request_pending_email_idx
  on public.admin_access_request (lower(email))
  where status = 'pending';

alter table public.admin_access_request enable row level security;
alter table public.admin_access_request force row level security;

revoke all on public.admin_access_request from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public submission RPC (insert-only, mirrors Phase 1 submit_request)
-- ---------------------------------------------------------------------------
create or replace function public.submit_access_request(
  p_name text,
  p_email text,
  p_reason text,
  p_honeypot text default ''
)
returns table (id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_created_at timestamptz;
begin
  -- Honeypot: silently succeed without inserting anything (mirrors Phase 1's bot handling
  -- so a bot cannot distinguish "accepted" from "rejected").
  if p_honeypot is not null and length(trim(p_honeypot)) > 0 then
    return query select gen_random_uuid(), now();
    return;
  end if;

  if p_name is null or char_length(trim(p_name)) = 0 or char_length(p_name) > 100 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;

  if p_email is null or char_length(p_email) < 3 or char_length(p_email) > 254
     or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;

  if p_reason is null or char_length(trim(p_reason)) = 0 or char_length(p_reason) > 1000 then
    raise exception 'invalid_reason' using errcode = 'P0001';
  end if;

  insert into public.admin_access_request (name, email, reason)
  values (trim(p_name), lower(trim(p_email)), trim(p_reason))
  returning public.admin_access_request.id, public.admin_access_request.created_at
    into v_id, v_created_at;

  return query select v_id, v_created_at;
exception
  when unique_violation then
    -- A pending request already exists for this email (admin_access_request_pending_email_idx).
    raise exception 'request_already_pending' using errcode = 'P0001';
end;
$$;

revoke all on function public.submit_access_request(text, text, text, text) from public;
grant execute on function public.submit_access_request(text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS: only super_admin (via private.has_menu_permission, operator_management menu —
-- seeded with zero rows for operator/viewer, so this is super_admin-only today and stays
-- consistent if that menu's grants are ever widened via the future permission-matrix UI)
-- can see or update requests. INV-8: same rule enforced again at the API route layer.
-- ---------------------------------------------------------------------------
create policy admin_access_request_select on public.admin_access_request
  for select to authenticated
  using (private.has_menu_permission('operator_management', 'read'));

create policy admin_access_request_update on public.admin_access_request
  for update to authenticated
  using (private.has_menu_permission('operator_management', 'update'))
  with check (private.has_menu_permission('operator_management', 'update'));

create policy admin_access_request_deny_insert on public.admin_access_request
  for insert to authenticated with check (false);

create policy admin_access_request_deny_delete on public.admin_access_request
  for delete to public using (false);

grant select, update on public.admin_access_request to authenticated;

-- ---------------------------------------------------------------------------
-- Finalization RPC — called by the service_role-backed approval API route AFTER it has
-- already created the auth.users row via the Auth Admin API (that step cannot happen in
-- SQL). This function does the DB-side bookkeeping atomically: create admin_user, assign
-- the chosen role, mark the request approved, and audit-log it. Restricted to service_role
-- only — the route has already re-verified the caller is an authenticated super_admin
-- before ever reaching this function, so no further permission check happens here.
-- ---------------------------------------------------------------------------
create or replace function public.finalize_admin_access_approval(
  p_request_id uuid,
  p_auth_user_id uuid,
  p_role_code text,
  p_approved_by_admin_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid;
  v_role_id uuid;
begin
  select id into v_role_id from public.role where code = p_role_code and code <> 'super_admin';
  if v_role_id is null then
    raise exception 'invalid_role_code' using errcode = 'P0001';
  end if;

  insert into public.admin_user (auth_user_id, display_name, status, activated_at)
  values (
    p_auth_user_id,
    (select name from public.admin_access_request where id = p_request_id),
    'active',
    now()
  )
  on conflict (auth_user_id) do update set status = 'active'
  returning id into v_admin_id;

  insert into public.admin_user_role (admin_user_id, role_id)
  values (v_admin_id, v_role_id)
  on conflict (admin_user_id, role_id) do nothing;

  update public.admin_access_request
  set status = 'approved',
      requested_role_code = p_role_code,
      reviewed_by = p_approved_by_admin_id,
      reviewed_at = now(),
      created_admin_user_id = v_admin_id
  where id = p_request_id and status = 'pending';

  if not found then
    raise exception 'request_not_pending' using errcode = 'P0001';
  end if;

  perform private.log_audit(
    p_action := 'admin_access_request.approve',
    p_result := 'success',
    p_target_table := 'admin_access_request',
    p_target_id := p_request_id::text,
    p_after_summary := jsonb_build_object('role_code', p_role_code, 'admin_user_id', v_admin_id)
  );

  return v_admin_id;
end;
$$;

revoke all on function public.finalize_admin_access_approval(uuid, uuid, text, uuid) from public;
grant execute on function public.finalize_admin_access_approval(uuid, uuid, text, uuid) to service_role;
-- Intentionally NOT granted to authenticated — service_role only (the API route uses the
-- service_role client, after re-verifying the caller is an authenticated super_admin).
-- authenticated must go through the route, never call this RPC directly.

create or replace function public.reject_admin_access_request(
  p_request_id uuid,
  p_rejected_by_admin_id uuid,
  p_rejection_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_menu_permission('operator_management', 'update') then
    raise exception 'insufficient_permission' using errcode = 'P0001';
  end if;

  update public.admin_access_request
  set status = 'rejected',
      reviewed_by = p_rejected_by_admin_id,
      reviewed_at = now(),
      rejection_reason = p_rejection_reason
  where id = p_request_id and status = 'pending';

  if not found then
    raise exception 'request_not_pending' using errcode = 'P0001';
  end if;

  perform private.log_audit(
    p_action := 'admin_access_request.reject',
    p_result := 'success',
    p_target_table := 'admin_access_request',
    p_target_id := p_request_id::text,
    p_after_summary := jsonb_build_object('rejection_reason', p_rejection_reason)
  );
end;
$$;

revoke all on function public.reject_admin_access_request(uuid, uuid, text) from public;
grant execute on function public.reject_admin_access_request(uuid, uuid, text) to authenticated;
