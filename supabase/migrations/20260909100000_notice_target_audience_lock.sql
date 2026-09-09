-- =============================================================================
-- Notice board — M-1: server-side re-validation of the D-N3 target_audience change lock.
-- =============================================================================
--
-- Design Ref:
--   - docs/01-plan/features/notice-board-v1.0.prd.md (v3.0 Final) §3.4 D-N3 ("대상은
--     원칙적으로 불변. 단 ko 외 번역 행이 하나도 없으면 변경을 허용한다").
--   - docs/02-design/features/notice-board.screen-spec.md §3.5 (UI lock state) — the UI-side
--     lock (자물쇠 아이콘, disabled select) this migration is the actual enforcement behind.
--   - docs/03-security/notice-board-privacy-review.md §3.2 NB-B3 ("content_item의 RLS는
--     읽기/쓰기 권한 경계일 뿐 D-N3 같은 비즈니스 규칙을 아는 계층이 아니다") — the RLS
--     policies on content_item/content_translation (20260827100000) enforce WHO may write,
--     not WHETHER a specific write is allowed given the row's current data. This function is
--     the missing "whether" layer.
--   - qa-reviewer M-1 condition (2026-09-08): the target_audience server-side re-validation
--     must ship in the SAME PR as the notice create/update actions, not a later batch.
--
-- Why a SECURITY DEFINER function instead of a plain app-layer
-- SELECT-then-.from('content_item').update(): a raw SELECT on content_translation from the
-- app layer is subject to content_translation_admin_select's RLS predicate (requires
-- content_management 'read', a DIFFERENT permission bit than the 'update' bit gating this
-- write). If those two bits were ever granted independently (this project's RBAC allows
-- per-action grants: create/read/update/delete), an admin with 'update' but not 'read' would
-- see ZERO content_translation rows regardless of what actually exists — the lock check would
-- silently report "unlocked" (fail-OPEN) purely because of a permission gap unrelated to the
-- D-N3 business rule. A SECURITY DEFINER function (this project's established pattern for
-- content_item/content_translation writes — see create_content_item/update_content_item/
-- upsert_content_translation) runs with the function owner's privileges and always sees the
-- true row state, so the lock check can't be defeated by an unrelated permission
-- configuration. This mirrors update_content_item/create_content_item
-- (20260827140000_phase5d_content_item_crud_functions.sql) exactly, just for one additional
-- column.
-- =============================================================================

create or replace function public.update_notice_target_audience(
  p_id uuid,
  p_target_audience text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_content_type text;
  v_locked boolean;
begin
  if not (
    private.is_active_admin()
    and private.is_aal2()
    and private.has_menu_permission('content_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  -- Defense-in-depth re-check of the 2-value allow-list even though
  -- chk_content_item_target_audience_values (20260908110000) already enforces it at the
  -- column level — failing here with a named error lets the caller distinguish "bad value"
  -- from "generic update failed" without parsing a raw constraint-violation message.
  if p_target_audience not in ('partner', 'seepn_user') then
    raise exception 'invalid_target_audience' using errcode = 'P0001';
  end if;

  select content_type into v_content_type
  from public.content_item
  where id = p_id;

  if v_content_type is null then
    raise exception 'content_item_not_found' using errcode = 'P0002';
  end if;

  -- target_audience is notice-only (chk_content_item_notice_requires_audience already forces
  -- NOT NULL for notice and implicitly NULL is the only valid state for every other
  -- content_type via the app's own create paths) — reject a caller trying to use this
  -- function on a blog/case_study/faq row instead of the generic update_content_item.
  if v_content_type <> 'notice' then
    raise exception 'not_a_notice' using errcode = 'P0001';
  end if;

  -- D-N3 lock condition: any content_translation row for this item whose locale isn't 'ko'
  -- (i.e. an en/ja/zh translation has been saved) makes target_audience immutable. Evaluated
  -- fresh on every call, ignoring whatever the caller believes the current lock state to be
  -- (PRD §3.4, screen-spec §3.5, privacy review NB-B3).
  select exists (
    select 1 from public.content_translation
    where content_item_id = p_id and locale <> 'ko'
  ) into v_locked;

  if v_locked then
    raise exception 'target_audience_locked' using errcode = 'P0001';
  end if;

  update public.content_item
  set target_audience = p_target_audience
  where id = p_id;

  perform private.log_audit(
    p_action := 'content.update',
    p_target_table := 'content_item',
    p_target_id := p_id::text
  );
end;
$$;

grant execute on function public.update_notice_target_audience(uuid, text) to authenticated;

-- =============================================================================
-- End of notice target_audience lock migration.
-- =============================================================================
