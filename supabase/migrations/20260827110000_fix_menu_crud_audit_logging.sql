-- =============================================================================
-- Fix: 메뉴관리(E3-R5) CRUD actions call supabase.rpc('log_audit', ...) from
-- app/admin/(protected)/permissions/menus/actions.ts. There is no public.log_audit
-- (only private.log_audit, not PostgREST-exposed) — same bug class already fixed for
-- leads (update_lead_status/update_lead_assignee) and role_menu_permission
-- (set_role_menu_permission) in 20260825160000. The menu table's underlying insert/
-- update/delete themselves succeed (separate direct calls), but no audit_log row
-- is ever written for menu.create/menu.update/menu.delete — a real E3-R8 gap.
--
-- Fix follows the same pattern: SECURITY DEFINER wrapper functions that perform the
-- write and the audit log atomically, re-checking the same permission the RLS policy
-- already checks (defense-in-depth, INV-8) since SECURITY DEFINER bypasses RLS.
-- 'menu.create'/'menu.update'/'menu.delete' are already in the audit_log.action
-- CHECK constraint allow-list (added in 20260825120000) — no constraint change needed.
-- =============================================================================

create or replace function public.create_menu(
  p_code text,
  p_display_name text,
  p_parent_id uuid,
  p_path text,
  p_menu_type text,
  p_sort_order integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not (
    private.is_active_admin()
    and private.is_aal2()
    and private.has_menu_permission('menu_management', 'create')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  insert into public.menu (code, display_name, parent_id, path, menu_type, sort_order)
  values (p_code, p_display_name, p_parent_id, p_path, p_menu_type, p_sort_order)
  returning id into v_id;

  perform private.log_audit(
    p_action := 'menu.create',
    p_target_table := 'menu',
    p_target_id := p_code
  );

  return v_id;
end;
$$;

create or replace function public.update_menu(
  p_id uuid,
  p_display_name text,
  p_path text,
  p_sort_order integer,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    private.is_active_admin()
    and private.is_aal2()
    and private.has_menu_permission('menu_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  update public.menu
  set display_name = p_display_name,
      path = p_path,
      sort_order = p_sort_order,
      is_active = p_is_active
  where id = p_id;

  perform private.log_audit(
    p_action := 'menu.update',
    p_target_table := 'menu',
    p_target_id := p_id::text
  );
end;
$$;

create or replace function public.delete_menu(
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    private.is_active_admin()
    and private.is_aal2()
    and private.has_menu_permission('menu_management', 'delete')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  delete from public.menu where id = p_id;

  perform private.log_audit(
    p_action := 'menu.delete',
    p_target_table := 'menu',
    p_target_id := p_id::text
  );
end;
$$;

grant execute on function public.create_menu(text, text, uuid, text, text, integer) to authenticated;
grant execute on function public.update_menu(uuid, text, text, integer, boolean) to authenticated;
grant execute on function public.delete_menu(uuid) to authenticated;
