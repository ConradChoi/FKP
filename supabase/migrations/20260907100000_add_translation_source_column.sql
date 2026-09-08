-- =============================================================================
-- CMS translation Phase 0 — `translation_source` column (선행 스키마 작업)
-- =============================================================================
--
-- Design Ref:
--   - docs/01-plan/features/seepn-unified-platform-v1.0.prd.md §3.2.4 TR-2′
--     (2026-09-07, ceo-advisor 승인): "translation_source를 human/ai/ai_reviewed
--     3값 enum(또는 CHECK 제약)으로 정의한다." TR-4″-1b/1c: AI 초벌은 반드시
--     status='draft' + translation_source='ai'로 생성되고, 운영자가 검수 후
--     발행 버튼을 눌러야만 published로 전환된다(자동 발행 금지).
--   - docs/01-plan/features/google-translation-api-evaluation.md §2.2 (Q-1) —
--     이 컬럼이 "AI가 채운 문장을 사람이 덮어쓰기/구분"하는 유일한 장치라는
--     문제 제기의 후속 조치.
--   - This migration is SCHEMA-ONLY (Phase 0). The actual "AI 초벌 채우기"
--     button / AI API call is a separate, later feature — not built here.
--
-- Scope: the 3 tables where the `content_translation` pattern already exists.
--   1. public.content_translation          (content_item 번역)
--   2. public.content_category_translation (content_category 번역)
--   3. public.standard_category_translation (standard_category 번역, 20260829150000
--      + zh locale added by 20260830100000)
--
-- STATUS: not yet applied — run manually via Supabase console per this
-- project's existing workflow (see repo memory: local-only verification
-- during the SEEPN integration arc).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Add the column to all three translation tables.
-- ---------------------------------------------------------------------------
-- Default 'human' matches actual past behavior exactly: every write to these
-- tables until today went through a human typing into the Admin UI (content/
-- categories screens) or a human-run one-off insert — see §3 below for why
-- standard_category_translation's existing 374-node rows are NOT backfilled
-- to 'ai' despite an earlier proposal to do so.

alter table public.content_translation
  add column if not exists translation_source text not null default 'human'
    check (translation_source in ('human', 'ai', 'ai_reviewed'));

alter table public.content_category_translation
  add column if not exists translation_source text not null default 'human'
    check (translation_source in ('human', 'ai', 'ai_reviewed'));

alter table public.standard_category_translation
  add column if not exists translation_source text not null default 'human'
    check (translation_source in ('human', 'ai', 'ai_reviewed'));

comment on column public.content_translation.translation_source is
  'TR-2′ (PRD §3.2.4, 2026-09-07 ceo-advisor 승인). human = operator-typed.
   ai = machine first-draft, not yet reviewed by a human — must stay
   status=''draft'' (TR-4″-1b/1c: no auto-publish of ai text). ai_reviewed =
   an ai draft a human has since edited/approved. TR-3′: rows with
   translation_source IN (''ai'',''ai_reviewed'') must never be used as
   matching/search evidence, regardless of locale or content type.';

comment on column public.content_category_translation.translation_source is
  'See public.content_translation.translation_source — identical semantics,
   TR-2′/TR-3′/TR-4″.';

comment on column public.standard_category_translation.translation_source is
  'See public.content_translation.translation_source — identical semantics.
   NOTE: this table currently has no upsert RPC (20260829150000''s own design
   intent — direct grant CRUD via app/admin/(protected)/categories/actions.ts,
   RLS is the real enforcement). Existing rows keep the ''human'' default
   un-backfilled — see this migration''s header / PR discussion for why the
   374-node ko/en/ja/zh dataset''s actual authorship could not be verified
   from any committed artifact.
   BACKLOG (qa-reviewer, 2026-09-07): unlike content_translation /
   content_category_translation, this table has NEITHER an RPC-level guard
   NOR a table-level CHECK against (translation_source=''ai'' and
   status=''published''). No real risk today (no AI-fill feature targets
   this table yet), but whoever builds an "AI 초벌 채우기" for standard
   categories MUST add the same guard (RPC raise + table CHECK, see
   content_translation_no_unreviewed_ai_publish below) before that ships —
   do not assume RLS alone will catch it, per this same review round''s
   finding on the other two tables.';


-- ---------------------------------------------------------------------------
-- 1a. Table-level CHECK constraints — the REAL enforcement boundary.
-- ---------------------------------------------------------------------------
-- qa-reviewer (2026-09-07, blocking): the RPC-level `raise exception` guard
-- added below only fires when writers go through the RPC. Both tables also
-- have `grant insert, update, delete ... to authenticated` with RLS policies
-- (`*_admin_update`) that check ONLY `is_active_admin() / is_aal2() /
-- has_menu_permission(...)` — they never inspect translation_source/status.
-- An admin-permissioned caller can therefore bypass the RPC entirely (e.g.
-- `supabase.from('content_translation').update({status:'published',
-- translation_source:'ai'})`) and RLS lets it through, defeating privacy-
-- security-officer's "우회 불가" requirement. A table-level CHECK is the only
-- boundary that holds regardless of write path (RPC or direct PostgREST
-- call) — this is now the actual defense; the RPC's raise exception is kept
-- only because it gives a clearer error message before the row ever hits
-- this constraint.
alter table public.content_translation
  add constraint content_translation_no_unreviewed_ai_publish
  check (not (translation_source = 'ai' and status = 'published'));

alter table public.content_category_translation
  add constraint content_category_translation_no_unreviewed_ai_publish
  check (not (translation_source = 'ai' and status = 'published'));


-- ---------------------------------------------------------------------------
-- 2. Extend upsert_content_translation / upsert_category_translation to
--    accept the new axis, reusing the SAME RPC rather than forking a second
--    one (design decision — see rationale below).
-- ---------------------------------------------------------------------------
--
-- Why extend in place instead of a separate RPC:
--   - Both the human-typed path (today's Admin UI) and the future "AI 초벌
--     채우기" button write to the exact same row shape and need the exact
--     same permission check / source_synced_at bookkeeping / audit log call.
--     A second RPC would duplicate ~90% of this function's body for a single
--     differing value.
--   - p_translation_source is OPTIONAL (default null) so every existing
--     call site (app/admin/(protected)/content/actions.ts) keeps working
--     unmodified — PostgREST calls Postgres functions with named arguments,
--     so an omitted trailing parameter simply takes its default.
--   - When the future AI-fill feature is built, it calls this SAME function
--     with p_translation_source := 'ai', p_status := 'draft' — satisfying
--     TR-4″-1b for free, with the existing audit trail (private.log_audit)
--     covering it automatically.
--   - Auto-promotion: when p_translation_source is NOT explicitly passed
--     (i.e. an operator saving through the normal Admin UI form) and the
--     row being overwritten was 'ai', this now promotes it to 'ai_reviewed'
--     — a human just edited/approved it through the normal save path, which
--     is exactly what 'ai_reviewed' means (TR-2′). Rows already 'human' or
--     'ai_reviewed' are left as-is. Brand new rows default to 'human'.
--   - BACKLOG (qa-reviewer, 2026-09-07, low priority): the ai->ai_reviewed
--     auto-promotion below does a SELECT (v_prev_source) then an INSERT ...
--     ON CONFLICT DO UPDATE in two separate statements — not atomic under
--     concurrent writers to the exact same (content_item_id, locale) /
--     (category_code, locale) row (TOCTOU). Not a real risk for Phase 0
--     (schema-only, no AI-fill feature writing concurrently yet), but once
--     an AI-fill feature increases write frequency on these rows, revisit
--     with `select ... for update` or a single atomic UPSERT expression
--     that derives translation_source from the pre-existing row inline.
--   - standard_category_translation is deliberately NOT given an RPC here —
--     that table has no RPC today by explicit prior design intent (see the
--     comment on that column above); introducing one is a bigger decision
--     than this Phase 0 schema ticket's scope. Its direct `.upsert()` calls
--     already work unmodified: they omit translation_source, so inserts take
--     the table default ('human') and updates leave the existing value
--     untouched (PostgREST only SETs the columns you pass). Flagged as an
--     open item below for whoever builds the AI-fill feature for categories.

drop function if exists public.upsert_content_translation(uuid, text, jsonb, text);

create function public.upsert_content_translation(
  p_content_item_id uuid,
  p_locale text,
  p_body jsonb,
  p_status text,
  p_translation_source text default null
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
  v_prev_source text;
  v_next_source text;
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

  if p_translation_source is not null and p_translation_source not in ('human', 'ai', 'ai_reviewed') then
    raise exception 'invalid_translation_source';
  end if;

  -- PSO-A (privacy-security-officer blocking review, 2026-09-07): TR-4″-1b/1c
  -- must be enforced at the DB layer, not left to caller discipline. An 'ai'
  -- first-draft can never be saved as 'published' in the same call — it must
  -- go through 'ai_reviewed' (a human touched it) before it can publish.
  -- 'ai_reviewed' + 'published' is explicitly allowed (review already happened).
  if p_translation_source = 'ai' and p_status = 'published' then
    raise exception 'translation_source=ai must be draft; publish only after human review (set ai_reviewed)';
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

  v_prev_source := v_before ->> 'translation_source';
  v_next_source := coalesce(
    p_translation_source,
    case when v_prev_source = 'ai' then 'ai_reviewed' else v_prev_source end,
    'human'
  );

  insert into public.content_translation
    (content_item_id, locale, body, status, source_synced_at, updated_by, translation_source)
  values (
    p_content_item_id, p_locale, p_body, p_status,
    case when p_locale = v_source_locale then now() else coalesce(v_source_updated_at, now()) end,
    v_admin_id, v_next_source
  )
  on conflict (content_item_id, locale) do update set
    body = excluded.body,
    status = excluded.status,
    source_synced_at = excluded.source_synced_at,
    updated_by = excluded.updated_by,
    translation_source = excluded.translation_source;

  perform private.log_audit(
    p_action := 'content.update',
    p_target_table := 'content_translation',
    p_target_id := p_content_item_id::text || ':' || p_locale,
    p_before_summary := v_before,
    p_after_summary := jsonb_build_object('status', p_status, 'translation_source', v_next_source)
  );
end;
$$;

revoke all on function public.upsert_content_translation(uuid, text, jsonb, text, text) from public;
grant execute on function public.upsert_content_translation(uuid, text, jsonb, text, text) to authenticated;


drop function if exists public.upsert_category_translation(text, text, text, jsonb, text);

create function public.upsert_category_translation(
  p_category_code text,
  p_locale text,
  p_name text,
  p_keywords jsonb,
  p_status text,
  p_translation_source text default null
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
  v_prev_source text;
  v_next_source text;
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

  if p_translation_source is not null and p_translation_source not in ('human', 'ai', 'ai_reviewed') then
    raise exception 'invalid_translation_source';
  end if;

  -- PSO-A (privacy-security-officer blocking review, 2026-09-07): see the
  -- identical guard in upsert_content_translation for the full rationale.
  if p_translation_source = 'ai' and p_status = 'published' then
    raise exception 'translation_source=ai must be draft; publish only after human review (set ai_reviewed)';
  end if;

  select id into v_admin_id from public.admin_user where auth_user_id = auth.uid();

  select ct.updated_at into v_source_updated_at
  from public.content_category_translation ct
  where ct.category_code = p_category_code and ct.locale = v_source_locale;

  select to_jsonb(t) into v_before
  from public.content_category_translation t
  where t.category_code = p_category_code and t.locale = p_locale;

  v_prev_source := v_before ->> 'translation_source';
  v_next_source := coalesce(
    p_translation_source,
    case when v_prev_source = 'ai' then 'ai_reviewed' else v_prev_source end,
    'human'
  );

  insert into public.content_category_translation
    (category_code, locale, name, keywords, status, source_synced_at, updated_by, translation_source)
  values (
    p_category_code, p_locale, p_name, coalesce(p_keywords, '[]'::jsonb), p_status,
    case when p_locale = v_source_locale then now() else coalesce(v_source_updated_at, now()) end,
    v_admin_id, v_next_source
  )
  on conflict (category_code, locale) do update set
    name = excluded.name,
    keywords = excluded.keywords,
    status = excluded.status,
    source_synced_at = excluded.source_synced_at,
    updated_by = excluded.updated_by,
    translation_source = excluded.translation_source;

  perform private.log_audit(
    p_action := 'content.update',
    p_target_table := 'content_category_translation',
    p_target_id := p_category_code || ':' || p_locale,
    p_before_summary := v_before,
    p_after_summary := jsonb_build_object('name', p_name, 'status', p_status, 'translation_source', v_next_source)
  );
end;
$$;

revoke all on function public.upsert_category_translation(text, text, text, jsonb, text, text) from public;
grant execute on function public.upsert_category_translation(text, text, text, jsonb, text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 3. Why the existing 374-node standard_category_translation data (ko/en/ja/zh)
--    is NOT backfilled to 'ai' — explicit judgment call, documented per this
--    task's instruction not to guess.
-- ---------------------------------------------------------------------------
--
-- An earlier internal review (docs/01-plan/features/google-translation-api-
-- evaluation.md §7, "0단계" table) proposed retroactively marking these rows
-- 'ai' ("이번에 LLM이 일괄 번역한 표준 카테고리 374노드 × en/ja/zh는 'ai'로
-- 소급 표기"). That document backs every OTHER factual claim it makes with an
-- explicit file:line citation from this codebase — this one claim is the only
-- exception, stated with no citation. Independently checking:
--   - No migration or committed script in this repo actually inserts the 374
--     rows (20260829150000's own header says the xlsx import is "OUT OF
--     SCOPE... a separate, future script/task", and no such script/migration
--     exists anywhere in git history for this repo).
--   - The commit that introduced this data (eecc83c, "SEEPN×FKP unified
--     platform...") describes it neutrally as "374-node standard category
--     taxonomy with ko/en/ja/zh translations" — it does not say who/what
--     authored the translations.
--   - The PRD (§3.5, L503) records the SOURCE xlsx as ko-only ("나라장터
--     기반... ko만, 실측 완료") — so en/ja/zh were added by *something* after
--     import, but no artifact in this repo records what.
-- In short: plausible, but not verifiable from anything checked into this
-- repo. Per this task's explicit instruction, an unverifiable retroactive
-- audit-trail edit is worse than leaving the honest "we don't actually know"
-- default. All existing rows keep translation_source='human' (the column
-- default). If real evidence turns up later (e.g. the actual prompt/session
-- log used to generate these translations), a dedicated follow-up migration
-- should make the correction explicitly, citing that evidence — not this one.

-- =============================================================================
-- End of translation_source migration.
-- =============================================================================
