-- =============================================================================
-- FKP v0.2 Phase 3 — point operator_management menu at the screen that actually
-- exists yet (가입요청 검토), instead of the not-yet-built /admin/operators
-- (account list/invite/deactivate, E3-R4 proper).
-- =============================================================================
--
-- INV-1 only protects `code` from changes — `path`/`display_name` are free to update.
-- When the full 운영자관리 screen (account list) ships, revisit whether
-- operator_management should become a `group` with both this and /admin/operators as
-- children, rather than pointing at just one of them.
--
-- STATUS: not yet applied — apply after 20260825130000_phase3_admin_access_request.sql,
-- same method (Dashboard SQL Editor or `supabase db push`).
-- =============================================================================

update public.menu
set path = '/admin/access-requests'
where code = 'operator_management';
