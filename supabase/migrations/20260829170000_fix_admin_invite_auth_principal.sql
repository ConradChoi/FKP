-- =============================================================================
-- Fix (qa-reviewer, 2026-08-30) — finalize_admin_access_approval() broken by
-- the auth_principal mutual-exclusion FK added in 20260829130000.
-- =============================================================================
--
-- 20260829130000 added `admin_user (auth_user_id, principal_kind)` as a
-- composite FK into `auth_principal (auth_user_id, principal_kind)`. The
-- 3 bootstrap admins were backfilled by that migration, but this function —
-- the ONLY runtime path that inserts new rows into admin_user (invite
-- approval) — was never updated. Left as-is, every admin invite approved
-- after 20260829130000 is applied fails with a foreign-key violation on
-- `insert into public.admin_user`, since no matching auth_principal row
-- exists yet for the newly-invited auth user.
--
-- Fix: insert into auth_principal first, same pattern finalize_partner_signup
-- (20260829140000) already uses for the partner side.
-- =============================================================================

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

  -- New: mutual-exclusion registry insert (privacy review §2.2).
  -- Fix (qa-reviewer re-review, 2026-08-30): auth_user_id is auth_principal's
  -- PRIMARY KEY, which is a strictly stronger constraint than the
  -- unique(auth_user_id, principal_kind) it's paired with — so an
  -- `on conflict (auth_user_id) do nothing` can NEVER raise unique_violation
  -- for a caller to catch; a same-user conflict is always absorbed silently
  -- by the ON CONFLICT clause itself. A prior version of this fix wrapped the
  -- INSERT in a begin/exception block expecting to catch that violation —
  -- dead code, since control never reaches the `exception when` branch. The
  -- actual "already a partner" case must be detected explicitly instead:
  if exists (
    select 1 from public.auth_principal
    where auth_user_id = p_auth_user_id and principal_kind <> 'admin'
  ) then
    raise exception 'auth_principal_conflict' using errcode = 'P0001';
  end if;

  insert into public.auth_principal (auth_user_id, principal_kind)
  values (p_auth_user_id, 'admin')
  on conflict (auth_user_id) do nothing;

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

-- GRANT unchanged from 20260825130000: service_role only (this is invoked
-- from the server-side approve route with the service_role client, never
-- directly by an authenticated admin session — 20260825130000:197).
-- `create or replace function` alone preserves the existing GRANT, but
-- re-issuing it explicitly here keeps this file self-contained and makes
-- the intended privilege level auditable without cross-referencing the
-- original migration.
revoke all on function public.finalize_admin_access_approval(uuid, uuid, text, uuid) from public;
grant execute on function public.finalize_admin_access_approval(uuid, uuid, text, uuid) to service_role;
