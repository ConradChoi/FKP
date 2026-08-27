-- =============================================================================
-- FKP v0.2 Phase 5-D — content_item CRUD write functions (blog / case_study / faq)
-- =============================================================================
--
-- Design Ref: docs/02-design/features/fkp-v0.2-phase5d-blog-case-faq.spec.md §6.5.
-- Same pattern as public.create_category/update_category/delete_category
-- (20260827120000) — SECURITY DEFINER wrapper performs the write + audit atomically.
-- 'content.create'/'content.update'/'content.delete' are already in the audit_log.action
-- CHECK allow-list (added in 20260827100000) — no constraint change needed.
--
-- content_key is NOT a parameter of update_content_item — the slug-immutability policy
-- (§2.1: "슬러그는 불변이다") is enforced at the function-signature level, not just in the
-- admin UI, so no code path can rename a published content_key out from under an
-- indexed/bookmarked URL.
--
-- Unlike content_category, content_item has no FK referencing it from any other table
-- (content_translation references it, but ON DELETE CASCADE), so delete_content_item
-- always succeeds — no restrict-violation case to handle.
-- =============================================================================

create or replace function public.create_content_item(
  p_content_type text,
  p_content_key text,
  p_sort_order integer,
  p_is_active boolean default true
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
    and private.has_menu_permission('content_management', 'create')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  insert into public.content_item (content_type, content_key, sort_order, is_active)
  values (p_content_type, p_content_key, p_sort_order, p_is_active)
  returning id into v_id;

  perform private.log_audit(
    p_action := 'content.create',
    p_target_table := 'content_item',
    p_target_id := p_content_key
  );

  return v_id;
end;
$$;

create or replace function public.update_content_item(
  p_id uuid,
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

  update public.content_item
  set sort_order = p_sort_order,
      is_active = p_is_active
  where id = p_id;

  perform private.log_audit(
    p_action := 'content.update',
    p_target_table := 'content_item',
    p_target_id := p_id::text
  );
end;
$$;

create or replace function public.delete_content_item(
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
    and private.has_menu_permission('content_management', 'delete')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  delete from public.content_item where id = p_id;

  perform private.log_audit(
    p_action := 'content.delete',
    p_target_table := 'content_item',
    p_target_id := p_id::text
  );
end;
$$;

grant execute on function public.create_content_item(text, text, integer, boolean) to authenticated;
grant execute on function public.update_content_item(uuid, integer, boolean) to authenticated;
grant execute on function public.delete_content_item(uuid) to authenticated;
