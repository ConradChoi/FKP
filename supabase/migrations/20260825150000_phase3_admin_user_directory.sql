-- =============================================================================
-- FKP v0.2 Phase 3 — minimal admin-user directory for assignment UI
-- =============================================================================
--
-- Gap found while building 요청관리 (lead_management screens): admin_user's own
-- RLS (20260825120000, admin_user_select) only lets a caller see their own row unless
-- they hold operator_management read — which today only super_admin has (INV-4). An
-- `operator` assigning a lead to a colleague, or just seeing who a lead is already
-- assigned to, has no way to resolve another admin_user's display_name.
--
-- This adds one narrow, purpose-built function: id + display_name only, active accounts
-- only, gated by lead_management read (not operator_management) — enough for an
-- assignee picker/label, nothing else about the account is exposed.
--
-- STATUS: not yet applied — apply after 20260825140000_phase3_menu_access_requests_path.sql.
-- =============================================================================

create or replace function public.list_admin_users_for_assignment()
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select au.id, au.display_name
  from public.admin_user au
  where au.status = 'active'
    and private.is_active_admin()
    and private.is_aal2()
    and private.has_menu_permission('lead_management', 'read')
  order by au.display_name;
$$;

comment on function public.list_admin_users_for_assignment is
  'Narrow directory (id + display_name of active accounts only) for the lead
   assignment picker, reachable by anyone with lead_management read — deliberately
   NOT gated by operator_management, since assigning/viewing lead ownership is a
   lead_management concern, not an account-management one.';

revoke all on function public.list_admin_users_for_assignment() from public;
grant execute on function public.list_admin_users_for_assignment() to authenticated;
