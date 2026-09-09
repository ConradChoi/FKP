-- =============================================================================
-- Notice board (공지사항) — WS-1 core: blog -> notice defensive migration,
-- target_audience column + CHECK guardrails, create_content_item G-3 signature fix
-- =============================================================================
--
-- Design Ref:
--   - docs/01-plan/features/notice-board-v1.0.prd.md (v3.0 Final) §7.1 (content_type
--     CHECK), §7.2 (target_audience), §7.5 G-3 (create_content_item source_locale/
--     target_audience params, overload pitfall), G-4 (content_key prefix must move
--     together with content_type), §D-N0-3/D-N0-7 (물리적 전환 확정 — 게시된 블로그
--     글 0건 확인, 단 draft 행은 0건 보장 없음).
--   - docs/02-design/features/notice-board.screen-spec.md §2 (데이터 계약).
--   - docs/03-security/notice-board-privacy-review.md §0.2 NB-B5 ("target_audience CHECK
--     2종 + 기본값 없음을 create_content_item 시그니처 변경과 같은 마이그레이션에"),
--     §5 (NULL/오타 대상이 만드는 "조용한 미발행" 위험, DB CHECK가 유일한 차단 지점).
--
-- supabase/migrations/20260827100000_phase5_content_management_schema.sql has already
-- been edited in place (2026-09-08) to replace 'blog' with 'notice' in content_item's
-- inline content_type CHECK. On a from-scratch replay of all migrations, that edit alone
-- is sufficient — no 'blog' row can ever have existed. Section 1 below exists purely as a
-- defensive path for an environment where that file was already applied BEFORE this edit
-- landed (i.e. its content_item table still has the old CHECK that allows 'blog', and may
-- have leftover draft rows created through the app while it did) — on a from-scratch
-- replay, section 1 is a safe no-op (the constraint search finds nothing to drop, and the
-- UPDATE matches zero rows).
--
-- STATUS: not yet applied — run manually via Supabase console per this project's existing
-- workflow (repo memory: local-only verification during the SEEPN integration arc).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1a. target_audience column — added BEFORE the defensive backfill in 1b below needs to
--     reference it. No default value on purpose (PRD §7.2: "기본값이 있으면 대상을 고르지
--     않고 저장했을 때 조용히 잘못된 대상으로 발행된다"). Nullable at the column level —
--     the CHECK in section 2 is what actually forces non-null for content_type='notice';
--     every other content_type (landing_copy/case_study/faq) has no target_audience concept
--     and stays NULL forever.
-- ---------------------------------------------------------------------------

alter table public.content_item
  add column if not exists target_audience text;

comment on column public.content_item.target_audience is
  'Notice-only (content_type=''notice''). ''partner'' | ''seepn_user'' (see CHECK
   constraints below) — NULL for every other content_type. This is a DISPLAY filter, not
   an access-control axis: content_item/content_translation RLS is unchanged (notice-
   board-v1.0.prd.md §7.2, notice-board-privacy-review.md §3 NB-B3 — do not add a
   `to authenticated` SELECT policy to "fix" this, it would leak draft notices to every
   logged-in partner via the OR-combined admin policy).';


-- ---------------------------------------------------------------------------
-- 1b. Defensive content_type CHECK swap + residual 'blog' draft row migration
--     (no-op on a from-scratch replay — see file header).
--
-- qa-reviewer (2026-09-08, blocking, C-1 — reproduced against a real Docker Postgres with
-- the original pre-edit schema applied): the FIRST version of this migration dropped the
-- old 'blog'-permitting constraint and immediately re-added the new 'notice'-permitting one
-- in the SAME step, BEFORE the backfill UPDATE ran. `ADD CONSTRAINT` validates every
-- existing row at add-time — with residual content_type='blog' rows still present (not yet
-- converted), the new CHECK (which does not list 'blog') rejected them immediately
-- ("check constraint ... is violated by some row"), the ALTER TABLE failed, and the
-- transaction rolled back, leaving the OLD constraint in place — so subsequent notice
-- creation would fail too, forever, until fixed. Fix: DROP the old constraint (step 1b-i)
-- and RE-ADD the new one (step 1b-iii) as two separate steps, with the backfill UPDATE
-- (step 1b-ii) running strictly BETWEEN them, in the window where the table has no
-- content_type CHECK at all — so the backfill's own writes can't violate anything, and by
-- the time the new CHECK is added back, no 'blog' row exists to violate it.
-- ---------------------------------------------------------------------------

-- 1b-i. Drop the old constraint IF it's still the 'blog'-permitting one (already-applied-DB
-- path only — on a from-scratch replay this finds nothing and is a no-op, since
-- 20260827100000 was edited in place to create the table with the 'notice'-permitting CHECK
-- from the start).
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.content_item'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%content_type%'
    and pg_get_constraintdef(oid) like '%blog%';

  if v_conname is not null then
    execute format('alter table public.content_item drop constraint %I', v_conname);
  end if;
end $$;

-- 1b-ii. Residual draft rows: 0 PUBLISHED blog posts were confirmed (D-N0-7), but draft rows
-- were never guaranteed to be 0, and local/staging DB state can differ from that
-- confirmation. Any content_type='blog' row still present at this point (only reachable via
-- the already-applied-DB path handled above — a from-scratch replay never allowed a 'blog'
-- row to be inserted in the first place) is converted to 'notice' AND its content_key prefix
-- is rewritten in the SAME statement (G-4 — slugFromContentKey() in
-- app/admin/(protected)/board/actions.ts slices content_key by `contentType.length + 1`;
-- leaving content_key='blog.xxx' while content_type='notice' would silently corrupt the
-- derived slug to 'g.xxx'). Safe to run unconditionally here regardless of which path was
-- taken above: on a from-scratch replay this matches 0 rows.
--
-- target_audience is set to 'partner' (not left NULL) here because step 2 below adds a CHECK
-- requiring every content_type='notice' row to have a non-null target_audience, and these
-- pre-existing rows predate that concept entirely — something has to be picked. 'partner' is
-- the lower-blast-radius choice: it has an actual consumption screen (/supplier/notices)
-- where a mis-tagged leftover draft is visibly wrong and gets corrected, whereas
-- 'seepn_user' has no consumption screen yet (Phase 1) and a wrong tag there could sit
-- unnoticed indefinitely (this is exactly N-R6's own rationale for why 'seepn_user' needs an
-- explicit "nobody can see this yet" warning in the admin UI).
update public.content_item
set content_type = 'notice',
    content_key = 'notice.' || substring(content_key from length('blog.') + 1),
    target_audience = 'partner'
where content_type = 'blog';

-- 1b-iii. Re-add the constraint only if it isn't already there (from-scratch replay already
-- has an equivalent 'notice'-permitting CHECK from table creation — adding a second one with
-- the same name would fail with "constraint already exists"). By this point no 'blog' row
-- can remain (converted in 1b-ii above), so this ADD CONSTRAINT's validation pass always
-- succeeds.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.content_item'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%content_type%'
      and pg_get_constraintdef(oid) not like '%blog%'
  ) then
    execute $sql$alter table public.content_item add constraint content_item_content_type_check
      check (content_type in ('landing_copy', 'notice', 'case_study', 'faq'))$sql$;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 2. target_audience CHECK x2 (PRD §7.2, N-R1; privacy review NB-B5/§5.2) — added AFTER
--    the backfill above so existing 'notice' rows (freshly converted or otherwise) already
--    satisfy the not-null-for-notice constraint at ADD CONSTRAINT validation time.
-- ---------------------------------------------------------------------------
-- privacy-security-officer (2026-09-08, NB-B5) — "두 개 다 필요하다": the allow-list CHECK
-- alone lets NULL through (fail-open for a notice with no audience chosen -> "조용한
-- 미발행", §5.1); the not-null-for-notice CHECK alone lets typos like 'partners' through
-- (that value matches no application filter either, same silent-non-display failure).
-- Only together do they make an out-of-range or missing target_audience impossible to
-- persist for a notice row.

alter table public.content_item
  add constraint chk_content_item_target_audience_values
    check (target_audience is null or target_audience in ('seepn_user', 'partner'));

alter table public.content_item
  add constraint chk_content_item_notice_requires_audience
    check (content_type <> 'notice' or target_audience is not null);

-- PRD §7.2 "인덱스: 검토" — /supplier/notices (screen-spec §4.2/§4.3) and the future
-- seepn.me consumption screen both always filter on exactly this tuple; cheap to add now.
create index if not exists idx_content_item_notice_audience
  on public.content_item (content_type, target_audience, is_active, sort_order);


-- ---------------------------------------------------------------------------
-- 3. create_content_item — G-3: accept p_source_locale + p_target_audience.
-- ---------------------------------------------------------------------------
-- PRD §7.5 G-3 pitfall: appending a defaulted parameter risks creating an overload
-- instead of cleanly replacing the function. DROP first, then CREATE, so there is exactly
-- one create_content_item(text,text,integer,boolean,text,text) afterward — no ambiguous-
-- overload resolution risk for the 2 existing call sites (createArticleAction /
-- createFaqAction in app/admin/(protected)/board/actions.ts), which only ever pass
-- p_content_type / p_content_key / p_sort_order by name and rely on defaults for the rest
-- — they keep working completely unmodified (p_source_locale defaults to 'en', matching
-- their current always-en behavior exactly; p_target_audience defaults to null, which is
-- valid for their content types since neither case_study nor faq is 'notice').
--
-- Every notice created going forward MUST be created via an explicit
-- p_source_locale := 'ko' call (PRD §3.1 — "모든 공지의 원문 로케일은 ko다") and an
-- explicit p_target_audience (no default — same "no silent default" rationale as the
-- column itself). Building that call site (a createNoticeAction or equivalent) is admin
-- screen work tracked separately from this schema/RPC change.
drop function if exists public.create_content_item(text, text, integer, boolean);

create function public.create_content_item(
  p_content_type text,
  p_content_key text,
  p_sort_order integer,
  p_is_active boolean default true,
  p_source_locale text default 'en',
  p_target_audience text default null
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

  insert into public.content_item
    (content_type, content_key, sort_order, is_active, source_locale, target_audience)
  values (
    p_content_type, p_content_key, p_sort_order, p_is_active,
    coalesce(p_source_locale, 'en'), p_target_audience
  )
  returning id into v_id;

  perform private.log_audit(
    p_action := 'content.create',
    p_target_table := 'content_item',
    p_target_id := p_content_key
  );

  return v_id;
end;
$$;

grant execute on function public.create_content_item(text, text, integer, boolean, text, text) to authenticated;

-- =============================================================================
-- End of notice board core migration.
-- =============================================================================
