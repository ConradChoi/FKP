-- =============================================================================
-- SEEPN Unified Platform v1.0 — P5a: SEEPN buyer account system +
-- partner public listing/detail split + category public read path +
-- bookmark + seepn_inquiry + breach-notification target extraction
-- =============================================================================
--
-- Design Ref:
--   - docs/01-plan/features/seepn-unified-platform-v1.0.prd.md D-3', D-12,
--     D-13, D-14, §3.1.4~3.1.6, §4.4 P5a DoD
--   - docs/02-design/features/seepn-buyer-web-p5a.screen-spec.md §0.3
--     (GAP-1..6), §1.3 (session architecture), §4 (BY-08), §6 (BY-09),
--     §7 (BY-10/11/12), §8 (BY-A1)
--   - docs/03-security/seepn-buyer-web-p5a-privacy-review.md — BP-1..BP-14
--     (blocking), BP-15..21 (recommended), §12 ceo-advisor decisions D-14①~④
--     (this migration implements the backend-developer action items in each)
--   - docs/03-security/data-breach-response-procedure-v1.0.md §5-1 (backend
--     developer action item: private.breach_notification_targets())
--   - Requires 20260829130000 (auth_principal, audit_log foundation),
--     20260829140000 (partner, partner_public, partner_consent,
--     private.mask_name/mask_email/mask_phone), 20260829150000
--     (standard_category, partner_standard_category), 20260906100000
--     (latest retention_jobs.job_type CHECK + run_daily_retention_batches —
--     used here as the diff base per repeated past mistakes in this repo),
--     20260908100000 (latest audit_log.action CHECK — used here as the diff
--     base for the same reason)
--
-- STATUS: not yet applied. Apply after all files listed above, in filename
-- order (this file sorts after all of them).
--
-- Deliberate scope decisions vs. the review, spelled out once here instead of
-- repeated at every section:
--   1. `buyer_account` gets NO admin-facing RLS SELECT policy at all (privacy
--      review §5.3(e): "buyer_account에 관리자용 SELECT 정책을 만들지 말 것").
--      The only paths from an admin session to buyer identity are
--      admin_list_seepn_inquiries() (masked) and get_seepn_inquiry_contact()
--      (raw, audited) — both defined in §12 below, both SECURITY DEFINER.
--   2. `seepn_inquiry` likewise gets no admin-facing RLS SELECT policy — an
--      admin session doing `select * from seepn_inquiry` directly returns
--      zero rows, on purpose. This is what makes "본문 미리보기 금지" (BP-6d)
--      a structural guarantee instead of a UI convention.
--   3. No `private.buyer_consent_meta` split table (unlike
--      partner_consent_meta): buyer consent is 100% self-service
--      (`method='online_self'` always), so there is no witnessing-operator
--      identity to split out in the first place.
--   4. `capability_completeness_pct` is carried into `private.partner_public_base`
--      (needed for a future "완성도순" sort per PRD B-12c) but is deliberately
--      NOT selected into either public view — BP-12's default recommendation
--      ("최신순/회사명순 2종으로 시작") is adopted, so P5a's public sort keys
--      are `created_at` and `company_name_ko`/`company_name_en` only.
-- =============================================================================


-- =============================================================================
-- §1. auth_principal — third principal_kind ('buyer')
-- =============================================================================
-- Same CHECK-widening pattern as every prior touch of this constraint. The
-- table's UNIQUE(auth_user_id, principal_kind) + each account table's
-- composite FK is what makes "one auth user, at most one principal_kind" a
-- constraint, not an application convention (privacy review §4.1 / F-8).

alter table public.auth_principal drop constraint if exists auth_principal_principal_kind_check;
alter table public.auth_principal
  add constraint auth_principal_principal_kind_check
  check (principal_kind in ('admin', 'partner', 'buyer'));


-- =============================================================================
-- §2. public.buyer_account — buyer login account (D-3', screen-spec §1.3,
--     privacy review §5.1 BP-5, §12 D-14④)
-- =============================================================================
-- Same shape as partner_account by design (PRD §3.1.6 "P1의 파트너 자가등록에
-- 준하는 규모"), with two additions D-14④ requires: last_login_at (must
-- actually be maintained — see record_buyer_login() in §8, unlike
-- partner_account.last_login_at which privacy review left unpopulated) and
-- dormant_notice_sent_at (evidence column: "안내 발송 시각... 을 나중에 입증
-- 가능해야 한다"). Deliberately NO email/phone/company/birthdate columns
-- (privacy review §5.1 BP-5 table — auth.users is the email SSOT).

create table if not exists public.buyer_account (
  id uuid primary key default gen_random_uuid(),

  auth_user_id uuid unique references auth.users (id) on delete restrict,
  principal_kind text not null default 'buyer' check (principal_kind = 'buyer'),

  status text not null default 'pending_email'
    check (status in ('pending_email', 'active', 'suspended', 'withdrawn')),

  display_name text not null check (char_length(display_name) between 1 and 100),

  last_login_at timestamptz,
  -- D-14④ / BP-18: set by mark_dormant_buyer_accounts_for_notice() (§15) the
  -- moment a 12-month-dormant account is flagged; cleared back to NULL by
  -- record_buyer_login() the moment the buyer logs in again (an active login
  -- cancels the dormancy warning). purge_dormant_buyer_accounts() (§15) only
  -- acts on rows where this is non-null AND older than 30 days — this column
  -- IS the evidence that "안내 후 30일" is provable, per the ceo-advisor
  -- decision's explicit requirement.
  dormant_notice_sent_at timestamptz,
  withdrawn_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.buyer_account is
  'Buyer login account (D-3'', screen-spec §1.3). Same shape principle as '
  'partner_account. NOT a Capability/PII-rich table by design — see privacy '
  'review §5.1 BP-5 for the exhaustive "collect / do not collect" list this '
  'table follows exactly (email via auth.users only, no phone, no company, '
  'no birthdate).';

comment on column public.buyer_account.display_name is
  '"이름 또는 회사명 중 편한 것" (screen-spec §3.3) — never enforced as a real '
  'legal name. Reused as the BY-11 발신자 표시 label. Real-name verification '
  'is out of scope for a consumer-facing buyer account.';

create index if not exists idx_buyer_account_status on public.buyer_account (status);
create index if not exists idx_buyer_account_dormant_notice_pending
  on public.buyer_account (last_login_at) where status = 'active' and dormant_notice_sent_at is null;
create index if not exists idx_buyer_account_dormant_purge_pending
  on public.buyer_account (dormant_notice_sent_at) where status = 'active' and dormant_notice_sent_at is not null;

alter table public.buyer_account enable row level security;
alter table public.buyer_account force row level security;
revoke all on public.buyer_account from anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_buyer_account_auth_principal'
  ) then
    alter table public.buyer_account
      add constraint fk_buyer_account_auth_principal
      foreign key (auth_user_id, principal_kind)
      references public.auth_principal (auth_user_id, principal_kind)
      on delete restrict;
  end if;
end;
$$;

drop trigger if exists trg_buyer_account_set_updated_at on public.buyer_account;
create trigger trg_buyer_account_set_updated_at
  before update on public.buyer_account
  for each row execute function private.set_updated_at();

-- Self-service read/update only. display_name is the only directly
-- UPDATE-able column; status/last_login_at/dormant_notice_sent_at/
-- withdrawn_at/auth_user_id are RPC-only (mirrors partner_account exactly).
-- DELIBERATE OMISSION vs partner_account: no admin_select policy at all
-- (privacy review §5.3(e) — "buyer_account에 관리자용 SELECT 정책을 만들지
-- 말 것"). An admin session querying this table directly gets zero rows,
-- always — the only paths to buyer identity for an admin are the two
-- SECURITY DEFINER functions in §12 (masked list + audited raw reveal).
grant select on public.buyer_account to authenticated;
grant update (display_name) on public.buyer_account to authenticated;

create policy buyer_account_self_select on public.buyer_account
  for select to authenticated
  using (auth_user_id = auth.uid());

create policy buyer_account_self_update on public.buyer_account
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());


-- =============================================================================
-- §3. Buyer judgment functions (privacy review §2.5 buyer function, verbatim)
-- =============================================================================

create or replace function private.is_active_buyer(p_auth_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.buyer_account ba
    join auth.users u on u.id = ba.auth_user_id
    where ba.auth_user_id = p_auth_uid
      and ba.status = 'active'
      and u.email_confirmed_at is not null
  );
$$;

comment on function private.is_active_buyer is
  'privacy review §2.5 (BP-1 §2.5 SQL sketch, adopted verbatim). true only '
  'when buyer_account.status=''active'' AND the auth.users row has completed '
  'email verification. Used as the sole gate on public.partner_detail_buyer '
  '(§10) — this is the "목적 제한" layer: grant-to-authenticated alone would '
  'let a PARTNER session bulk-read the buyer-facing detail view, which is not '
  'the purpose partners consented to (§10 comment).';

revoke all on function private.is_active_buyer(uuid) from public;
grant execute on function private.is_active_buyer(uuid) to authenticated;


create or replace function private.current_buyer_id(p_auth_uid uuid default auth.uid())
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ba.id from public.buyer_account ba where ba.auth_user_id = p_auth_uid;
$$;

comment on function private.current_buyer_id is
  'privacy review §2.5 rule 1 (buyer analog of private.current_partner_id): '
  'returns only the CALLING user''s own buyer_account.id (or null).';

revoke all on function private.current_buyer_id(uuid) from public;
grant execute on function private.current_buyer_id(uuid) to authenticated;


-- =============================================================================
-- §4. audit_log — third actor axis ('buyer') + action whitelist extension
--     (privacy review §4.2 BP-4, F-9/F-10 — same introspect-drop-recreate
--     pattern used by every prior widening of these two constraints)
-- =============================================================================

-- 4a. actor_kind CHECK: add 'buyer'.
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.audit_log'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%actor_kind%';

  if v_conname is not null then
    execute format('alter table public.audit_log drop constraint %I', v_conname);
  end if;
end;
$$;

alter table public.audit_log add constraint audit_log_actor_kind_check
  check (actor_kind in ('admin', 'partner', 'buyer', 'system', 'anon'));

-- 4b. Buyer actor FK + 3-way mutual exclusion with the existing admin/partner
-- actor FKs (widens chk_audit_actor_exclusive from 20260829130000 §4b, which
-- only checked the admin/partner pair — that constraint is dropped by its
-- explicit name below, not introspected, since it was never auto-generated).
alter table public.audit_log
  add column if not exists actor_buyer_account_id uuid
    references public.buyer_account (id) on delete restrict;

alter table public.audit_log drop constraint if exists chk_audit_actor_exclusive;
alter table public.audit_log add constraint chk_audit_actor_exclusive check (
  (case when actor_user_id is not null then 1 else 0 end)
  + (case when actor_partner_account_id is not null then 1 else 0 end)
  + (case when actor_buyer_account_id is not null then 1 else 0 end)
  <= 1
);

create index if not exists idx_audit_log_actor_buyer_occurred_at
  on public.audit_log (actor_buyer_account_id, occurred_at desc);

-- 4c. action CHECK: diff base is 20260908100000 (the latest file to touch
--     this constraint as of this migration — verified by grep across every
--     migration filed after it). Full list reproduced verbatim below, plus
--     the new buyer.*/seepn_inquiry.*/admin_seepn_inquiry.*/security.* rows
--     (privacy review §4.2 "신규 action 목록" + §12 D-14① BP-22).
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
  -- H. Human matching (P4, screen-spec §10 / privacy review HM-B4)
  'match.candidate_add', 'match.candidate_remove', 'match.judge',
  'match.shortlist_confirm', 'match.outcome_transition', 'match.third_party_consent_record',
  -- I. Standard category translation AI-fill guard
  'standard_category.update',
  -- J. SEEPN buyer self-service actions (this migration, privacy review §4.2)
  'buyer.signup', 'buyer.login_success', 'buyer.login_failed',
  'buyer.consent_grant', 'buyer.consent_revoke', 'buyer.withdraw',
  'buyer.dormant_notice_sent', 'buyer.dormant_purge',
  -- K. SEEPN inquiry (this migration, privacy review §4.2 / INQ-7)
  'seepn_inquiry.create',
  'admin_seepn_inquiry.list', 'admin_seepn_inquiry.view',
  'admin_seepn_inquiry.contact_reveal',
  'admin_seepn_inquiry.status_change', 'admin_seepn_inquiry.assign',
  -- L. Breach-response tooling (this migration, D-14① BP-22)
  'security.breach_target_export',
  -- D. Audit log itself (§3.2-D)
  'audit.view', 'audit.export', 'audit.review'
));


-- =============================================================================
-- §5. private.log_audit() — teach it about buyer actors (extends the
--     admin -> partner -> buyer -> else 'system' chain from 20260829130000 §5)
-- =============================================================================

create or replace function private.log_audit(
  p_action text,
  p_result text default 'success',
  p_target_table text default null,
  p_target_id text default null,
  p_subject_ids uuid[] default null,
  p_result_count integer default null,
  p_query_filter jsonb default null,
  p_before_summary jsonb default null,
  p_after_summary jsonb default null,
  p_error_code text default null,
  p_export_reason text default null,
  p_ip inet default null,
  p_user_agent text default null,
  p_request_id text default null,
  p_session_id text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_admin_id uuid;
  v_partner_account_id uuid;
  v_buyer_account_id uuid;
  v_display_name text;
  v_email text;
  v_role_codes text[];
  v_actor_kind text;
  v_subject_ids uuid[] := p_subject_ids;
  v_id bigint;
begin
  if v_auth_uid is not null then
    select au.id, au.display_name into v_admin_id, v_display_name
    from public.admin_user au
    where au.auth_user_id = v_auth_uid;

    if v_admin_id is null then
      select pa.id, pa.display_name into v_partner_account_id, v_display_name
      from public.partner_account pa
      where pa.auth_user_id = v_auth_uid;
    end if;

    if v_admin_id is null and v_partner_account_id is null then
      -- New (buyer support): not an admin and not a partner — check whether
      -- this auth user is a buyer account before falling back to 'system'.
      -- Mirrors the partner branch exactly.
      select ba.id, ba.display_name into v_buyer_account_id, v_display_name
      from public.buyer_account ba
      where ba.auth_user_id = v_auth_uid;
    end if;

    if v_admin_id is not null or v_partner_account_id is not null or v_buyer_account_id is not null then
      begin
        select u.email into v_email from auth.users u where u.id = v_auth_uid;
      exception when others then
        v_email := null; -- non-critical snapshot field; never let this block logging
      end;
    end if;
  end if;

  v_actor_kind := case
    when v_auth_uid is null then 'anon'
    when v_admin_id is not null then 'admin'
    when v_partner_account_id is not null then 'partner'
    when v_buyer_account_id is not null then 'buyer'
    else 'system'
  end;

  -- §3.3: cap subject_ids payload size, fall back to result_count/query_filter.
  if v_subject_ids is not null and array_length(v_subject_ids, 1) > 200 then
    v_subject_ids := null;
  end if;

  insert into public.audit_log (
    actor_user_id, actor_partner_account_id, actor_buyer_account_id, actor_auth_uid,
    actor_email_snapshot, actor_name_snapshot, actor_role_codes, actor_kind, action,
    target_table, target_id, subject_ids, result_count, query_filter, before_summary,
    after_summary, result, error_code, ip, user_agent, request_id, session_id, export_reason
  ) values (
    v_admin_id, v_partner_account_id, v_buyer_account_id, v_auth_uid, v_email, v_display_name,
    coalesce(v_role_codes, '{}'), v_actor_kind, p_action, p_target_table, p_target_id,
    v_subject_ids, p_result_count, p_query_filter, p_before_summary, p_after_summary,
    coalesce(p_result, 'success'), p_error_code, p_ip, left(p_user_agent, 500), p_request_id, p_session_id,
    p_export_reason
  )
  returning id into v_id;

  return v_id;
exception when others then
  raise warning 'private.log_audit failed for action=%: %', p_action, sqlerrm;
  return null;
end;
$$;

revoke execute on function private.log_audit(
  text, text, text, text, uuid[], integer, jsonb, jsonb, jsonb, text, text, inet, text, text, text
) from authenticated;


-- =============================================================================
-- §6. public.buyer_consent — append-only (mirrors partner_consent shape,
--     privacy review §5.1/§5.4/§8.3, D-14② third_party_share value reserved)
-- =============================================================================
-- No private.buyer_consent_meta split table (see file header note 3) — buyer
-- consent is always method='online_self', so there is no witnessing-operator
-- identity to hold.

create table if not exists public.buyer_consent (
  id uuid primary key default gen_random_uuid(),
  buyer_account_id uuid not null references public.buyer_account (id) on delete restrict,

  consent_type text not null check (consent_type in (
    'terms', 'privacy', 'marketing', 'third_party_share'
  )),
  granted boolean not null,

  -- Bound to lib/legal/buyerConsentVersions.ts, same 1:1-file-version
  -- discipline as partnerConsentVersions.ts (privacy review §8.3).
  document_version text,
  consent_locale text not null default 'ko' check (consent_locale in ('ko', 'en', 'ja')),

  method text not null default 'online_self' check (method = 'online_self'),
  collected_at timestamptz not null,
  recorded_at timestamptz not null default now(),

  created_at timestamptz not null default now(),

  constraint chk_buyer_consent_collected_at_not_future check (collected_at <= now() + interval '5 minutes')
);

comment on table public.buyer_consent is
  'Append-only, same convention as partner_consent (revocation = a NEW row '
  'with granted=false, never an UPDATE). "effective" consent for '
  '(buyer_account_id, consent_type) is the row with the latest recorded_at. '
  'consent_type=''third_party_share'' is a RESERVED VALUE ONLY (D-14②/BP-7): '
  'no code path in this migration ever inserts a row with this consent_type '
  '— finalize_buyer_signup() explicitly REJECTS it if present in the signup '
  'payload, and buyer_grant_consent() explicitly rejects it as a self-service '
  'target. It exists solely so a future per-case consent flow (ceo-advisor '
  'approval gated, D-14②) does not require a schema migration to add it.';

create index if not exists idx_buyer_consent_account_type_recorded
  on public.buyer_consent (buyer_account_id, consent_type, recorded_at desc);

alter table public.buyer_consent enable row level security;
alter table public.buyer_consent force row level security;
revoke all on public.buyer_consent from anon, authenticated, service_role;

create or replace function private.protect_buyer_consent_append_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'buyer_consent_append_only: buyer_consent rows cannot be updated or deleted (attempted %)', tg_op
    using errcode = 'P0001';
end;
$$;

drop trigger if exists trg_buyer_consent_append_only on public.buyer_consent;
create trigger trg_buyer_consent_append_only
  before update or delete on public.buyer_consent
  for each row execute function private.protect_buyer_consent_append_only();


-- =============================================================================
-- §7. Signup / login-bookkeeping / withdrawal / consent RPCs
-- =============================================================================

create or replace function public.finalize_buyer_signup(
  p_auth_user_id uuid,
  p_display_name text,
  p_consents jsonb, -- [{"consent_type":"terms","granted":true,"document_version":"...","consent_locale":"ko"}, ...]
  p_consent_locale text default 'ko'
)
returns table (buyer_account_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_item jsonb;
  v_has_terms boolean := false;
  v_has_privacy boolean := false;
begin
  for v_item in select * from jsonb_array_elements(coalesce(p_consents, '[]'::jsonb))
  loop
    -- D-14②: gate-crash guard — third_party_share must NEVER be settable at
    -- signup, "가입 시 포괄 동의는 반려" is not a UI-only rule.
    if v_item ->> 'consent_type' = 'third_party_share' then
      raise exception 'third_party_share_not_allowed_at_signup' using errcode = 'P0001';
    end if;
    if v_item ->> 'consent_type' = 'terms' and (v_item ->> 'granted')::boolean is true then
      v_has_terms := true;
    elsif v_item ->> 'consent_type' = 'privacy' and (v_item ->> 'granted')::boolean is true then
      v_has_privacy := true;
    end if;
  end loop;

  if not (v_has_terms and v_has_privacy) then
    raise exception 'consent_required';
  end if;

  begin
    insert into public.auth_principal (auth_user_id, principal_kind) values (p_auth_user_id, 'buyer');
  exception when unique_violation then
    raise exception 'auth_principal_conflict' using errcode = 'P0001';
  end;

  insert into public.buyer_account (auth_user_id, display_name, status)
  values (p_auth_user_id, p_display_name, 'active')
  returning id into v_account_id;

  for v_item in select * from jsonb_array_elements(p_consents)
  loop
    insert into public.buyer_consent (
      buyer_account_id, consent_type, granted, document_version, consent_locale, collected_at
    ) values (
      v_account_id,
      v_item ->> 'consent_type',
      (v_item ->> 'granted')::boolean,
      v_item ->> 'document_version',
      coalesce(v_item ->> 'consent_locale', p_consent_locale),
      now()
    );
  end loop;

  -- Same known limitation as finalize_partner_signup (20260829140000 §9):
  -- called via the service_role client, so auth.uid() is typically NULL here
  -- and log_audit() cannot attribute this to the new buyer account.
  perform private.log_audit(
    p_action := 'buyer.signup',
    p_target_table := 'buyer_account',
    p_target_id := v_account_id::text
  );

  return query select v_account_id;
end;
$$;

comment on function public.finalize_buyer_signup is
  'Called by POST /api/seepn/signup AFTER that route has already called '
  'supabase.auth.admin.createUser() (privacy review §5.2 BP-3 — Supabase '
  'Auth''s public sign-up toggle MUST stay OFF; this RPC is the only signup '
  'path). If this function raises, the route MUST clean up the just-created '
  'auth.users row (admin.deleteUser), exactly like partner signup''s EDGE-2.';

revoke all on function public.finalize_buyer_signup(uuid, text, jsonb, text) from public;
grant execute on function public.finalize_buyer_signup(uuid, text, jsonb, text) to service_role;
-- Intentionally NOT granted to authenticated or anon.


-- record_buyer_login(): the login flow (client or server route, right after
-- a successful signInWithPassword against the buyer-scoped client) MUST call
-- this once per session start. This is what makes buyer_account.last_login_at
-- an actual signal instead of a column nobody writes (unlike
-- partner_account.last_login_at today — see this file's header). It also
-- clears dormant_notice_sent_at: a fresh login cancels a pending dormancy
-- warning (D-14④'s "안내 후 30일" only makes sense if logging back in stops
-- the clock).
create or replace function public.record_buyer_login()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_account_id uuid := private.current_buyer_id(auth.uid());
begin
  if v_account_id is null then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  update public.buyer_account
  set last_login_at = now(), dormant_notice_sent_at = null
  where id = v_account_id;

  perform private.log_audit(
    p_action := 'buyer.login_success',
    p_target_table := 'buyer_account',
    p_target_id := v_account_id::text
  );
end;
$$;

revoke all on function public.record_buyer_login() from public;
grant execute on function public.record_buyer_login() to authenticated;


create or replace function public.buyer_grant_consent(
  p_consent_type text,
  p_granted boolean,
  p_document_version text default null,
  p_consent_locale text default 'ko'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_account_id uuid := private.current_buyer_id(v_auth_uid);
begin
  if v_account_id is null or not private.is_active_buyer(v_auth_uid) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  -- D-14②: 'third_party_share' is a reserved value only — no self-service
  -- toggle for it exists in v1.0 (§6 table comment).
  if p_consent_type <> 'marketing' then
    raise exception 'consent_type_not_self_service' using errcode = 'P0001';
  end if;

  insert into public.buyer_consent (
    buyer_account_id, consent_type, granted, document_version, consent_locale, collected_at
  ) values (
    v_account_id, p_consent_type, p_granted, p_document_version, p_consent_locale, now()
  );

  perform private.log_audit(
    p_action := case when p_granted then 'buyer.consent_grant' else 'buyer.consent_revoke' end,
    p_target_table := 'buyer_consent', p_target_id := v_account_id::text,
    p_subject_ids := array[v_account_id],
    p_after_summary := jsonb_build_object('consent_type', p_consent_type, 'granted', p_granted)
  );
end;
$$;

revoke all on function public.buyer_grant_consent(text, boolean, text, text) from public;
grant execute on function public.buyer_grant_consent(text, boolean, text, text) to authenticated;


create or replace function public.buyer_withdraw()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_account_id uuid := private.current_buyer_id(v_auth_uid);
begin
  if v_account_id is null or not private.is_active_buyer(v_auth_uid) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  update public.buyer_account
  set status = 'withdrawn', withdrawn_at = now()
  where id = v_account_id;

  -- BP-13: bookmarks are hard-deleted immediately on withdrawal — the only
  -- purpose they served (showing the buyer their own list) disappears with
  -- the account, unlike partner Match rows which survive as business records.
  delete from public.buyer_bookmark where buyer_account_id = v_account_id;

  -- BP-6(f): unresolved inquiries are force-closed and their body purged
  -- immediately — there is no longer a channel to reply to this buyer.
  update public.seepn_inquiry
  set status = 'closed', closed_at = now(), body = '[파기됨]', updated_at = now()
  where buyer_account_id = v_account_id and status <> 'closed';

  perform private.log_audit(
    p_action := 'buyer.withdraw', p_target_table := 'buyer_account', p_target_id := v_account_id::text,
    p_subject_ids := array[v_account_id]
  );
end;
$$;

comment on function public.buyer_withdraw is
  'Self-service only. The calling server route MUST additionally call '
  'supabase.auth.admin.signOut(auth_user_id, ''global'') right after this '
  'returns successfully (Auth Admin API, not reachable from SQL) — same '
  'requirement as partner_withdraw (20260829140000 §11a).';

revoke all on function public.buyer_withdraw() from public;
grant execute on function public.buyer_withdraw() to authenticated;


-- =============================================================================
-- §8. Public-listing 3-view split (privacy review §2 BP-1, GAP-1)
-- =============================================================================
-- private.partner_public_base applies the 3-layer public-listing gate EXACTLY
-- ONCE (privacy review §2.4 "3계층 게이트를 두 뷰에 손으로 복제하지 말 것").
-- The WHERE clause below is byte-for-byte the WHERE clause of the
-- public.partner_public view being dropped in this same section (F-3/F-13) —
-- not one condition changed — plus the two GAP-3 columns
-- (created_at, capability_completeness_pct) added to the SELECT list.

create or replace view private.partner_public_base as
select
  p.id,
  p.company_name_ko, p.company_name_en, p.founded_year, p.employee_band,
  p.location_region, p.website_url,
  p.supported_languages, p.overseas_experience, p.overseas_experience_countries,
  p.company_intro_text, p.company_intro_locale, p.representative_offerings, p.certifications,
  p.vertical,
  p.moq, p.price_band, p.lead_time_days, p.sample_available, p.sample_terms, p.oem_odm_type, p.export_record,
  p.service_types, p.project_min_size, p.pricing_model, p.standard_lead_time, p.reference_projects,
  p.team_size_band, p.remote_onsite,
  p.created_at,                     -- GAP-3
  p.capability_completeness_pct     -- GAP-3 (kept here for a future sort option; NOT surfaced by either public view below — see §7's header note 4 / BP-12)
from public.partner p
left join public.partner_account pa on pa.id = p.owner_account_id
where p.public_listing_state = 'on'
  and p.verification_state = 'verified'
  and (pa.id is null or pa.status <> 'withdrawn')
  and exists (
    select 1 from public.partner_consent pc
    where pc.partner_id = p.id
      and pc.consent_type = 'public_listing'
      and pc.granted = true
      and pc.recorded_at = (
        select max(pc2.recorded_at) from public.partner_consent pc2
        where pc2.partner_id = p.id and pc2.consent_type = 'public_listing'
      )
  );

comment on view private.partner_public_base is
  'Privacy review §2.4: the ONLY place the public-listing 3-layer gate is '
  'evaluated for buyer-facing reads. NOT in the Exposed Schema (private), NO '
  'GRANT to anyone — every reader is one of the two public views below. NO '
  'contact/business-registration-number/document columns exist here, by '
  'construction (same guarantee the dropped partner_public view had, F-2).';

revoke all on private.partner_public_base from public, anon, authenticated;


create or replace view public.partner_list_public as
select
  id, company_name_ko, company_name_en, location_region, vertical,
  service_types, supported_languages, overseas_experience, created_at
from private.partner_public_base;

comment on view public.partner_list_public is
  'BY-08 (bidirectional-anon list). Deliberately NOT `select * from
  private.partner_public_base` — enumerated columns only, so a future column
  added to the base view does not silently leak into the anon-readable list
  (privacy review §2.5 "select p.* 형태의 뷰 금지" principle, applied here
  too even though the immediate risk that warning names is public.partner
  itself, not this view).';

grant select on public.partner_list_public to anon, authenticated;


create or replace view public.partner_detail_buyer as
select
  id, company_name_ko, company_name_en, founded_year, employee_band,
  location_region, website_url,
  supported_languages, overseas_experience, overseas_experience_countries,
  company_intro_text, company_intro_locale, representative_offerings, certifications,
  vertical,
  moq, price_band, lead_time_days, sample_available, sample_terms, oem_odm_type, export_record,
  service_types, project_min_size, pricing_model, standard_lead_time, reference_projects,
  team_size_band, remote_onsite,
  created_at
from private.partner_public_base
where (select private.is_active_buyer());

comment on view public.partner_detail_buyer is
  'BY-09 (login-gated detail, D-3''). private.is_active_buyer() is the '
  '"목적 제한" layer per privacy review §2.5: grant-to-authenticated alone '
  'would let a PARTNER session (also `authenticated`) bulk-read every '
  'competitor''s detail row, which is not what public_listing consent was '
  'given for. NO contact/business-registration-number/document columns '
  '(PR-1/B-9c'' — unchanged from the dropped view). capability_completeness_pct '
  'is intentionally NOT selected here (file header note 4).';

revoke all on public.partner_detail_buyer from anon, authenticated;
grant select on public.partner_detail_buyer to authenticated; -- anon: no grant, ever.


-- privacy review §2.2: F-13 confirmed zero runtime references to
-- public.partner_public outside a comment/derived-constant in
-- lib/supplier/publicListingDisclosure.ts. Safe to drop outright rather than
-- leave a "named _public but not actually anon-readable" trap in the schema.
drop view if exists public.partner_public;


-- =============================================================================
-- §9. Category public read path (privacy review §3 BP-2, GAP-2)
-- =============================================================================

create or replace view public.partner_category_public as
select psc.partner_id, psc.standard_category_id
from public.partner_standard_category psc
join private.partner_public_base b on b.id = psc.partner_id;

comment on view public.partner_category_public is
  'Privacy review §3.2: joins on private.partner_public_base (NOT a hand-
  copied WHERE clause) so the 3-layer public-listing gate is automatically
  inherited — a partner that disappears from partner_list_public/
  partner_detail_buyer disappears from here in the same statement, with no
  possibility of drift. Only 2 uuid columns, no created_at (no use for it —
  privacy review §3.2 table). Not personal data (§3.2 판정).';

grant select on public.partner_category_public to anon, authenticated;


create or replace view public.partner_category_count_public as
select standard_category_id, count(*)::integer as partner_count
from public.partner_category_public
group by standard_category_id;

comment on view public.partner_category_count_public is
  'Privacy review §3.3: direct-link counts only (no ancestor rollup — see
  public.get_standard_category_rollup_counts() below for that). Reviewed and
  cleared: small counts do not create a re-identification risk because the
  referenced company''s name is already in partner_list_public (§3.3 table).';

grant select on public.partner_category_count_public to anon, authenticated;


create or replace function public.get_standard_category_rollup_counts()
returns table (standard_category_id uuid, partner_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  with recursive descendants as (
    select id as ancestor_id, id as node_id from public.standard_category
    union all
    select d.ancestor_id, c.id
    from public.standard_category c
    join descendants d on c.parent_id = d.node_id
  )
  select d.ancestor_id as standard_category_id, count(distinct pcp.partner_id)::integer as partner_count
  from descendants d
  join public.partner_category_public pcp on pcp.standard_category_id = d.node_id
  group by d.ancestor_id;
$$;

comment on function public.get_standard_category_rollup_counts is
  'D-S4/B-13: L1 (대분류) badges need "how many public partners fall under
  this node OR any of its descendants", not just direct links — this is the
  ancestor-closure rollup screen-spec §4.2/privacy-review §3.3 flagged as
  needed. Backed entirely by public data (standard_category + the already-
  gated partner_category_public), so safe to grant to anon.';

revoke all on function public.get_standard_category_rollup_counts() from public;
grant execute on function public.get_standard_category_rollup_counts() to anon, authenticated;


-- =============================================================================
-- §10. public.buyer_bookmark (B-12a, privacy review §6 BP-13)
-- =============================================================================

create table if not exists public.buyer_bookmark (
  buyer_account_id uuid not null references public.buyer_account (id) on delete cascade,
  partner_id uuid not null references public.partner (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (buyer_account_id, partner_id)
);

comment on table public.buyer_bookmark is
  'B-12a. Privacy review §6.2: hard-deleted on buyer withdrawal (see
  buyer_withdraw() §7) — bookmarks are NOT retained like partner Match rows,
  because the sole purpose (showing the buyer their own saved list) ends with
  the account. Deliberately NOT audited (§4.2 "감사하지 않을 것" — add/remove
  has no security value and would bloat audit_log).';

create index if not exists idx_buyer_bookmark_partner_id on public.buyer_bookmark (partner_id);

alter table public.buyer_bookmark enable row level security;
alter table public.buyer_bookmark force row level security;
revoke all on public.buyer_bookmark from anon, authenticated;

grant select, insert, delete on public.buyer_bookmark to authenticated;
-- No UPDATE grant/policy — a bookmark is either present or absent.
-- Deliberately NO admin-facing policy of any kind — see get_own_partner_
-- bookmark_count() below for the ONLY way partner-side code ever learns
-- anything about buyer_bookmark, and it returns an aggregate integer only.

create policy buyer_bookmark_self_select on public.buyer_bookmark
  for select to authenticated
  using ((select private.is_active_buyer()) and buyer_account_id = (select private.current_buyer_id()));

create policy buyer_bookmark_self_insert on public.buyer_bookmark
  for insert to authenticated
  with check ((select private.is_active_buyer()) and buyer_account_id = (select private.current_buyer_id()));

create policy buyer_bookmark_self_delete on public.buyer_bookmark
  for delete to authenticated
  using ((select private.is_active_buyer()) and buyer_account_id = (select private.current_buyer_id()));


create or replace function public.get_own_partner_bookmark_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.buyer_bookmark bb
  where bb.partner_id = (select id from public.partner where owner_account_id = private.current_partner_id());
$$;

comment on function public.get_own_partner_bookmark_count is
  'Privacy review §6.3: the ONLY thing a partner may ever learn about
  buyer_bookmark — a single aggregate integer for their OWN partner row, never
  which buyer, never a time series (a time-bucketed series at low counts would
  let re-identification creep back in — explicitly warned against in the
  review, so deliberately not built).';

revoke all on function public.get_own_partner_bookmark_count() from public;
grant execute on function public.get_own_partner_bookmark_count() to authenticated;


-- =============================================================================
-- §11. public.seepn_inquiry (B-18, INQ-1..7, privacy review §5.3 BP-6/BP-7/BP-8)
-- =============================================================================

create table if not exists public.seepn_inquiry (
  id uuid primary key default gen_random_uuid(),
  buyer_account_id uuid not null references public.buyer_account (id) on delete restrict,
  partner_id uuid not null references public.partner (id) on delete restrict,

  -- NOTE (found via local migration replay, 2026-09-10): the lower bound
  -- (20 chars, matching screen-spec §7.2) is enforced by create_seepn_inquiry()
  -- at INSERT time only, NOT here at the table level. Reason: the retention
  -- purge sentinel '[파기됨]' (buyer_withdraw() / purge_expired_seepn_inquiry_body()
  -- / purge_dormant_buyer_accounts()) is only 5 characters — a table-level
  -- `between 20 and 2000` CHECK would make every purge UPDATE fail. The 2000
  -- upper bound stays as a table-level backstop (defense in depth even though
  -- create_seepn_inquiry is currently the only INSERT path).
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed')),
  assigned_admin_id uuid references public.admin_user (id) on delete restrict,
  closed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.seepn_inquiry is
  'B-18 minimal schema (INQ-1). Deliberately ONLY these columns — no
  category/budget/timeline/structured fields (SP-13 / B-11 boundary: adding
  any of those makes this B-11, which is Won''t in v1.0). No sender contact
  column either (INQ-3): the buyer''s email is looked up from auth.users /
  buyer_account at read time by get_seepn_inquiry_contact() (§12), never
  snapshotted here (privacy review §5.3(e) — a snapshot would create a
  second PII store and mean "withdrawn buyer" could still be emailed).';

create index if not exists idx_seepn_inquiry_buyer_account_id on public.seepn_inquiry (buyer_account_id);
create index if not exists idx_seepn_inquiry_partner_id on public.seepn_inquiry (partner_id);
create index if not exists idx_seepn_inquiry_status_created on public.seepn_inquiry (status, created_at desc);
create index if not exists idx_seepn_inquiry_body_purge_pending
  on public.seepn_inquiry (closed_at) where status = 'closed' and body <> '[파기됨]';

alter table public.seepn_inquiry enable row level security;
alter table public.seepn_inquiry force row level security;
revoke all on public.seepn_inquiry from anon, authenticated;

drop trigger if exists trg_seepn_inquiry_set_updated_at on public.seepn_inquiry;
create trigger trg_seepn_inquiry_set_updated_at
  before update on public.seepn_inquiry
  for each row execute function private.set_updated_at();

-- Self-read only (BY-12 문의 내역). No INSERT/UPDATE/DELETE grant to
-- authenticated at all — every write goes through a SECURITY DEFINER RPC
-- below (create_seepn_inquiry / admin_update_seepn_inquiry_status /
-- admin_assign_seepn_inquiry / buyer_withdraw). DELIBERATE OMISSION: no
-- admin-facing SELECT policy exists on this table (privacy review §5.3(d) —
-- "목록에 본문 미리보기 없음" is enforced structurally here, not just in the
-- UI: an admin session running `select * from seepn_inquiry` gets ZERO rows,
-- always. The only admin reads are admin_list_seepn_inquiries() (masked,
-- no body) and get_seepn_inquiry_detail() (full body, audited) in §12.
grant select on public.seepn_inquiry to authenticated;

create policy seepn_inquiry_self_select on public.seepn_inquiry
  for select to authenticated
  using ((select private.is_active_buyer()) and buyer_account_id = (select private.current_buyer_id()));


create or replace function public.create_seepn_inquiry(p_partner_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_buyer_id uuid := private.current_buyer_id(v_auth_uid);
  v_inquiry_id uuid;
  v_count_1h integer;
  v_count_24h integer;
  v_count_partner_24h integer;
begin
  if v_buyer_id is null or not private.is_active_buyer(v_auth_uid) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if p_body is null or char_length(p_body) < 20 or char_length(p_body) > 2000 then
    raise exception 'invalid_body_length';
  end if;

  if not exists (select 1 from public.partner where id = p_partner_id) then
    raise exception 'partner_not_found' using errcode = 'P0002';
  end if;

  -- BP-8: rate limit is enforced HERE (inside the SECURITY DEFINER RPC, via a
  -- direct DB count), never in a calling server route — a route-level limit
  -- is trivially bypassed because this RPC is granted to `authenticated` and
  -- a buyer can call it directly via PostgREST with their own JWT (privacy
  -- review §5.3(g)). Thresholds are operationally adjustable; the REQUIREMENT
  -- is the location (inside the DB), not these specific numbers.
  select count(*) into v_count_1h from public.seepn_inquiry
  where buyer_account_id = v_buyer_id and created_at > now() - interval '1 hour';
  if v_count_1h >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select count(*) into v_count_24h from public.seepn_inquiry
  where buyer_account_id = v_buyer_id and created_at > now() - interval '24 hours';
  if v_count_24h >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select count(*) into v_count_partner_24h from public.seepn_inquiry
  where buyer_account_id = v_buyer_id and partner_id = p_partner_id and created_at > now() - interval '24 hours';
  if v_count_partner_24h >= 3 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.seepn_inquiry (buyer_account_id, partner_id, body)
  values (v_buyer_id, p_partner_id, p_body)
  returning id into v_inquiry_id;

  perform private.log_audit(
    p_action := 'seepn_inquiry.create',
    p_target_table := 'seepn_inquiry', p_target_id := v_inquiry_id::text,
    p_subject_ids := array[p_partner_id]
  );

  return v_inquiry_id;
end;
$$;

comment on function public.create_seepn_inquiry is
  'D-S5/INQ-2/SP-13: exactly 2 parameters, on purpose — no sender-contact
  parameter (INQ-3, server looks it up), no structured fields (category/
  budget/timeline — SP-13 B-11 boundary). Adding a parameter to this
  function''s signature without a corresponding product-planner sign-off is a
  scope violation, not a refactor.';

revoke all on function public.create_seepn_inquiry(uuid, text) from public;
grant execute on function public.create_seepn_inquiry(uuid, text) to authenticated;


create or replace function public.admin_list_seepn_inquiries(
  p_status text default null,
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  partner_id uuid,
  partner_company_name_ko text,
  buyer_display_name_masked text,
  status text,
  assigned_admin_id uuid,
  assigned_admin_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    private.is_active_admin() and private.is_aal2()
    and private.has_menu_permission('lead_management', 'read')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  perform private.log_audit(p_action := 'admin_seepn_inquiry.list');

  return query
  select
    si.id, si.partner_id, p.company_name_ko,
    private.mask_name(ba.display_name) as buyer_display_name_masked,
    si.status, si.assigned_admin_id, au.display_name as assigned_admin_name,
    si.created_at
  from public.seepn_inquiry si
  join public.partner p on p.id = si.partner_id
  join public.buyer_account ba on ba.id = si.buyer_account_id
  left join public.admin_user au on au.id = si.assigned_admin_id
  where (p_status is null or si.status = p_status)
    and (
      p_search is null or p_search = ''
      or p.company_name_ko ilike '%' || p_search || '%'
      or ba.display_name ilike '%' || p_search || '%'
    )
  order by si.created_at desc
  limit greatest(least(coalesce(p_limit, 50), 200), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

comment on function public.admin_list_seepn_inquiries is
  'Privacy review §5.3(d)/(e): NO body column in the return shape — "본문
  미리보기 없음" (기본값 채택). buyer_display_name_masked uses
  private.mask_name(), never the raw display_name (raw is only available via
  get_seepn_inquiry_detail(), and raw email only via
  get_seepn_inquiry_contact()).';

revoke all on function public.admin_list_seepn_inquiries(text, text, integer, integer) from public;
grant execute on function public.admin_list_seepn_inquiries(text, text, integer, integer) to authenticated;


create or replace function public.get_seepn_inquiry_detail(p_inquiry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_audit_id bigint;
begin
  if not (
    private.is_active_admin() and private.is_aal2()
    and private.has_menu_permission('lead_management', 'read')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  select si.*, p.company_name_ko as partner_company_name_ko,
         ba.display_name as buyer_display_name, au.display_name as assigned_admin_name
  into v_row
  from public.seepn_inquiry si
  join public.partner p on p.id = si.partner_id
  join public.buyer_account ba on ba.id = si.buyer_account_id
  left join public.admin_user au on au.id = si.assigned_admin_id
  where si.id = p_inquiry_id;

  if not found then
    raise exception 'inquiry_not_found' using errcode = 'P0002';
  end if;

  -- INQ-7: opening the detail view (which DOES reveal the body — screen-spec
  -- §7.3 "상세 클릭시에만 노출") is itself audited, unlike list access which
  -- is masked and lower-stakes.
  v_audit_id := private.log_audit(
    p_action := 'admin_seepn_inquiry.view',
    p_target_table := 'seepn_inquiry', p_target_id := p_inquiry_id::text,
    p_subject_ids := array[v_row.partner_id]
  );
  if v_audit_id is null then
    raise exception 'audit_log_write_failed: inquiry detail view aborted because the audit record could not be written'
      using errcode = '55000';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'partner_id', v_row.partner_id,
    'partner_company_name_ko', v_row.partner_company_name_ko,
    'buyer_display_name', v_row.buyer_display_name,
    'body', v_row.body,
    'status', v_row.status,
    'assigned_admin_id', v_row.assigned_admin_id,
    'assigned_admin_name', v_row.assigned_admin_name,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at,
    'closed_at', v_row.closed_at
  );
end;
$$;

revoke all on function public.get_seepn_inquiry_detail(uuid) from public;
grant execute on function public.get_seepn_inquiry_detail(uuid) to authenticated;


create or replace function public.get_seepn_inquiry_contact(p_inquiry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_audit_id bigint;
begin
  -- Clone of get_partner_contact's three-stage deny + atomic audit-or-
  -- rollback shape (20260829140000 §6), per privacy review §5.3(e).
  if not (private.is_active_admin() and private.is_aal2()) then
    perform private.log_audit(
      p_action := 'auth.access_denied', p_result := 'denied',
      p_target_table := 'seepn_inquiry', p_target_id := p_inquiry_id::text
    );
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if not private.has_menu_permission('lead_management', 'read') then
    perform private.log_audit(
      p_action := 'auth.access_denied', p_result := 'denied',
      p_target_table := 'seepn_inquiry', p_target_id := p_inquiry_id::text
    );
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if not private.has_pii_access() then
    perform private.log_audit(
      p_action := 'admin_seepn_inquiry.contact_reveal', p_result := 'denied',
      p_target_table := 'seepn_inquiry', p_target_id := p_inquiry_id::text
    );
    raise exception 'pii_access_denied' using errcode = '42501';
  end if;

  select si.buyer_account_id, ba.display_name, u.email
  into v_row
  from public.seepn_inquiry si
  join public.buyer_account ba on ba.id = si.buyer_account_id
  join auth.users u on u.id = ba.auth_user_id
  where si.id = p_inquiry_id;

  if not found then
    raise exception 'inquiry_not_found' using errcode = 'P0002';
  end if;

  v_audit_id := private.log_audit(
    p_action := 'admin_seepn_inquiry.contact_reveal', p_result := 'success',
    p_target_table := 'seepn_inquiry', p_target_id := p_inquiry_id::text,
    p_subject_ids := array[v_row.buyer_account_id]
  );
  if v_audit_id is null then
    raise exception 'audit_log_write_failed: contact reveal aborted because the audit record could not be written'
      using errcode = '55000';
  end if;

  return jsonb_build_object('display_name', v_row.display_name, 'email', v_row.email);
end;
$$;

comment on function public.get_seepn_inquiry_contact is
  'The ONLY path from an admin session to a buyer''s raw email/display_name.
  buyer_account carries no admin-facing SELECT policy at all (§2) — this
  function (owned by the table owner, SECURITY DEFINER) is what bypasses that
  deliberately, with an audit trail get_partner_contact-style. NEVER snapshot
  the returned email onto seepn_inquiry (privacy review §5.3(e) — "탈퇴한
  바이어에게는 회신할 수 없다... 그것이 올바른 동작").';

revoke all on function public.get_seepn_inquiry_contact(uuid) from public;
grant execute on function public.get_seepn_inquiry_contact(uuid) to authenticated;


create or replace function public.admin_update_seepn_inquiry_status(p_inquiry_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    private.is_active_admin() and private.is_aal2()
    and private.has_menu_permission('lead_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if p_status not in ('new', 'in_progress', 'closed') then
    raise exception 'invalid_status';
  end if;

  update public.seepn_inquiry
  set status = p_status,
      closed_at = case when p_status = 'closed' then now() else null end,
      updated_at = now()
  where id = p_inquiry_id;

  if not found then
    raise exception 'inquiry_not_found' using errcode = 'P0002';
  end if;

  perform private.log_audit(
    p_action := 'admin_seepn_inquiry.status_change',
    p_target_table := 'seepn_inquiry', p_target_id := p_inquiry_id::text,
    p_after_summary := jsonb_build_object('status', p_status)
  );
end;
$$;

revoke all on function public.admin_update_seepn_inquiry_status(uuid, text) from public;
grant execute on function public.admin_update_seepn_inquiry_status(uuid, text) to authenticated;


create or replace function public.admin_assign_seepn_inquiry(p_inquiry_id uuid, p_admin_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    private.is_active_admin() and private.is_aal2()
    and private.has_menu_permission('lead_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if p_admin_id is not null and not exists (select 1 from public.admin_user where id = p_admin_id) then
    raise exception 'admin_not_found' using errcode = 'P0002';
  end if;

  update public.seepn_inquiry set assigned_admin_id = p_admin_id, updated_at = now()
  where id = p_inquiry_id;

  if not found then
    raise exception 'inquiry_not_found' using errcode = 'P0002';
  end if;

  perform private.log_audit(
    p_action := 'admin_seepn_inquiry.assign',
    p_target_table := 'seepn_inquiry', p_target_id := p_inquiry_id::text,
    p_after_summary := jsonb_build_object('assigned_admin_id', p_admin_id)
  );
end;
$$;

revoke all on function public.admin_assign_seepn_inquiry(uuid, uuid) from public;
grant execute on function public.admin_assign_seepn_inquiry(uuid, uuid) to authenticated;


-- =============================================================================
-- §12. private.breach_notification_targets() — D-14① / BP-22
-- =============================================================================
-- docs/03-security/data-breach-response-procedure-v1.0.md §5-1: the 5 queries
-- listed there, wrapped into one definer function so a real incident does not
-- start with someone hand-writing SQL against auth/private schemas under
-- time pressure. service_role only — this function reads auth.users and
-- private.partner_contact, neither of which anon/authenticated may ever see.

create or replace function private.breach_notification_targets(
  p_scope text,             -- 'admin' | 'partner_account' | 'partner_contact' | 'buyer' | 'fkp_request' | 'all'
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  scope text,
  subject_id text,
  email text,
  display_name text,
  extra jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_scope not in ('admin', 'partner_account', 'partner_contact', 'buyer', 'fkp_request', 'all') then
    raise exception 'invalid_scope';
  end if;

  -- Every call is audited BEFORE any rows are returned — a breach-response
  -- PII export is itself a security-sensitive event (§5-1 backend-developer
  -- note: "사고 대응 중의 PII 대량 조회도 감사 대상이다").
  perform private.log_audit(
    p_action := 'security.breach_target_export',
    p_query_filter := jsonb_build_object('scope', p_scope, 'from', p_from, 'to', p_to)
  );

  return query
  -- (1) Admins
  select 'admin'::text, au.id::text, u.email, au.display_name, jsonb_build_object('status', au.status)
  from public.admin_user au
  join auth.users u on u.id = au.auth_user_id
  where p_scope in ('admin', 'all')
    and au.status = 'active'
    and (p_from is null or au.created_at >= p_from)
    and (p_to is null or au.created_at <= p_to)

  union all
  -- (2) Partner login accounts
  select 'partner_account'::text, pa.id::text, u.email, pa.display_name, jsonb_build_object('status', pa.status)
  from public.partner_account pa
  join auth.users u on u.id = pa.auth_user_id
  where p_scope in ('partner_account', 'all')
    and pa.status <> 'withdrawn'
    and (p_from is null or pa.created_at >= p_from)
    and (p_to is null or pa.created_at <= p_to)

  union all
  -- (3) Partner contacts (raw PII from private.partner_contact)
  select 'partner_contact'::text, pc.partner_id::text, pc.contact_email, pc.contact_name,
         jsonb_build_object('contact_phone', pc.contact_phone)
  from private.partner_contact pc
  where p_scope in ('partner_contact', 'all')

  union all
  -- (4) SEEPN buyer accounts (P5a — did not exist before this migration)
  select 'buyer'::text, ba.id::text, u.email, ba.display_name, jsonb_build_object('status', ba.status)
  from public.buyer_account ba
  join auth.users u on u.id = ba.auth_user_id
  where p_scope in ('buyer', 'all')
    and ba.status <> 'withdrawn'
    and (p_from is null or ba.created_at >= p_from)
    and (p_to is null or ba.created_at <= p_to)

  union all
  -- (5) FKP request submitters (non-anonymized only)
  select 'fkp_request'::text, r.id::text, r.contact, null::text,
         jsonb_build_object('locale', r.locale, 'created_at', r.created_at)
  from public.requests r
  where p_scope in ('fkp_request', 'all')
    and r.anonymized_at is null
    and (p_from is null or r.created_at >= p_from)
    and (p_to is null or r.created_at <= p_to);
end;
$$;

comment on function private.breach_notification_targets is
  'D-14①/BP-22 (data-breach-response-procedure-v1.0.md §5-1). service_role
  ONLY — never grant to anon/authenticated, even to an admin session (this
  function does not check is_active_admin() on purpose: it is meant to be run
  from the Supabase Dashboard SQL Editor or a service_role script during an
  active incident, not from application code). Every call is logged to
  audit_log regardless of who invokes it.';

revoke all on function private.breach_notification_targets(text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function private.breach_notification_targets(text, timestamptz, timestamptz) to service_role;


-- =============================================================================
-- §13. Admin menu seed — SEEPN inquiry lightweight sub-page (INQ-5, D-5)
-- =============================================================================
-- D-5 ("별도 Admin 앱/메뉴 신설 금지"): a sub-menu under lead_management, not
-- a new top-level menu. Actual RPC permission gates in §11 check
-- has_menu_permission('lead_management', ...) directly (the PARENT code),
-- matching privacy review §5.3(e)'s explicit design — this menu row exists
-- for navigation/visibility only, it is not itself consulted by any RPC.

insert into public.menu (code, parent_id, display_name, path, menu_type, sort_order, is_active)
select 'seepn_inquiry_management', m.id, '운영자 문의(SEEPN)', '/admin/leads/inquiries', 'page', 30, true
from public.menu m where m.code = 'lead_management'
on conflict (code) do nothing;

insert into public.role_menu_permission (role_id, menu_id, can_read, can_create, can_update, can_delete, can_export)
select r.id, m.id, true, false, true, false, false
from public.role r
cross join public.menu m
where r.code = 'super_admin'
  and m.code = 'seepn_inquiry_management'
on conflict (role_id, menu_id) do update set
  can_read = true, can_update = true;


-- =============================================================================
-- §14. Retention — buyer dormancy (D-14④) + inquiry body purge (BP-6(f))
-- =============================================================================

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

  -- Diff base: 20260906100000 §15 (the latest file to touch this constraint,
  -- verified by grep across every later-filenamed migration). Full prior list
  -- reproduced verbatim; 'buyer_account_dormant_purge' and
  -- 'seepn_inquiry_body_purge' are the only new values.
  alter table public.retention_jobs
    add constraint retention_jobs_job_type_check
    check (job_type in (
      'anonymize', 'hard_delete', 'audit_purge', 'failed_submission_purge',
      'partner_unconsented_purge', 'partner_doc_purge', 'partner_rejected_purge',
      'partner_consent_meta_purge', 'partner_doc_storage_purge',
      'match_freetext_purge',
      'buyer_account_dormant_purge', 'seepn_inquiry_body_purge'
    ));
end;
$$;


create or replace function private.mark_dormant_buyer_accounts_for_notice()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  -- D-14④: 12 months since last_login_at (or since created_at for an account
  -- that never logged in again after signup — last_login_at is only set by
  -- record_buyer_login(), so a never-re-logged-in account has last_login_at
  -- still null; coalesce to created_at so that case is not skipped forever).
  update public.buyer_account
  set dormant_notice_sent_at = now()
  where status = 'active'
    and dormant_notice_sent_at is null
    and coalesce(last_login_at, created_at) < now() - interval '12 months';
  get diagnostics v_count = row_count;

  perform private.log_audit(
    p_action := 'buyer.dormant_notice_sent',
    p_result_count := v_count
  );

  insert into public.retention_jobs (job_type, target_condition, anonymized_count, notes)
  values (
    'buyer_account_dormant_purge',
    'status=''active'' and coalesce(last_login_at, created_at) < now() - interval ''12 months'' and dormant_notice_sent_at is null',
    v_count,
    'D-14④ notice phase — this batch only FLAGS accounts (sets
    dormant_notice_sent_at) so an out-of-band process (this project currently
    has no bulk-email sender — same constraint as
    data-breach-response-procedure-v1.0.md §5-2) can pick up
    WHERE dormant_notice_sent_at IS NOT NULL AND status=''active'' rows and
    actually notify. Purge itself happens 30 days later, in
    purge_dormant_buyer_accounts() below, per this same
    dormant_notice_sent_at column.'
  );

  return v_count;
end;
$$;


create or replace function private.purge_dormant_buyer_accounts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account record;
  v_count integer := 0;
begin
  for v_account in
    select id from public.buyer_account
    where status = 'active'
      and dormant_notice_sent_at is not null
      and dormant_notice_sent_at < now() - interval '30 days'
  loop
    update public.buyer_account
    set status = 'withdrawn', withdrawn_at = now()
    where id = v_account.id;

    delete from public.buyer_bookmark where buyer_account_id = v_account.id;

    update public.seepn_inquiry
    set status = 'closed', closed_at = now(), body = '[파기됨]', updated_at = now()
    where buyer_account_id = v_account.id and status <> 'closed';

    perform private.log_audit(
      p_action := 'buyer.dormant_purge',
      p_target_table := 'buyer_account', p_target_id := v_account.id::text,
      p_subject_ids := array[v_account.id]
    );

    v_count := v_count + 1;
  end loop;

  insert into public.retention_jobs (job_type, target_condition, anonymized_count, notes)
  values (
    'buyer_account_dormant_purge',
    'status=''active'' and dormant_notice_sent_at < now() - interval ''30 days''',
    v_count,
    'D-14④ / ceo-advisor decision: 12-month dormancy notice, then 30 days
    later this batch withdraws the account (same effect as self-service
    buyer_withdraw()). BP-24 dependency: this batch is only correct if
    run_daily_retention_batches() is actually registered with pg_cron — that
    registration status must be confirmed (Dashboard, not a migration) before
    the 12-month/30-day figures are published in the buyer privacy policy.'
  );

  return v_count;
end;
$$;


create or replace function private.purge_expired_seepn_inquiry_body()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  -- BP-6(f): body purged 12 months after closure (requests 12/24-month
  -- retention precedent) — the row itself (id/partner_id/buyer_account_id/
  -- status/created_at) survives indefinitely as the §1.3 지표 소스 (운영자
  -- 문의 수 / 문의→매칭 전환).
  update public.seepn_inquiry
  set body = '[파기됨]', updated_at = now()
  where status = 'closed'
    and closed_at is not null
    and closed_at < now() - interval '12 months'
    and body <> '[파기됨]';
  get diagnostics v_count = row_count;

  insert into public.retention_jobs (job_type, target_condition, anonymized_count, notes)
  values (
    'seepn_inquiry_body_purge',
    'status=''closed'' and closed_at < now() - interval ''12 months''',
    v_count,
    'BP-6(f): body-only purge, row survives as the inbound-inquiry metric
    source (PRD §1.3).'
  );

  return v_count;
end;
$$;


-- Extend the daily batch runner. Diff base: 20260906100000 §14 (the latest
-- full definition — verified no later-filenamed migration touches this
-- function). All 8 pre-existing blocks reproduced verbatim; only the 3 new
-- blocks at the end are new.
create or replace function private.run_daily_retention_batches()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
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

  begin
    perform private.purge_orphan_match_freetext();
  exception when others then
    raise warning 'purge_orphan_match_freetext failed: %', sqlerrm;
  end;

  -- SEEPN buyer web (P5a): independent blocks, added 20260910100000. Must
  -- never be merged into any block above.
  begin
    perform private.mark_dormant_buyer_accounts_for_notice();
  exception when others then
    raise warning 'mark_dormant_buyer_accounts_for_notice failed: %', sqlerrm;
  end;

  begin
    perform private.purge_dormant_buyer_accounts();
  exception when others then
    raise warning 'purge_dormant_buyer_accounts failed: %', sqlerrm;
  end;

  begin
    perform private.purge_expired_seepn_inquiry_body();
  exception when others then
    raise warning 'purge_expired_seepn_inquiry_body failed: %', sqlerrm;
  end;
end;
$$;

-- =============================================================================
-- End of SEEPN buyer web (P5a) migration.
-- =============================================================================
