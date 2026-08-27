-- =============================================================================
-- FKP v0.2 Phase 5 (5-A) — content management data model
-- =============================================================================
--
-- Design Ref: docs/01-plan/features/fkp-v0.2-platform-foundation.prd.md §8.1.1 OQ-1
-- ("광범위 CMS 채택"), 대표 확정(2026-08-27): 랜딩 카피 + 카테고리 마스터 + 블로그/사례/FAQ
-- 전부, 번역상태 추적 포함.
--
-- Two families of tables, on purpose:
--   1. content_category / content_category_translation — categories are referenced by FK
--      from public.requests.category (replacing its old hardcoded CHECK), so they need
--      real relational integrity, not a polymorphic key.
--   2. content_item / content_translation — landing copy / blog / case_study / faq don't
--      need to be FK targets from anywhere, so one generic jsonb-bodied pair of tables
--      covers all of them without four near-identical table sets.
--
-- Translation-status algorithm (대표 확정): every content item has ONE source locale
-- (default 'en'). Each translation row stamps `source_synced_at` = the source locale's
-- `updated_at` at the moment it was last saved. Comparing that stamp against the source's
-- CURRENT `updated_at` tells you whether a non-source translation is stale — no separate
-- "needs update" flag to maintain by hand. `status` (draft/translated/published) is the
-- orthogonal manual workflow axis; publish/unpublish never implies "in sync" or vice versa.
--
-- STATUS: not yet applied.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. content_category (FK target for public.requests.category)
-- ---------------------------------------------------------------------------

create table if not exists public.content_category (
  code text primary key check (code ~ '^[a-z][a-z0-9-]{1,49}$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_category is
  'Category master data (Phase 5-A). code is the same string requests.category has always
   stored (education/it-ai/...) — replacing this table''s rows does not require touching
   existing requests rows. Deactivating a category (is_active=false) hides it from the
   public site and the request form without breaking historical requests that reference it
   (no FK cascade delete — see the requests.category FK below).';

create index if not exists idx_content_category_active_sort on public.content_category (is_active, sort_order);

alter table public.content_category enable row level security;
alter table public.content_category force row level security;

drop trigger if exists trg_content_category_set_updated_at on public.content_category;
create trigger trg_content_category_set_updated_at before update on public.content_category
  for each row execute function private.set_updated_at();

-- Category metadata (code/sort_order/is_active) is not sensitive — public read for
-- everyone, no reason to gate it behind auth. Writes are content_management-only.
revoke all on public.content_category from anon, authenticated;
grant select on public.content_category to anon, authenticated;
grant insert, update, delete on public.content_category to authenticated;

create policy content_category_public_select on public.content_category
  for select to anon, authenticated using (true);

create policy content_category_admin_insert on public.content_category
  for insert to authenticated
  with check (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('content_management', 'create'))
  );

create policy content_category_admin_update on public.content_category
  for update to authenticated
  using (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('content_management', 'update'))
  )
  with check (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('content_management', 'update'))
  );

create policy content_category_admin_delete on public.content_category
  for delete to authenticated
  using (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('content_management', 'delete'))
  );


-- ---------------------------------------------------------------------------
-- 2. content_category_translation
-- ---------------------------------------------------------------------------

create table if not exists public.content_category_translation (
  id uuid primary key default gen_random_uuid(),
  category_code text not null references public.content_category (code) on delete cascade,
  locale text not null check (locale in ('en', 'ja', 'ko', 'zh')),
  name text not null check (char_length(name) between 1 and 100),
  keywords jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'translated', 'published')),
  source_synced_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.admin_user (id),
  unique (category_code, locale)
);

comment on column public.content_category_translation.source_synced_at is
  'Snapshot of the SOURCE locale translation''s updated_at at the moment THIS row was last
   saved. For the source locale''s own row this equals its own updated_at (always "in
   sync" with itself). Staleness = source_synced_at < (current source row''s updated_at) —
   computed by the app at read time, not stored redundantly.';

create index if not exists idx_content_category_translation_category on public.content_category_translation (category_code);

alter table public.content_category_translation enable row level security;
alter table public.content_category_translation force row level security;

drop trigger if exists trg_content_category_translation_set_updated_at on public.content_category_translation;
create trigger trg_content_category_translation_set_updated_at before update on public.content_category_translation
  for each row execute function private.set_updated_at();

revoke all on public.content_category_translation from anon, authenticated;
grant select on public.content_category_translation to anon, authenticated;
grant insert, update, delete on public.content_category_translation to authenticated;

create policy content_category_translation_public_select on public.content_category_translation
  for select to anon using (status = 'published');

create policy content_category_translation_admin_select on public.content_category_translation
  for select to authenticated
  using (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('content_management', 'read'))
  );

create policy content_category_translation_admin_insert on public.content_category_translation
  for insert to authenticated
  with check (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('content_management', 'create'))
  );

create policy content_category_translation_admin_update on public.content_category_translation
  for update to authenticated
  using (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('content_management', 'update'))
  )
  with check (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('content_management', 'update'))
  );

create policy content_category_translation_admin_delete on public.content_category_translation
  for delete to authenticated
  using (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('content_management', 'delete'))
  );


-- =============================================================================
-- 3. Seed: existing 5 categories, en/ja, status=published (already-live copy —
--    not a draft, this IS what's currently hardcoded in lib/i18n/{en,ja}.ts).
--    MUST run before the FK constraint below, or adding that FK fails validation
--    against existing public.requests rows (content_category would still be empty).
-- =============================================================================

insert into public.content_category (code, sort_order) values
  ('education', 10),
  ('it-ai', 20),
  ('content-media', 30),
  ('beauty-lifestyle', 40),
  ('business-services', 50)
on conflict (code) do nothing;

insert into public.content_category_translation (category_code, locale, name, keywords, status, source_synced_at)
values
  ('education', 'en', 'Education & EdTech',
    '["Korean language education", "AI & coding education", "Career counseling", "LMS & e-learning"]'::jsonb,
    'published', now()),
  ('education', 'ja', '教育・EdTech',
    '["韓国語教育", "AI・コーディング教育", "キャリアカウンセリング", "LMS・eラーニング"]'::jsonb,
    'published', now()),

  ('it-ai', 'en', 'IT & AI',
    '["Web & app development", "AI automation", "Chatbots", "SaaS platforms"]'::jsonb,
    'published', now()),
  ('it-ai', 'ja', 'IT・AI',
    '["Web・アプリ開発", "AI自動化", "チャットボット", "SaaSプラットフォーム"]'::jsonb,
    'published', now()),

  ('content-media', 'en', 'Content & Media',
    '["Video production", "Short-form content", "Design & branding", "Translation & localization"]'::jsonb,
    'published', now()),
  ('content-media', 'ja', 'コンテンツ・メディア',
    '["動画制作", "ショート動画コンテンツ", "デザイン・ブランディング", "翻訳・ローカライズ"]'::jsonb,
    'published', now()),

  ('beauty-lifestyle', 'en', 'Beauty & Lifestyle',
    '["K-beauty products", "Lifestyle goods", "Brand partnerships", "Manufacturing & sourcing"]'::jsonb,
    'published', now()),
  ('beauty-lifestyle', 'ja', 'ビューティー・ライフスタイル',
    '["K-ビューティー製品", "ライフスタイル商品", "ブランド提携", "製造・調達"]'::jsonb,
    'published', now()),

  ('business-services', 'en', 'Business Services',
    '["Marketing & PR", "Market research", "Korea market entry", "Consulting"]'::jsonb,
    'published', now()),
  ('business-services', 'ja', 'ビジネスサービス',
    '["マーケティング・PR", "市場調査", "韓国市場進出支援", "コンサルティング"]'::jsonb,
    'published', now())
on conflict (category_code, locale) do nothing;


-- ---------------------------------------------------------------------------
-- 4. public.requests.category: hardcoded CHECK -> FK into content_category
-- ---------------------------------------------------------------------------
-- Existing values (education/it-ai/content-media/beauty-lifestyle/business-services) were
-- just seeded into content_category above, so no existing requests row can violate this.

-- Introspect rather than assume the auto-generated name (same robustness reasoning as
-- the audit_log.action constraint further below) — the original CHECK was an inline
-- `category text not null check (category in (...))` in the Phase 1 migration, with no
-- explicit CONSTRAINT name given.
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.requests'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%education%'
    and pg_get_constraintdef(oid) like '%it-ai%';

  if v_conname is not null then
    execute format('alter table public.requests drop constraint %I', v_conname);
  end if;
end $$;

alter table public.requests
  add constraint fk_requests_category foreign key (category) references public.content_category (code)
  on delete restrict;


-- ---------------------------------------------------------------------------
-- 5. content_item — generic content (landing copy / blog / case_study / faq)
-- ---------------------------------------------------------------------------

create table if not exists public.content_item (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('landing_copy', 'blog', 'case_study', 'faq')),
  content_key text not null unique check (content_key ~ '^[a-z][a-z0-9_.-]{1,149}$'),
  source_locale text not null default 'en' check (source_locale in ('en', 'ja', 'ko', 'zh')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_item is
  'One row per addressable piece of content. content_key is what the rendering code looks
   up by (e.g. "landing.hero.headline", "blog.launching-in-japan", "faq.pricing-1") — never
   the row id, so re-ordering/renaming in the admin UI never breaks a lookup. content_type
   distinguishes shape expectations for content_translation.body (see there).';

create index if not exists idx_content_item_type_active_sort on public.content_item (content_type, is_active, sort_order);

alter table public.content_item enable row level security;
alter table public.content_item force row level security;

drop trigger if exists trg_content_item_set_updated_at on public.content_item;
create trigger trg_content_item_set_updated_at before update on public.content_item
  for each row execute function private.set_updated_at();

revoke all on public.content_item from anon, authenticated;
grant select on public.content_item to anon, authenticated;
grant insert, update, delete on public.content_item to authenticated;

create policy content_item_public_select on public.content_item
  for select to anon using (is_active = true);

create policy content_item_admin_select on public.content_item
  for select to authenticated
  using (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('content_management', 'read'))
  );

create policy content_item_admin_insert on public.content_item
  for insert to authenticated
  with check (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('content_management', 'create'))
  );

create policy content_item_admin_update on public.content_item
  for update to authenticated
  using (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('content_management', 'update'))
  )
  with check (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('content_management', 'update'))
  );

create policy content_item_admin_delete on public.content_item
  for delete to authenticated
  using (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('content_management', 'delete'))
  );


-- ---------------------------------------------------------------------------
-- 6. content_translation
-- ---------------------------------------------------------------------------

create table if not exists public.content_translation (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_item (id) on delete cascade,
  locale text not null check (locale in ('en', 'ja', 'ko', 'zh')),
  -- Shape depends on content_type (enforced by app code, not the DB, same tradeoff as
  -- Supabase's own jsonb columns elsewhere in this schema — e.g. audit_log.query_filter):
  --   landing_copy: {"text": "..."}
  --   blog / case_study: {"title": "...", "excerpt": "...", "body_markdown": "..."}
  --   faq: {"question": "...", "answer": "..."}
  body jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'translated', 'published')),
  source_synced_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.admin_user (id),
  unique (content_item_id, locale)
);

create index if not exists idx_content_translation_item on public.content_translation (content_item_id);

alter table public.content_translation enable row level security;
alter table public.content_translation force row level security;

drop trigger if exists trg_content_translation_set_updated_at on public.content_translation;
create trigger trg_content_translation_set_updated_at before update on public.content_translation
  for each row execute function private.set_updated_at();

revoke all on public.content_translation from anon, authenticated;
grant select on public.content_translation to anon, authenticated;
grant insert, update, delete on public.content_translation to authenticated;

create policy content_translation_public_select on public.content_translation
  for select to anon
  using (
    status = 'published'
    and exists (select 1 from public.content_item ci where ci.id = content_item_id and ci.is_active)
  );

create policy content_translation_admin_select on public.content_translation
  for select to authenticated
  using (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('content_management', 'read'))
  );

create policy content_translation_admin_insert on public.content_translation
  for insert to authenticated
  with check (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('content_management', 'create'))
  );

create policy content_translation_admin_update on public.content_translation
  for update to authenticated
  using (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('content_management', 'update'))
  )
  with check (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('content_management', 'update'))
  );

create policy content_translation_admin_delete on public.content_translation
  for delete to authenticated
  using (
    (select private.is_active_admin()) and (select private.is_aal2())
    and (select private.has_menu_permission('content_management', 'delete'))
  );


-- ---------------------------------------------------------------------------
-- 7. Write wrappers (upsert + audit, atomic) — same pattern as
--    update_lead_status/set_role_menu_permission (20260825160000).
-- ---------------------------------------------------------------------------

create or replace function public.upsert_category_translation(
  p_category_code text,
  p_locale text,
  p_name text,
  p_keywords jsonb,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid;
  v_source_locale text := 'en';
  v_source_updated_at timestamptz;
  v_before jsonb;
begin
  if not (
    private.is_active_admin()
    and private.is_aal2()
    and private.has_menu_permission('content_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if p_status not in ('draft', 'translated', 'published') then
    raise exception 'invalid_status';
  end if;

  select id into v_admin_id from public.admin_user where auth_user_id = auth.uid();

  select ct.updated_at into v_source_updated_at
  from public.content_category_translation ct
  where ct.category_code = p_category_code and ct.locale = v_source_locale;

  select to_jsonb(t) into v_before
  from public.content_category_translation t
  where t.category_code = p_category_code and t.locale = p_locale;

  insert into public.content_category_translation
    (category_code, locale, name, keywords, status, source_synced_at, updated_by)
  values (
    p_category_code, p_locale, p_name, coalesce(p_keywords, '[]'::jsonb), p_status,
    case when p_locale = v_source_locale then now() else coalesce(v_source_updated_at, now()) end,
    v_admin_id
  )
  on conflict (category_code, locale) do update set
    name = excluded.name,
    keywords = excluded.keywords,
    status = excluded.status,
    source_synced_at = excluded.source_synced_at,
    updated_by = excluded.updated_by;

  perform private.log_audit(
    p_action := 'content.update',
    p_target_table := 'content_category_translation',
    p_target_id := p_category_code || ':' || p_locale,
    p_before_summary := v_before,
    p_after_summary := jsonb_build_object('name', p_name, 'status', p_status)
  );
end;
$$;

revoke all on function public.upsert_category_translation(text, text, text, jsonb, text) from public;
grant execute on function public.upsert_category_translation(text, text, text, jsonb, text) to authenticated;


create or replace function public.upsert_content_translation(
  p_content_item_id uuid,
  p_locale text,
  p_body jsonb,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid;
  v_source_locale text;
  v_source_updated_at timestamptz;
  v_before jsonb;
begin
  if not (
    private.is_active_admin()
    and private.is_aal2()
    and private.has_menu_permission('content_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if p_status not in ('draft', 'translated', 'published') then
    raise exception 'invalid_status';
  end if;

  select source_locale into v_source_locale from public.content_item where id = p_content_item_id;
  if v_source_locale is null then
    raise exception 'content_item_not_found' using errcode = 'P0002';
  end if;

  select id into v_admin_id from public.admin_user where auth_user_id = auth.uid();

  select t.updated_at into v_source_updated_at
  from public.content_translation t
  where t.content_item_id = p_content_item_id and t.locale = v_source_locale;

  select to_jsonb(t) into v_before
  from public.content_translation t
  where t.content_item_id = p_content_item_id and t.locale = p_locale;

  insert into public.content_translation (content_item_id, locale, body, status, source_synced_at, updated_by)
  values (
    p_content_item_id, p_locale, p_body, p_status,
    case when p_locale = v_source_locale then now() else coalesce(v_source_updated_at, now()) end,
    v_admin_id
  )
  on conflict (content_item_id, locale) do update set
    body = excluded.body,
    status = excluded.status,
    source_synced_at = excluded.source_synced_at,
    updated_by = excluded.updated_by;

  perform private.log_audit(
    p_action := 'content.update',
    p_target_table := 'content_translation',
    p_target_id := p_content_item_id::text || ':' || p_locale,
    p_before_summary := v_before,
    p_after_summary := jsonb_build_object('status', p_status)
  );
end;
$$;

revoke all on function public.upsert_content_translation(uuid, text, jsonb, text) from public;
grant execute on function public.upsert_content_translation(uuid, text, jsonb, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 8. audit_log action allow-list: add content.* (same drop/recreate approach as
--    20260825160000, introspecting the constraint name rather than hardcoding it).
-- ---------------------------------------------------------------------------

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
  'admin_access_request.approve', 'admin_access_request.reject',
  'role.create', 'role.update', 'role.delete',
  'menu.create', 'menu.update', 'menu.delete',
  'role_menu_permission.change',
  -- E. Content management (added 20260827100000, Phase 5-A)
  'content.create', 'content.update', 'content.delete',
  -- D. Audit log itself (§3.2-D)
  'audit.view', 'audit.export', 'audit.review'
));
