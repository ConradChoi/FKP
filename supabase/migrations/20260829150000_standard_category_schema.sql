-- =============================================================================
-- SEEPN Unified Platform v1.0 — Standard category (Capability master) schema
-- =============================================================================
--
-- Design Ref:
--   - docs/01-plan/features/seepn-unified-platform-v1.0.prd.md §3.3.4 (A2-R1..R8),
--     §3.5 (C안: 이중 계층 + 매핑 — this table is the "Capability 마스터" layer;
--     public.content_category, the existing 5-species FKP-facing table, is left
--     untouched — the relationship between the two is a P2 mapping-UX decision,
--     out of this migration's scope per the task brief)
--   - supabase/migrations/20260827100000_phase5_content_management_schema.sql
--     (content_category / content_category_translation — the pattern this file
--     reuses for the tree/translation table shapes)
--   - lib/admin/menuTree.ts (buildMenuTree<T extends {id, parent_id}> — this
--     table's column names are chosen so rows can be passed to that function
--     unmodified, per A2-R1 "기존 메뉴관리 트리 UI 패턴 재사용")
--   - Requires 20260829140000_partner_schema.sql (public.partner — the join
--     table in §3 below references it)
--
-- STATUS: not yet applied. Apply strictly after 20260829140000.
--
-- OUT OF SCOPE (explicitly, per the task brief): importing the 374-node
-- seepn_standard_categories_2.0.xlsx (A2-R6). This migration only creates the
-- table structure; the import is a separate, future script/task. No seed rows
-- are inserted here.
-- =============================================================================


-- =============================================================================
-- §1. public.standard_category — hierarchical Capability master (A2-R1..R8)
-- =============================================================================

create table if not exists public.standard_category (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.standard_category (id) on delete restrict,

  -- Stable external code for the eventual xlsx import (narajangter's own
  -- numbering) — nullable because SEEPN-신설 nodes (source='seepn_custom')
  -- may not have one. Unique only when present.
  code text,

  -- A2-R8: distinguishes "나라장터 표준" nodes from nodes SEEPN adds itself
  -- (e.g. the 번역/로컬라이제이션 gap identified in PRD §3.5.3).
  source text not null check (source in ('narajangter_standard', 'seepn_custom')),

  is_active boolean not null default true, -- A2-R2
  sort_order integer not null default 0,

  -- D-11 / A2-R4 / CAT-1: curation flag for the FKP-facing "노출 셋". Default
  -- false — a node must be explicitly opted in by an operator, matching the
  -- PM's recommendation (§3.5.5) to keep the FKP-facing set small (8~15).
  exposed_to_fkp boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.standard_category is
  'Capability classification master (PRD §3.5 C안). Not the FKP-facing '
  '5-species content_category table — that is untouched by this migration. '
  'id/parent_id are named to match lib/admin/menuTree.ts''s '
  'buildMenuTree<T extends {id, parent_id}> generic constraint exactly, so '
  'the existing 메뉴관리 tree-UI helper can be reused for A2-R1 without '
  'modification. 374-node xlsx import (A2-R6) is a SEPARATE follow-up task — '
  'this table starts empty.';

create unique index if not exists idx_standard_category_code on public.standard_category (code) where code is not null;
create index if not exists idx_standard_category_parent_id on public.standard_category (parent_id);
create index if not exists idx_standard_category_active_sort on public.standard_category (parent_id, is_active, sort_order);
create index if not exists idx_standard_category_exposed_to_fkp on public.standard_category (exposed_to_fkp) where exposed_to_fkp = true;

alter table public.standard_category enable row level security;
alter table public.standard_category force row level security;

drop trigger if exists trg_standard_category_set_updated_at on public.standard_category;
create trigger trg_standard_category_set_updated_at before update on public.standard_category
  for each row execute function private.set_updated_at();

-- Category metadata is not sensitive (same reasoning as content_category,
-- 20260827100000 §1) — public read for anon AND authenticated (partner
-- self-registration screens need the FULL active tree, not just the
-- FKP-curated exposed_to_fkp=true subset; that curation is an application-
-- level query filter for the FKP request-form dropdown, not an RLS
-- distinction — there is no confidentiality reason to hide the other nodes).
revoke all on public.standard_category from anon, authenticated;
grant select on public.standard_category to anon, authenticated;
grant insert, update, delete on public.standard_category to authenticated;

create policy standard_category_public_select on public.standard_category
  for select to anon, authenticated using (is_active = true);

create policy standard_category_admin_select on public.standard_category
  for select to authenticated
  using (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('standard_category_management', 'read'))
  );

create policy standard_category_admin_insert on public.standard_category
  for insert to authenticated
  with check (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('standard_category_management', 'create'))
  );

create policy standard_category_admin_update on public.standard_category
  for update to authenticated
  using (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('standard_category_management', 'update'))
  )
  with check (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('standard_category_management', 'update'))
  );

create policy standard_category_admin_delete on public.standard_category
  for delete to authenticated
  using (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('standard_category_management', 'delete'))
  );


-- =============================================================================
-- §2. public.standard_category_translation (A2-R3 — content_category_translation
--     pattern reused verbatim)
-- =============================================================================

create table if not exists public.standard_category_translation (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.standard_category (id) on delete cascade,
  locale text not null check (locale in ('ko', 'en', 'ja')),
  name text not null check (char_length(name) between 1 and 100),
  status text not null default 'draft' check (status in ('draft', 'translated', 'published')),
  source_synced_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.admin_user (id),
  unique (category_id, locale)
);

create index if not exists idx_standard_category_translation_category on public.standard_category_translation (category_id);

alter table public.standard_category_translation enable row level security;
alter table public.standard_category_translation force row level security;

drop trigger if exists trg_standard_category_translation_set_updated_at on public.standard_category_translation;
create trigger trg_standard_category_translation_set_updated_at before update on public.standard_category_translation
  for each row execute function private.set_updated_at();

revoke all on public.standard_category_translation from anon, authenticated;
grant select on public.standard_category_translation to anon, authenticated;
grant insert, update, delete on public.standard_category_translation to authenticated;

create policy standard_category_translation_public_select on public.standard_category_translation
  for select to anon, authenticated using (status = 'published');

create policy standard_category_translation_admin_select on public.standard_category_translation
  for select to authenticated
  using (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('standard_category_management', 'read'))
  );

create policy standard_category_translation_admin_insert on public.standard_category_translation
  for insert to authenticated
  with check (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('standard_category_management', 'create'))
  );

create policy standard_category_translation_admin_update on public.standard_category_translation
  for update to authenticated
  using (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('standard_category_management', 'update'))
  )
  with check (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('standard_category_management', 'update'))
  );

create policy standard_category_translation_admin_delete on public.standard_category_translation
  for delete to authenticated
  using (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('standard_category_management', 'delete'))
  );


-- =============================================================================
-- §3. public.partner_standard_category — Partner <-> Capability master N:M
-- =============================================================================
-- The PRD table (§3.2.2 A) calls for "표준 카테고리 (다중 선택, L2 또는 L3)".
-- Modeled as a join table (not a uuid[] array column on public.partner) so
-- referential integrity is a real FK, not an app-enforced convention — this
-- is also why this table lives here (150000) rather than as a placeholder
-- column back in 140000 (see that file's header note and comment on
-- public.partner: no category column exists there at all, intentionally).

create table if not exists public.partner_standard_category (
  partner_id uuid not null references public.partner (id) on delete cascade,
  standard_category_id uuid not null references public.standard_category (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (partner_id, standard_category_id)
);

comment on table public.partner_standard_category is
  'Partner Capability classification (PRD §3.2.2 A "표준 카테고리, 다중선택"). '
  'ON DELETE RESTRICT on standard_category_id is the hard backstop for A2-R7 '
  '("참조 중이면 비활성만 허용") — see the friendlier pre-check trigger in §4.';

create index if not exists idx_partner_standard_category_category_id on public.partner_standard_category (standard_category_id);

alter table public.partner_standard_category enable row level security;
alter table public.partner_standard_category force row level security;
revoke all on public.partner_standard_category from anon, authenticated;

grant select, insert, delete on public.partner_standard_category to authenticated;
-- No UPDATE grant/policy: changing a category selection is delete-old-row +
-- insert-new-row, not an in-place update of a 2-column PK table.

create policy partner_standard_category_self_select on public.partner_standard_category
  for select to authenticated
  using ((select private.is_active_partner()) and (select private.owns_partner(partner_id)));

create policy partner_standard_category_self_insert on public.partner_standard_category
  for insert to authenticated
  with check ((select private.is_active_partner()) and (select private.owns_partner(partner_id)));

create policy partner_standard_category_self_delete on public.partner_standard_category
  for delete to authenticated
  using ((select private.is_active_partner()) and (select private.owns_partner(partner_id)));

create policy partner_standard_category_admin_select on public.partner_standard_category
  for select to authenticated
  using (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('partner_management', 'read'))
  );

create policy partner_standard_category_admin_insert on public.partner_standard_category
  for insert to authenticated
  with check (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('partner_management', 'update'))
  );

create policy partner_standard_category_admin_delete on public.partner_standard_category
  for delete to authenticated
  using (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('partner_management', 'update'))
  );


-- =============================================================================
-- §4. A2-R7 — referential-integrity guard (friendly pre-check ahead of the
--     hard ON DELETE RESTRICT above)
-- =============================================================================

create or replace function private.protect_standard_category_referenced()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner_ref_count integer;
  v_child_count integer;
begin
  select count(*) into v_partner_ref_count
  from public.partner_standard_category
  where standard_category_id = old.id;

  select count(*) into v_child_count
  from public.standard_category
  where parent_id = old.id;

  if v_partner_ref_count > 0 or v_child_count > 0 then
    raise exception 'standard_category_referenced: node % is referenced by % partner(s) and has % child node(s) — deactivate it (is_active=false) instead of deleting it',
      old.id, v_partner_ref_count, v_child_count
      using errcode = 'P0001';
  end if;

  return old;
end;
$$;

comment on function private.protect_standard_category_referenced is
  'A2-R7: "노드 삭제 시 참조 무결성(파트너/요청이 참조 중이면 비활성만 허용)". '
  'Partner references are checked here directly; requests currently has no '
  'direct reference to standard_category (requests.category still FKs '
  'content_category, PRD §3.5 C안) — once a request<->standard_category '
  'mapping ships (P2/P4), extend this trigger''s check accordingly. The plain '
  'ON DELETE RESTRICT FK on partner_standard_category.standard_category_id '
  'is the actual hard backstop regardless of this trigger; this trigger only '
  'turns that into a friendlier, specific error message before Postgres ever '
  'reaches the FK check.';

drop trigger if exists trg_standard_category_protect_referenced on public.standard_category;
create trigger trg_standard_category_protect_referenced
  before delete on public.standard_category
  for each row execute function private.protect_standard_category_referenced();


-- =============================================================================
-- End of standard category schema migration.
-- =============================================================================
