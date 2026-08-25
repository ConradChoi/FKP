-- =============================================================================
-- FKP v0.2 Phase 1 — Lead pipeline: Apps Script/Sheets -> Supabase (Postgres)
-- =============================================================================
--
-- Design Ref:
--   - docs/01-plan/features/fkp-v0.2-platform-foundation.prd.md
--     §4.1 Epic 1 (E1-R1..R11), §6 Phase 1
--   - docs/01-plan/features/fkp-v0.2-privacy-review-oq4-tv4.md
--     §2 (retention/erasure), §4 (consent columns), §5 (RLS principles R-1..R-12)
--
-- STATUS: Applied to the live project by the representative on 2026-08-24 via
-- the Supabase Dashboard SQL Editor, and re-verified live by qa-reviewer (RLS
-- deny-by-default, insert-only RPC, consent checks). backend-developer could
-- not run it directly (no DB password/service_role key in this environment),
-- hence the how-to-apply notes below — kept for reference and for any future
-- migration files that still need manual application.
--
--   Option A — Supabase Dashboard SQL Editor
--     1. Open https://supabase.com/dashboard/project/<project-ref>/sql/new
--     2. Paste the full contents of this file and click "Run".
--     3. Re-run is idempotent-ish (uses IF NOT EXISTS / CREATE OR REPLACE).
--
--   Option B — Supabase CLI
--     1. `supabase link --project-ref <project-ref>`
--     2. `supabase db push`
--
--   AFTER applying this file, two things must be done from the Supabase
--   Dashboard (cannot be done via SQL migration):
--     1. Authentication > Providers > Email > "Allow new users to sign up" -> OFF
--        (privacy review §5.1, S-1 — public sign-up must be closed regardless of
--        this migration; confirm it is still OFF).
--     2. Project Settings > API > Exposed schemas — make sure `private` is
--        NOT added to the list (only `public` should be exposed via PostgREST).
--        This is the second, independent layer of defense for the
--        `private.request_meta` table described in §2 below.
--
-- =============================================================================


-- =============================================================================
-- §0. Preconditions / notes
-- =============================================================================
-- - Assumes Supabase project region = ap-northeast-2 (Seoul), confirmed by the
--   representative (privacy review §7 checklist). No cross-border-transfer
--   clause is embedded in this schema as a result.
-- - gen_random_uuid() / now() / left() are pg_catalog builtins (PG13+) and
--   resolve correctly even under `set search_path = ''` because pg_catalog is
--   always implicitly searched by Postgres regardless of search_path.
-- - Enum-like columns use `text` + `check` (not native Postgres ENUM types) so
--   that adding values later (e.g. Phase 4 locales ko/zh) is a simple
--   `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT ...` instead of the
--   more awkward ALTER TYPE ... ADD VALUE workflow.


-- =============================================================================
-- §1. `private` schema — for columns that must never be reachable via
--     PostgREST even if a future policy/grant mistake is made
--     (privacy review R-7: internal_note, consent_ip must be split out)
-- =============================================================================

create schema if not exists private;

-- New schemas do not grant PUBLIC usage by default in Postgres, but we revoke
-- explicitly anyway so intent is self-documenting and this migration is safe
-- to re-run even if Supabase's project defaults ever change.
revoke all on schema private from anon, authenticated;


-- =============================================================================
-- §2. public.requests — the core lead table
-- =============================================================================

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),

  -- --- form fields (Step 1) ---------------------------------------------
  what_looking_for text not null check (char_length(what_looking_for) between 1 and 300),
  category text not null check (category in (
    'education', 'it-ai', 'content-media', 'beauty-lifestyle', 'business-services'
  )),

  -- --- form fields (Step 2) ---------------------------------------------
  partner_type text not null check (partner_type in (
    'purchase', 'partnership', 'license', 'other'
  )),
  purpose text not null check (char_length(purpose) between 1 and 500),
  description text not null check (char_length(description) between 1 and 5000),
  budget text not null check (budget in (
    'under-500', '500-1500', '1500-3000', 'over-3000', 'not-sure'
  )),
  timeline text not null check (timeline in (
    'asap', 'within-1-month', '1-3-months', '3-6-months', 'flexible'
  )),
  english_speaking text not null check (english_speaking in (
    'required', 'preferred', 'not-needed'
  )),

  -- --- form fields (Step 3) ---------------------------------------------
  company_name_website text not null check (char_length(company_name_website) between 1 and 300),
  contact text not null check (
    char_length(contact) <= 254
    and contact ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'
  ),

  -- --- operational columns (E1-R5) ---------------------------------------
  -- NOTE: OQ-3 confirmed status workflow: 신규접수(new) -> 검토중(reviewing)
  -- -> 파트너매칭중(matching) -> 매칭완료(matched) / 보류(on_hold) / 종료(closed, incl. spam)
  status text not null default 'new' check (status in (
    'new', 'reviewing', 'matching', 'matched', 'on_hold', 'closed'
  )),
  -- FK to admin_user(id) will be added in the Phase 3 migration once the
  -- admin_user table exists (E3-R2). Left unconstrained for now.
  assignee_id uuid,
  source text not null default 'web' check (char_length(source) <= 50),
  locale text not null check (locale in ('en', 'ja')), -- Phase 4 will widen this set (ko/zh)

  -- --- consent columns (privacy review §4.3 — verbatim) -------------------
  privacy_consent boolean not null,
  consent_version text not null check (char_length(consent_version) <= 100),
  consented_at timestamptz not null,
  consent_locale text not null check (consent_locale in ('en', 'ja')),
  terms_consent boolean not null,
  terms_version text not null check (char_length(terms_version) <= 100),
  marketing_consent boolean not null default false,
  marketing_consented_at timestamptz,

  -- future-use consent columns (Phase 1: columns only, unused — privacy
  -- review §4.1 item 2: do NOT collect 3rd-party-transfer consent at intake
  -- time; it must be requested individually at actual matching time)
  third_party_consent boolean not null default false,
  third_party_consented_at timestamptz,
  third_party_recipient text,

  -- --- retention / erasure columns (privacy review §2.4) -------------------
  retention_expires_at timestamptz not null,
  anonymized_at timestamptz,

  -- --- timestamps -----------------------------------------------------------
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_privacy_consent check (privacy_consent = true),
  constraint chk_terms_consent check (terms_consent = true)
);

comment on table public.requests is
  'Lead intake. Written exclusively through public.submit_request(); direct '
  'INSERT/UPDATE/DELETE/SELECT via PostgREST is denied for anon/authenticated '
  '(see §5 GRANT revocation + §6 RLS policies below).';
comment on column public.requests.retention_expires_at is
  'Auto-maintained by trg_requests_set_retention. See '
  'public.compute_retention_expires_at() for the 12mo/24mo/30d rule.';
comment on column public.requests.anonymized_at is
  'Set by the (future, Phase 1+ optional) retention batch job when PII '
  'columns are nulled out per privacy review §2.3 (in-place anonymization, '
  'row kept for statistics). closed/spam rows are hard-deleted instead.';

create index if not exists idx_requests_status on public.requests (status);
create index if not exists idx_requests_locale on public.requests (locale);
create index if not exists idx_requests_category on public.requests (category);
create index if not exists idx_requests_created_at on public.requests (created_at);
-- Partial index for the future retention batch job (privacy review §2.4).
create index if not exists idx_requests_retention_pending
  on public.requests (retention_expires_at)
  where anonymized_at is null;

alter table public.requests enable row level security;
alter table public.requests force row level security; -- R-1


-- =============================================================================
-- §3. private.request_meta — sensitive columns split out of public.requests
--     (privacy review R-7: internal_note, consent_ip)
-- =============================================================================

create table if not exists private.request_meta (
  request_id uuid primary key references public.requests (id) on delete cascade,

  -- /24-masked at write time by the caller (see lib/forms/mask.ts::maskIp).
  -- This column must never receive a raw, unmasked IP address.
  consent_ip text,
  -- Retention decision (privacy review §7 checklist): masked IP kept 6 months
  -- regardless of the lead's own retention_expires_at.
  consent_ip_expires_at timestamptz,

  -- Populated by the Phase 3 Admin console (E3-R2). Not written in Phase 1.
  internal_note text check (internal_note is null or char_length(internal_note) <= 5000),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table private.request_meta is
  'Split from public.requests per privacy review R-7. Lives in the `private` '
  'schema, which must NOT be added to Supabase API Settings > Exposed '
  'schemas, in addition to the GRANT/RLS lockdown below (defense in depth).';

create index if not exists idx_request_meta_consent_ip_expires_at
  on private.request_meta (consent_ip_expires_at);

alter table private.request_meta enable row level security;
alter table private.request_meta force row level security;


-- =============================================================================
-- §4. public.failed_submissions — masked payloads for manual recovery
--     (E1-R9, privacy review S-5)
-- =============================================================================
--
-- IMPORTANT: this table must never receive raw PII. The Next.js server route
-- masks values BEFORE calling public.log_failed_submission() — see
-- lib/forms/mask.ts. Free-text fields are recorded as a LENGTH ONLY.

create table if not exists public.failed_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- 7-day retention (S-5). No pg_cron job ships in Phase 1 (optional per
  -- scope); this column exists so the batch can be added later without a
  -- schema change. See §8 note.
  expires_at timestamptz not null default (now() + interval '7 days'),

  reason text not null check (char_length(reason) <= 100), -- e.g. 'rpc_error', 'validation_error', 'network_error'
  error_detail text check (error_detail is null or char_length(error_detail) <= 500),

  -- masked contact, e.g. 'a***@example.com' — never a full email address
  masked_contact text,

  -- free-text fields: length only, never content
  what_looking_for_length integer,
  purpose_length integer,
  description_length integer,
  company_name_website_length integer,

  -- non-PII structured fields kept as-is for triage
  category text,
  partner_type text,
  budget text,
  timeline text,
  english_speaking text,
  locale text,
  source text default 'web',
  request_ip text -- /24-masked, same rule as private.request_meta.consent_ip
);

comment on table public.failed_submissions is
  'Masked record of submit_request() failures for manual recovery (E1-R9). '
  'Written only via public.log_failed_submission(). 7-day retention '
  '(expires_at) — batch deletion is optional in Phase 1, see migration '
  'header notes.';

create index if not exists idx_failed_submissions_expires_at on public.failed_submissions (expires_at);
create index if not exists idx_failed_submissions_created_at on public.failed_submissions (created_at);

alter table public.failed_submissions enable row level security;
alter table public.failed_submissions force row level security;


-- =============================================================================
-- §5. public.retention_jobs — batch-run evidence (schema only, Phase 1)
-- =============================================================================
-- Actual pg_cron scheduling + the anonymization/hard-delete batch function
-- are explicitly OUT of scope for Phase 1 (optional per task scope). This
-- table exists now so that when the batch ships, no further schema
-- migration is needed and historical proof-of-erasure can start
-- accumulating from day one if a job is added later.

create table if not exists public.retention_jobs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  job_type text not null check (job_type in ('anonymize', 'hard_delete')),
  target_condition text, -- human-readable description of the WHERE clause applied
  anonymized_count integer not null default 0,
  deleted_count integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.retention_jobs is
  'Proof-of-erasure log for the retention batch (privacy review §2.4). No '
  'writer exists yet in Phase 1 — this table is schema-only groundwork.';

alter table public.retention_jobs enable row level security;
alter table public.retention_jobs force row level security;


-- =============================================================================
-- §6. GRANT lockdown (privacy review R-2) — do this BEFORE relying on RLS
-- =============================================================================
-- Supabase grants broad default privileges on the `public` schema to
-- anon/authenticated at project creation time, and those defaults apply to
-- every new table unless revoked. Revoke explicitly, per table, right here.

revoke all on public.requests from anon, authenticated;
revoke all on public.failed_submissions from anon, authenticated;
revoke all on public.retention_jobs from anon, authenticated;
revoke all on private.request_meta from anon, authenticated;

-- Also close the door for any future table created by this same role
-- without an explicit REVOKE (Phase 3 migrations should repeat this
-- pattern per table rather than relying on this statement retroactively).
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema private revoke all on tables from anon, authenticated;


-- =============================================================================
-- §7. Retention timestamp automation (privacy review §2.4)
-- =============================================================================

create or replace function public.compute_retention_expires_at(
  p_status text,
  p_status_changed_at timestamptz
)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'matched' then p_status_changed_at + interval '24 months'
    when 'closed'  then p_status_changed_at + interval '30 days'
    else                p_status_changed_at + interval '12 months'
  end
$$;

comment on function public.compute_retention_expires_at is
  'Privacy review §2.3 retention matrix: matched=+24mo, closed(incl. spam)=+30d, '
  'everything else (new/reviewing/matching/on_hold)=+12mo from last status change.';

create or replace function public.requests_set_retention()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.retention_expires_at := public.compute_retention_expires_at(new.status, new.created_at);
    return new;
  end if;

  new.updated_at := now();
  if new.status is distinct from old.status then
    new.retention_expires_at := public.compute_retention_expires_at(new.status, new.updated_at);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_requests_set_retention on public.requests;
create trigger trg_requests_set_retention
  before insert or update on public.requests
  for each row execute function public.requests_set_retention();

comment on trigger trg_requests_set_retention on public.requests is
  'Recomputes retention_expires_at whenever status changes (Phase 3 admin '
  'status updates get correct retention automatically, no app-side logic needed).';


-- =============================================================================
-- §8. Write path — insert-only RPC functions (privacy review R-3, R-4)
-- =============================================================================
-- SECURITY DEFINER + `set search_path = ''` + fully-schema-qualified object
-- references. anon gets EXECUTE only — no SELECT/INSERT/UPDATE/DELETE grant
-- on any table, so a leaked anon key cannot read or directly write leads.

create or replace function public.submit_request(
  p_what_looking_for text,
  p_category text,
  p_partner_type text,
  p_purpose text,
  p_description text,
  p_budget text,
  p_timeline text,
  p_english_speaking text,
  p_company_name_website text,
  p_contact text,
  p_locale text,
  p_privacy_consent boolean,
  p_consent_version text,
  p_consent_locale text,
  p_terms_consent boolean,
  p_terms_version text,
  p_marketing_consent boolean,
  p_consent_ip text default null,
  p_source text default 'web'
)
returns table (id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_created_at timestamptz;
  v_now timestamptz := now();
begin
  -- Defense in depth: the Next.js route (E1-R3) already validates this, and
  -- the table-level CHECK constraints also enforce it. This gives a clean,
  -- distinguishable error message for the caller to map to an API error code.
  if p_privacy_consent is not true or p_terms_consent is not true then
    raise exception 'consent_required';
  end if;

  insert into public.requests (
    what_looking_for, category, partner_type, purpose, description,
    budget, timeline, english_speaking, company_name_website, contact,
    locale, source,
    privacy_consent, consent_version, consented_at, consent_locale,
    terms_consent, terms_version,
    marketing_consent, marketing_consented_at
  ) values (
    p_what_looking_for, p_category, p_partner_type, p_purpose, p_description,
    p_budget, p_timeline, p_english_speaking, p_company_name_website, p_contact,
    p_locale, coalesce(p_source, 'web'),
    true, p_consent_version, v_now, p_consent_locale,
    true, p_terms_version,
    coalesce(p_marketing_consent, false),
    case when p_marketing_consent then v_now else null end
  )
  returning requests.id, requests.created_at into v_id, v_created_at;

  insert into private.request_meta (request_id, consent_ip, consent_ip_expires_at)
  values (
    v_id,
    p_consent_ip,
    case when p_consent_ip is not null then v_now + interval '6 months' else null end
  );

  return query select v_id, v_created_at;
end;
$$;

comment on function public.submit_request is
  'The ONLY write path into public.requests for anon callers. Called from '
  'the Next.js route handler (app/api/requests/route.ts), never directly '
  'from the browser (E1-R1). p_consent_ip must already be /24-masked by the '
  'caller (lib/forms/mask.ts::maskIp) — this function does not mask it.';

revoke execute on function public.submit_request(
  text, text, text, text, text, text, text, text, text, text, text,
  boolean, text, text, boolean, text, boolean, text, text
) from public;
grant execute on function public.submit_request(
  text, text, text, text, text, text, text, text, text, text, text,
  boolean, text, text, boolean, text, boolean, text, text
) to anon, authenticated;


create or replace function public.log_failed_submission(
  p_reason text,
  p_error_detail text default null,
  p_masked_contact text default null,
  p_what_looking_for_length integer default null,
  p_purpose_length integer default null,
  p_description_length integer default null,
  p_company_name_website_length integer default null,
  p_category text default null,
  p_partner_type text default null,
  p_budget text default null,
  p_timeline text default null,
  p_english_speaking text default null,
  p_locale text default null,
  p_source text default 'web',
  p_request_ip text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.failed_submissions (
    reason, error_detail, masked_contact,
    what_looking_for_length, purpose_length, description_length, company_name_website_length,
    category, partner_type, budget, timeline, english_speaking, locale, source, request_ip
  ) values (
    left(p_reason, 100), left(p_error_detail, 500), p_masked_contact,
    p_what_looking_for_length, p_purpose_length, p_description_length, p_company_name_website_length,
    p_category, p_partner_type, p_budget, p_timeline, p_english_speaking, p_locale,
    coalesce(p_source, 'web'), p_request_ip
  )
  returning failed_submissions.id into v_id;

  return v_id;
end;
$$;

comment on function public.log_failed_submission is
  'Called by the Next.js route handler when submit_request() fails or the '
  'request never reached Supabase. Caller MUST pre-mask contact/IP and MUST '
  'NOT pass raw free-text field content — lengths only (privacy review S-5).';

revoke execute on function public.log_failed_submission(
  text, text, text, integer, integer, integer, integer,
  text, text, text, text, text, text, text, text
) from public;
grant execute on function public.log_failed_submission(
  text, text, text, integer, integer, integer, integer,
  text, text, text, text, text, text, text, text
) to anon, authenticated;


-- =============================================================================
-- §9. RLS policies — explicit, per-command, deny-by-default (R-5)
-- =============================================================================
-- No admin/role model exists yet (that's Phase 3 — E3). Until then, direct
-- PostgREST access to these tables must be impossible for every role, which
-- is already true from §6's GRANT revocation. These policies are an
-- explicit, self-documenting second layer (R-1) and a placeholder Phase 3
-- will replace with real admin-role-scoped policies backed by a
-- SECURITY DEFINER permission-check helper (privacy review R-6, to avoid
-- circular RLS recursion against a future admin_user/role table).
--
-- `for all using (true)` is never used anywhere in this file (R-5).

create policy requests_deny_select on public.requests for select to public using (false);
create policy requests_deny_insert on public.requests for insert to public with check (false);
create policy requests_deny_update on public.requests for update to public using (false) with check (false);
create policy requests_deny_delete on public.requests for delete to public using (false);

create policy request_meta_deny_select on private.request_meta for select to public using (false);
create policy request_meta_deny_insert on private.request_meta for insert to public with check (false);
create policy request_meta_deny_update on private.request_meta for update to public using (false) with check (false);
create policy request_meta_deny_delete on private.request_meta for delete to public using (false);

create policy failed_submissions_deny_select on public.failed_submissions for select to public using (false);
create policy failed_submissions_deny_insert on public.failed_submissions for insert to public with check (false);
create policy failed_submissions_deny_update on public.failed_submissions for update to public using (false) with check (false);
create policy failed_submissions_deny_delete on public.failed_submissions for delete to public using (false);

create policy retention_jobs_deny_select on public.retention_jobs for select to public using (false);
create policy retention_jobs_deny_insert on public.retention_jobs for insert to public with check (false);
create policy retention_jobs_deny_update on public.retention_jobs for update to public using (false) with check (false);
create policy retention_jobs_deny_delete on public.retention_jobs for delete to public using (false);

-- submit_request() / log_failed_submission() still work despite these
-- deny-all policies because they are SECURITY DEFINER functions owned by
-- the migration-running role (postgres), which bypasses RLS in Supabase's
-- managed Postgres even with FORCE ROW LEVEL SECURITY set. This is the
-- documented Supabase pattern for insert-only public write APIs (R-3). The
-- privacy review's R-10 raw-HTTP verification (qa-reviewer, before deploy)
-- must confirm this holds in the actual project before launch.


-- =============================================================================
-- §10. Realtime — explicitly NOT enabled (R-8)
-- =============================================================================
-- Do not run `alter publication supabase_realtime add table ...` for any
-- table in this migration. No action needed beyond not adding it — this
-- section exists so a future migration author sees the decision was
-- deliberate, not an oversight.


-- =============================================================================
-- End of Phase 1 lead pipeline migration.
-- =============================================================================
