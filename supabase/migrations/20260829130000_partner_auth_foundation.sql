-- =============================================================================
-- SEEPN Unified Platform v1.0 — Partner Auth foundation
-- (auth_principal mutual-exclusion registry, partner_account, audit_log
--  extension for partner actors, partner judgment functions)
-- =============================================================================
--
-- Design Ref:
--   - docs/01-plan/features/seepn-unified-platform-v1.0.prd.md §3.0, §3.2.1
--     (D-4/D-6 — self-service partner accounts are P1/MVP), §3.2.3 (PC-1..PC-7)
--   - docs/03-security/partner-signup-privacy-review.md
--     §2.2 (auth_principal mutual-exclusion registry — table DDL copied
--     near-verbatim from this section), §2.3 (is_active_admin() is already
--     safe — no change needed to it), §2.4 (regression checklist — item (3)
--     revokes authenticated's EXECUTE on private.log_audit; item (5) widens
--     the public-content anon-only policies to anon+authenticated),
--     §2.5 (is_active_partner/current_partner_id/owns_partner design rules),
--     §2.6 (audit_log actor_kind/action/actor_partner_account_id extension —
--     this section's SQL sketch is followed exactly), §6.2 (consent type
--     list — used by 20260829140000, not this file)
--   - supabase/migrations/20260825120000_phase3_admin_rbac.sql (admin_user,
--     audit_log, private.log_audit(), private.is_active_admin() — this
--     migration ALTERs these, never edits that file directly)
--   - supabase/migrations/20260827100000_phase5_content_management_schema.sql
--     (content_item / content_translation / content_category_translation
--     anon-only public-read policies widened in §6 below)
--
-- STATUS: not yet applied. Apply by hand via the Supabase Dashboard SQL
-- Editor (or `supabase db push`), same process as every prior migration in
-- this repo — see the header of 20260824120000 for the two options. Apply
-- strictly in filename order: this file, then 20260829140000, then
-- 20260829150000, then 20260829160000.
--
-- IMPORTANT — deliberate scope decision vs. the task brief: `partner_account`
-- (Part B in the original task breakdown) is created HERE, in the "auth
-- foundation" file, not in 20260829140000_partner_schema.sql. Reason:
-- `partner_account` is the auth-side counterpart of `admin_user` (exactly
-- like admin_user, it exists to be the second leaf of the auth_principal
-- mutual-exclusion registry) — grouping it with auth_principal/admin_user
-- here mirrors how admin_user and role/menu/audit_log were grouped together
-- in 20260825120000 rather than split across files by "business domain".
-- The business entity `public.partner` (Capability data) still lives in
-- 20260829140000 as originally planned.
--
-- AFTER applying this file (Dashboard, cannot be done via SQL):
--   1. Authentication > Providers > Email > "Allow new users to sign up" ->
--      stays OFF (privacy review §2.8 / §K). Partner sign-up goes through
--      POST /api/partner/signup (service_role, supabase.auth.admin.createUser)
--      — see the RPC contract summary in the final report, not in this file.
--   2. Confirm `private` is still not an Exposed Schema (unchanged).
-- =============================================================================


-- =============================================================================
-- §1. public.auth_principal — mutual-exclusion registry (privacy review §2.2)
-- =============================================================================
-- Every login-capable Auth user in this project must be EXACTLY one kind:
-- 'admin' or 'partner', never both, enforced by composite FK from admin_user
-- and partner_account below (not by a trigger — FK/PK/UNIQUE constraints are
-- checked atomically at commit time and cannot be bypassed by a leaked
-- service_role key the way a trigger-based check could be, per privacy
-- review §2.2 "성질" table).

create table if not exists public.auth_principal (
  auth_user_id   uuid primary key references auth.users (id) on delete restrict,
  principal_kind text not null check (principal_kind in ('admin', 'partner')),
  created_at     timestamptz not null default now(),
  -- This UNIQUE is the actual FK target for admin_user/partner_account's
  -- composite FK below. Redundant with the PK for uniqueness purposes, but
  -- Postgres requires the referenced column *set* (in this exact order) to
  -- have its own unique constraint for a composite FK to reference it.
  unique (auth_user_id, principal_kind)
);

comment on table public.auth_principal is
  'Mutual-exclusion registry (privacy review §2.2): one row per Auth user, '
  'exactly one principal_kind. admin_user and partner_account both carry a '
  'composite FK (auth_user_id, principal_kind) -> this table''s UNIQUE, which '
  'makes "one auth user is both an admin and a partner" a constraint '
  'violation, not just an application-level bug — the guarantee holds even '
  'against a leaked service_role key (FK/CHECK are never bypassed by '
  'BYPASSRLS, only RLS is).';

alter table public.auth_principal enable row level security;
alter table public.auth_principal force row level security;
revoke all on public.auth_principal from anon, authenticated;
-- No RLS policy defined at all (deny-by-default) — this table is never read
-- or written directly by anon/authenticated; every writer is a SECURITY
-- DEFINER function (finalize_partner_signup, the admin_user backfill below,
-- finalize_admin_access_approval in a future revision of that file).


-- =============================================================================
-- §2. public.admin_user — retrofit principal_kind + composite FK (backfill)
-- =============================================================================

alter table public.admin_user
  add column if not exists principal_kind text not null default 'admin'
    check (principal_kind = 'admin');

comment on column public.admin_user.principal_kind is
  'Always ''admin''. Exists solely so the composite FK below can pin this row '
  'to the ''admin'' leaf of auth_principal (privacy review §2.2).';

-- Backfill auth_principal for every existing admin_user row that already has
-- an auth_user_id (the 3 bootstrap admin accounts, per the task brief — this
-- statement is written generically against however many rows actually exist
-- rather than hardcoding a count, so it stays correct regardless of exactly
-- how many admins have been provisioned by the time this runs).
insert into public.auth_principal (auth_user_id, principal_kind)
select au.auth_user_id, 'admin'
from public.admin_user au
where au.auth_user_id is not null
on conflict (auth_user_id) do nothing;

-- Composite FK. NULL auth_user_id (the §2.4 step-8 post-anonymization case,
-- documented on the admin_user table already) is never checked by a
-- MATCH SIMPLE foreign key (the default), so this is safe to add even though
-- auth_user_id remains nullable.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_admin_user_auth_principal'
  ) then
    alter table public.admin_user
      add constraint fk_admin_user_auth_principal
      foreign key (auth_user_id, principal_kind)
      references public.auth_principal (auth_user_id, principal_kind)
      on delete restrict;
  end if;
end;
$$;


-- =============================================================================
-- §3. public.partner_account — partner auth account (privacy review §2.2)
-- =============================================================================
-- Copied near-verbatim from the review's "partner_account 최소 컬럼 권고"
-- (§2.2). Deliberately NO email column (auth.users is the SSOT, admin_user
-- precedent) and display_name is a display label, never the contact
-- person's real name (that lives in private.partner_contact, 20260829140000).

create table if not exists public.partner_account (
  id uuid primary key default gen_random_uuid(),

  auth_user_id uuid unique references auth.users (id) on delete restrict, -- nullable, withdrawal precedent (admin_user)
  principal_kind text not null default 'partner' check (principal_kind = 'partner'),

  status text not null default 'pending_email'
    check (status in ('pending_email', 'active', 'suspended', 'withdrawn')),

  display_name text not null check (char_length(display_name) between 1 and 100),

  last_login_at timestamptz,
  withdrawn_at timestamptz,
  anonymized_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.partner_account is
  'Partner login account (privacy review §2.2). NOT the Capability entity — '
  'see public.partner (20260829140000) for that. No email column: auth.users '
  'is the SSOT, matching the admin_user precedent. display_name is a display '
  'label only, never a real person''s name (that is private.partner_contact).';

comment on column public.partner_account.display_name is
  'Display label the partner chooses for themselves (e.g. a nickname or the '
  'company short name), NOT the contact person''s real name — see PR-1 '
  '(privacy review §4): real names/titles/emails/phones live in '
  'private.partner_contact, never here.';

comment on column public.partner_account.status is
  'Note (qa-reviewer, 2026-08-30): finalize_partner_signup (20260829140000) '
  'inserts this as ''active'' immediately, never ''pending_email'' — email '
  'verification (SS-1) is enforced independently by '
  'private.is_active_partner() checking auth.users.email_confirmed_at, not '
  'by this column. ''pending_email'' is reserved for a future distinct '
  'pending-state flow if one becomes necessary; it is not currently reachable '
  'and ''partner.email_verified'' (the audit action for that transition) is '
  'correspondingly unused today. This is a deliberate simplification, not a '
  'bug — do not infer "email verified" from status=''active''.';

create index if not exists idx_partner_account_status on public.partner_account (status);

alter table public.partner_account enable row level security;
alter table public.partner_account force row level security;
revoke all on public.partner_account from anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_partner_account_auth_principal'
  ) then
    alter table public.partner_account
      add constraint fk_partner_account_auth_principal
      foreign key (auth_user_id, principal_kind)
      references public.auth_principal (auth_user_id, principal_kind)
      on delete restrict;
  end if;
end;
$$;

drop trigger if exists trg_partner_account_set_updated_at on public.partner_account;
create trigger trg_partner_account_set_updated_at
  before update on public.partner_account
  for each row execute function private.set_updated_at();

-- Self-service read/update. Kept intentionally narrow: only display_name is
-- writable directly; status/withdrawn_at/anonymized_at/auth_user_id are
-- RPC-only (finalize_partner_signup, a future partner_withdraw()), same
-- pattern as admin_user's own self-row policy (20260825120000 §13).
grant select on public.partner_account to authenticated;
grant update (display_name) on public.partner_account to authenticated;

create policy partner_account_self_select on public.partner_account
  for select to authenticated
  using (auth_user_id = auth.uid());

create policy partner_account_self_update on public.partner_account
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Admin read (separate policy from the self policy above, per privacy
-- review §2.5 rule 2 — never OR the two conditions into one policy).
create policy partner_account_admin_select on public.partner_account
  for select to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('partner_management', 'read'))
  );


-- =============================================================================
-- §4. audit_log extension — actor_kind / actor_partner_account_id / action
--     (privacy review §2.6 — verbatim SQL sketch, adapted to this codebase's
--     "introspect the actual constraint name" convention, same as every
--     prior CHECK-widening migration in this repo)
-- =============================================================================

-- 4a. actor_kind CHECK: add 'partner'.
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
  check (actor_kind in ('admin', 'partner', 'system', 'anon'));

-- 4b. Partner actor FK + mutual-exclusion with the existing admin actor FK.
alter table public.audit_log
  add column if not exists actor_partner_account_id uuid
    references public.partner_account (id) on delete restrict;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_audit_actor_exclusive'
  ) then
    alter table public.audit_log add constraint chk_audit_actor_exclusive check (
      not (actor_user_id is not null and actor_partner_account_id is not null)
    );
  end if;
end;
$$;

create index if not exists idx_audit_log_actor_partner_occurred_at
  on public.audit_log (actor_partner_account_id, occurred_at desc);

-- 4c. action CHECK: add the full partner.* / admin_partner.* set from
--     privacy review §2.6, on top of the full existing list (introspected by
--     definition text, same pattern as every prior widening of this
--     constraint in 20260825160000 / 20260827100000).
--     Also folds in 'lead.hide' (added by 20260829120000_admin_lead_hide.sql
--     but never added to this CHECK list — a pre-existing gap this migration
--     happens to touch anyway; see the note in the final report). Every
--     private.log_audit() call for that action has been silently failing
--     (caught by log_audit's own exception handler, which returns NULL and
--     only warns) — fixed here at zero extra cost since this CHECK is being
--     rewritten regardless.
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
  -- D. Audit log itself (§3.2-D)
  'audit.view', 'audit.export', 'audit.review'
));

-- 4d. export_reason >=10-char guard: extend to admin_partner.export too
--     (privacy review §2.6 note: "admin_partner.export도 export_reason 10자
--     이상을 CHECK로 강제"). Named constraint from the original CREATE TABLE,
--     so it can be dropped by name directly (not auto-generated).
alter table public.audit_log drop constraint if exists chk_audit_export_reason;

alter table public.audit_log add constraint chk_audit_export_reason check (
  action not in ('lead.export', 'audit.export', 'admin_partner.export')
  or (export_reason is not null and char_length(export_reason) >= 10)
);


-- =============================================================================
-- §5. private.log_audit() — teach it about partner actors (privacy review §2.6)
-- =============================================================================
-- Full CREATE OR REPLACE of the Phase 3 function body (20260825120000 §8),
-- with the admin-lookup branch kept byte-for-byte identical and a new
-- partner-lookup branch added as the fallback before defaulting to 'system'.

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

    if v_admin_id is not null then
      select coalesce(array_agg(r.code), '{}')
      into v_role_codes
      from public.admin_user_role aur
      join public.role r on r.id = aur.role_id
      where aur.admin_user_id = v_admin_id;
    else
      -- New (partner support): not an admin — check whether this auth user
      -- is a partner account before falling back to 'system'. Mirrors the
      -- admin branch exactly (id + display_name lookup, no role codes since
      -- partners have no role model).
      select pa.id, pa.display_name into v_partner_account_id, v_display_name
      from public.partner_account pa
      where pa.auth_user_id = v_auth_uid;
    end if;

    if v_admin_id is not null or v_partner_account_id is not null then
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
    else 'system'
  end;

  -- §3.3: cap subject_ids payload size, fall back to result_count/query_filter.
  if v_subject_ids is not null and array_length(v_subject_ids, 1) > 200 then
    v_subject_ids := null;
  end if;

  insert into public.audit_log (
    actor_user_id, actor_partner_account_id, actor_auth_uid, actor_email_snapshot,
    actor_name_snapshot, actor_role_codes, actor_kind, action, target_table, target_id,
    subject_ids, result_count, query_filter, before_summary, after_summary,
    result, error_code, ip, user_agent, request_id, session_id, export_reason
  ) values (
    v_admin_id, v_partner_account_id, v_auth_uid, v_email, v_display_name,
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

-- privacy review §2.4-(3): revoke authenticated's direct EXECUTE. This
-- function is only ever called from INSIDE another SECURITY DEFINER function
-- owned by the migration-running role (postgres) — those calls do not need
-- an EXECUTE grant to `authenticated`, because the privilege check for a
-- function-to-function call is against the CALLING function's owner, not the
-- original session role (see 20260825120000 §0's note on this exact point).
-- No RLS policy anywhere calls private.log_audit() directly either. Removing
-- this grant closes the "audit log write/oversupply from an arbitrary
-- authenticated session" vector entirely, at zero functional cost.
revoke execute on function private.log_audit(
  text, text, text, text, uuid[], integer, jsonb, jsonb, jsonb, text, text, inet, text, text, text
) from authenticated;


-- =============================================================================
-- §6. Partner judgment functions (privacy review §2.5 — design rules 1..4)
-- =============================================================================
-- Design rules being followed here, verbatim from the review:
--   1. Return boolean (or a uuid about the caller's own row) only — never
--      row data.
--   2. Partner-scoped RLS policies use these ANDed together in their OWN
--      policy, never OR'd with an admin condition in the same policy.
--   3. Never require is_aal2() on the partner path (MFA is admin-only).
--   4. Columns partners can write are GRANTed at column granularity; the
--      partner-owned-but-sensitive columns (verification_state,
--      intake_source, owner_account_id, public_listing_state) get NO grant
--      at all — RPC only (see 20260829140000).

create or replace function private.is_active_partner(p_auth_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.partner_account pa
    join auth.users u on u.id = pa.auth_user_id
    where pa.auth_user_id = p_auth_uid
      and pa.status = 'active'
      and u.email_confirmed_at is not null
  );
$$;

comment on function private.is_active_partner is
  'privacy review §2.5: true only when partner_account.status=''active'' AND '
  'the underlying auth.users row has completed email verification (SS-1). '
  'Deliberately does NOT check is_aal2() — MFA is an admin-only requirement '
  '(rule 3); requiring it here would be a regression, not a hardening.';

revoke all on function private.is_active_partner(uuid) from public;
grant execute on function private.is_active_partner(uuid) to authenticated;


create or replace function private.current_partner_id(p_auth_uid uuid default auth.uid())
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pa.id
  from public.partner_account pa
  where pa.auth_user_id = p_auth_uid;
$$;

comment on function private.current_partner_id is
  'privacy review §2.5 rule 1: returns only the CALLING user''s own '
  'partner_account.id (or null), never another partner''s. Safe to expose to '
  '`authenticated` unconditionally for the same reason get_my_admin_context() '
  'is safe (20260825120000 §9) — it describes only the caller.';

revoke all on function private.current_partner_id(uuid) from public;
grant execute on function private.current_partner_id(uuid) to authenticated;


create or replace function private.owns_partner(p_partner_id uuid, p_auth_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- NOTE: joins public.partner, created in 20260829140000. This function is
  -- LANGUAGE SQL (like is_active_admin/is_super_admin/has_pii_access), which
  -- means Postgres validates the referenced relation AT CREATE-FUNCTION TIME
  -- (unlike plpgsql, whose bodies are only checked at first call) — so this
  -- statement must run AFTER 20260829140000 has created public.partner, not
  -- as part of this file. See 20260829140000 §-final for the actual
  -- `create or replace function private.owns_partner` statement; this
  -- comment-only stub is left here intentionally so a reader scanning this
  -- file top-to-bottom is told where to look, instead of assuming the
  -- function was forgotten.
  select false;
$$;

comment on function private.owns_partner is
  'PLACEHOLDER — real definition lives in 20260829140000_partner_schema.sql '
  '(this function needs public.partner, which does not exist until that file '
  'runs; LANGUAGE SQL functions are validated against the catalog at CREATE '
  'time, so it cannot reference public.partner here). This stub always '
  'returns false and MUST be superseded by the real CREATE OR REPLACE in the '
  'next migration file before this feature set is usable.';

revoke all on function private.owns_partner(uuid, uuid) from public;
grant execute on function private.owns_partner(uuid, uuid) to authenticated;


-- =============================================================================
-- §7. Public-content policy widening (privacy review §2.4-(5) / item J)
-- =============================================================================
-- A logged-in partner session is `authenticated`, not `anon`. The existing
-- `for select to anon` policies on content_item / content_translation /
-- content_category_translation therefore return zero rows to a partner
-- session, making the blog/FAQ/category-name public content invisible to
-- them. Fix: widen the ROLE list to `anon, authenticated`, keep the exact
-- same predicate (do NOT touch the admin policies on these same tables —
-- those stay exactly as they are in 20260827100000).
--
-- content_category itself is unaffected: its public policy
-- (content_category_public_select) is already `to anon, authenticated`
-- (20260827100000 §1) — cited by the privacy review as the precedent this
-- section follows for the other three tables.

drop policy if exists content_category_translation_public_select on public.content_category_translation;
create policy content_category_translation_public_select on public.content_category_translation
  for select to anon, authenticated using (status = 'published');

drop policy if exists content_item_public_select on public.content_item;
create policy content_item_public_select on public.content_item
  for select to anon, authenticated using (is_active = true);

drop policy if exists content_translation_public_select on public.content_translation;
create policy content_translation_public_select on public.content_translation
  for select to anon, authenticated
  using (
    status = 'published'
    and exists (select 1 from public.content_item ci where ci.id = content_item_id and ci.is_active)
  );

-- content_category_translation / content_item / content_translation already
-- have `grant select ... to anon, authenticated` from 20260827100000 — only
-- the RLS policy's role list needed widening, no GRANT change required here.


-- =============================================================================
-- End of partner auth foundation migration.
-- =============================================================================
