-- =============================================================================
-- SEEPN Unified Platform v1.0 — Admin menu seed (D-5, §3.3.1)
-- =============================================================================
--
-- Design Ref:
--   - docs/01-plan/features/seepn-unified-platform-v1.0.prd.md §3.3.1 (D-5:
--     "기존 FKP 메뉴관리 위에 메뉴 추가", 1차 신규 2개만: partner_management,
--     standard_category_management)
--   - supabase/migrations/20260825120000_phase3_admin_rbac.sql §16 (menu /
--     role_menu_permission seed pattern reused verbatim: `on conflict (code)
--     do nothing` for menu, super_admin cross-join for role_menu_permission)
--
-- STATUS: not yet applied. Apply strictly last, after 20260829130000,
-- 20260829140000, and 20260829150000 — the RLS policies added in those files
-- already reference the menu codes seeded here via
-- private.has_menu_permission('partner_management', ...) /
-- ('standard_category_management', ...), so those checks are simply "no
-- matching menu row yet" (INV-4 default-deny) until this file runs, not
-- broken — order matters for completeness, not correctness.
--
-- Scope note: this file seeds `role_menu_permission` for super_admin ONLY
-- (documentation purposes — INV-4: super_admin bypasses this table entirely,
-- per 20260825120000 §16's own comment). It deliberately does NOT grant
-- operator/viewer any access to these two new menus — unlike lead_management,
-- the task brief for this round did not specify an intended operator
-- permission set for 공급사(파트너) 관리 / 표준 카테고리 관리, and INV-4's
-- default-deny means the safe default is "no access until a human explicitly
-- grants it" via the existing 메뉴권한관리 (/admin/permissions/matrix) screen.
-- This is a deliberate scope limit, not an oversight — flagged in the final
-- report for project-manager / ceo-advisor to decide who (beyond super_admin)
-- should see these menus at P1 launch.
-- =============================================================================

insert into public.menu (code, parent_id, display_name, path, menu_type, sort_order, is_active)
values
  ('partner_management', null, '공급사(파트너) 관리', '/admin/partners', 'page', 60, true),
  ('standard_category_management', null, '표준 카테고리 관리', '/admin/categories', 'page', 70, true)
on conflict (code) do nothing;

insert into public.role_menu_permission (role_id, menu_id, can_read, can_create, can_update, can_delete, can_export)
select r.id, m.id, true, true, true, true, true
from public.role r
cross join public.menu m
where r.code = 'super_admin'
  and m.code in ('partner_management', 'standard_category_management')
on conflict (role_id, menu_id) do update set
  can_read = true, can_create = true, can_update = true, can_delete = true, can_export = true;

-- =============================================================================
-- End of menu seed migration.
-- =============================================================================
