-- =============================================================================
-- SEEPN Unified Platform v1.0 — Partner (Capability) schema
-- =============================================================================
--
-- Design Ref:
--   - docs/01-plan/features/seepn-unified-platform-v1.0.prd.md §3.2.2 (Capability
--     fields, Common Core + Vertical A/B), §3.2.3 (PC-1..PC-7), §3.2.5 (PR-1..PR-9)
--   - docs/03-security/partner-signup-privacy-review.md §3 (partner_consent +
--     public-listing 3-layer gate), §4 (PR-1 contact table, PR-2 documents,
--     PR-5 retention matrix, PR-9 withdrawal), §5 (PR-10..PR-13), §6.2 (consent
--     type list), §7.2 (Q-2/Q-3 recommended values, adopted below)
--   - Requires 20260829130000_partner_auth_foundation.sql (auth_principal,
--     partner_account, private.is_active_partner/current_partner_id, the
--     private.owns_partner STUB superseded for real in §2 below)
--
-- STATUS: not yet applied. Apply strictly after 20260829130000.
--
-- Deliberate deviations from a literal reading of the source docs (see the
-- section-local comments for the "why" of each):
--   1. Most "필수" Capability columns are NULLable at the table level, not
--      NOT NULL. SS-6 requires "부분 저장 후 이어쓰기" (draft/partial save),
--      which is incompatible with NOT NULL on every PRD-"required" field.
--      "Required" is enforced at the point that matters — the draft/rejected
--      -> submitted transition (private.partner_profile_submission_gaps(),
--      called from partner_submit_for_review()) — not at every INSERT/UPDATE.
--   2. partner_consent revocation is modeled as a NEW row (granted=false),
--      not an UPDATE of revoked_at — the review explicitly allows either,
--      "둘 중 하나만 쓰십시오" (§3.2). This keeps the table's append-only
--      trigger unconditional (no GUC escape hatch needed at all, simpler
--      than audit_log's), and "effective consent" is just "latest row per
--      (partner_id, consent_type) by recorded_at".
--   3. PII masking for the admin/self list view is NOT built as generated
--      columns on private.partner_contact (the review's stated preference,
--      "전자를 권고") but as plain (non-generated) columns synced onto
--      public.partner by an AFTER INSERT/UPDATE trigger on
--      private.partner_contact. Reason: `private` is not a PostgREST Exposed
--      Schema, so masked values still need a `public`-schema surface one way
--      or another; syncing onto the already-`public`, already-RLS-gated
--      `partner` row lets list screens read masked contact with the exact
--      same single SELECT they already issue for every other partner column,
--      instead of a bespoke join/RPC per list row. Trade-off: these columns
--      are a cache, never authoritative — get_partner_contact() /
--      get_own_partner_contact() (querying private.partner_contact directly)
--      remain the only source of truth for raw or "just revealed" values.
--   4. Q-2 (사업자등록증 원본 보관) and Q-3 (partner_consent 보관기간) are
--      answered with the privacy review's own recommendations (90 days
--      post-verification / 3 years post-withdrawal) rather than left open —
--      per the task brief, these are value decisions, not structural ones,
--      and the review says backend-developer should not wait on them.
-- =============================================================================


-- =============================================================================
-- §1. public.partner — the Capability entity
-- =============================================================================

create table if not exists public.partner (
  id uuid primary key default gen_random_uuid(),

  -- --- provenance / lifecycle (PC-1, PC-2, PC-3, PC-5, PR-10, PR-11, PR-13) ---
  intake_source text not null check (intake_source in ('self_service', 'admin_entry')),
  verification_state text not null default 'draft'
    check (verification_state in ('draft', 'submitted', 'under_review', 'verified', 'rejected', 'suspended')),
  owner_account_id uuid references public.partner_account (id) on delete restrict, -- null for un-claimed admin_entry rows
  -- PR-10: legal-treatment fork. Required for real, but NOT NULL is deferred to
  -- submission-gate validation like the other "required" fields (see header
  -- note 1) so admin_create_partner_entry can still set it eagerly while
  -- partner_create_profile_draft leaves the row otherwise empty.
  business_entity_type text check (business_entity_type in ('corporation', 'sole_proprietor')),
  referred_by uuid references public.admin_user (id) on delete restrict, -- PC-5
  referred_at timestamptz,
  -- PR-13 (법 제20조 수집출처 고지): required at INSERT time for admin_entry,
  -- unlike the other "required" fields, because admin_create_partner_entry
  -- collects it in the same single call that creates the row — there is no
  -- multi-step wizard on the admin_entry path the way there is for self_service.
  collection_source_detail text,
  -- PR-11: only ever set for admin_entry rows without confirmed terms+privacy
  -- consent yet. Recommended default: created_at + 90 days (review §3.5).
  consent_deadline_at timestamptz,
  rejected_at timestamptz,
  -- Fix (qa-reviewer, 2026-08-30): admin_reject_partner previously validated
  -- p_reason but only ever stored its character count in the audit summary
  -- — the partner had no way to learn why they were rejected or what to fix
  -- before resubmitting. Plain text, not PII, so no private-schema split.
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 2000),
  -- Set by the retention batches in §7 once PII has been purged for this row
  -- (unconsented-admin_entry timeout or rejected+90d) — a purged row is never
  -- reprocessed by the same batch again.
  pii_purged_at timestamptz,

  -- --- Common Core: company identity (PRD §3.2.2 A) ---
  company_name_ko text check (char_length(company_name_ko) between 1 and 200),
  company_name_en text check (company_name_en is null or char_length(company_name_en) <= 200),
  -- Deliberately NOT unique (PC-4: "자동 병합 금지, Admin에 중복 후보로 노출" —
  -- a hard UNIQUE would make that impossible). Duplicate detection is a
  -- non-blocking check, see public.check_business_registration_duplicate below
  -- and A1-R6 (admin screen warning).
  business_registration_number text check (business_registration_number ~ '^[0-9-]{10,20}$'),
  founded_year integer check (founded_year is null or founded_year between 1900 and 2100),
  employee_band text check (employee_band is null or employee_band in ('1-9', '10-49', '50-99', '100-299', '300+')),
  location_region text check (location_region is null or char_length(location_region) <= 50), -- 시/도
  website_url text check (website_url is null or char_length(website_url) <= 300),

  -- --- Common Core: response capability (PRD §3.2.2 A) ---
  supported_languages text[] not null default '{}', -- e.g. {ko,en,ja,zh}
  overseas_experience boolean,
  overseas_experience_countries text[] not null default '{}',

  -- --- Common Core: intro / offerings (TR-1: original text + explicit locale) ---
  company_intro_text text check (company_intro_text is null or char_length(company_intro_text) <= 5000),
  company_intro_locale text check (company_intro_locale is null or company_intro_locale in ('ko', 'en', 'ja', 'zh')),
  -- [{"name": "...", "description": "..."}], up to 3 (PRD §3.2.2 A).
  representative_offerings jsonb not null default '[]'::jsonb,
  -- 보유 인증 (ISO/KS/친환경/기관인증 등) — v1.0 자유 입력 목록, 증서 파일은
  -- partner_document(doc_type='certification')로 별도 업로드.
  certifications text[] not null default '{}',

  -- --- Vertical split (PRD §3.2.2 principle: Common Core + Vertical Extension) ---
  vertical text check (vertical in ('product', 'service')), -- 'product'=A, 'service'=B (D-9: B is MVP focus)

  -- --- Vertical A (product/sourcing) extension ---
  moq text, -- free text: "1,000 units" etc. — deliberately not numeric, unit varies by category
  price_band text,
  lead_time_days integer check (lead_time_days is null or lead_time_days >= 0),
  sample_available boolean,
  sample_terms text,
  oem_odm_type text check (oem_odm_type is null or oem_odm_type in ('oem', 'odm', 'own_brand')),
  export_record text, -- free text: countries/years

  -- --- Vertical B (service partner) extension — D-9 MVP focus ---
  service_types text[] not null default '{}', -- e.g. {marketing_pr, it_dev, ai_automation, content, translation}
  project_min_size text,
  pricing_model text check (pricing_model is null or pricing_model in ('project', 'retainer', 'hourly')),
  standard_lead_time text,
  -- [{"client_industry": "...", "deliverable": "...", "anonymized": true}]
  reference_projects jsonb not null default '[]'::jsonb,
  team_size_band text,
  remote_onsite text check (remote_onsite is null or remote_onsite in ('remote', 'onsite', 'both')),

  -- --- Public listing gate, layer 1 of 3 (privacy review §3.3) ---
  public_listing_state text not null default 'off' check (public_listing_state in ('off', 'on', 'suspended')),

  -- --- System-derived (PRD §3.2.2 D) ---
  capability_completeness_pct integer not null default 0 check (capability_completeness_pct between 0 and 100),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_partner_admin_entry_source_detail check (
    intake_source <> 'admin_entry' or collection_source_detail is not null
  ),
  constraint chk_partner_offerings_shape check (
    -- CASE, not a plain AND, so a non-array value fails the constraint
    -- cleanly instead of risking jsonb_array_length's "cannot get array
    -- length of a non-array" runtime error (AND short-circuit order is not
    -- part of the SQL standard, even though PostgreSQL happens to evaluate
    -- left-to-right in practice).
    case when jsonb_typeof(representative_offerings) = 'array'
      then jsonb_array_length(representative_offerings) <= 3
      else false
    end
  ),
  constraint chk_partner_reference_projects_shape check (
    jsonb_typeof(reference_projects) = 'array'
  )
);

comment on table public.partner is
  'The Capability entity (PRD §3.0 "Korean Partner"). Rows are created ONLY '
  'via public.partner_create_profile_draft() (self_service) or '
  'public.admin_create_partner_entry() (admin_entry) — no direct INSERT grant '
  'exists for authenticated. "필수" Capability fields are NULLable here by '
  'design (see file header note 1); required-ness is enforced at the '
  'draft->submitted transition, not at every write.';

create index if not exists idx_partner_verification_state on public.partner (verification_state);
create index if not exists idx_partner_intake_source on public.partner (intake_source);
create index if not exists idx_partner_owner_account_id on public.partner (owner_account_id);
create index if not exists idx_partner_business_registration_number on public.partner (business_registration_number);
create index if not exists idx_partner_consent_deadline_pending
  on public.partner (consent_deadline_at) where pii_purged_at is null and intake_source = 'admin_entry';
create index if not exists idx_partner_rejected_pending
  on public.partner (rejected_at) where pii_purged_at is null and verification_state = 'rejected';

alter table public.partner enable row level security;
alter table public.partner force row level security;
revoke all on public.partner from anon, authenticated;

drop trigger if exists trg_partner_set_updated_at on public.partner;
create trigger trg_partner_set_updated_at before update on public.partner
  for each row execute function private.set_updated_at();


-- =============================================================================
-- §2. private.owns_partner — real definition (supersedes the 20260829130000 stub)
-- =============================================================================

create or replace function private.owns_partner(p_partner_id uuid, p_auth_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.partner p
    join public.partner_account pa on pa.id = p.owner_account_id
    where p.id = p_partner_id
      and pa.auth_user_id = p_auth_uid
  );
$$;

comment on function private.owns_partner is
  'privacy review §2.5 rule 1: boolean only. True iff p_partner_id is owned '
  'by the partner_account belonging to p_auth_uid. admin_entry rows with '
  'owner_account_id IS NULL always return false here (correct — nobody owns '
  'them yet until a future claim flow, out of v1.0 scope).';


-- =============================================================================
-- §3. Capability Completeness — trigger-computed (PRD §3.2.2 D)
-- =============================================================================
-- MVP heuristic (flagged for product/service-planner sign-off, not a final
-- spec): weighted average of Common-Core fill rate (70%) and the fill rate of
-- whichever Vertical extension applies to `vertical` (30%). Both counts treat
-- a field as "filled" if it is non-null, non-empty-array, and non-empty-text.
-- A partner with `vertical` still unset only gets the Common-Core score.

create or replace function private.jsonb_array_nonempty(p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- Guards jsonb_array_length against a non-array value (would otherwise
  -- raise "cannot get array length of a non-array" instead of failing the
  -- CHECK constraint cleanly — see chk_partner_offerings_shape). Used by the
  -- completeness trigger below, which runs BEFORE the row's own CHECK
  -- constraints are validated.
  select jsonb_typeof(p_value) = 'array' and jsonb_array_length(p_value) > 0;
$$;

create or replace function private.partner_compute_completeness(p_partner public.partner)
returns integer
language plpgsql
stable
set search_path = ''
as $$
declare
  v_core_total integer := 10;
  v_core_filled integer := 0;
  v_vert_total integer := 0;
  v_vert_filled integer := 0;
  v_score numeric;
begin
  if p_partner.company_name_ko is not null then v_core_filled := v_core_filled + 1; end if;
  if p_partner.business_registration_number is not null then v_core_filled := v_core_filled + 1; end if;
  if p_partner.business_entity_type is not null then v_core_filled := v_core_filled + 1; end if;
  if coalesce(array_length(p_partner.supported_languages, 1), 0) > 0 then v_core_filled := v_core_filled + 1; end if;
  if p_partner.overseas_experience is not null then v_core_filled := v_core_filled + 1; end if;
  if p_partner.company_intro_text is not null then v_core_filled := v_core_filled + 1; end if;
  if private.jsonb_array_nonempty(p_partner.representative_offerings) then v_core_filled := v_core_filled + 1; end if;
  if p_partner.location_region is not null then v_core_filled := v_core_filled + 1; end if;
  if p_partner.website_url is not null then v_core_filled := v_core_filled + 1; end if;
  if p_partner.founded_year is not null then v_core_filled := v_core_filled + 1; end if;

  if p_partner.vertical = 'product' then
    v_vert_total := 5;
    if p_partner.moq is not null then v_vert_filled := v_vert_filled + 1; end if;
    if p_partner.lead_time_days is not null then v_vert_filled := v_vert_filled + 1; end if;
    if p_partner.oem_odm_type is not null then v_vert_filled := v_vert_filled + 1; end if;
    if p_partner.price_band is not null then v_vert_filled := v_vert_filled + 1; end if;
    if p_partner.sample_available is not null then v_vert_filled := v_vert_filled + 1; end if;
  elsif p_partner.vertical = 'service' then
    v_vert_total := 5;
    if coalesce(array_length(p_partner.service_types, 1), 0) > 0 then v_vert_filled := v_vert_filled + 1; end if;
    if p_partner.project_min_size is not null then v_vert_filled := v_vert_filled + 1; end if;
    if p_partner.pricing_model is not null then v_vert_filled := v_vert_filled + 1; end if;
    if p_partner.standard_lead_time is not null then v_vert_filled := v_vert_filled + 1; end if;
    if private.jsonb_array_nonempty(p_partner.reference_projects) then v_vert_filled := v_vert_filled + 1; end if;
  end if;

  if v_vert_total = 0 then
    v_score := (v_core_filled::numeric / v_core_total) * 100;
  else
    v_score := ((v_core_filled::numeric / v_core_total) * 0.7 + (v_vert_filled::numeric / v_vert_total) * 0.3) * 100;
  end if;

  return round(v_score)::integer;
end;
$$;

comment on function private.partner_compute_completeness is
  'MVP heuristic, not a final spec (PRD §3.2.2 D leaves the exact formula '
  'open) — flagged for product/service-planner sign-off before A1-R4 ships. '
  '70/30 Common-Core/Vertical weighting, present-vs-absent per field, no '
  'partial credit within a field.';

create or replace function private.partner_set_completeness()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.capability_completeness_pct := private.partner_compute_completeness(new);
  return new;
end;
$$;

drop trigger if exists trg_partner_set_completeness on public.partner;
create trigger trg_partner_set_completeness
  before insert or update on public.partner
  for each row execute function private.partner_set_completeness();


-- =============================================================================
-- §4. GRANT + RLS for public.partner (self vs admin — separate policies,
--     privacy review §2.5 rule 2)
-- =============================================================================

grant select on public.partner to authenticated;

-- Column-scoped UPDATE grant (rule 4): the Capability fields a partner (or an
-- admin editing on their behalf, A1-R3) may freely change. Deliberately
-- EXCLUDED: intake_source, verification_state, owner_account_id, referred_by,
-- referred_at, collection_source_detail, consent_deadline_at, rejected_at,
-- pii_purged_at, public_listing_state, capability_completeness_pct (trigger-
-- computed), created_at/updated_at — all RPC-only or system-only.
grant update (
  business_entity_type,
  company_name_ko, company_name_en, business_registration_number,
  founded_year, employee_band, location_region, website_url,
  supported_languages, overseas_experience, overseas_experience_countries,
  company_intro_text, company_intro_locale, representative_offerings, certifications,
  vertical,
  moq, price_band, lead_time_days, sample_available, sample_terms, oem_odm_type, export_record,
  service_types, project_min_size, pricing_model, standard_lead_time, reference_projects,
  team_size_band, remote_onsite
) on public.partner to authenticated;

-- No INSERT/DELETE grant at all: rows are created only by the SECURITY
-- DEFINER RPCs in §8/§9 (owned by postgres, bypasses RLS/GRANT the same way
-- submit_request() does), and never hard-deleted (PR-5: retention is
-- anonymize-in-place, never delete, for the business-entity row itself).

create policy partner_self_select on public.partner
  for select to authenticated
  using (
    (select private.is_active_partner())
    and (select private.owns_partner(id))
  );

create policy partner_self_update on public.partner
  for update to authenticated
  using (
    (select private.is_active_partner())
    and (select private.owns_partner(id))
  )
  with check (
    (select private.is_active_partner())
    and (select private.owns_partner(id))
  );

create policy partner_admin_select on public.partner
  for select to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('partner_management', 'read'))
  );

create policy partner_admin_update on public.partner
  for update to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('partner_management', 'update'))
  )
  with check (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('partner_management', 'update'))
  );


-- =============================================================================
-- §5. private.partner_contact — PII table (privacy review §4 PR-1)
-- =============================================================================

create table if not exists private.partner_contact (
  partner_id uuid primary key references public.partner (id) on delete cascade,
  contact_name text not null,
  contact_title text,
  contact_email text not null check (contact_email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  contact_phone text,
  representative_name text, -- PII if business_entity_type='sole_proprietor' (PR-10)
  updated_at timestamptz not null default now()
);

comment on table private.partner_contact is
  'PR-1 (privacy review §4): split from public.partner (table-split pattern, '
  'not column GRANT — 5 PII columns is the review''s stated threshold for '
  'preferring a table split like private.request_meta). NEVER reachable via '
  'PostgREST directly (private is not an Exposed Schema). Read/write paths '
  'are the RPCs in §6 only.';

alter table private.partner_contact enable row level security;
alter table private.partner_contact force row level security;
revoke all on private.partner_contact from anon, authenticated;
-- No RLS policy defined (deny-by-default) — matches auth_principal's stance,
-- not private.request_meta's (which grants column-select for defense in
-- depth even though unreachable). Chosen here because partner_contact holds
--5 raw PII columns rather than one internal-note column; the smaller the
-- surface with any grant at all, the better, and every legitimate access
-- path already goes through a SECURITY DEFINER RPC that runs as table owner.


-- --- masking helpers (immutable, reused by the sync trigger below) ----------

create or replace function private.mask_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_email is null then null
    when position('@' in p_email) > 1 then
      left(p_email, 1) || repeat('*', greatest(position('@' in p_email) - 2, 1)) || substr(p_email, position('@' in p_email))
    else '***'
  end;
$$;

create or replace function private.mask_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_phone is null then null
    when char_length(regexp_replace(p_phone, '[^0-9]', '', 'g')) >= 4 then
      repeat('*', greatest(char_length(regexp_replace(p_phone, '[^0-9]', '', 'g')) - 4, 0))
      || right(regexp_replace(p_phone, '[^0-9]', '', 'g'), 4)
    else '****'
  end;
$$;

create or replace function private.mask_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name is null then null
    when char_length(p_name) <= 1 then p_name
    when char_length(p_name) = 2 then left(p_name, 1) || '*'
    else left(p_name, 1) || repeat('*', char_length(p_name) - 2) || right(p_name, 1)
  end;
$$;

-- --- masked-value cache columns on public.partner (header note 3) ----------

alter table public.partner add column if not exists contact_name_masked text;
alter table public.partner add column if not exists contact_email_masked text;
alter table public.partner add column if not exists contact_phone_masked text;

grant select (contact_name_masked, contact_email_masked, contact_phone_masked)
  on public.partner to authenticated;
-- Deliberately no UPDATE grant on these three — system-maintained only, via
-- the sync trigger below.

create or replace function private.partner_contact_sync_masked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.partner set
    contact_name_masked = private.mask_name(new.contact_name),
    contact_email_masked = private.mask_email(new.contact_email),
    contact_phone_masked = private.mask_phone(new.contact_phone)
  where id = new.partner_id;
  return new;
end;
$$;

drop trigger if exists trg_partner_contact_sync_masked on private.partner_contact;
create trigger trg_partner_contact_sync_masked
  after insert or update on private.partner_contact
  for each row execute function private.partner_contact_sync_masked();


-- =============================================================================
-- §6. Contact read/write RPCs (self + admin-reveal)
-- =============================================================================

create or replace function public.get_own_partner_contact()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_partner_id uuid;
  v_row private.partner_contact%rowtype;
begin
  if not private.is_active_partner(v_auth_uid) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  select id into v_partner_id from public.partner where owner_account_id = private.current_partner_id(v_auth_uid);
  if v_partner_id is null then
    return null;
  end if;

  select * into v_row from private.partner_contact where partner_id = v_partner_id;
  if not found then
    return null;
  end if;

  -- Self-access to one's own data: not audited (PR-15 — logging every self
  -- profile view would just bloat audit_log with no security value).
  return jsonb_build_object(
    'contact_name', v_row.contact_name,
    'contact_title', v_row.contact_title,
    'contact_email', v_row.contact_email,
    'contact_phone', v_row.contact_phone,
    'representative_name', v_row.representative_name
  );
end;
$$;

revoke all on function public.get_own_partner_contact() from public;
grant execute on function public.get_own_partner_contact() to authenticated;


create or replace function public.set_own_partner_contact(
  p_contact_name text,
  p_contact_title text,
  p_contact_email text,
  p_contact_phone text,
  p_representative_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_partner_id uuid;
begin
  if not private.is_active_partner(v_auth_uid) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  select id into v_partner_id from public.partner where owner_account_id = private.current_partner_id(v_auth_uid);
  if v_partner_id is null then
    raise exception 'partner_not_found' using errcode = 'P0002';
  end if;

  if p_contact_name is null or char_length(trim(p_contact_name)) = 0 then
    raise exception 'invalid_contact_name';
  end if;
  if p_contact_email is null or p_contact_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'invalid_contact_email';
  end if;

  insert into private.partner_contact (partner_id, contact_name, contact_title, contact_email, contact_phone, representative_name)
  values (v_partner_id, trim(p_contact_name), p_contact_title, lower(trim(p_contact_email)), p_contact_phone, p_representative_name)
  on conflict (partner_id) do update set
    contact_name = excluded.contact_name,
    contact_title = excluded.contact_title,
    contact_email = excluded.contact_email,
    contact_phone = excluded.contact_phone,
    representative_name = excluded.representative_name,
    updated_at = now();

  -- §3.4 convention: fact-of-change only, never the PII content itself.
  perform private.log_audit(
    p_action := 'partner.profile_update',
    p_target_table := 'partner_contact',
    p_target_id := v_partner_id::text
  );
end;
$$;

revoke all on function public.set_own_partner_contact(text, text, text, text, text) from public;
grant execute on function public.set_own_partner_contact(text, text, text, text, text) to authenticated;


create or replace function public.get_partner_contact(p_partner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_row private.partner_contact%rowtype;
  v_audit_id bigint;
begin
  -- Structurally identical to public.get_request_contact (20260825120000
  -- §11), per the task brief's explicit "그대로 복제" instruction — same
  -- three-stage deny checks, same atomic audit-or-rollback guarantee.
  if not (private.is_active_admin(v_auth_uid) and private.is_aal2()) then
    perform private.log_audit(
      p_action := 'auth.access_denied', p_result := 'denied',
      p_target_table := 'partner', p_target_id := p_partner_id::text
    );
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if not private.has_menu_permission('partner_management', 'read', v_auth_uid) then
    perform private.log_audit(
      p_action := 'auth.access_denied', p_result := 'denied',
      p_target_table := 'partner', p_target_id := p_partner_id::text
    );
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if not private.has_pii_access(v_auth_uid) then
    perform private.log_audit(
      p_action := 'admin_partner.contact_reveal', p_result := 'denied',
      p_target_table := 'partner', p_target_id := p_partner_id::text,
      p_subject_ids := array[p_partner_id]
    );
    raise exception 'pii_access_denied' using errcode = '42501';
  end if;

  select * into v_row from private.partner_contact where partner_id = p_partner_id;

  if not found then
    raise exception 'partner_contact_not_found' using errcode = 'P0002';
  end if;

  v_audit_id := private.log_audit(
    p_action := 'admin_partner.contact_reveal', p_result := 'success',
    p_target_table := 'partner', p_target_id := p_partner_id::text,
    p_subject_ids := array[p_partner_id]
  );

  if v_audit_id is null then
    raise exception 'audit_log_write_failed: contact reveal aborted because the audit record could not be written'
      using errcode = '55000';
  end if;

  return jsonb_build_object(
    'contact_name', v_row.contact_name,
    'contact_title', v_row.contact_title,
    'contact_email', v_row.contact_email,
    'contact_phone', v_row.contact_phone,
    'representative_name', v_row.representative_name
  );
end;
$$;

comment on function public.get_partner_contact is
  'Clone of public.get_request_contact (20260825120000 §11) for partner '
  'contact PII. The only path to raw partner_contact values for an admin. '
  'Every call — success AND denial — is audited; a failed audit write rolls '
  'back the entire reveal (no orphaned "PII returned but not logged" state).';

revoke all on function public.get_partner_contact(uuid) from public;
grant execute on function public.get_partner_contact(uuid) to authenticated;


-- =============================================================================
-- §7. public.partner_consent + private.partner_consent_meta
--     (privacy review §3.2 — append-only, PC-6/PC-7/PR-11)
-- =============================================================================

create table if not exists public.partner_consent (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner (id) on delete restrict,

  consent_type text not null check (consent_type in (
    'terms', 'privacy', 'public_listing', 'third_party_share', 'marketing'
  )),
  granted boolean not null,

  document_version text, -- bound to lib/legal/partnerConsentVersions.ts (§9 below)
  consent_locale text not null default 'ko' check (consent_locale in ('ko', 'en', 'ja')),

  method text not null check (method in ('online_self', 'phone', 'in_person', 'email', 'paper')),
  collected_at timestamptz not null,
  recorded_at timestamptz not null default now(),

  recorded_by_admin_id uuid references public.admin_user (id) on delete restrict, -- admin_entry only
  evidence_kind text not null default 'none'
    check (evidence_kind in ('none', 'call_log', 'signed_form', 'email_thread', 'recording')),

  -- Populated only on a revocation row (granted=false) that supersedes an
  -- earlier granted=true row for the same (partner_id, consent_type).
  revoked_reason text,

  created_at timestamptz not null default now(),

  constraint chk_partner_consent_collected_at_not_future check (collected_at <= now() + interval '5 minutes')
);

comment on table public.partner_consent is
  'Append-only (privacy review §3.2). Revocation = a NEW row with '
  'granted=false, never an UPDATE of an existing row (header note 2) — '
  '"effective" consent for (partner_id, consent_type) is the row with the '
  'latest recorded_at. PII about WHO recorded/witnessed the consent lives in '
  'private.partner_consent_meta, not here (PII-splitting, same reasoning as '
  'private.request_meta).';

create index if not exists idx_partner_consent_partner_type_recorded
  on public.partner_consent (partner_id, consent_type, recorded_at desc);

alter table public.partner_consent enable row level security;
alter table public.partner_consent force row level security;

-- Layer 1 (mirrors audit_log §3.5 layer 1): revoke everything from every
-- role, including service_role — the only writers are the SECURITY DEFINER
-- RPCs below, which run as table owner (postgres) regardless of GRANT.
revoke all on public.partner_consent from anon, authenticated, service_role;

-- Layer 3: unconditional append-only trigger. Unlike audit_log's, this one
-- has NO GUC escape hatch at all — partner_consent rows are never deleted or
-- updated by design; the 3-year-post-withdrawal policy (Q-3) only purges the
-- PII in partner_consent_meta (§10), not these rows.
create or replace function private.protect_partner_consent_append_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'partner_consent_append_only: partner_consent rows cannot be updated or deleted (attempted %)', tg_op
    using errcode = 'P0001';
end;
$$;

drop trigger if exists trg_partner_consent_append_only on public.partner_consent;
create trigger trg_partner_consent_append_only
  before update or delete on public.partner_consent
  for each row execute function private.protect_partner_consent_append_only();


create table if not exists private.partner_consent_meta (
  consent_id uuid primary key references public.partner_consent (id) on delete cascade,
  consenter_name text,
  consenter_title text,
  evidence_ref text, -- Storage object path or message id — never the raw evidence content
  consent_ip text,   -- /24-masked, same convention as private.request_meta.consent_ip
  created_at timestamptz not null default now()
);

comment on table private.partner_consent_meta is
  'PII split out of partner_consent (privacy review §3.2, mirrors '
  'private.request_meta). Unlike partner_consent itself, this table IS '
  'eventually hard-deleted — see private.purge_expired_partner_consent_meta '
  '(§13, Q-3: 3 years post-withdrawal) — because only the fact/timestamps of '
  'consent need to survive indefinitely as evidence, not the consenter''s name.';

alter table private.partner_consent_meta enable row level security;
alter table private.partner_consent_meta force row level security;
revoke all on private.partner_consent_meta from anon, authenticated;
-- No RLS policy (deny-by-default) — same stance as private.partner_contact.


-- =============================================================================
-- §8. public.partner_document + Storage (privacy review §4 PR-2)
-- =============================================================================

create table if not exists public.partner_document (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner (id) on delete cascade,
  doc_type text not null check (doc_type in ('business_registration_cert', 'portfolio', 'certification', 'other')),
  -- p/{partner_id}/{doc_type}/{uuid}.{ext} — NEVER the original filename
  -- (privacy review §4 PR-2: a path like "(주)OO_사업자등록증.pdf" is itself
  -- a PII leak). Original filename is kept in its own column instead.
  storage_path text not null unique check (storage_path ~ '^p/'),
  original_filename text not null check (char_length(original_filename) <= 255),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 10485760), -- 10MB
  sha256_hash text not null check (char_length(sha256_hash) = 64),

  uploaded_by_kind text not null check (uploaded_by_kind in ('partner', 'admin')),
  uploaded_by_partner_account_id uuid references public.partner_account (id) on delete restrict,
  uploaded_by_admin_id uuid references public.admin_user (id) on delete restrict,

  -- PR-2: "검증 후 90일" (verified) or rejected+90d (§13 batch #3) or
  -- immediate (withdrawal). Set by the app/RPC layer at upload time based on
  -- the partner's CURRENT verification_state, and recomputed by
  -- admin_verify_partner() (§11) when that state changes to 'verified'.
  purge_after timestamptz,
  -- Set by private.mark_expired_partner_documents_for_purge() (§13). SQL
  -- cannot call the Storage REST API to remove the underlying object — this
  -- column only QUEUES the row for an out-of-band process (Next.js scheduled
  -- route / Supabase Edge Function using the service_role Storage client)
  -- that must (a) storage.remove() the object, then (b) delete this row.
  pending_deletion_at timestamptz,

  created_at timestamptz not null default now(),

  constraint chk_partner_document_uploader check (
    (uploaded_by_kind = 'partner' and uploaded_by_partner_account_id is not null and uploaded_by_admin_id is null)
    or (uploaded_by_kind = 'admin' and uploaded_by_admin_id is not null and uploaded_by_partner_account_id is null)
  )
);

comment on table public.partner_document is
  'Metadata only — file bytes live in Storage bucket partner-doc (§8b below). '
  'purge_after / pending_deletion_at implement PR-2''s "검증 후 90일 삭제" '
  'policy (Q-2, adopted). NEVER store 주민등록번호-bearing documents '
  '(privacy review §4 PR-2 note) — enforced by admin review checklist '
  '(A1-R5), not by this schema.';

create index if not exists idx_partner_document_partner_id on public.partner_document (partner_id);
create index if not exists idx_partner_document_purge_pending
  on public.partner_document (purge_after) where pending_deletion_at is null;

alter table public.partner_document enable row level security;
alter table public.partner_document force row level security;
revoke all on public.partner_document from anon, authenticated;

grant select, insert on public.partner_document to authenticated;
-- No UPDATE grant at all (files are immutable once recorded — "교체는
-- 삭제+신규", privacy review §4 PR-2 Storage RLS row) and no DELETE grant
-- (deletion is RPC-only, see partner_delete_document below).

create policy partner_document_self_select on public.partner_document
  for select to authenticated
  using ((select private.is_active_partner()) and (select private.owns_partner(partner_id)));

create policy partner_document_self_insert on public.partner_document
  for insert to authenticated
  with check (
    (select private.is_active_partner())
    and (select private.owns_partner(partner_id))
    and uploaded_by_kind = 'partner'
    and uploaded_by_partner_account_id = (select private.current_partner_id())
  );

create policy partner_document_admin_select on public.partner_document
  for select to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('partner_management', 'read'))
    and (select private.has_pii_access())
  );

create policy partner_document_admin_insert on public.partner_document
  for insert to authenticated
  with check (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('partner_management', 'create'))
    and uploaded_by_kind = 'admin'
  );


create or replace function public.log_partner_document_reveal(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_partner_id uuid;
  v_audit_id bigint;
begin
  select partner_id into v_partner_id from public.partner_document where id = p_document_id;
  if v_partner_id is null then
    raise exception 'document_not_found' using errcode = 'P0002';
  end if;

  if not (
    private.is_active_admin(v_auth_uid)
    and private.is_aal2()
    and private.has_menu_permission('partner_management', 'read', v_auth_uid)
    and private.has_pii_access(v_auth_uid)
  ) then
    perform private.log_audit(
      p_action := 'admin_partner.document_reveal', p_result := 'denied',
      p_target_table := 'partner_document', p_target_id := p_document_id::text,
      p_subject_ids := array[v_partner_id]
    );
    raise exception 'access_denied' using errcode = '42501';
  end if;

  v_audit_id := private.log_audit(
    p_action := 'admin_partner.document_reveal', p_result := 'success',
    p_target_table := 'partner_document', p_target_id := p_document_id::text,
    p_subject_ids := array[v_partner_id]
  );

  if v_audit_id is null then
    raise exception 'audit_log_write_failed: document reveal aborted because the audit record could not be written'
      using errcode = '55000';
  end if;
end;
$$;

comment on function public.log_partner_document_reveal is
  'privacy review §4 PR-2 "발급 감사": Storage signed-URL issuance itself is '
  'an out-of-SQL Storage API call, so it cannot be made atomic with an audit '
  'insert the way get_partner_contact is. This is the required substitute — '
  'the calling server route MUST call this RPC and confirm it did not raise '
  'BEFORE calling createSignedUrl, never after. A raised exception here '
  '(access denied or audit-write failure) must abort the signed-URL issuance.';

revoke all on function public.log_partner_document_reveal(uuid) from public;
grant execute on function public.log_partner_document_reveal(uuid) to authenticated;


-- --- §8b. Storage bucket + storage.objects RLS (privacy review §4 PR-2 table) ---

insert into storage.buckets (id, name, public)
values ('partner-doc', 'partner-doc', false)
on conflict (id) do nothing;

comment on column public.partner_document.storage_path is
  'Must match the storage.objects RLS path convention: '
  'p/{partner_id}/{doc_type}/{uuid}.{ext} — (storage.foldername(name))[2] '
  'is the partner_id segment the policies below check against.';

-- (1) Partner: insert/select within their own partner_id folder only.
-- Fix (qa-reviewer, 2026-08-30): guarded with CASE, not a plain AND, so an
-- object path from some future non-partner-doc bucket whose second folder
-- segment isn't a valid uuid fails closed (denied) instead of raising a cast
-- error (AND short-circuit order is not guaranteed by the SQL standard —
-- same reasoning as chk_partner_offerings_shape above).
create policy partner_doc_owner_rw on storage.objects
  for select to authenticated
  using (
    case when bucket_id = 'partner-doc'
      then private.owns_partner(((storage.foldername(name))[2])::uuid)
      else false
    end
  );

create policy partner_doc_owner_insert on storage.objects
  for insert to authenticated
  with check (
    case when bucket_id = 'partner-doc'
      then private.owns_partner(((storage.foldername(name))[2])::uuid)
      else false
    end
  );

-- (2) Admin: select only, gated exactly like the DB-side policy above.
create policy partner_doc_admin_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'partner-doc'
    and (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('partner_management', 'read'))
    and (select private.has_pii_access())
  );

-- (3) No UPDATE policy anywhere — objects are immutable once written
--     (replace = delete + re-upload, matching the DB table's own stance).
-- (4) No DELETE policy for `authenticated` at all — deletion only happens
--     via the service_role Storage client from a trusted server route,
--     invoked by public.partner_delete_document() below as the DB-side half
--     of that same operation (see that function's comment for the required
--     call order).


create or replace function public.partner_delete_document(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_partner_id uuid;
  v_is_admin boolean := private.is_active_admin(v_auth_uid) and private.is_aal2();
begin
  select partner_id into v_partner_id from public.partner_document where id = p_document_id;
  if v_partner_id is null then
    raise exception 'document_not_found' using errcode = 'P0002';
  end if;

  if not (
    (private.is_active_partner(v_auth_uid) and private.owns_partner(v_partner_id, v_auth_uid))
    or (v_is_admin and private.has_menu_permission('partner_management', 'update', v_auth_uid))
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  -- IMPORTANT: this only removes the metadata row. The CALLER (server route)
  -- MUST also call supabase.storage.from('partner-doc').remove([storage_path])
  -- with the service_role client — SQL cannot reach the Storage REST API.
  -- Call order: remove the DB row first (this function), then the Storage
  -- object — if the Storage call fails after this succeeds, the object is
  -- merely orphaned (harmless, cleaned up by an out-of-band audit), whereas
  -- the reverse order could let a caller retry a Storage delete against a
  -- path some OTHER document row has since reused.
  delete from public.partner_document where id = p_document_id;

  -- NOTE: the review's §2.6 action list has no dedicated "admin deleted a
  -- partner's document" action — 'admin_partner.document_reveal' is for
  -- VIEWING/downloading only, reusing it here for a delete would misreport
  -- what happened. 'admin_partner.update' (already in the allow-list) is the
  -- closest correct fit for an admin-initiated write against partner data.
  perform private.log_audit(
    p_action := case when v_is_admin then 'admin_partner.update' else 'partner.document_delete' end,
    p_target_table := 'partner_document',
    p_target_id := p_document_id::text,
    p_subject_ids := array[v_partner_id]
  );
end;
$$;

revoke all on function public.partner_delete_document(uuid) from public;
grant execute on function public.partner_delete_document(uuid) to authenticated;


-- =============================================================================
-- §9. Signup / profile-creation RPCs
-- =============================================================================

create or replace function public.finalize_partner_signup(
  p_auth_user_id uuid,
  p_display_name text,
  p_consents jsonb, -- [{"consent_type":"terms","granted":true,"document_version":"...","consent_locale":"ko"}, ...]
  p_consent_locale text default 'ko'
)
returns table (partner_account_id uuid, partner_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_partner_id uuid;
  v_item jsonb;
  v_has_terms boolean := false;
  v_has_privacy boolean := false;
begin
  -- §6.2: terms + privacy are mandatory; public_listing/third_party_share/
  -- marketing must NOT be required to complete signup (law 제22조).
  for v_item in select * from jsonb_array_elements(coalesce(p_consents, '[]'::jsonb))
  loop
    if v_item ->> 'consent_type' = 'terms' and (v_item ->> 'granted')::boolean is true then
      v_has_terms := true;
    elsif v_item ->> 'consent_type' = 'privacy' and (v_item ->> 'granted')::boolean is true then
      v_has_privacy := true;
    end if;
  end loop;

  if not (v_has_terms and v_has_privacy) then
    raise exception 'consent_required';
  end if;

  -- Mutual-exclusion registry insert. A unique_violation here means this
  -- auth user already has a principal row (as admin OR partner) — surfaced
  -- as a clean error rather than the raw constraint name.
  begin
    insert into public.auth_principal (auth_user_id, principal_kind) values (p_auth_user_id, 'partner');
  exception when unique_violation then
    raise exception 'auth_principal_conflict' using errcode = 'P0001';
  end;

  insert into public.partner_account (auth_user_id, display_name, status)
  values (p_auth_user_id, p_display_name, 'active')
  returning id into v_account_id;

  insert into public.partner (owner_account_id, intake_source, verification_state)
  values (v_account_id, 'self_service', 'draft')
  returning id into v_partner_id;

  for v_item in select * from jsonb_array_elements(p_consents)
  loop
    insert into public.partner_consent (
      partner_id, consent_type, granted, document_version, consent_locale, method, collected_at
    ) values (
      v_partner_id,
      v_item ->> 'consent_type',
      (v_item ->> 'granted')::boolean,
      v_item ->> 'document_version',
      coalesce(v_item ->> 'consent_locale', p_consent_locale),
      'online_self',
      now()
    );
  end loop;

  -- NOTE (matches the precedent in finalize_admin_access_approval): when
  -- this RPC is invoked via the service_role client from a trusted server
  -- route (privacy review §2.8's POST /api/partner/signup), auth.uid() is
  -- typically NULL in that DB session, so private.log_audit()'s actor
  -- detection cannot attribute this event to the new partner account. This
  -- is the SAME known limitation already present for
  -- 'admin_access_request.approve' — not a new gap introduced here.
  perform private.log_audit(
    p_action := 'partner.signup',
    p_target_table := 'partner_account',
    p_target_id := v_account_id::text,
    p_after_summary := jsonb_build_object('partner_id', v_partner_id)
  );

  return query select v_account_id, v_partner_id;
end;
$$;

comment on function public.finalize_partner_signup is
  'privacy review §2.8: called by POST /api/partner/signup AFTER that route '
  'has already called supabase.auth.admin.createUser(). Creates '
  'auth_principal + partner_account + a draft public.partner row + the '
  'terms/privacy partner_consent rows in ONE transaction. If this function '
  'raises, the route MUST clean up the just-created auth.users row '
  '(admin.deleteUser) or log it as an orphaned account for manual cleanup — '
  'this function cannot do that itself (Auth Admin API calls are not SQL).';

revoke all on function public.finalize_partner_signup(uuid, text, jsonb, text) from public;
grant execute on function public.finalize_partner_signup(uuid, text, jsonb, text) to service_role;
-- Intentionally NOT granted to authenticated or anon — service_role only,
-- exactly like finalize_admin_access_approval (20260825130000).


create or replace function private.partner_profile_submission_gaps(p_partner public.partner)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  v_gaps text[] := '{}';
begin
  if p_partner.business_entity_type is null then v_gaps := v_gaps || 'business_entity_type'; end if;
  if p_partner.company_name_ko is null then v_gaps := v_gaps || 'company_name_ko'; end if;
  if p_partner.business_registration_number is null then v_gaps := v_gaps || 'business_registration_number'; end if;
  if coalesce(array_length(p_partner.supported_languages, 1), 0) = 0 then v_gaps := v_gaps || 'supported_languages'; end if;
  if p_partner.overseas_experience is null then v_gaps := v_gaps || 'overseas_experience'; end if;
  if p_partner.company_intro_text is null then v_gaps := v_gaps || 'company_intro_text'; end if;
  if jsonb_array_length(p_partner.representative_offerings) = 0 then v_gaps := v_gaps || 'representative_offerings'; end if;
  if p_partner.vertical is null then v_gaps := v_gaps || 'vertical'; end if;

  if p_partner.vertical = 'product' then
    if p_partner.moq is null then v_gaps := v_gaps || 'moq'; end if;
    if p_partner.lead_time_days is null then v_gaps := v_gaps || 'lead_time_days'; end if;
    if p_partner.oem_odm_type is null then v_gaps := v_gaps || 'oem_odm_type'; end if;
  elsif p_partner.vertical = 'service' then
    if coalesce(array_length(p_partner.service_types, 1), 0) = 0 then v_gaps := v_gaps || 'service_types'; end if;
    if p_partner.project_min_size is null then v_gaps := v_gaps || 'project_min_size'; end if;
    if p_partner.pricing_model is null then v_gaps := v_gaps || 'pricing_model'; end if;
    if p_partner.standard_lead_time is null then v_gaps := v_gaps || 'standard_lead_time'; end if;
    if jsonb_array_length(p_partner.reference_projects) = 0 then v_gaps := v_gaps || 'reference_projects'; end if;
  end if;

  if not exists (select 1 from public.partner_document d where d.partner_id = p_partner.id and d.doc_type = 'business_registration_cert') then
    v_gaps := v_gaps || 'business_registration_cert_document';
  end if;

  if not exists (select 1 from private.partner_contact c where c.partner_id = p_partner.id) then
    v_gaps := v_gaps || 'contact';
  end if;

  return v_gaps;
end;
$$;

comment on function private.partner_profile_submission_gaps is
  'SS-7 ("미입력 항목 안내") / SS-8 gate. This is where "필수" from PRD §3.2.2 '
  'is actually enforced (header note 1) — NOT NULL at the table level would '
  'break SS-6 partial-save. Also enforces the PRD 결함 #4 correction '
  '(privacy review §9 item 4): the business-registration certificate is '
  'required at SUBMISSION, not merely at public-listing time.';


create or replace function public.partner_submit_for_review()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_partner public.partner%rowtype;
  v_gaps text[];
begin
  if not private.is_active_partner(v_auth_uid) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  select * into v_partner from public.partner where owner_account_id = private.current_partner_id(v_auth_uid);
  if v_partner.id is null then
    raise exception 'partner_not_found' using errcode = 'P0002';
  end if;

  if v_partner.verification_state not in ('draft', 'rejected') then
    raise exception 'invalid_state_for_submission';
  end if;

  v_gaps := private.partner_profile_submission_gaps(v_partner);
  if array_length(v_gaps, 1) > 0 then
    raise exception 'profile_incomplete: %', array_to_string(v_gaps, ', ') using errcode = 'P0001';
  end if;

  update public.partner set verification_state = 'submitted' where id = v_partner.id;

  perform private.log_audit(
    p_action := 'partner.submit_for_review',
    p_target_table := 'partner',
    p_target_id := v_partner.id::text,
    p_subject_ids := array[v_partner.id]
  );
end;
$$;

revoke all on function public.partner_submit_for_review() from public;
grant execute on function public.partner_submit_for_review() to authenticated;


create or replace function public.partner_create_profile_draft()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_account_id uuid;
  v_partner_id uuid;
begin
  if not private.is_active_partner(v_auth_uid) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  v_account_id := private.current_partner_id(v_auth_uid);

  select id into v_partner_id from public.partner where owner_account_id = v_account_id;
  if v_partner_id is not null then
    return v_partner_id; -- idempotent: finalize_partner_signup already created one for self_service
  end if;

  insert into public.partner (owner_account_id, intake_source, verification_state)
  values (v_account_id, 'self_service', 'draft')
  returning id into v_partner_id;

  return v_partner_id;
end;
$$;

comment on function public.partner_create_profile_draft is
  'Defensive helper: finalize_partner_signup already creates one draft '
  'public.partner row per partner_account, so this is normally a no-op that '
  'just returns the existing id. Kept as its own RPC for a future path where '
  'partner_account and partner profile creation are decoupled (e.g. if OAuth '
  'sign-up (SS-10) or account recovery ever bypasses finalize_partner_signup).';

revoke all on function public.partner_create_profile_draft() from public;
grant execute on function public.partner_create_profile_draft() to authenticated;


create or replace function public.admin_create_partner_entry(
  p_business_entity_type text,
  p_company_name_ko text,
  p_vertical text,
  p_business_registration_number text,
  p_method text,             -- 'phone' | 'in_person' only (§3.4)
  p_collected_at timestamptz,
  p_consenter_name text,
  p_consenter_title text,
  p_collection_source_detail text,
  p_evidence_kind text default 'call_log'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_admin_id uuid;
  v_partner_id uuid;
  v_consent_id uuid;
begin
  if not (
    private.is_active_admin(v_auth_uid)
    and private.is_aal2()
    and private.has_menu_permission('partner_management', 'create', v_auth_uid)
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  -- §3.4 required-input regression: method restricted to phone/in_person,
  -- collected_at not in the future and not stale (>30 days is treated as a
  -- suspicious backdated entry — a reasonable N per the review's "사후 소급
  -- 입력 방지" intent; not itself specified by the review).
  if p_method not in ('phone', 'in_person') then
    raise exception 'invalid_consent_method';
  end if;
  if p_collected_at > now() or p_collected_at < now() - interval '30 days' then
    raise exception 'invalid_collected_at';
  end if;
  if p_consenter_name is null or char_length(trim(p_consenter_name)) = 0 then
    raise exception 'consenter_name_required';
  end if;
  if p_consenter_title is null or char_length(trim(p_consenter_title)) = 0 then
    raise exception 'consenter_title_required';
  end if;
  if p_collection_source_detail is null or char_length(trim(p_collection_source_detail)) = 0 then
    raise exception 'collection_source_detail_required';
  end if;

  select id into v_admin_id from public.admin_user where auth_user_id = v_auth_uid;

  insert into public.partner (
    intake_source, verification_state, business_entity_type, company_name_ko, vertical,
    business_registration_number, referred_by, referred_at, collection_source_detail, consent_deadline_at
  ) values (
    'admin_entry', 'draft', p_business_entity_type, p_company_name_ko, p_vertical,
    p_business_registration_number, v_admin_id, now(), p_collection_source_detail, now() + interval '90 days'
  )
  returning id into v_partner_id;

  -- terms + privacy: recorded as granted on the strength of the phone/
  -- in_person confirmation. public_listing is deliberately NOT inserted here
  -- (§3.4 decision: "public_listing 동의는 기본 미체크") — an admin who
  -- separately confirms public-listing consent must call a dedicated
  -- consent-recording step before partner_set_public_listing can ever
  -- succeed for this row.
  insert into public.partner_consent (partner_id, consent_type, granted, method, collected_at, recorded_by_admin_id, evidence_kind)
  values (v_partner_id, 'terms', true, p_method, p_collected_at, v_admin_id, p_evidence_kind)
  returning id into v_consent_id;
  insert into private.partner_consent_meta (consent_id, consenter_name, consenter_title)
  values (v_consent_id, trim(p_consenter_name), trim(p_consenter_title));

  insert into public.partner_consent (partner_id, consent_type, granted, method, collected_at, recorded_by_admin_id, evidence_kind)
  values (v_partner_id, 'privacy', true, p_method, p_collected_at, v_admin_id, p_evidence_kind)
  returning id into v_consent_id;
  insert into private.partner_consent_meta (consent_id, consenter_name, consenter_title)
  values (v_consent_id, trim(p_consenter_name), trim(p_consenter_title));

  perform private.log_audit(
    p_action := 'admin_partner.admin_entry_create',
    p_target_table := 'partner', p_target_id := v_partner_id::text,
    p_subject_ids := array[v_partner_id],
    p_after_summary := jsonb_build_object('business_entity_type', p_business_entity_type, 'vertical', p_vertical)
  );
  perform private.log_audit(
    p_action := 'admin_partner.consent_evidence_write',
    p_target_table := 'partner', p_target_id := v_partner_id::text,
    p_subject_ids := array[v_partner_id],
    p_after_summary := jsonb_build_object('method', p_method, 'evidence_kind', p_evidence_kind)
  );

  return v_partner_id;
end;
$$;

revoke all on function public.admin_create_partner_entry(text, text, text, text, text, timestamptz, text, text, text, text) from public;
grant execute on function public.admin_create_partner_entry(text, text, text, text, text, timestamptz, text, text, text, text) to authenticated;


-- =============================================================================
-- §10. Verification queue RPCs (A1-R5)
-- =============================================================================

create or replace function public.admin_verify_partner(p_partner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    private.is_active_admin() and private.is_aal2()
    and private.has_menu_permission('partner_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  update public.partner
  set verification_state = 'verified', rejected_at = null
  where id = p_partner_id and verification_state in ('submitted', 'under_review');

  if not found then
    raise exception 'invalid_state_for_verification';
  end if;

  -- PR-2 / Q-2: business-registration certs get a hard purge deadline the
  -- moment verification succeeds (90 days), never before.
  update public.partner_document
  set purge_after = now() + interval '90 days'
  where partner_id = p_partner_id and doc_type = 'business_registration_cert' and purge_after is null;

  perform private.log_audit(
    p_action := 'admin_partner.verify', p_target_table := 'partner', p_target_id := p_partner_id::text,
    p_subject_ids := array[p_partner_id]
  );
end;
$$;

revoke all on function public.admin_verify_partner(uuid) from public;
grant execute on function public.admin_verify_partner(uuid) to authenticated;


create or replace function public.admin_reject_partner(p_partner_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    private.is_active_admin() and private.is_aal2()
    and private.has_menu_permission('partner_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'rejection_reason_required';
  end if;

  update public.partner
  set verification_state = 'rejected', rejected_at = now(), rejection_reason = p_reason, public_listing_state = 'off'
  where id = p_partner_id and verification_state in ('submitted', 'under_review', 'verified');

  if not found then
    raise exception 'invalid_state_for_rejection';
  end if;

  -- Fix (qa-reviewer, 2026-08-30): the reason text itself now lives on
  -- public.partner (readable by the owning partner and partner_management
  -- admins), not just its length here. Length is kept in the audit summary
  -- for a quick glance without opening the row.
  perform private.log_audit(
    p_action := 'admin_partner.reject', p_target_table := 'partner', p_target_id := p_partner_id::text,
    p_subject_ids := array[p_partner_id],
    p_after_summary := jsonb_build_object('reason_length', char_length(p_reason))
  );
end;
$$;

revoke all on function public.admin_reject_partner(uuid, text) from public;
grant execute on function public.admin_reject_partner(uuid, text) to authenticated;


-- =============================================================================
-- §11. Public-listing 3-layer gate (privacy review §3.3)
-- =============================================================================

create or replace function public.partner_set_public_listing(p_partner_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_partner public.partner%rowtype;
  v_is_owner boolean;
  v_is_admin boolean;
  v_consent public.partner_consent%rowtype;
  v_has_biz_cert boolean;
begin
  select * into v_partner from public.partner where id = p_partner_id;
  if v_partner.id is null then
    raise exception 'partner_not_found' using errcode = 'P0002';
  end if;

  v_is_owner := private.is_active_partner(v_auth_uid) and private.owns_partner(p_partner_id, v_auth_uid);
  v_is_admin := private.is_active_admin(v_auth_uid) and private.is_aal2()
    and private.has_menu_permission('partner_management', 'update', v_auth_uid);

  if not (v_is_owner or v_is_admin) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if p_on then
    -- Layer 2, condition (a): verified.
    if v_partner.verification_state <> 'verified' then
      raise exception 'not_verified';
    end if;

    -- Layer 2, condition (b): latest public_listing consent row is granted.
    select * into v_consent from public.partner_consent
    where partner_id = p_partner_id and consent_type = 'public_listing'
    order by recorded_at desc limit 1;

    if v_consent.id is null or v_consent.granted is not true then
      raise exception 'public_listing_consent_missing';
    end if;

    -- Layer 2, condition (c): owner may always act on their own valid
    -- consent; an admin may only act on an admin_entry row's consent when
    -- that SPECIFIC consent record shows phone/in_person evidence (i.e. it
    -- was NOT self-recorded online by someone impersonating the owner).
    if not (v_is_owner or (v_is_admin and v_consent.method in ('phone', 'in_person'))) then
      raise exception 'insufficient_consent_evidence_for_admin_activation';
    end if;

    -- Layer 2, condition (d): business-registration certificate on file
    -- (PRD 결함 #4 correction, privacy review §9 item 4).
    select exists (
      select 1 from public.partner_document
      where partner_id = p_partner_id and doc_type = 'business_registration_cert'
    ) into v_has_biz_cert;
    if not v_has_biz_cert then
      raise exception 'business_registration_cert_missing';
    end if;

    update public.partner set public_listing_state = 'on' where id = p_partner_id;
    perform private.log_audit(
      p_action := 'partner.public_listing_on', p_target_table := 'partner', p_target_id := p_partner_id::text,
      p_subject_ids := array[p_partner_id]
    );
  else
    -- Turning OFF is always allowed for the owner or any admin with update
    -- permission (A1-R9: "공개 중단만 일방 가능") — no consent/verification
    -- checks apply to the safer direction.
    update public.partner set public_listing_state = 'off' where id = p_partner_id and public_listing_state <> 'off';
    perform private.log_audit(
      p_action := 'partner.public_listing_off', p_target_table := 'partner', p_target_id := p_partner_id::text,
      p_subject_ids := array[p_partner_id]
    );
  end if;
end;
$$;

revoke all on function public.partner_set_public_listing(uuid, boolean) from public;
grant execute on function public.partner_set_public_listing(uuid, boolean) to authenticated;


create or replace function public.admin_suspend_partner_listing(p_partner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    private.is_active_admin() and private.is_aal2()
    and private.has_menu_permission('partner_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  update public.partner set public_listing_state = 'suspended' where id = p_partner_id;
  if not found then
    raise exception 'partner_not_found' using errcode = 'P0002';
  end if;

  perform private.log_audit(
    p_action := 'admin_partner.suspend_listing', p_target_table := 'partner', p_target_id := p_partner_id::text,
    p_subject_ids := array[p_partner_id]
  );
end;
$$;

revoke all on function public.admin_suspend_partner_listing(uuid) from public;
grant execute on function public.admin_suspend_partner_listing(uuid) to authenticated;


-- =============================================================================
-- §11a. Fix (qa-reviewer, 2026-08-30) — PR-9 withdrawal (privacy review §4
-- "PR-9 / SS-12" "즉시(트랜잭션 내)" steps 1-5) was fully specified but never
-- implemented; this RPC covers everything that CAN happen inside a single
-- SQL transaction. What it deliberately does NOT do (documented, not an
-- oversight, matching the partner_document purge-queue precedent above):
--   - step 3 (invalidate all refresh tokens via auth.admin.signOut) — Auth
--     Admin API, not reachable from SQL. The calling server route MUST call
--     `supabase.auth.admin.signOut(auth_user_id, 'global')` right after this
--     RPC returns successfully, or up to ~30min of stale sessions remain
--     valid (privacy review §4, step 3 note).
--   - step 7 (auth.users row deletion after the audit retention window) —
--     deferred/batch by design in the review itself, same as admin_user.
--   - step 8 (sole-proprietor company-info anonymization) — deferred to a
--     future retention batch; scoping that anonymization rule is a
--     PM/service-planner decision, not something to guess here.
-- =============================================================================

create or replace function public.partner_withdraw(p_partner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_account_id uuid;
begin
  -- Self-service only (SS-12 is the partner's own action) — matching §2.5
  -- rule 2, this is a separate access path, never OR'd with an admin check.
  if not (private.is_active_partner(v_auth_uid) and private.owns_partner(p_partner_id, v_auth_uid)) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  select owner_account_id into v_account_id from public.partner where id = p_partner_id;

  -- Step 1: account status.
  update public.partner_account
  set status = 'withdrawn', withdrawn_at = now()
  where id = v_account_id;

  -- Step 2: public exposure off immediately, plus a revocation row so
  -- partner_public's own consent-existence check (layer 3) independently
  -- excludes this row even if public_listing_state were ever force-set back
  -- to 'on' by mistake (the review's "의도된 중복" philosophy, extended).
  update public.partner set public_listing_state = 'off' where id = p_partner_id;

  insert into public.partner_consent (partner_id, consent_type, granted, method, collected_at)
  values (p_partner_id, 'public_listing', false, 'online_self', now());

  -- Step 4: all on-file documents queued for hard deletion immediately
  -- (privacy review §4 PR-2 "탈퇴 시: 즉시 전량 삭제"), not the 90-day path.
  update public.partner_document
  set pending_deletion_at = now()
  where partner_id = p_partner_id and pending_deletion_at is null;

  -- Contact PII: delete now (review recommends immediate, allows up to 30
  -- days if dispute-handling requires it — v1.0 takes the immediate option).
  delete from private.partner_contact where partner_id = p_partner_id;

  -- Step 5.
  perform private.log_audit(
    p_action := 'partner.withdraw', p_target_table := 'partner', p_target_id := p_partner_id::text,
    p_subject_ids := array[p_partner_id]
  );
end;
$$;

comment on function public.partner_withdraw is
  'PR-9 (privacy review §4). Match-history retention is intentionally NOT '
  'this function''s concern: per the review, company-level match rows are '
  'kept (§1.3 North Star source), only person-level contact PII is purged, '
  'and partner_contact deletion here already covers that.';

revoke all on function public.partner_withdraw(uuid) from public;
grant execute on function public.partner_withdraw(uuid) to authenticated;


-- =============================================================================
-- §11b. Fix (qa-reviewer, 2026-08-30) — no RPC existed for a partner to
-- change an optional consent (public_listing off→on after verification,
-- marketing on/off) after signup; finalize_partner_signup only writes the
-- consent rows captured at signup time. 'terms'/'privacy' are excluded on
-- purpose (they gate account status, not self-service revocable here) and
-- 'third_party_share' is excluded per F-8 (collected per-match, not here).
-- =============================================================================

create or replace function public.partner_grant_consent(
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
  v_partner_id uuid := private.current_partner_id(v_auth_uid);
begin
  if v_partner_id is null or not private.is_active_partner(v_auth_uid) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if p_consent_type not in ('public_listing', 'marketing') then
    raise exception 'consent_type_not_self_service' using errcode = 'P0001';
  end if;

  insert into public.partner_consent (
    partner_id, consent_type, granted, document_version, consent_locale, method, collected_at
  ) values (
    v_partner_id, p_consent_type, p_granted, p_document_version, p_consent_locale, 'online_self', now()
  );

  perform private.log_audit(
    p_action := case when p_granted then 'partner.consent_grant' else 'partner.consent_revoke' end,
    p_target_table := 'partner_consent', p_target_id := v_partner_id::text,
    p_subject_ids := array[v_partner_id],
    p_after_summary := jsonb_build_object('consent_type', p_consent_type, 'granted', p_granted)
  );
end;
$$;

revoke all on function public.partner_grant_consent(text, boolean, text, text) from public;
grant execute on function public.partner_grant_consent(text, boolean, text, text) to authenticated;


-- Layer 3: the ONLY read path for anon (SEEPN public pages, P5) and the
-- generic authenticated public view. No RLS needed on the view itself
-- (Postgres views default to running with the OWNER's privileges unless
-- `security_invoker=true` is set, which this deliberately does NOT set —
-- the fixed WHERE clause below is the entire security boundary, not a
-- caller-controlled parameter). public.partner itself has zero GRANT to
-- anon, so anon's only possible partner data access in this whole schema is
-- through this view.
create or replace view public.partner_public as
select
  p.id,
  p.company_name_ko, p.company_name_en, p.founded_year, p.employee_band,
  p.location_region, p.website_url,
  p.supported_languages, p.overseas_experience, p.overseas_experience_countries,
  p.company_intro_text, p.company_intro_locale, p.representative_offerings, p.certifications,
  p.vertical,
  p.moq, p.price_band, p.lead_time_days, p.sample_available, p.sample_terms, p.oem_odm_type, p.export_record,
  p.service_types, p.project_min_size, p.pricing_model, p.standard_lead_time, p.reference_projects,
  p.team_size_band, p.remote_onsite
from public.partner p
left join public.partner_account pa on pa.id = p.owner_account_id
where p.public_listing_state = 'on'
  and p.verification_state = 'verified'
  -- Fix (qa-reviewer, 2026-08-30): an explicit withdrawal check, independent
  -- of the consent-existence check below. partner_withdraw() already revokes
  -- public_listing consent and turns this off, so today this condition never
  -- actually fires — it exists purely as another "의도된 중복" layer in case
  -- a future code path ever sets public_listing_state='on' without going
  -- through partner_withdraw()'s bookkeeping. left join, not inner: rows
  -- with no owner_account_id (unclaimed admin_entry) have no account to be
  -- withdrawn, so pa.id is null and this condition must not exclude them.
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

comment on view public.partner_public is
  'privacy review §3.3 layer 3. Deliberately duplicates the consent check '
  'already enforced by partner_set_public_listing (layer 2) — "이 중복이 '
  '방어선입니다": even a bug in layer 2, or a direct service_role UPDATE '
  'that force-sets public_listing_state=''on'', still cannot make a row '
  'appear here without a live granted public_listing consent row. NO contact '
  'columns exist in this view AT ALL, by construction, not by masking.';

grant select on public.partner_public to anon, authenticated;


-- =============================================================================
-- §12. PR-12 — sanitized business-registration-number duplicate check
-- =============================================================================

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
  );
$$;

comment on function public.check_business_registration_duplicate is
  'PR-12: returns a bare boolean, never which company or what state ("이미 '
  '등록됨" enumeration risk). Deliberately NOT granted to anon — SS-5 must '
  'happen after login + email verification (service-planner SP-3), and the '
  'calling route must apply its own per-account rate limit (app layer, not '
  'enforceable in SQL).';

revoke all on function public.check_business_registration_duplicate(text) from public;
grant execute on function public.check_business_registration_duplicate(text) to authenticated;
-- Intentionally NOT granted to anon (PR-12).


-- =============================================================================
-- §13. Retention batches — PR-11 / PR-2 / PR-5 / Q-3 (privacy review §3.5, §4)
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

  alter table public.retention_jobs
    add constraint retention_jobs_job_type_check
    check (job_type in (
      'anonymize', 'hard_delete', 'audit_purge', 'failed_submission_purge',
      'partner_unconsented_purge', 'partner_doc_purge', 'partner_rejected_purge',
      'partner_consent_meta_purge'
    ));
end;
$$;


create or replace function private.purge_unconsented_partner_pii()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner record;
  v_count integer := 0;
begin
  for v_partner in
    select p.* from public.partner p
    where p.intake_source = 'admin_entry'
      and p.pii_purged_at is null
      and p.consent_deadline_at is not null
      and p.consent_deadline_at < now()
      and not exists (
        select 1 from public.partner_consent pc
        where pc.partner_id = p.id and pc.consent_type in ('terms', 'privacy') and pc.granted = true
        group by pc.partner_id
        having count(distinct pc.consent_type) = 2
      )
  loop
    delete from private.partner_contact where partner_id = v_partner.id;
    update public.partner_document set pending_deletion_at = now()
    where partner_id = v_partner.id and pending_deletion_at is null;

    if v_partner.business_entity_type = 'sole_proprietor' then
      -- §3.5: sole-proprietor identifying fields ARE personal data — full
      -- anonymization, not just contact removal (corporation rows keep
      -- their company-level fields for outreach per the review's allowance).
      update public.partner set
        company_name_ko = '[purged]', company_name_en = null,
        business_registration_number = null, location_region = null,
        website_url = null, company_intro_text = null,
        public_listing_state = 'off', pii_purged_at = now()
      where id = v_partner.id;
    else
      update public.partner set public_listing_state = 'off', pii_purged_at = now()
      where id = v_partner.id;
    end if;

    v_count := v_count + 1;
  end loop;

  insert into public.retention_jobs (job_type, target_condition, anonymized_count, notes)
  values (
    'partner_unconsented_purge',
    'intake_source=''admin_entry'' and consent_deadline_at < now() and no granted terms+privacy consent',
    v_count,
    'PR-11 (privacy review §3.5): 90-day default consent_deadline_at, recommended value adopted.'
  );

  return v_count;
end;
$$;


create or replace function private.mark_expired_partner_documents_for_purge()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.partner_document
  set pending_deletion_at = now()
  where purge_after is not null and purge_after < now() and pending_deletion_at is null;
  get diagnostics v_count = row_count;

  insert into public.retention_jobs (job_type, target_condition, anonymized_count, notes)
  values (
    'partner_doc_purge',
    'purge_after < now() and pending_deletion_at is null',
    v_count,
    'PR-2/Q-2 (adopted: verified+90d). This batch only QUEUES rows '
    '(pending_deletion_at) — actual Storage object + row deletion requires '
    'the service_role Storage API, which SQL/pg_cron cannot call. A '
    'follow-up Next.js scheduled route / Supabase Edge Function must poll '
    'partner_document WHERE pending_deletion_at IS NOT NULL, remove the '
    'object, then DELETE the row. This is an explicit gap left for '
    'frontend/platform follow-up, not an oversight.'
  );

  return v_count;
end;
$$;


create or replace function private.purge_rejected_partner_pii()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with target as (
    select id from public.partner
    where verification_state = 'rejected'
      and rejected_at is not null
      and rejected_at < now() - interval '90 days'
      and pii_purged_at is null
  )
  delete from private.partner_contact pc using target t where pc.partner_id = t.id;

  update public.partner_document pd
  set pending_deletion_at = now()
  from public.partner p
  where pd.partner_id = p.id
    and p.verification_state = 'rejected'
    and p.rejected_at < now() - interval '90 days'
    and p.pii_purged_at is null
    and pd.pending_deletion_at is null;

  with target as (
    select id from public.partner
    where verification_state = 'rejected'
      and rejected_at < now() - interval '90 days'
      and pii_purged_at is null
  )
  update public.partner p set pii_purged_at = now()
  from target t where p.id = t.id;
  get diagnostics v_count = row_count;

  insert into public.retention_jobs (job_type, target_condition, anonymized_count, notes)
  values (
    'partner_rejected_purge',
    'verification_state=''rejected'' and rejected_at < now() - interval ''90 days''',
    v_count,
    'PR-5 (privacy review §4): rejected-partner contact PII purged 90 days '
    'after rejection; rejection reason/statistics on public.partner survive.'
  );

  return v_count;
end;
$$;


create or replace function private.purge_expired_partner_consent_meta()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  -- Q-3 (adopted recommendation): 3 years post-withdrawal. Only the
  -- consenter-identity metadata is purged — public.partner_consent itself
  -- (the fact/timestamp/version of consent) is retained indefinitely as
  -- append-only evidence, per header note 2.
  with target as (
    select pcm.consent_id
    from private.partner_consent_meta pcm
    join public.partner_consent pc on pc.id = pcm.consent_id
    join public.partner p on p.id = pc.partner_id
    join public.partner_account pa on pa.id = p.owner_account_id
    where pa.status = 'withdrawn'
      and pa.withdrawn_at is not null
      and pa.withdrawn_at < now() - interval '3 years'
  )
  delete from private.partner_consent_meta pcm using target t where pcm.consent_id = t.consent_id;
  get diagnostics v_count = row_count;

  insert into public.retention_jobs (job_type, target_condition, anonymized_count, notes)
  values (
    'partner_consent_meta_purge',
    'partner_account.status=''withdrawn'' and withdrawn_at < now() - interval ''3 years''',
    v_count,
    'Q-3 (privacy review §4 PR-5, §7.2): 3-year post-withdrawal retention of '
    'consent evidence, recommended value adopted pending legal confirmation '
    '(변호사 검토 필요, per the review).'
  );

  return v_count;
end;
$$;


-- Extend the Phase 3 daily batch runner with the four new jobs above. Each
-- new call is independently fault-isolated, same pattern as the three
-- pre-existing calls (which are reproduced byte-for-byte below).
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
end;
$$;


-- =============================================================================
-- End of partner schema migration.
-- =============================================================================
