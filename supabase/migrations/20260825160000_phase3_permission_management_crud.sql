-- =============================================================================
-- FKP v0.2 Phase 3 — write access for 권한관리 (E3-R5 메뉴관리, E3-R6 메뉴권한관리)
-- =============================================================================
--
-- 20260825120000 wired SELECT-only RLS for menu/role_menu_permission ("read path is
-- wired now so that round only has to build UI, not schema" — this is that round).
-- Adds INSERT/UPDATE(/DELETE for menu) so the CRUD screens can actually write.
--
-- Safety notes:
-- - menu.code stays immutable regardless of these grants — trg_menu_protect_code
--   (20260825120000 §4) fires on every UPDATE and blocks a code change at the trigger
--   level, independent of what the UI allows.
-- - role_menu_permission has no DELETE policy here on purpose: "no access" is
--   represented by all five boolean flags false via UPSERT, not row absence — keeps
--   the write surface to one operation (upsert) instead of two (upsert + delete).
-- - super_admin bypasses role_menu_permission entirely (INV-4) — editing that role's
--   row in the matrix has zero effect on its actual access either way, so no
--   additional guard is needed here; the UI renders that row read-only for clarity
--   only, not as a security boundary.
--
-- STATUS: not yet applied — apply after 20260825150000_phase3_admin_user_directory.sql.
-- =============================================================================

create policy menu_admin_insert on public.menu
  for insert to authenticated
  with check (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('menu_management', 'create'))
  );

create policy menu_admin_update on public.menu
  for update to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('menu_management', 'update'))
  )
  with check (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('menu_management', 'update'))
  );

create policy menu_admin_delete on public.menu
  for delete to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('menu_management', 'delete'))
  );

grant insert, update, delete on public.menu to authenticated;
-- updated_at trigger already exists (trg_menu_set_updated_at, 20260825120000) — no need
-- to add it again here.

create policy role_menu_permission_admin_insert on public.role_menu_permission
  for insert to authenticated
  with check (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('role_menu_permission_management', 'create'))
  );

create policy role_menu_permission_admin_update on public.role_menu_permission
  for update to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('role_menu_permission_management', 'update'))
  )
  with check (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('role_menu_permission_management', 'update'))
  );

grant insert, update on public.role_menu_permission to authenticated;


-- =============================================================================
-- Bug fix (found while building this round): app/admin/(protected)/leads/[id]/actions.ts
-- was calling supabase.rpc('log_audit', ...) to log lead.status_change / lead.assign.
-- There is no public.log_audit — only private.log_audit, and `private` is not a
-- PostgREST-exposed schema (§0 of 20260825120000), so that call was failing on every
-- status/assignee change. The UPDATE itself still succeeded (plain authenticated table
-- grant, unaffected), but no audit row was ever written — a real gap against E3-R8.
--
-- Fix: wrap both actions the same way get_request_contact/set_request_internal_note
-- already do — update + audit insert atomic in one SECURITY DEFINER function — instead
-- of "update from the app, then a separate (broken) audit call".
-- =============================================================================

create or replace function public.update_lead_status(p_request_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before text;
begin
  if not (
    private.is_active_admin()
    and private.is_aal2()
    and private.has_menu_permission('lead_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if p_status not in ('new', 'reviewing', 'matching', 'matched', 'on_hold', 'closed') then
    raise exception 'invalid_status';
  end if;

  select status into v_before from public.requests where id = p_request_id;
  if v_before is null then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;

  update public.requests set status = p_status where id = p_request_id;

  perform private.log_audit(
    p_action := 'lead.status_change',
    p_target_table := 'requests',
    p_target_id := p_request_id::text,
    p_subject_ids := array[p_request_id],
    p_before_summary := jsonb_build_object('status', v_before),
    p_after_summary := jsonb_build_object('status', p_status)
  );
end;
$$;

revoke all on function public.update_lead_status(uuid, text) from public;
grant execute on function public.update_lead_status(uuid, text) to authenticated;

create or replace function public.update_lead_assignee(p_request_id uuid, p_assignee_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before uuid;
begin
  if not (
    private.is_active_admin()
    and private.is_aal2()
    and private.has_menu_permission('lead_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  select assignee_id into v_before from public.requests where id = p_request_id;

  update public.requests set assignee_id = p_assignee_id where id = p_request_id;

  perform private.log_audit(
    p_action := 'lead.assign',
    p_target_table := 'requests',
    p_target_id := p_request_id::text,
    p_subject_ids := array[p_request_id],
    p_before_summary := jsonb_build_object('assignee_id', v_before),
    p_after_summary := jsonb_build_object('assignee_id', p_assignee_id)
  );
end;
$$;

revoke all on function public.update_lead_assignee(uuid, uuid) from public;
grant execute on function public.update_lead_assignee(uuid, uuid) to authenticated;

-- Now that the SECURITY DEFINER functions above own the audit trail for these two
-- actions, the plain authenticated UPDATE grant on requests(status, assignee_id) from
-- 20260825120000 is redundant as a write PATH (the app should always go through the
-- functions) but is deliberately left in place rather than revoked — INV-8 relies on
-- RLS staying independently correct even if a caller bypasses the function.


-- =============================================================================
-- E3-R6 메뉴권한관리: toggle one (role, menu, action) permission flag, audited.
-- =============================================================================
-- One flag at a time, matching the matrix UI's per-checkbox toggle — reads the existing
-- row (if any) so the other four flags are preserved, not reset to false. "No row yet"
-- is treated as all-false (INV-4 default deny), matching private.has_menu_permission's
-- own reading of an absent row.

create or replace function public.set_role_menu_permission(
  p_role_id uuid,
  p_menu_id uuid,
  p_flag text,
  p_value boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_code text;
  v_existing public.role_menu_permission%rowtype;
  v_before jsonb;
begin
  if not (
    private.is_active_admin()
    and private.is_aal2()
    and private.has_menu_permission('role_menu_permission_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if p_flag not in ('can_read', 'can_create', 'can_update', 'can_delete', 'can_export') then
    raise exception 'invalid_flag';
  end if;

  select code into v_role_code from public.role where id = p_role_id;
  if v_role_code is null then
    raise exception 'role_not_found' using errcode = 'P0002';
  end if;
  if v_role_code = 'super_admin' then
    -- Not a security boundary (INV-4 means this table is never consulted for
    -- super_admin either way) — just refuses a pointless write so the matrix UI's
    -- "super_admin row is read-only" isn't only cosmetic.
    raise exception 'super_admin_not_editable';
  end if;

  select * into v_existing from public.role_menu_permission
    where role_id = p_role_id and menu_id = p_menu_id;

  v_before := to_jsonb(v_existing);

  insert into public.role_menu_permission (role_id, menu_id, can_read, can_create, can_update, can_delete, can_export)
  values (
    p_role_id, p_menu_id,
    case when p_flag = 'can_read' then p_value else coalesce(v_existing.can_read, false) end,
    case when p_flag = 'can_create' then p_value else coalesce(v_existing.can_create, false) end,
    case when p_flag = 'can_update' then p_value else coalesce(v_existing.can_update, false) end,
    case when p_flag = 'can_delete' then p_value else coalesce(v_existing.can_delete, false) end,
    case when p_flag = 'can_export' then p_value else coalesce(v_existing.can_export, false) end
  )
  on conflict (role_id, menu_id) do update set
    can_read = excluded.can_read,
    can_create = excluded.can_create,
    can_update = excluded.can_update,
    can_delete = excluded.can_delete,
    can_export = excluded.can_export;

  perform private.log_audit(
    -- 'role_menu_permission.change' is the exact allow-listed value from
    -- audit_log's CHECK constraint (20260825120000 §6, category C) — not a
    -- free-form string. Using anything else (e.g. 'permission.menu_permission_change')
    -- silently loses the audit row: log_audit swallows CHECK-constraint failures
    -- (its own `exception when others` handler) so the write appears to succeed
    -- with no audit trail. See the bug-fix note below for two more instances of
    -- this same mistake, found and fixed while writing this function.
    p_action := 'role_menu_permission.change',
    p_target_table := 'role_menu_permission',
    p_target_id := p_role_id::text || ':' || p_menu_id::text,
    p_before_summary := v_before,
    p_after_summary := jsonb_build_object(p_flag, p_value)
  );
end;
$$;

revoke all on function public.set_role_menu_permission(uuid, uuid, text, boolean) from public;
grant execute on function public.set_role_menu_permission(uuid, uuid, text, boolean) to authenticated;


-- =============================================================================
-- Bug fix #2 (found while writing set_role_menu_permission above and re-checking every
-- p_action string against audit_log's CHECK constraint, 20260825120000 §6): the access-
-- request approve/reject functions in 20260825130000_phase3_admin_access_request.sql use
-- 'admin_access_request.approve' / 'admin_access_request.reject' — neither is in that
-- allow-list. Same silent failure mode: the approval/rejection itself succeeds (the
-- UPDATE isn't gated by the audit insert), but no audit row is written for it, which is
-- exactly the kind of account-provisioning event E3-R8 requires a record of.
--
-- Fix: extend the CHECK constraint with the two missing values, rather than force-fitting
-- them onto an existing category (they're genuinely a new sub-case of "account changes").
-- Postgres has no ALTER CHECK ... ADD VALUE, so drop and recreate with the fuller list.
-- =============================================================================

-- Robust against the constraint's actual auto-generated name (expected to be
-- audit_log_action_check, Postgres's default for an inline column CHECK, but this
-- introspects pg_constraint instead of hardcoding it, so a naming mismatch can't
-- leave the OLD, stricter constraint in place alongside a new one).
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.audit_log'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%auth.login_success%';

  if v_conname is not null then
    execute format('alter table public.audit_log drop constraint %I', v_conname);
  end if;
end $$;

alter table public.audit_log add constraint audit_log_action_check check (action in (
  -- A. Authentication (§3.2-A)
  'auth.login_success', 'auth.login_failed', 'auth.logout', 'auth.session_expired',
  'auth.mfa_enrolled', 'auth.mfa_reset',
  'auth.password_reset_requested', 'auth.password_changed',
  'auth.access_denied',
  -- B. Lead PII access (§3.2-B)
  'lead.list', 'lead.view', 'lead.contact_reveal', 'lead.update',
  'lead.status_change', 'lead.assign', 'lead.note_write',
  'lead.export', 'lead.export_denied',
  -- C. Account / permission changes (§3.2-C)
  'admin_user.invite', 'admin_user.invite_resend', 'admin_user.invite_revoke',
  'admin_user.activate', 'admin_user.suspend', 'admin_user.withdraw',
  'admin_user.role_grant', 'admin_user.role_revoke', 'admin_user.profile_update',
  'admin_access_request.approve', 'admin_access_request.reject', -- added 20260825160000
  'role.create', 'role.update', 'role.delete',
  'menu.create', 'menu.update', 'menu.delete',
  'role_menu_permission.change',
  -- D. Audit log itself (§3.2-D)
  'audit.view', 'audit.export', 'audit.review'
));
