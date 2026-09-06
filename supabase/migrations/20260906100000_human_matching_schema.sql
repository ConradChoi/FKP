-- =============================================================================
-- SEEPN x FKP Human Matching (P4) — `/admin/leads/[id]` "매칭" 탭 schema
-- =============================================================================
--
-- Ground truth for every decision in this file:
--   - docs/02-design/features/human-matching.screen-spec.md
--     (§2 concept model is a DRAFT — superseded below wherever it conflicts
--     with the privacy review; see inline notes)
--   - docs/03-security/human-matching-privacy-review.md (THE decision record:
--     SP-M1/§2, SP-M2/§3, SP-M3/§4, HM-B1..B6)
--   - docs/03-security/human-matching-ceo-decision.md (ceo-advisor, same day:
--     HM-B5 resolved via a 2-stage introduction process — stage 1 = company
--     info only, no consent needed; stage 2 = contact-person hand-off,
--     per-instance offline consent required. Adds 2 columns + 1 RPC + 1
--     audit action to this same migration, per that memo §4 item 1 — does
--     NOT reopen HM-B1..B4/B6 or SP-M1..M3, which stand as decided)
--
-- Key decisions actually implemented here (see the privacy review for the
-- full reasoning — not re-derived here):
--   1. match.requirement_id / match_shortlist_confirmation.requirement_id are
--      NULLABLE with ON DELETE SET NULL (never CASCADE, never RESTRICT —
--      RESTRICT would silently kill the ENTIRE daily retention batch the
--      moment any lead with a match hits its closed/30-day hard-delete
--      window, per privacy review F-M4). match.partner_id is
--      ON DELETE RESTRICT (partner rows are never hard-deleted, F-M12).
--   2. match snapshots ONLY non-PII structural fields (category / locale /
--      english_speaking / vertical / country placeholders / status-at-
--      detach). It is STRUCTURALLY IMPOSSIBLE to snapshot the forbidden
--      fields (what_looking_for / purpose / description /
--      company_name_website / contact / internal_note / consent_ip) because
--      no column for them exists on this table — this is deliberate, do not
--      add one.
--   3. match_shortlist_confirmation.requirement_created_at (month-truncated)
--      is captured at confirm time so "Time to Shortlist" survives the
--      requirement's own hard-delete.
--   4. Free-text columns (selection_memo / exclusion_memo / meeting_note /
--      match_outcome_event.note) are nulled out (a) immediately on
--      requirement hard-delete (BEFORE DELETE trigger below), (b) in the
--      same batch as the requirement's 12/24mo anonymization, and (c) by an
--      independent 24-month backstop batch for any orphan that slipped past
--      (a)/(b). (c) is REQUIRED to run as its own fault-isolated block per
--      privacy review §3.3 — never merged into run_requests_retention_batch().
--   5. `closed` lead-status transitions are NEVER blocked by the presence of
--      match rows (only warned about, via the audit summary) — see
--      update_lead_status() below.
--
-- RLS pattern decision (task asked to judge this from existing precedent):
--   Reads: direct RLS SELECT to `authenticated`, gated by the same 3-factor
--   check (`is_active_admin() AND is_aal2() AND has_menu_permission(
--   'lead_management','read')`) as `public.requests` (20260825120000 §11 —
--   `requests_admin_select`). This mirrors the "leads" convention, not the
--   partner self-registration convention, because the matching tab reads
--   match data the same way the overview tab reads lead data.
--   Writes: NO column GRANTs to `authenticated` at all (stricter than
--   `requests`, which grants a direct UPDATE on status/assignee_id). Every
--   mutation on match/match_shortlist_confirmation/match_outcome_event has a
--   side effect that must not be skippable (tag-vocabulary + memo pairing,
--   Top3 rank bookkeeping, is_confirmed_top3 cascade-unset, current_outcome_
--   state cache sync, audit logging) — a direct-UPDATE escape hatch would
--   let those be silently bypassed, unlike `requests.status`/`assignee_id`
--   which have no such side effects. All 6 RPCs below are SECURITY DEFINER
--   (owned by the migration role) and therefore do not need a table GRANT to
--   execute their writes; the RLS INSERT/UPDATE/DELETE policies below are
--   explicit `deny` and exist only as defense-in-depth documentation of
--   intent (INV-8), exactly like `requests_deny_insert`/`requests_deny_delete`.
--
-- =============================================================================
-- DEPLOYMENT CHECKLIST (do NOT skip — read before flipping this feature on)
-- =============================================================================
--   [ ] HM-B3 / privacy review §4.2: grant `partner_management` `can_read =
--       true` (ONLY read, never create/update/delete/export) to whichever
--       role does matching work, via /admin/permissions/matrix
--       (`set_role_menu_permission`) — a human decision, deliberately NOT
--       seeded by this migration (privacy review §4.2 item 2 / F-M10/F-M11:
--       "부여 방법은 마이그레이션 시드가 아니라 /admin/permissions/matrix 화면").
--       Without this grant, F-M8 means the candidate search panel returns
--       ZERO rows for that role — not a partial degradation, a total outage
--       of the matching tab's core function.
--   [ ] Confirm pg_cron still runs `private.run_daily_retention_batches()`
--       daily (unchanged schedule) — this file adds a new independent block
--       to it (`private.purge_orphan_match_freetext()`) but does not touch
--       the cron registration itself.
--   [ ] HM-B5 (third-party sharing): per human-matching-ceo-decision.md, the
--       `third_party_share_*` / `consent_scope` / `evidence_kind` columns are
--       now WRITABLE via `match_record_third_party_consent()` (not schema-only
--       placeholders anymore). frontend must add the "파트너 동의 기록" button
--       + modal, and gate stage-2 contact hand-off on this record actually
--       existing (operational discipline, not a DB-level block in v1.0).
--       Legal review gate is now: 20 stage-2 connections, OR before P3/P5
--       launch, OR 2026-11-30 — whichever comes first (ceo-decision §5).
--   [ ] Run the P4 DoD gate checklist in human-matching-privacy-review.md §7
--       against a staging environment before enabling this for real leads.
-- =============================================================================


-- =============================================================================
-- §1. public.match — Requirement x Partner candidate/judgment/Top3 state
-- =============================================================================

create table if not exists public.match (
  id uuid primary key default gen_random_uuid(),

  -- --- requirement linkage (privacy review §2-(1)/(2)) -----------------------
  requirement_id uuid references public.requests (id) on delete set null,
  -- Non-FK copy of requirement_id, captured at INSERT time, so a match stays
  -- traceable by id even after requirement_id is nulled out by the FK action
  -- above. This is NOT PII — a bare uuid identifies nothing once the row it
  -- pointed to is gone (privacy review §2-(2) note).
  requirement_ref_id uuid not null,
  requirement_detached_at timestamptz,
  -- requests.status snapshotted the instant the requirement row is
  -- hard-deleted (set by trg_requests_before_delete_detach_matches below).
  -- NULL while requirement_id is still valid (read requests.status directly).
  requirement_status_at_snapshot text
    check (requirement_status_at_snapshot is null or requirement_status_at_snapshot in (
      'new', 'reviewing', 'matching', 'matched', 'on_hold', 'closed'
    )),

  -- --- non-PII structural snapshot (privacy review §2-(2) "스냅샷 허용" row) --
  -- Captured once, at candidate_add time, from public.requests. Every field
  -- here is a closed-vocabulary code or a boolean, never free text.
  requirement_category text
    check (requirement_category is null or requirement_category in (
      'education', 'it-ai', 'content-media', 'beauty-lifestyle', 'business-services'
    )),
  -- requirement_vertical / requirement_country stay NULL until requests
  -- gains the corresponding columns (screen-spec G-3 / G-2 are still open).
  -- Columns exist now so no further migration is needed once those Gaps
  -- close — backend-developer just has to start populating them.
  requirement_vertical text check (requirement_vertical is null or requirement_vertical in ('product', 'service')),
  requirement_country text,
  requirement_locale text check (requirement_locale is null or requirement_locale in ('en', 'ja')),
  requirement_english_speaking text
    check (requirement_english_speaking is null or requirement_english_speaking in (
      'required', 'preferred', 'not-needed'
    )),

  -- --- partner linkage --------------------------------------------------------
  partner_id uuid not null references public.partner (id) on delete restrict,

  -- --- judgment (M-R3/M-R4/M-R5) ----------------------------------------------
  judge_status text not null default 'pending'
    check (judge_status in ('pending', 'shortlisted', 'excluded')),
  -- Fixed vocabulary CHECK, byte-identical to lib/admin/matchTags.ts
  -- (screen-spec §3.2: vocabulary changes are a code deploy, never free
  -- input — keep both lists in sync by hand when that happens).
  selection_tags text[] not null default '{}'::text[]
    check (selection_tags <@ array[
      '카테고리 적합', 'MOQ 충족', '언어 대응', '해외경험',
      '인증 보유', '가격대 적합', '납기 적합', '응답 이력 양호'
    ]::text[]),
  selection_memo text check (selection_memo is null or char_length(selection_memo) <= 500),
  exclusion_tags text[] not null default '{}'::text[]
    check (exclusion_tags <@ array[
      'MOQ 미달', '카테고리 불일치', '언어 미대응', '응답 없음',
      '가격 불일치', '납기 불가', '파트너 거절', '중복'
    ]::text[]),
  exclusion_memo text check (exclusion_memo is null or char_length(exclusion_memo) <= 500),
  judged_by_admin_id uuid references public.admin_user (id) on delete restrict,
  judged_at timestamptz,

  added_by_admin_id uuid not null references public.admin_user (id) on delete restrict,
  added_at timestamptz not null default now(),

  -- --- Top3 (M-R6) -------------------------------------------------------------
  is_confirmed_top3 boolean not null default false,
  confirmed_rank smallint check (confirmed_rank is null or confirmed_rank between 1 and 3),

  -- --- Outcome cache (M-R7, kept in sync by trg_match_outcome_event_sync_*) ---
  current_outcome_state text
    check (current_outcome_state is null or current_outcome_state in (
      'recommended', 'viewed', 'responded', 'meeting', 'quote', 'sample',
      'negotiation', 'deal', 'repeat'
    )),

  -- --- Outcome detail fields (M-R8, OQ-9: all optional) -------------------------
  meeting_date date,
  meeting_note text check (meeting_note is null or char_length(meeting_note) <= 500),
  quote_amount numeric(14, 2) check (quote_amount is null or quote_amount >= 0),
  quote_currency text check (quote_currency is null or char_length(quote_currency) = 3),
  deal_flag boolean not null default false,
  deal_amount numeric(14, 2) check (deal_amount is null or deal_amount >= 0),
  deal_currency text check (deal_currency is null or char_length(deal_currency) = 3),

  -- --- HM-B5 (privacy review §5 + human-matching-ceo-decision.md §1/§4) -------
  -- ceo-advisor 2026-09-06: 2-stage introduction process adopted (stage 1 =
  -- company info only, no consent needed; stage 2 = contact-person details,
  -- per-instance consent required before hand-off). These columns record
  -- the FACT that stage-2 consent was obtained (offline call), written only
  -- by match_record_third_party_consent() below — never by direct UPDATE.
  third_party_share_consent_at timestamptz,
  third_party_share_consent_method text
    check (third_party_share_consent_method is null or third_party_share_consent_method in (
      'online_self', 'phone', 'in_person', 'email'
    )),
  third_party_share_recorded_by_admin_id uuid references public.admin_user (id) on delete restrict,
  -- ceo-decision §4 item 1: which contact-person data items the partner
  -- consented to share (e.g. name/title/email/phone) — §2 of that memo's
  -- "범위 최소화 기본값" (name/title/work-email by default, phone only if
  -- the partner volunteers it).
  consent_scope text[] not null default '{}'::text[]
    check (consent_scope <@ array['name', 'title', 'email', 'phone']::text[]),
  -- ceo-decision §3 근거3: how the consent was evidenced — a confirmation
  -- email materially raises proof strength over a verbal-only record.
  evidence_kind text check (evidence_kind is null or evidence_kind in (
    'email_thread', 'verbal_only', 'other'
  )),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- screen-spec §2.1 / privacy review §0.4 last row: NULL requirement_id
  -- values never collide with each other here (Postgres unique constraints
  -- treat NULL as distinct) — orphaned matches can stack up freely, which is
  -- the intended behavior, not a bug.
  constraint uq_match_requirement_partner unique (requirement_id, partner_id)
);

comment on table public.match is
  'Requirement x Partner candidate/judgment/Top3/outcome state (P4 human '
  'matching). MUST NEVER gain a column copying requests.what_looking_for / '
  'purpose / description / company_name_website / contact, or '
  'private.request_meta.internal_note / consent_ip — see '
  'docs/03-security/human-matching-privacy-review.md §2-(2) "스냅샷 금지". '
  'requirement_id is nullable + ON DELETE SET NULL by design (F-M4): never '
  'change this to CASCADE (destroys the Match-to-Meeting/Time-to-Shortlist '
  'data source) or RESTRICT (silently kills the whole daily retention batch).';

comment on column public.match.requirement_ref_id is
  'Non-FK copy of requirement_id captured at row creation. Survives '
  'requirement_id being SET NULL on requirement hard-delete. A bare uuid '
  'with no live referent is not personal data.';

create index if not exists idx_match_requirement_id on public.match (requirement_id);
create index if not exists idx_match_requirement_ref_id on public.match (requirement_ref_id);
create index if not exists idx_match_partner_id on public.match (partner_id);
create index if not exists idx_match_judge_status on public.match (judge_status);
create index if not exists idx_match_is_confirmed_top3 on public.match (requirement_id, is_confirmed_top3) where is_confirmed_top3 = true;
create index if not exists idx_match_requirement_detached_at on public.match (requirement_detached_at) where requirement_detached_at is not null;

alter table public.match enable row level security;
alter table public.match force row level security;


-- =============================================================================
-- §2. public.match_shortlist_confirmation — Top3 confirmation event log (M-R6)
-- =============================================================================
-- Append-only by convention (no UPDATE/DELETE RPC or grant exists for it
-- anywhere in this file) so "is_initial" / Time to Shortlist can never be
-- retroactively altered.

create table if not exists public.match_shortlist_confirmation (
  id uuid primary key default gen_random_uuid(),

  requirement_id uuid references public.requests (id) on delete set null,
  requirement_ref_id uuid not null,
  -- privacy review §2-(3): REQUIRED, not optional. Month-truncated per the
  -- same re-identification-risk reasoning already applied to
  -- requests.created_at in the anonymization batch (20260825120000 §14).
  -- This is what lets "Time to Shortlist" still be computed after the
  -- requirement row itself has been hard-deleted.
  requirement_created_at timestamptz not null,

  confirmed_match_ids uuid[] not null
    check (array_length(confirmed_match_ids, 1) between 1 and 3),
  confirmed_by_admin_id uuid not null references public.admin_user (id) on delete restrict,
  confirmed_at timestamptz not null default now(),
  -- True only for the very first confirmation event of a given requirement.
  -- Time to Shortlist = min(confirmed_at) where is_initial = true, i.e. this
  -- row's confirmed_at, minus requirement_created_at.
  is_initial boolean not null default false,

  created_at timestamptz not null default now()
);

comment on table public.match_shortlist_confirmation is
  'Append-only Top3 confirmation event log (M-R6). confirmed_match_ids '
  'references public.match.id values by VALUE, not FK — a match row being '
  'later removed from the candidate list must not be able to fail or cascade '
  'into this historical record.';

create index if not exists idx_match_shortlist_confirmation_requirement_id
  on public.match_shortlist_confirmation (requirement_id);
create index if not exists idx_match_shortlist_confirmation_confirmed_match_ids
  on public.match_shortlist_confirmation using gin (confirmed_match_ids);
create index if not exists idx_match_shortlist_confirmation_initial
  on public.match_shortlist_confirmation (requirement_id, confirmed_at) where is_initial = true;

alter table public.match_shortlist_confirmation enable row level security;
alter table public.match_shortlist_confirmation force row level security;


-- =============================================================================
-- §3. public.match_outcome_event — Outcome transition history (M-R7/M-R8)
-- =============================================================================
-- Append-only: "단조 진행 강제 금지" / revisit-without-losing-history means
-- there is no UPDATE path for this table anywhere in this file, by design.

create table if not exists public.match_outcome_event (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.match (id) on delete restrict,

  outcome_state text not null check (outcome_state in (
    'recommended', 'viewed', 'responded', 'meeting', 'quote', 'sample',
    'negotiation', 'deal', 'repeat'
  )),
  -- Operator-editable, can be backdated (screen-spec §6.4: "과거 일자 입력
  -- 가능") — this is the business-meaningful timestamp.
  transitioned_at timestamptz not null default now(),
  note text check (note is null or char_length(note) <= 500),

  -- recorded_at is the immutable, non-editable "when was this actually typed
  -- in" audit timestamp — distinct from transitioned_at by design.
  recorded_by_admin_id uuid not null references public.admin_user (id) on delete restrict,
  recorded_at timestamptz not null default now()
);

comment on table public.match_outcome_event is
  'Append-only Outcome transition history (M-R7/M-R8). match_id is '
  'ON DELETE RESTRICT (not CASCADE): a match row with recorded outcome '
  'history cannot be silently deleted by match_candidate_remove — see that '
  'function''s explicit pre-check below.';

create index if not exists idx_match_outcome_event_match_id
  on public.match_outcome_event (match_id, transitioned_at desc);

alter table public.match_outcome_event enable row level security;
alter table public.match_outcome_event force row level security;


-- =============================================================================
-- §4. RLS policies (read: direct SELECT; write: explicit deny, RPC-only)
-- =============================================================================

create policy match_admin_select on public.match
  for select to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('lead_management', 'read'))
  );

create policy match_deny_insert on public.match for insert to public with check (false);
create policy match_deny_update on public.match for update to public using (false) with check (false);
create policy match_deny_delete on public.match for delete to public using (false);

create policy match_shortlist_confirmation_admin_select on public.match_shortlist_confirmation
  for select to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('lead_management', 'read'))
  );

create policy match_shortlist_confirmation_deny_insert on public.match_shortlist_confirmation for insert to public with check (false);
create policy match_shortlist_confirmation_deny_update on public.match_shortlist_confirmation for update to public using (false) with check (false);
create policy match_shortlist_confirmation_deny_delete on public.match_shortlist_confirmation for delete to public using (false);

create policy match_outcome_event_admin_select on public.match_outcome_event
  for select to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('lead_management', 'read'))
  );

create policy match_outcome_event_deny_insert on public.match_outcome_event for insert to public with check (false);
create policy match_outcome_event_deny_update on public.match_outcome_event for update to public using (false) with check (false);
create policy match_outcome_event_deny_delete on public.match_outcome_event for delete to public using (false);

-- Read grants: no column contains raw PII (contact/internal_note/etc. are
-- structurally absent from these tables — see §1/§2/§3 comments), so a full
-- column grant is safe, unlike public.requests' contact-column exclusion.
revoke all on public.match, public.match_shortlist_confirmation, public.match_outcome_event from anon, authenticated;
grant select on public.match to authenticated;
grant select on public.match_shortlist_confirmation to authenticated;
grant select on public.match_outcome_event to authenticated;
-- Deliberately NO insert/update/delete grant to authenticated on any of the
-- three tables above — see the RLS pattern note at the top of this file.


-- =============================================================================
-- §5. updated_at triggers + Outcome-state cache sync trigger
-- =============================================================================

drop trigger if exists trg_match_set_updated_at on public.match;
create trigger trg_match_set_updated_at
  before update on public.match
  for each row execute function private.set_updated_at();

create or replace function public.match_outcome_event_sync_current_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.match
  set current_outcome_state = new.outcome_state,
      updated_at = now()
  where id = new.match_id;
  return new;
end;
$$;

comment on function public.match_outcome_event_sync_current_state is
  'screen-spec §2.1: match.current_outcome_state is a cache of "the most '
  'recently RECORDED outcome event" (insertion order), not the '
  'chronologically-latest transitioned_at (events can be backdated) — '
  'matches the "노드 클릭 = 지금 이 상태로 표시" UI behavior in §6.4.';

drop trigger if exists trg_match_outcome_event_sync_current_state on public.match_outcome_event;
create trigger trg_match_outcome_event_sync_current_state
  after insert on public.match_outcome_event
  for each row execute function public.match_outcome_event_sync_current_state();


-- =============================================================================
-- §6. RPC — public.match_candidate_add (M-R2, audit action match.candidate_add)
-- =============================================================================

create or replace function public.match_candidate_add(
  p_requirement_id uuid,
  p_partner_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_admin_id uuid;
  v_req record;
  v_match_id uuid;
begin
  if not (
    private.is_active_admin(v_auth_uid)
    and private.is_aal2()
    and private.has_menu_permission('lead_management', 'create', v_auth_uid)
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  select au.id into v_admin_id from public.admin_user au where au.auth_user_id = v_auth_uid;

  select id, category, locale, english_speaking, status
    into v_req
    from public.requests
    where id = p_requirement_id;

  if v_req.id is null then
    raise exception 'requirement_not_found' using errcode = 'P0002';
  end if;

  -- screen-spec §9 edge case 9: no new candidates once a lead is closed.
  if v_req.status = 'closed' then
    raise exception 'requirement_closed';
  end if;

  if not exists (select 1 from public.partner p where p.id = p_partner_id) then
    raise exception 'partner_not_found' using errcode = 'P0002';
  end if;

  insert into public.match (
    requirement_id, requirement_ref_id, partner_id,
    requirement_category, requirement_locale, requirement_english_speaking,
    added_by_admin_id
  ) values (
    v_req.id, v_req.id, p_partner_id,
    v_req.category, v_req.locale, v_req.english_speaking,
    v_admin_id
  )
  on conflict (requirement_id, partner_id) do nothing
  returning id into v_match_id;

  -- screen-spec §9 edge case 4: uniqueness is also enforced client-side
  -- (button becomes disabled), this is the second layer of defense.
  if v_match_id is null then
    raise exception 'match_already_exists' using errcode = '23505';
  end if;

  perform private.log_audit(
    p_action := 'match.candidate_add',
    p_target_table := 'match',
    p_target_id := v_match_id::text,
    p_subject_ids := array[p_partner_id],
    p_after_summary := jsonb_build_object('requirement_id', p_requirement_id)
  );

  return v_match_id;
end;
$$;

revoke all on function public.match_candidate_add(uuid, uuid) from public;
grant execute on function public.match_candidate_add(uuid, uuid) to authenticated;


-- =============================================================================
-- §7. RPC — public.match_candidate_remove (audit action match.candidate_remove)
-- =============================================================================

create or replace function public.match_candidate_remove(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_partner_id uuid;
  v_requirement_id uuid;
begin
  if not (
    private.is_active_admin(v_auth_uid)
    and private.is_aal2()
    and private.has_menu_permission('lead_management', 'update', v_auth_uid)
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  select partner_id, requirement_id into v_partner_id, v_requirement_id
  from public.match where id = p_match_id;

  if v_partner_id is null then
    raise exception 'match_not_found' using errcode = 'P0002';
  end if;

  -- match_outcome_event.match_id is ON DELETE RESTRICT — this pre-check just
  -- turns that into a friendly error instead of a raw FK violation.
  if exists (select 1 from public.match_outcome_event where match_id = p_match_id) then
    raise exception 'match_has_outcome_history';
  end if;

  delete from public.match where id = p_match_id;

  perform private.log_audit(
    p_action := 'match.candidate_remove',
    p_target_table := 'match',
    p_target_id := p_match_id::text,
    p_subject_ids := array[v_partner_id],
    p_before_summary := jsonb_build_object('requirement_id', v_requirement_id)
  );
end;
$$;

revoke all on function public.match_candidate_remove(uuid) from public;
grant execute on function public.match_candidate_remove(uuid) to authenticated;


-- =============================================================================
-- §8. RPC — public.match_judge (M-R3/M-R4/M-R5, audit action match.judge)
-- =============================================================================
-- Single transaction: judge_status + tags + memo saved together, per
-- screen-spec §6.2 "판정+태그+메모를 한 번에 저장(RPC 1회)" / §9 edge case 7
-- "부분 저장 없음(RPC 트랜잭션 1개)".

create or replace function public.match_judge(
  p_match_id uuid,
  p_judge_status text,
  p_tags text[] default '{}'::text[],
  p_memo text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_admin_id uuid;
  v_row public.match%rowtype;
  v_requirement_status text;
begin
  if not (
    private.is_active_admin(v_auth_uid)
    and private.is_aal2()
    and private.has_menu_permission('lead_management', 'update', v_auth_uid)
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if p_judge_status not in ('pending', 'shortlisted', 'excluded') then
    raise exception 'invalid_judge_status';
  end if;

  select * into v_row from public.match where id = p_match_id;
  if v_row.id is null then
    raise exception 'match_not_found' using errcode = 'P0002';
  end if;

  if v_row.requirement_id is null then
    raise exception 'requirement_detached';
  end if;

  select status into v_requirement_status from public.requests where id = v_row.requirement_id;
  if v_requirement_status = 'closed' then
    raise exception 'requirement_closed';
  end if;

  -- screen-spec §3.2/§6.2: tags and memo are BOTH required together for a
  -- shortlisted/excluded judgment; tag-vocabulary itself is enforced by the
  -- table's CHECK constraints (selection_tags/exclusion_tags <@ fixed list).
  if p_judge_status in ('shortlisted', 'excluded') then
    if p_tags is null or coalesce(array_length(p_tags, 1), 0) = 0 then
      raise exception 'tags_required';
    end if;
    if p_memo is null or length(btrim(p_memo)) = 0 then
      raise exception 'memo_required';
    end if;
    if char_length(p_memo) > 500 then
      raise exception 'memo_too_long';
    end if;
  end if;

  select au.id into v_admin_id from public.admin_user au where au.auth_user_id = v_auth_uid;

  if p_judge_status = 'shortlisted' then
    update public.match
    set judge_status = 'shortlisted',
        selection_tags = p_tags,
        selection_memo = p_memo,
        judged_by_admin_id = v_admin_id,
        judged_at = now()
    where id = p_match_id;
  elsif p_judge_status = 'excluded' then
    -- screen-spec §9 edge case 6: excluding an already-confirmed Top3
    -- candidate also un-confirms it. Outcome history (if any) is untouched.
    update public.match
    set judge_status = 'excluded',
        exclusion_tags = p_tags,
        exclusion_memo = p_memo,
        judged_by_admin_id = v_admin_id,
        judged_at = now(),
        is_confirmed_top3 = false,
        confirmed_rank = null
    where id = p_match_id;
  else
    update public.match
    set judge_status = 'pending',
        judged_by_admin_id = v_admin_id,
        judged_at = now()
    where id = p_match_id;
  end if;

  -- privacy review HM-R2 / screen-spec §10: fact-of-change only in the audit
  -- record — tags are structured labels, the memo BODY must never appear
  -- here.
  perform private.log_audit(
    p_action := 'match.judge',
    p_target_table := 'match',
    p_target_id := p_match_id::text,
    p_subject_ids := array[v_row.partner_id],
    p_after_summary := jsonb_build_object(
      'judge_status', p_judge_status,
      'tags', case when p_judge_status <> 'pending' then to_jsonb(p_tags) else null end
    )
  );
end;
$$;

revoke all on function public.match_judge(uuid, text, text[], text) from public;
grant execute on function public.match_judge(uuid, text, text[], text) to authenticated;


-- =============================================================================
-- §9. RPC — public.match_shortlist_confirm (M-R6, audit action match.shortlist_confirm)
-- =============================================================================

create or replace function public.match_shortlist_confirm(
  p_requirement_id uuid,
  p_match_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_admin_id uuid;
  v_req record;
  v_is_initial boolean;
  v_confirmation_id uuid;
  v_confirmed_at timestamptz := now();
  v_partner_ids uuid[];
  v_bad_count integer;
  v_found_count integer;
begin
  if not (
    private.is_active_admin(v_auth_uid)
    and private.is_aal2()
    and private.has_menu_permission('lead_management', 'update', v_auth_uid)
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  -- screen-spec §6.3: 1~3 candidates, no duplicates.
  if p_match_ids is null or coalesce(array_length(p_match_ids, 1), 0) < 1
     or array_length(p_match_ids, 1) > 3 then
    raise exception 'invalid_match_count';
  end if;

  if array_length(p_match_ids, 1) <> (select count(distinct x) from unnest(p_match_ids) as x) then
    raise exception 'duplicate_match_ids';
  end if;

  select id, status, created_at into v_req from public.requests where id = p_requirement_id;
  if v_req.id is null then
    raise exception 'requirement_not_found' using errcode = 'P0002';
  end if;
  if v_req.status = 'closed' then
    raise exception 'requirement_closed';
  end if;

  select count(*) into v_found_count from public.match where id = any (p_match_ids);
  if v_found_count <> array_length(p_match_ids, 1) then
    raise exception 'match_not_found' using errcode = 'P0002';
  end if;

  -- screen-spec §9 edge case 5: only shortlisted candidates of THIS
  -- requirement may be confirmed — enforced here even though the UI already
  -- restricts the modal's choices to shortlisted-only.
  select count(*) into v_bad_count
  from public.match
  where id = any (p_match_ids)
    and (requirement_id is distinct from p_requirement_id or judge_status <> 'shortlisted');
  if v_bad_count > 0 then
    raise exception 'invalid_candidate_selection';
  end if;

  select au.id into v_admin_id from public.admin_user au where au.auth_user_id = v_auth_uid;

  v_is_initial := not exists (
    select 1 from public.match_shortlist_confirmation where requirement_id = p_requirement_id
  );

  -- Un-confirm anything previously confirmed for this requirement that is
  -- not in the new set (screen-spec §6.3: "기존에 확정됐다가 빠진 match는
  -- is_confirmed_top3=false로 갱신").
  update public.match
  set is_confirmed_top3 = false, confirmed_rank = null
  where requirement_id = p_requirement_id
    and is_confirmed_top3 = true
    and not (id = any (p_match_ids));

  update public.match m
  set is_confirmed_top3 = true,
      confirmed_rank = t.rnk
  from unnest(p_match_ids) with ordinality as t (match_id, rnk)
  where m.id = t.match_id;

  select array_agg(partner_id) into v_partner_ids from public.match where id = any (p_match_ids);

  insert into public.match_shortlist_confirmation (
    requirement_id, requirement_ref_id, requirement_created_at,
    confirmed_match_ids, confirmed_by_admin_id, confirmed_at, is_initial
  ) values (
    p_requirement_id, p_requirement_id, date_trunc('month', v_req.created_at),
    p_match_ids, v_admin_id, v_confirmed_at, v_is_initial
  )
  returning id into v_confirmation_id;

  perform private.log_audit(
    p_action := 'match.shortlist_confirm',
    p_target_table := 'match_shortlist_confirmation',
    p_target_id := v_confirmation_id::text,
    p_subject_ids := v_partner_ids,
    p_after_summary := jsonb_build_object(
      'requirement_id', p_requirement_id,
      'match_ids', to_jsonb(p_match_ids),
      'is_initial', v_is_initial
    )
  );

  return jsonb_build_object(
    'confirmation_id', v_confirmation_id,
    'is_initial', v_is_initial,
    'confirmed_at', v_confirmed_at
  );
end;
$$;

revoke all on function public.match_shortlist_confirm(uuid, uuid[]) from public;
grant execute on function public.match_shortlist_confirm(uuid, uuid[]) to authenticated;


-- =============================================================================
-- §10. RPC — public.match_outcome_transition (M-R7/M-R8, audit action match.outcome_transition)
-- =============================================================================

create or replace function public.match_outcome_transition(
  p_match_id uuid,
  p_outcome_state text,
  p_transitioned_at timestamptz default now(),
  p_note text default null,
  p_meeting_date date default null,
  p_meeting_note text default null,
  p_quote_amount numeric default null,
  p_quote_currency text default null,
  p_deal_flag boolean default null,
  p_deal_amount numeric default null,
  p_deal_currency text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_admin_id uuid;
  v_row public.match%rowtype;
  v_event_id uuid;
begin
  if not (
    private.is_active_admin(v_auth_uid)
    and private.is_aal2()
    and private.has_menu_permission('lead_management', 'update', v_auth_uid)
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if p_outcome_state not in (
    'recommended', 'viewed', 'responded', 'meeting', 'quote', 'sample',
    'negotiation', 'deal', 'repeat'
  ) then
    raise exception 'invalid_outcome_state';
  end if;

  select * into v_row from public.match where id = p_match_id;
  if v_row.id is null then
    raise exception 'match_not_found' using errcode = 'P0002';
  end if;

  -- Outcome tracking only exists for confirmed Top3 candidates
  -- (screen-spec §6.4: hidden entirely until Top3 confirmation). Note this
  -- is intentionally NOT gated on requirement.status <> 'closed' — screen-
  -- spec §9 edge case 9 explicitly keeps Outcome recording open even after
  -- the lead is closed ("사후 보고가 늦게 들어오는 경우가 실무에서 흔함").
  if not v_row.is_confirmed_top3 then
    raise exception 'match_not_confirmed_top3';
  end if;

  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'note_too_long';
  end if;
  if p_meeting_note is not null and char_length(p_meeting_note) > 500 then
    raise exception 'meeting_note_too_long';
  end if;

  select au.id into v_admin_id from public.admin_user au where au.auth_user_id = v_auth_uid;

  -- screen-spec §6.4: re-clicking a past node adds a NEW event, history is
  -- never overwritten.
  insert into public.match_outcome_event (
    match_id, outcome_state, transitioned_at, note, recorded_by_admin_id
  ) values (
    p_match_id, p_outcome_state, coalesce(p_transitioned_at, now()), p_note, v_admin_id
  )
  returning id into v_event_id;
  -- trg_match_outcome_event_sync_current_state (AFTER INSERT) updates
  -- match.current_outcome_state as a side effect of the insert above.

  update public.match
  set meeting_date = coalesce(p_meeting_date, meeting_date),
      meeting_note = coalesce(p_meeting_note, meeting_note),
      quote_amount = coalesce(p_quote_amount, quote_amount),
      quote_currency = coalesce(p_quote_currency, quote_currency),
      deal_flag = coalesce(p_deal_flag, deal_flag),
      deal_amount = coalesce(p_deal_amount, deal_amount),
      deal_currency = coalesce(p_deal_currency, deal_currency)
  where id = p_match_id;

  perform private.log_audit(
    p_action := 'match.outcome_transition',
    p_target_table := 'match_outcome_event',
    p_target_id := v_event_id::text,
    p_subject_ids := array[v_row.partner_id],
    p_after_summary := jsonb_build_object(
      'match_id', p_match_id,
      'outcome_state', p_outcome_state,
      'transitioned_at', p_transitioned_at
    )
  );

  return v_event_id;
end;
$$;

revoke all on function public.match_outcome_transition(
  uuid, text, timestamptz, text, date, text, numeric, text, boolean, numeric, text
) from public;
grant execute on function public.match_outcome_transition(
  uuid, text, timestamptz, text, date, text, numeric, text, boolean, numeric, text
) to authenticated;


-- =============================================================================
-- §10a. RPC — public.match_record_third_party_consent
--       (human-matching-ceo-decision.md §1/§4 item 1, audit action
--       match.third_party_consent_record)
-- =============================================================================
-- Records the FACT that an operator obtained stage-2 (contact-person
-- hand-off) consent from a partner over an offline channel (phone/email/in
-- person). This does not send anything or reveal any contact — it is purely
-- a compliance record, matching the privacy review's "fact-of-change only"
-- audit convention. v1.0 does not block match_outcome_transition on the
-- presence of this record (ceo-decision §4 item 2: warning only, enforced
-- in the UI) — deliberately not re-implemented as a backend gate here.

create or replace function public.match_record_third_party_consent(
  p_match_id uuid,
  p_consent_method text,
  p_consent_scope text[],
  p_evidence_kind text,
  p_consent_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_admin_id uuid;
  v_row public.match%rowtype;
begin
  if not (
    private.is_active_admin(v_auth_uid)
    and private.is_aal2()
    and private.has_menu_permission('lead_management', 'update', v_auth_uid)
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if p_consent_method not in ('online_self', 'phone', 'in_person', 'email') then
    raise exception 'invalid_consent_method';
  end if;

  if p_consent_scope is null or coalesce(array_length(p_consent_scope, 1), 0) = 0 then
    raise exception 'consent_scope_required';
  end if;

  if p_evidence_kind is not null and p_evidence_kind not in ('email_thread', 'verbal_only', 'other') then
    raise exception 'invalid_evidence_kind';
  end if;

  select * into v_row from public.match where id = p_match_id;
  if v_row.id is null then
    raise exception 'match_not_found' using errcode = 'P0002';
  end if;

  select au.id into v_admin_id from public.admin_user au where au.auth_user_id = v_auth_uid;

  -- consent_scope's vocabulary is enforced by the table CHECK constraint
  -- (consent_scope <@ array['name','title','email','phone']).
  update public.match
  set third_party_share_consent_at = coalesce(p_consent_at, now()),
      third_party_share_consent_method = p_consent_method,
      third_party_share_recorded_by_admin_id = v_admin_id,
      consent_scope = p_consent_scope,
      evidence_kind = p_evidence_kind
  where id = p_match_id;

  -- Fact-of-change only — no free text is captured by this RPC in the first
  -- place, so there is nothing to exclude from the audit summary.
  perform private.log_audit(
    p_action := 'match.third_party_consent_record',
    p_target_table := 'match',
    p_target_id := p_match_id::text,
    p_subject_ids := array[v_row.partner_id],
    p_after_summary := jsonb_build_object(
      'consent_method', p_consent_method,
      'consent_scope', to_jsonb(p_consent_scope),
      'evidence_kind', p_evidence_kind
    )
  );
end;
$$;

revoke all on function public.match_record_third_party_consent(uuid, text, text[], text, timestamptz) from public;
grant execute on function public.match_record_third_party_consent(uuid, text, text[], text, timestamptz) to authenticated;


-- =============================================================================
-- §11. update_lead_status() — closed-transition match-count audit warning
--      (privacy review §2-(4): warn, never block)
-- =============================================================================

create or replace function public.update_lead_status(p_request_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before text;
  v_match_count integer := 0;
begin
  if not (
    private.is_active_admin()
    and private.is_aal2()
    and private.has_menu_permission('lead_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if p_status not in ('new', 'reviewing', 'matching', 'matched', 'on_hold', 'closed') then
    raise exception 'invalid_status';
  end if;

  select status into v_before from public.requests where id = p_request_id;
  if v_before is null then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;

  update public.requests set status = p_status where id = p_request_id;

  -- privacy review §2-(4): closed is NEVER blocked by existing matches
  -- (blocking would keep spam/withdrawn-lead PII alive on a 12-month clock
  -- instead of the intended 30-day one) — the match count is only surfaced
  -- for audit visibility so an operator closing a lead mid-matching leaves a
  -- trace of that decision.
  if p_status = 'closed' then
    select count(*) into v_match_count from public.match where requirement_id = p_request_id;
  end if;

  perform private.log_audit(
    p_action := 'lead.status_change',
    p_target_table := 'requests',
    p_target_id := p_request_id::text,
    p_subject_ids := array[p_request_id],
    p_before_summary := jsonb_build_object('status', v_before),
    p_after_summary := case
      when p_status = 'closed' then jsonb_build_object('status', p_status, 'match_count', v_match_count)
      else jsonb_build_object('status', p_status)
    end
  );
end;
$$;
-- Signature unchanged from 20260825160000 — existing REVOKE/GRANT still apply.


-- =============================================================================
-- §12. public.requests BEFORE DELETE trigger — detach + null free text
--      (privacy review §2-(5) / §3.3 point 1)
-- =============================================================================
-- MUST be BEFORE DELETE: if this ran AFTER, match.requirement_id would
-- already have been SET NULL by the FK action and `where requirement_id =
-- old.id` below would match nothing.

create or replace function public.requests_before_delete_detach_matches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.match
  set selection_memo = null,
      exclusion_memo = null,
      meeting_note = null,
      requirement_detached_at = now(),
      requirement_status_at_snapshot = old.status
  where requirement_id = old.id;

  update public.match_outcome_event
  set note = null
  where match_id in (select id from public.match where requirement_id = old.id);

  return old;
end;
$$;

comment on function public.requests_before_delete_detach_matches is
  'privacy review §2-(5)/§3.3(1): runs immediately before a requests row is '
  'hard-deleted by private.run_requests_retention_batch() (closed + 30 days). '
  'Nulls the 4 free-text match columns and stamps requirement_detached_at so '
  'match/match_outcome_event survive as non-identifying statistics. The FK '
  'ON DELETE SET NULL on match.requirement_id fires afterward, as part of '
  'the same statement.';

drop trigger if exists trg_requests_before_delete_detach_matches on public.requests;
create trigger trg_requests_before_delete_detach_matches
  before delete on public.requests
  for each row execute function public.requests_before_delete_detach_matches();


-- =============================================================================
-- §13. private.run_requests_retention_batch() — anonymization block also
--      nulls match free text (privacy review §3.3 point 2)
-- =============================================================================
-- Full CREATE OR REPLACE of the 20260825120000 §15 function body, with the
-- two new UPDATE statements added right after the existing
-- private.request_meta cleanup (marked below). Everything else is
-- byte-for-byte identical to the prior version.

create or replace function private.run_requests_retention_batch()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_ids uuid[];
  v_anonymized_ids uuid[];
  v_deleted_count integer;
  v_anonymized_count integer;
begin
  -- 1. Closed/spam rows past their 30-day window: hard delete (no
  --    statistical value retained for these, privacy review oq4 §2.3 point 4).
  --    Cascades to private.request_meta via its existing ON DELETE CASCADE.
  --    trg_requests_before_delete_detach_matches (§12 above) detaches any
  --    match rows and nulls their free text BEFORE this delete executes.
  with d as (
    delete from public.requests
    where status = 'closed' and retention_expires_at < now()
    returning id
  )
  select array_agg(id) into v_deleted_ids from d;

  -- 2. Everything else past its window (12mo default / 24mo matched):
  --    pseudonymize in place, row kept for aggregate stats (oq4 §2.3).
  --    NOTE (deviation from the literal review wording, see migration report):
  --    oq4 §2.3 says "NULL 처리" for these columns, but Phase 1's CHECK
  --    constraints (char_length between 1 and N, NOT NULL, email-shape regex
  --    on `contact`) make a literal NULL impossible without weakening those
  --    constraints for ALL rows, not just anonymized ones. A fixed,
  --    non-identifying sentinel value achieves the same irreversible
  --    de-identification effect while satisfying the existing constraints.
  with u as (
    update public.requests
    set
      what_looking_for = '[anonymized]',
      purpose = '[anonymized]',
      description = '[anonymized]',
      company_name_website = '[anonymized]',
      contact = 'anonymized+' || id::text || '@invalid',
      -- oq4 §2.3 note: truncate to month while lead volume is low, to avoid
      -- created_at + category + locale becoming a re-identification vector.
      created_at = date_trunc('month', created_at),
      anonymized_at = now()
    where anonymized_at is null
      and status <> 'closed'
      and retention_expires_at < now()
    returning id
  )
  select array_agg(id) into v_anonymized_ids from u;

  if v_anonymized_ids is not null then
    update private.request_meta
    set internal_note = null, consent_ip = null, consent_ip_expires_at = null
    where request_id = any (v_anonymized_ids);

    -- Human matching (privacy review §3.3 point 2): the requirement row
    -- survives this branch (only pseudonymized, not deleted), so
    -- requirement_id stays valid and requirement_detached_at is NOT set —
    -- only the free-text columns are nulled, in lockstep with the leads
    -- they describe.
    update public.match
    set selection_memo = null, exclusion_memo = null, meeting_note = null
    where requirement_id = any (v_anonymized_ids);

    update public.match_outcome_event
    set note = null
    where match_id in (select id from public.match where requirement_id = any (v_anonymized_ids));
  end if;

  v_deleted_count := coalesce(array_length(v_deleted_ids, 1), 0);
  v_anonymized_count := coalesce(array_length(v_anonymized_ids, 1), 0);

  insert into public.retention_jobs (job_type, target_condition, anonymized_count, deleted_count, notes)
  values (
    'anonymize',
    'status <> ''closed'' and retention_expires_at < now() and anonymized_at is null',
    v_anonymized_count, 0,
    'P3-6: 12mo default / 24mo matched retention batch (privacy review oq4 §2.2/§2.3).'
  );

  insert into public.retention_jobs (job_type, target_condition, anonymized_count, deleted_count, notes)
  values (
    'hard_delete',
    'status = ''closed'' and retention_expires_at < now()',
    0, v_deleted_count,
    'P3-6: closed/spam hard-delete, 30-day window (privacy review oq4 §2.2/§2.3).'
  );

  return jsonb_build_object('anonymized_count', v_anonymized_count, 'deleted_count', v_deleted_count);
end;
$$;

comment on function private.run_requests_retention_batch is
  'P3-6: the lead retention batch the Phase 1 review flagged as promised in '
  'the privacy policy but never implemented. Extended by the human-matching '
  'migration (20260906100000) to also null match free-text columns in the '
  'anonymization branch — see human-matching-privacy-review.md §3.3 point 2.';


-- =============================================================================
-- §14. private.purge_orphan_match_freetext() — 24-month orphan backstop
--      (privacy review §3.2/§3.3 point 3)
-- =============================================================================
-- Deliberately NOT called from inside run_requests_retention_batch() —
-- privacy review §3.3 is explicit that this must be its own fault-isolated
-- block in run_daily_retention_batches() (F-M4's lesson: one failure must
-- never be able to take the other batches down with it).

create or replace function private.purge_orphan_match_freetext()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_purged_count integer;
begin
  with u as (
    update public.match m
    set selection_memo = null,
        exclusion_memo = null,
        meeting_note = null
    where (m.requirement_detached_at is not null or m.requirement_id is null)
      and (m.selection_memo is not null or m.exclusion_memo is not null or m.meeting_note is not null)
      and coalesce(
            m.requirement_detached_at,
            (
              select min(msc.confirmed_at)
              from public.match_shortlist_confirmation msc
              where msc.is_initial and msc.confirmed_match_ids @> array[m.id]
            ),
            m.created_at
          ) < now() - interval '24 months'
    returning m.id
  )
  select array_agg(id) into v_ids from u;

  if v_ids is not null then
    update public.match_outcome_event
    set note = null
    where match_id = any (v_ids) and note is not null;
  end if;

  v_purged_count := coalesce(array_length(v_ids, 1), 0);

  insert into public.retention_jobs (job_type, target_condition, anonymized_count, deleted_count, notes)
  values (
    'match_freetext_purge',
    'orphan match (requirement_detached_at is not null or requirement_id is null) '
      || 'free text older than 24 months from detach/initial-confirmation/created_at',
    v_purged_count, 0,
    'privacy review §3.2/§3.3(3): 24-month backstop for orphan match free text that '
      || 'was not already nulled by the requests BEFORE DELETE trigger or the '
      || '12/24mo anonymization batch (defense-in-depth, expected to usually purge 0 rows).'
  );

  return v_purged_count;
end;
$$;

comment on function private.purge_orphan_match_freetext is
  'privacy review §3.3: MUST stay called only from run_daily_retention_batches() '
  'in its own independent exception block, never merged into '
  'run_requests_retention_batch() (fault-isolation, F-M4).';


create or replace function private.run_daily_retention_batches()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Each batch is independently fault-isolated: one failing must not block
  -- the others (this function itself is what pg_cron calls once/day).
  --
  -- qa-reviewer catch, 2026-09-06: the first draft of this migration
  -- re-created this function from the 20260825120000 version and silently
  -- dropped the four partner-PII blocks added later by 20260829140000
  -- (purge_unconsented_partner_pii / mark_expired_partner_documents_for_purge /
  -- purge_rejected_partner_pii / purge_expired_partner_consent_meta) — exactly
  -- the "quiet failure discovered months later" pattern F-M4 warned about,
  -- except against existing partner retention duties instead of new ones.
  -- All 7 pre-existing blocks are restored verbatim below; only the new
  -- match block at the end is actually new.
  begin
    perform private.run_requests_retention_batch();
  exception when others then
    raise warning 'run_requests_retention_batch failed: %', sqlerrm;
  end;

  begin
    perform private.purge_expired_failed_submissions();
  exception when others then
    raise warning 'purge_expired_failed_submissions failed: %', sqlerrm;
  end;

  begin
    perform private.purge_expired_audit_log();
  exception when others then
    raise warning 'purge_expired_audit_log failed: %', sqlerrm;
  end;

  begin
    perform private.purge_unconsented_partner_pii();
  exception when others then
    raise warning 'purge_unconsented_partner_pii failed: %', sqlerrm;
  end;

  begin
    perform private.mark_expired_partner_documents_for_purge();
  exception when others then
    raise warning 'mark_expired_partner_documents_for_purge failed: %', sqlerrm;
  end;

  begin
    perform private.purge_rejected_partner_pii();
  exception when others then
    raise warning 'purge_rejected_partner_pii failed: %', sqlerrm;
  end;

  begin
    perform private.purge_expired_partner_consent_meta();
  exception when others then
    raise warning 'purge_expired_partner_consent_meta failed: %', sqlerrm;
  end;

  -- Human matching (privacy review §3.3): independent block, added
  -- 20260906100000. Must never be merged into any block above.
  begin
    perform private.purge_orphan_match_freetext();
  exception when others then
    raise warning 'purge_orphan_match_freetext failed: %', sqlerrm;
  end;
end;
$$;


-- =============================================================================
-- §15. retention_jobs.job_type CHECK — add 'match_freetext_purge'
-- =============================================================================
-- Same introspect-drop-recreate pattern already used twice for this
-- constraint (20260825120000 §14) — robust against the constraint's actual
-- auto-generated/prior name.

do $$
declare
  v_conname text;
begin
  select con.conname into v_conname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'retention_jobs'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%job_type%';

  if v_conname is not null then
    execute format('alter table public.retention_jobs drop constraint %I', v_conname);
  end if;

  alter table public.retention_jobs
    add constraint retention_jobs_job_type_check
    check (job_type in (
      -- qa-reviewer catch, 2026-09-06: the first draft of this CHECK was based on
      -- 20260825120000's original 4-value list and silently dropped the 5 partner-related
      -- values added since (20260829140000, 20260904100000). Restored verbatim below;
      -- 'match_freetext_purge' is the only actually-new value.
      'anonymize', 'hard_delete', 'audit_purge', 'failed_submission_purge',
      'partner_unconsented_purge', 'partner_doc_purge', 'partner_rejected_purge',
      'partner_consent_meta_purge', 'partner_doc_storage_purge',
      'match_freetext_purge'
    ));
end;
$$;


-- =============================================================================
-- §16. audit_log.action CHECK — add the 5 human-matching actions (HM-B4)
-- =============================================================================
-- Same introspect-by-definition-text-drop-recreate pattern used by every
-- prior widening of this constraint (20260825160000 / 20260827100000 /
-- 20260829130000). Full existing list is carried forward verbatim from
-- 20260829130000 (the most recent version) with one new category (H) added.

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
end;
$$;

alter table public.audit_log add constraint audit_log_action_check check (action in (
  -- A. Authentication (§3.2-A)
  'auth.login_success', 'auth.login_failed', 'auth.logout', 'auth.session_expired',
  'auth.mfa_enrolled', 'auth.mfa_reset',
  'auth.password_reset_requested', 'auth.password_changed',
  'auth.access_denied',
  -- B. Lead PII access (§3.2-B)
  'lead.list', 'lead.view', 'lead.contact_reveal', 'lead.update',
  'lead.status_change', 'lead.assign', 'lead.note_write',
  'lead.export', 'lead.export_denied', 'lead.hide',
  -- C. Account / permission changes (§3.2-C)
  'admin_user.invite', 'admin_user.invite_resend', 'admin_user.invite_revoke',
  'admin_user.activate', 'admin_user.suspend', 'admin_user.withdraw',
  'admin_user.role_grant', 'admin_user.role_revoke', 'admin_user.profile_update',
  'admin_access_request.approve', 'admin_access_request.reject',
  'role.create', 'role.update', 'role.delete',
  'menu.create', 'menu.update', 'menu.delete',
  'role_menu_permission.change',
  -- E. Content management (Phase 5-A)
  'content.create', 'content.update', 'content.delete',
  -- F. Partner self-service actions (privacy review §2.6, new)
  'partner.signup', 'partner.email_verified', 'partner.login_success', 'partner.login_failed',
  'partner.password_changed', 'partner.withdraw',
  'partner.profile_update', 'partner.submit_for_review',
  'partner.consent_grant', 'partner.consent_revoke',
  'partner.public_listing_on', 'partner.public_listing_off',
  'partner.document_upload', 'partner.document_delete',
  -- G. Admin partner-management actions (privacy review §2.6, new)
  'admin_partner.list', 'admin_partner.view', 'admin_partner.contact_reveal',
  'admin_partner.document_reveal', 'admin_partner.update', 'admin_partner.verify',
  'admin_partner.reject', 'admin_partner.suspend_listing',
  'admin_partner.admin_entry_create', 'admin_partner.consent_evidence_write',
  'admin_partner.export', 'admin_partner.export_denied',
  -- H. Human matching (P4, screen-spec §10 / privacy review HM-B4). Note:
  --    match.third_party_consent_record (ceo-decision §4 item 1) is added in
  --    the SAME migration as the other 5, per that memo's explicit warning
  --    against splitting this across migrations ("따로 하면 또 롤백된다"),
  --    which would repeat the exact F-M13 mistake.
  'match.candidate_add', 'match.candidate_remove', 'match.judge',
  'match.shortlist_confirm', 'match.outcome_transition', 'match.third_party_consent_record',
  -- D. Audit log itself (§3.2-D)
  'audit.view', 'audit.export', 'audit.review'
));
