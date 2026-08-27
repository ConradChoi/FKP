-- =============================================================================
-- FKP v0.2 Phase 5-B — category admin write functions (base content_category row)
-- =============================================================================
--
-- 20260827100000 (Phase 5-A) shipped public.upsert_category_translation for the
-- per-locale name/keywords/status rows, but nothing atomically writes+audits the base
-- public.content_category row itself (code/sort_order/is_active). Without these, the
-- admin category screen would have to call .insert()/.update()/.delete() directly on
-- the table — which the RLS policies from Phase 5-A do permit, but with no audit_log
-- row at all (not even a broken one), the same E3-R8 gap already fixed twice this
-- session for leads and menus. Adding these now, before the UI is built, avoids
-- reintroducing that gap a third time.
--
-- 'content.create' / 'content.delete' are already in the audit_log.action CHECK
-- allow-list (added alongside 'content.update' in 20260827100000) — no constraint
-- change needed here.
-- =============================================================================

create or replace function public.create_category(
  p_code text,
  p_sort_order integer
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
    and private.has_menu_permission('content_management', 'create')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  insert into public.content_category (code, sort_order)
  values (p_code, p_sort_order);

  perform private.log_audit(
    p_action := 'content.create',
    p_target_table := 'content_category',
    p_target_id := p_code
  );
end;
$$;

create or replace function public.update_category(
  p_code text,
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
    and private.has_menu_permission('content_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  update public.content_category
  set sort_order = p_sort_order,
      is_active = p_is_active
  where code = p_code;

  perform private.log_audit(
    p_action := 'content.update',
    p_target_table := 'content_category',
    p_target_id := p_code
  );
end;
$$;

create or replace function public.delete_category(
  p_code text
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
    and private.has_menu_permission('content_management', 'delete')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  -- requests.category FK is ON DELETE RESTRICT (20260827100000) — this raises
  -- foreign_key_violation (23503) if any request still references the category.
  -- Deactivating (update_category p_is_active=false) is the normal retirement path;
  -- this is only for correcting a category created by mistake.
  delete from public.content_category where code = p_code;

  perform private.log_audit(
    p_action := 'content.delete',
    p_target_table := 'content_category',
    p_target_id := p_code
  );
end;
$$;

grant execute on function public.create_category(text, integer) to authenticated;
grant execute on function public.update_category(text, integer, boolean) to authenticated;
grant execute on function public.delete_category(text) to authenticated;
