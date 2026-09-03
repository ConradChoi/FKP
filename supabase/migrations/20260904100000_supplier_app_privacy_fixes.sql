-- =============================================================================
-- `/supplier` partner self-registration app — UI-level privacy/security review
-- blocking-item backend implementation (privacy-security-officer review:
-- docs/03-security/partner-supplier-app-ui-privacy-review.md, ceo-advisor
-- decision: docs/03-security/partner-supplier-app-ceo-decisions.md)
--
-- Scope (backend-developer, 2026-09-04) — the 6 items the ceo memo did not
-- block on and prioritized in this order:
--   §0. public.get_own_partner_id() — new small helper RPC every route
--       handler below needs to resolve the caller's own partner_id/
--       partner_account_id server-side, instead of trusting a client-
--       supplied value (same "never trust the client for this" principle
--       already used throughout this schema).
--   §1. UI-B2 — public.get_own_partner_consents() (new RPC).
--   §2. UI-B1 — public.partner_detach_auth_principal() (new RPC, service_role
--       only) — paired with app/api/partner/withdraw/route.ts.
--   §3. UI-B5 + UI-B6 (ceo memo's #1 priority ticket) —
--       (a) UI-B6: public.partner_withdraw() now anonymizes sole-proprietor
--           company info, reusing private.purge_unconsented_partner_pii()'s
--           existing UPDATE block verbatim (no new logic invented).
--       (b) UI-B5: three new service_role-only RPCs
--           (select_pending_deletion_documents / confirm_document_purged /
--           record_partner_document_purge_run) that the new worker route
--           app/api/cron/purge-partner-documents/route.ts polls, since SQL
--           itself cannot call the Storage REST API (documented gap at
--           private.mark_expired_partner_documents_for_purge, 20260829140000
--           lines ~1882-1887).
--   §4. UI-B4 — document upload moved server-side: storage.buckets mime/size
--       limits, a same-row CHECK tying storage_path to partner_id (UI-R2),
--       the partner's direct Storage/table INSERT policies dropped, and a
--       new service_role-only public.partner_record_document_upload() RPC —
--       paired with app/api/partner/documents/route.ts.
--   §5. UI-B10 — public.check_business_registration_duplicate() row scope
--       narrowed (ceo-advisor decision) + regranted to service_role only,
--       forcing all calls through app/api/partner/check-brn/route.ts (which
--       applies the account-scoped daily rate limit BEFORE calling it — a
--       direct `authenticated` GRANT would let that limit be bypassed
--       entirely from the browser).
--
-- UI-B3 (public-listing consent revocation) needed NO SQL change —
-- public.partner_grant_consent() already exists and is correct; the defect
-- was purely a missing call in the screen's client-side handler. See
-- docs/03-security/partner-supplier-app-backend-implementation-notes.md
-- §1 for the exact call order frontend-developer must implement.
--
-- Not yet executed against Supabase — paste into the SQL Editor manually.
-- =============================================================================


-- =============================================================================
-- §0. public.get_own_partner_id() — resolves the CALLING partner's own
--     partner_account.id + partner.id in one round trip. Mirrors the design
--     rule already stated for private.current_partner_id (privacy review
--     §2.5 rule 1: "returns only the CALLING user's own ... never another
--     partner's"). Needed because private.* functions are not reachable via
--     PostgREST/.rpc() (this project's exposed schema is `public` only) —
--     every new Route Handler below needs a public wrapper to avoid trusting
--     a client-supplied partner_id, per UI-B4 §4.1 step 1's "클라이언트 입력값을
--     신뢰하지 않는다" requirement (applied here to all three new routes, not
--     just the document upload one it was written for).
-- =============================================================================

create or replace function public.get_own_partner_id()
returns table (partner_account_id uuid, partner_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select pa.id, p.id
  from public.partner_account pa
  left join public.partner p on p.owner_account_id = pa.id
  where pa.auth_user_id = auth.uid()
    and private.is_active_partner(auth.uid());
$$;

comment on function public.get_own_partner_id is
  'Returns zero rows if the caller is not an active partner (private.is_active_partner). '
  'partner_id can legitimately be null only in the impossible-in-practice case where '
  'finalize_partner_signup''s account+partner insert somehow ran partially — treat a null '
  'partner_id from a returned row as a server bug, not a valid state, in callers.';

revoke all on function public.get_own_partner_id() from public;
grant execute on function public.get_own_partner_id() to authenticated;


-- =============================================================================
-- §1. [UI-B2] public.get_own_partner_consents()
--     privacy review §1.2 — exact field whitelist per that section's table:
--     granted / collected_at / document_version ONLY. method, evidence_kind,
--     evidence_ref, recorded_by_admin_id, consenter_name/title, consent_ip,
--     recorded_at, revoked_reason, and full history are all deliberately
--     excluded (see §1.2 for the per-field reasoning — not reproduced here).
--     Latest recorded_at row per consent_type only; a type with no history
--     is OMITTED from the returned object entirely (never a null value) so
--     the frontend can distinguish "미동의" from "기록 없음" (§1.2 note).
-- =============================================================================

create or replace function public.get_own_partner_consents()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_partner_id uuid;
  v_result jsonb := '{}'::jsonb;
  v_type text;
  v_row public.partner_consent%rowtype;
begin
  if not private.is_active_partner(v_auth_uid) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  select id into v_partner_id from public.partner where owner_account_id = private.current_partner_id(v_auth_uid);
  if v_partner_id is null then
    return '{}'::jsonb;
  end if;

  -- §1.2: 'third_party_share' is explicitly OUT of scope for this RPC (v1.0
  -- unused; a future per-match consent type must not be flattened into a
  -- type-level summary like the other four).
  foreach v_type in array array['terms', 'privacy', 'public_listing', 'marketing']
  loop
    select * into v_row
    from public.partner_consent
    where partner_id = v_partner_id and consent_type = v_type
    order by recorded_at desc
    limit 1;

    if found then
      v_result := v_result || jsonb_build_object(
        v_type, jsonb_build_object(
          'granted', v_row.granted,
          'collected_at', v_row.collected_at,
          'document_version', v_row.document_version
        )
      );
    end if;
  end loop;

  -- Self-access to one's own consent history: not audited (PR-15, same
  -- stance as get_own_partner_contact — logging every self-view would just
  -- bloat audit_log with no security value).
  return v_result;
end;
$$;

comment on function public.get_own_partner_consents is
  'UI-B2 (privacy review §1.2). Field whitelist is load-bearing, not incidental — do not add '
  'columns to the returned jsonb without re-reading §1.2''s per-field table first. Superseded '
  'the SELECT-RLS-on-partner_consent alternative that review explicitly rejected (§1.2 '
  '"RLS 정책 대안을 기각하는 이유").';

revoke all on function public.get_own_partner_consents() from public;
grant execute on function public.get_own_partner_consents() to authenticated;


-- =============================================================================
-- §2. [UI-B1] public.partner_detach_auth_principal()
--     privacy review §1.1 procedure step 3. service_role ONLY — invoked by
--     app/api/partner/withdraw/route.ts strictly AFTER that route's own step
--     1 (rpc('partner_withdraw', ...), run with the USER's own session so
--     partner_withdraw's ownership check applies) has already succeeded.
--     Deliberately takes p_account_id (server-resolved by the route via
--     get_own_partner_id()), NOT p_partner_id — per §1.1: "p_partner_id를
--     인자로 받는 3번 RPC를 만들지 말 것".
--
--     Order inside this function matters (FK correctness, not just style):
--     partner_account.auth_user_id is nulled FIRST. The composite FK
--     fk_partner_account_auth_principal (auth_user_id, principal_kind) ->
--     auth_principal is MATCH SIMPLE (Postgres default) — a NULL in any
--     composite FK column skips the check entirely, so nulling auth_user_id
--     makes partner_account stop referencing that auth_principal row BEFORE
--     the DELETE below, which is what makes the DELETE legal in the first
--     place (auth_principal has no other referencer at that point).
-- =============================================================================

create or replace function public.partner_detach_auth_principal(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid;
begin
  select auth_user_id into v_auth_uid from public.partner_account where id = p_account_id;

  if v_auth_uid is null then
    -- Already detached (e.g. a retried call after a prior partial failure) —
    -- idempotent no-op, not an error. The caller (withdraw route) treats a
    -- non-raising return as success either way.
    return;
  end if;

  update public.partner_account
  set auth_user_id = null, anonymized_at = now()
  where id = p_account_id;

  delete from public.auth_principal where auth_user_id = v_auth_uid;

  -- §1.1: "새 감사 action 문자열을 쓰지 말 것 ... 기존 'partner.withdraw'에
  -- 흡수" — reusing the same action string partner_withdraw() itself uses
  -- (audit_log.action is a fixed CHECK enum; this action string is already
  -- in it, added by 20260829130000). auth.uid() is null in this call's DB
  -- session (invoked via the service_role client, no user JWT context — the
  -- same documented limitation already noted on finalize_partner_signup,
  -- 20260829140000 lines ~1093-1099) so this row's actor_kind will be
  -- 'system', not 'partner'; the EARLIER partner_withdraw() call (run with
  -- the user's own session, by the same route, one step before this one)
  -- already recorded the correctly-attributed 'partner.withdraw' row for
  -- partner_id — this second row is a supplementary record of the auth-
  -- principal-detach step specifically, keyed by target_table/target_id.
  perform private.log_audit(
    p_action := 'partner.withdraw',
    p_target_table := 'partner_account',
    p_target_id := p_account_id::text,
    p_after_summary := jsonb_build_object('step', 'auth_principal_detached')
  );
end;
$$;

comment on function public.partner_detach_auth_principal is
  'UI-B1 (privacy review §1.1, ceo-decisions.md §1.1 정정). Step 3 of the withdraw procedure — '
  'nulls partner_account.auth_user_id + deletes the auth_principal row, clearing the way for the '
  'CALLER (app/api/partner/withdraw/route.ts) to then call auth.admin.deleteUser() (step 4, Auth '
  'Admin API, unreachable from SQL). service_role only — never grant to authenticated: this '
  'function trusts p_account_id completely and performs no ownership check of its own, unlike '
  'every partner-facing RPC in this schema.';

revoke all on function public.partner_detach_auth_principal(uuid) from public;
grant execute on function public.partner_detach_auth_principal(uuid) to service_role;


-- =============================================================================
-- §3. [UI-B5 + UI-B6] partner_withdraw() gains step 8 (sole-proprietor
--     anonymization) + the three new purge-worker RPCs.
-- =============================================================================

-- --- §3a. [UI-B6] public.partner_withdraw() — full CREATE OR REPLACE ---
-- All steps 1/2/4/5 below are byte-for-byte identical to the version this
-- supersedes (20260829140000 lines 1581-1638) except v_account_id -> v_partner
-- (needed to read business_entity_type for the new step 8). Step 8's UPDATE
-- block is copied VERBATIM from private.purge_unconsented_partner_pii()
-- (20260829140000 lines ~1831-1840) — same columns, same '[purged]' sentinel,
-- same pii_purged_at bookkeeping — per the task instruction to reuse, not
-- reinvent, that logic.

create or replace function public.partner_withdraw(p_partner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_partner public.partner%rowtype;
begin
  -- Self-service only (SS-12 is the partner's own action) — matching §2.5
  -- rule 2, this is a separate access path, never OR'd with an admin check.
  if not (private.is_active_partner(v_auth_uid) and private.owns_partner(p_partner_id, v_auth_uid)) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  select * into v_partner from public.partner where id = p_partner_id;

  -- Step 1: account status.
  update public.partner_account
  set status = 'withdrawn', withdrawn_at = now()
  where id = v_partner.owner_account_id;

  -- Step 2: public exposure off immediately, plus a revocation row so
  -- partner_public's own consent-existence check (layer 3) independently
  -- excludes this row even if public_listing_state were ever force-set back
  -- to 'on' by mistake (the review's "의도된 중복" philosophy, extended).
  update public.partner set public_listing_state = 'off' where id = p_partner_id;

  insert into public.partner_consent (partner_id, consent_type, granted, method, collected_at)
  values (p_partner_id, 'public_listing', false, 'online_self', now());

  -- Step 4: all on-file documents queued for hard deletion immediately
  -- (privacy review §4 PR-2 "탈퇴 시: 즉시 전량 삭제"), not the 90-day path.
  -- UI-B5 (this migration, §3b below): a real worker now consumes this
  -- queue — app/api/cron/purge-partner-documents/route.ts polling
  -- select_pending_deletion_documents(), which previously did not exist.
  update public.partner_document
  set pending_deletion_at = now()
  where partner_id = p_partner_id and pending_deletion_at is null;

  -- Contact PII: delete now (review recommends immediate, allows up to 30
  -- days if dispute-handling requires it — v1.0 takes the immediate option).
  delete from private.partner_contact where partner_id = p_partner_id;

  -- Step 8 (UI-B6, this migration): sole-proprietor company-info
  -- anonymization. Reuses private.purge_unconsented_partner_pii()'s own
  -- UPDATE block verbatim (20260829140000 §13) — those fields are personal
  -- data for a sole proprietor (PR-10) exactly the same way regardless of
  -- WHICH retention trigger fires (self-withdrawal here vs. the 90-day
  -- unconsented-admin_entry timeout there). Corporation rows are
  -- deliberately untouched — company-level fields for a corporation survive
  -- withdrawal by design (this function's own header comment, match-history
  -- retention / §1.3 North Star).
  if v_partner.business_entity_type = 'sole_proprietor' then
    update public.partner set
      company_name_ko = '[purged]', company_name_en = null,
      business_registration_number = null, location_region = null,
      website_url = null, company_intro_text = null,
      public_listing_state = 'off', pii_purged_at = now()
    where id = p_partner_id;
  end if;

  -- Step 5.
  perform private.log_audit(
    p_action := 'partner.withdraw', p_target_table := 'partner', p_target_id := p_partner_id::text,
    p_subject_ids := array[p_partner_id]
  );
end;
$$;

comment on function public.partner_withdraw is
  'PR-9 (privacy review §4), extended by UI-B6 (this migration) to add step 8 (sole-proprietor '
  'anonymization, reusing purge_unconsented_partner_pii()''s UPDATE block). Match-history '
  'retention is intentionally NOT this function''s concern: per the review, company-level match '
  'rows are kept (§1.3 North Star source), only person-level contact PII (+ sole-proprietor '
  'company identity, which IS personal data) is purged. '
  'Step 3 (auth.admin.signOut) and steps 3-4 of UI-B1''s procedure (auth_principal detach + '
  'auth.users hard delete) are NOT in this function by design — Auth Admin API calls are not '
  'SQL. The caller (app/api/partner/withdraw/route.ts) MUST call this RPC FIRST (using the '
  'user''s own session, so the ownership check above applies), then '
  'auth.admin.signOut()/partner_detach_auth_principal()/auth.admin.deleteUser() in that order '
  '(privacy review §1.1) using a service_role client.';

revoke all on function public.partner_withdraw(uuid) from public;
grant execute on function public.partner_withdraw(uuid) to authenticated;


-- --- §3b. [UI-B5] Purge-worker RPCs ---
-- SQL cannot call the Storage REST API (documented gap, 20260829140000 lines
-- ~1882-1887) — these three RPCs are the contract an out-of-process worker
-- (app/api/cron/purge-partner-documents/route.ts) uses to actually remove
-- the Storage object, then the metadata row, then log the run. All three are
-- service_role only: they trust their caller completely (no ownership
-- check), which is only safe because that caller is a trusted server route,
-- never a partner or admin session.

create or replace function public.select_pending_deletion_documents(p_limit integer default 200)
returns table (document_id uuid, partner_id uuid, storage_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select id, partner_id, storage_path
  from public.partner_document
  where pending_deletion_at is not null
  order by pending_deletion_at asc
  limit greatest(coalesce(p_limit, 200), 1);
$$;

comment on function public.select_pending_deletion_documents is
  'UI-B5 worker step 1/3 (privacy review §5.1). Feeds every one of the three purge triggers that '
  'set pending_deletion_at (partner_withdraw immediate, mark_expired_partner_documents_for_purge '
  'verified+90d, purge_rejected_partner_pii rejected+90d) through the SAME queue and the SAME '
  'worker — there is only one pending_deletion_at column, so there only needs to be one consumer.';

revoke all on function public.select_pending_deletion_documents(integer) from public;
grant execute on function public.select_pending_deletion_documents(integer) to service_role;


create or replace function public.confirm_document_purged(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_found boolean;
begin
  select true into v_found from public.partner_document where id = p_document_id;
  if v_found is null then
    -- Already gone (e.g. a retried call after a prior run's storage.remove()
    -- succeeded but the confirm call itself then failed/timed out) —
    -- idempotent no-op, matching partner_detach_auth_principal's stance.
    return;
  end if;

  -- Caller (the worker route) MUST have already confirmed storage.remove()
  -- succeeded for this row's storage_path before calling this — see
  -- select_pending_deletion_documents's comment for the required order.
  delete from public.partner_document where id = p_document_id;
end;
$$;

comment on function public.confirm_document_purged is
  'UI-B5 worker step 2/3. Deletes the metadata row ONLY — the caller is responsible for having '
  'already removed the underlying Storage object first (same "Storage object, then DB row" order '
  'partner_delete_document''s own comment already documents for the partner self-delete path — '
  'consistent, not a new convention).';

revoke all on function public.confirm_document_purged(uuid) from public;
grant execute on function public.confirm_document_purged(uuid) to service_role;


create or replace function public.record_partner_document_purge_run(
  p_deleted_count integer,
  p_failed_count integer default 0,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.retention_jobs (job_type, target_condition, deleted_count, notes)
  values (
    'partner_doc_storage_purge',
    'partner_document.pending_deletion_at is not null',
    coalesce(p_deleted_count, 0),
    case
      when p_failed_count is not null and p_failed_count > 0
        then coalesce(p_notes, '') || format(' | %s object(s) failed to remove from Storage and were left queued for retry.', p_failed_count)
      else p_notes
    end
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.record_partner_document_purge_run is
  'UI-B5 worker step 3/3 — proof-of-erasure log (privacy review §5.1 "실행 결과를 retention_jobs에 '
  '기록"). Distinct job_type (partner_doc_storage_purge) from partner_doc_purge on purpose: that '
  'existing job_type records the MARKING batch (pending_deletion_at set), this one records the '
  'actual Storage+row deletion — conflating the two into one job_type would make it impossible to '
  'tell "queued" from "actually erased" apart in the audit trail, which is exactly the gap UI-B5 '
  'exists to close.';

revoke all on function public.record_partner_document_purge_run(integer, integer, text) from public;
grant execute on function public.record_partner_document_purge_run(integer, integer, text) to service_role;


-- retention_jobs.job_type CHECK: add 'partner_doc_storage_purge' on top of
-- the full existing list (same introspect-drop-recreate pattern used for
-- every prior widening of this exact constraint, e.g. 20260829140000 §13).
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.retention_jobs'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%job_type%';

  if v_conname is not null then
    execute format('alter table public.retention_jobs drop constraint %I', v_conname);
  end if;

  alter table public.retention_jobs
    add constraint retention_jobs_job_type_check
    check (job_type in (
      'anonymize', 'hard_delete', 'audit_purge', 'failed_submission_purge',
      'partner_unconsented_purge', 'partner_doc_purge', 'partner_rejected_purge',
      'partner_consent_meta_purge', 'partner_doc_storage_purge'
    ));
end;
$$;


-- Index for the worker's own poll query — no index previously existed for
-- "pending_deletion_at IS NOT NULL" (the only prior partial index,
-- idx_partner_document_purge_pending, indexes the OPPOSITE condition:
-- purge_after WHERE pending_deletion_at IS NULL, for the marking batches).
create index if not exists idx_partner_document_pending_deletion
  on public.partner_document (pending_deletion_at)
  where pending_deletion_at is not null;


-- =============================================================================
-- §4. [UI-B4] Document upload moved server-side
-- =============================================================================

-- --- §4a. Bucket-level MIME/size allowlist (privacy review §4.1 "병행 조치") ---
-- Defense-in-depth only — a declared Content-Type header is still spoofable,
-- which is exactly why §4b's server-side magic-byte check
-- (lib/forms/fileSignature.ts, used by app/api/partner/documents/route.ts)
-- remains the real control. This closes one more layer for free.
update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'],
    file_size_limit = 10485760 -- 10MB, matches partner_document's own CHECK
where id = 'partner-doc';


-- --- §4b. [UI-R2] storage_path <-> partner_id same-row CHECK ---
-- "코드가 바뀌어도 남는 방어" (privacy review §4.1 후속 조치) — even though §4c
-- below removes the client's ability to INSERT this row directly (which was
-- the actual exploit path for a mismatched storage_path), this constraint
-- means a FUTURE regression that reopens that path still cannot produce a
-- partner_id="mine" / storage_path="p/{someone else's uuid}/..." row.
alter table public.partner_document
  drop constraint if exists chk_partner_document_storage_path_partner_scope;
alter table public.partner_document
  add constraint chk_partner_document_storage_path_partner_scope
  check (storage_path like ('p/' || partner_id::text || '/%'));


-- --- §4c. Remove the partner's direct write access (the actual fix) ---
-- privacy review §4.1 items a/c/d/e all stem from the SAME root cause: a
-- partner-authenticated client could INSERT into partner_document (and the
-- Storage bucket) directly, with the browser fully in control of
-- sha256_hash, mime_type, and (before §4b) storage_path. Closing this
-- requires removing the ability to write directly, not just adding more
-- CHECKs the client still ultimately controls the inputs to.
--
-- The table-level `grant insert ... to authenticated` (20260829140000 line
-- 826) is INTENTIONALLY left untouched — the partner_document_admin_insert
-- RLS policy (the admin path) still needs it. Only the PARTNER's RLS policy
-- is dropped;
-- with no policy left that matches a partner-context insert, RLS denies by
-- default (deny-by-absence, the same posture private.partner_consent_meta
-- already documents for having no SELECT policy at all).
drop policy if exists partner_document_self_insert on public.partner_document;

comment on table public.partner_document is
  'Metadata only — file bytes live in Storage bucket partner-doc (§8b below). '
  'purge_after / pending_deletion_at implement PR-2''s "검증 후 90일 삭제" '
  'policy (Q-2, adopted). NEVER store 주민등록번호-bearing documents '
  '(privacy review §4 PR-2 note) — enforced by admin review checklist '
  '(A1-R5), not by this schema. '
  'UI-B4 (2026-09-04): partner-authored rows can ONLY be created via '
  'public.partner_record_document_upload(), called by '
  'app/api/partner/documents/route.ts (service_role) — the partner''s own '
  'direct INSERT RLS policy has been dropped. See that function''s comment.';

-- Storage-side counterpart: partners can still SELECT (read/sign their own
-- files, partner_doc_owner_rw, unchanged) but can no longer INSERT directly.
drop policy if exists partner_doc_owner_insert on storage.objects;


-- --- §4d. public.partner_record_document_upload() ---
-- The ONLY sanctioned way left to create a partner-authored partner_document
-- row. service_role only, on purpose — see its own comment for why granting
-- this to `authenticated` would silently reopen exactly the hole §4c closes.
create or replace function public.partner_record_document_upload(
  p_partner_id uuid,
  p_doc_type text,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_sha256_hash text,
  p_uploaded_by_partner_account_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.partner_document (
    partner_id, doc_type, storage_path, original_filename, mime_type,
    file_size_bytes, sha256_hash, uploaded_by_kind, uploaded_by_partner_account_id
  ) values (
    p_partner_id, p_doc_type, p_storage_path, p_original_filename, p_mime_type,
    p_file_size_bytes, p_sha256_hash, 'partner', p_uploaded_by_partner_account_id
  )
  returning id into v_id;

  perform private.log_audit(
    p_action := 'partner.document_upload',
    p_target_table := 'partner_document',
    p_target_id := v_id::text,
    p_subject_ids := array[p_partner_id]
  );

  return v_id;
end;
$$;

comment on function public.partner_record_document_upload is
  'UI-B4 (privacy review §4.1). The ONLY sanctioned way to create a partner-authored '
  'partner_document row (supersedes the dropped partner_document_self_insert RLS policy, §4c '
  'above). Called exclusively by POST app/api/partner/documents/route.ts AFTER that route has '
  'independently (a) resolved p_partner_id/p_uploaded_by_partner_account_id server-side via '
  'get_own_partner_id() — never from client input — and (b) computed p_sha256_hash/p_storage_path/'
  'p_mime_type itself from the ACTUAL uploaded bytes, including a magic-byte check '
  '(lib/forms/fileSignature.ts) the client cannot spoof by only changing a declared Content-Type. '
  'Granted to service_role only: granting this to `authenticated` would let a client bypass the '
  'route''s validation and insert an arbitrary sha256_hash/mime_type pair again, recreating the '
  'exact vulnerability items (a)/(c) of §4.1 describe.';

revoke all on function public.partner_record_document_upload(uuid, text, text, text, text, bigint, text, uuid) from public;
grant execute on function public.partner_record_document_upload(uuid, text, text, text, text, bigint, text, uuid) to service_role;


-- =============================================================================
-- §5. [UI-B10] check_business_registration_duplicate — scope narrowed +
--     regranted to service_role only
-- =============================================================================
--
-- Scope-narrowing judgment (task instruction: "충돌 없으면 좁혀라, 충돌 여지가
-- 있으면 좁히지 말고 근거를 남겨라" — backend-developer decision, 2026-09-04,
-- made without a same-day privacy-security-officer round-trip; documented
-- here in full so that review can happen asynchronously):
--
--   New scope: TRUE only if a row exists whose business_registration_number
--   matches AND (owner_account_id IS NOT NULL OR verification_state =
--   'verified'). Un-claimed admin_entry outreach drafts (owner_account_id
--   null AND not yet verified) never produce a duplicate=true anymore — this
--   is precisely the sales-pipeline enumeration the ceo memo's #2 item
--   flagged (ceo-decisions.md §2(b)-3).
--
--   Checked for conflicts, found none:
--   1. A1-R6 (admin must see ALL duplicate candidates, including unverified
--      drafts) is UNAFFECTED: the admin screen's duplicate-candidate check
--      (checkDuplicateCandidatesAction, app/admin/(protected)/partners/
--      actions.ts) queries public.partner DIRECTLY under the admin''s own
--      RLS-granted read access (partner_account_admin_select-equivalent for
--      partner) and does NOT call this function at all (confirmed by
--      grep — the only other reference to this function''s name in the repo
--      before this migration is a comment noting exactly this separation).
--      Narrowing this function''s scope has zero effect on what an admin can
--      see.
--   2. PR-12''s four listed requirements (no anon grant / neutral message /
--      per-account rate limit / screen flow change, baseline review §5) are
--      all about the partner-facing boolean''s ENUMERATION surface, not its
--      row scope — none of the four are affected either way by narrowing.
--   3. PC-4''s actual anti-abuse purpose (a rejected/suspended company cannot
--      spin up a fresh account to bypass its own rejection by reusing the
--      same BRN) is FULLY preserved: finalize_partner_signup sets
--      owner_account_id at the moment of signup, BEFORE any verification —
--      so a self-service partner row is caught by this scope in every state
--      (draft/submitted/rejected/verified), not merely once verified.
--
--   Residual, out-of-scope observation (not fixed here): a withdrawn
--   CORPORATION''s partner row keeps owner_account_id set (only
--   auth_user_id is nulled by UI-B1/partner_detach_auth_principal), so its
--   business_registration_number continues to read as "duplicate" forever
--   after withdrawal. This is pre-existing behavior (true before this
--   migration too, since the old unscoped version also matched every row
--   unconditionally) — not a regression introduced by narrowing, and out of
--   this ticket''s scope.
--
-- Access-path judgment: revoke direct `authenticated` GRANT, force every
-- call through app/api/partner/check-brn/route.ts (service_role). Without
-- this, privacy review §6.1 point 2 ("클라이언트 디바운스만으로는 통제가 아니다 —
-- 호출자가 우회 가능") would remain literally true even with the route built:
-- a partner session could call supabase.rpc('check_business_registration_
-- duplicate', ...) straight from the browser via supabase-js, bypassing the
-- route''s rate limit entirely. No other caller in the repo uses this
-- function directly (confirmed by grep before writing this migration) — safe
-- to revoke.

create or replace function public.check_business_registration_duplicate(p_business_registration_number text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.partner
    where business_registration_number = p_business_registration_number
      and (owner_account_id is not null or verification_state = 'verified')
  );
$$;

comment on function public.check_business_registration_duplicate is
  'PR-12 + UI-B10 (privacy review §6.1, ceo-decisions.md §2). Returns a bare boolean, never which '
  'company or what state. Row scope narrowed 2026-09-04 (see the do-block comment immediately '
  'above this function in the migration that introduced it) to owner_account_id IS NOT NULL OR '
  'verification_state=''verified'' — un-claimed admin_entry outreach drafts no longer surface as '
  '"already registered", closing the sales-pipeline-enumeration risk UI-B10 problem 2 identified. '
  'service_role ONLY as of the same migration — the sole intended caller is '
  'app/api/partner/check-brn/route.ts, which applies the account-scoped daily rate limit BEFORE '
  'calling this. Do not grant to `authenticated` again without re-adding an equivalent DB-level '
  'rate limit first.';

revoke all on function public.check_business_registration_duplicate(text) from public, authenticated;
grant execute on function public.check_business_registration_duplicate(text) to service_role;


-- =============================================================================
-- End of migration.
-- =============================================================================
