-- =============================================================================
-- FKP v0.2 Phase 3 (slice 3-A + 3-B) — Admin auth foundation + RBAC model
-- =============================================================================
--
-- Design Ref:
--   - docs/01-plan/features/fkp-v0.2-privacy-review-phase3-rbac.md (THE spec for
--     this file — every section reference below, e.g. "§7.3", "§4.2-a", "A-10",
--     "P3-3", is a section of this document. Read it in full before touching
--     this migration.)
--   - docs/01-plan/features/fkp-v0.2-platform-foundation.prd.md §4.3 (Epic 3,
--     §4.3.1 concept model — superseded/refined by the privacy review above
--     wherever the two disagree; the privacy review wins)
--   - supabase/migrations/20260824120000_phase1_requests_pipeline.sql (Phase 1,
--     already applied and verified live — DO NOT EDIT that file. This
--     migration only ADDS to / ALTERs what it left in place.)
--
-- STATUS: NOT applied. Written by backend-developer, SQL-reviewed for syntax
-- only (see "How this was checked" below) — the representative must apply it
-- by hand, exactly like Phase 1 was applied.
--
--   Option A — Supabase Dashboard SQL Editor
--     1. Open https://supabase.com/dashboard/project/<project-ref>/sql/new
--     2. Paste the full contents of this file and click "Run".
--     3. Statements are written to be idempotent-ish (IF NOT EXISTS / CREATE OR
--        REPLACE / ON CONFLICT DO NOTHING) so a re-run after a partial failure
--        should not corrupt state, but this file has NOT been run against a
--        live database — read it fully before running, and run in a
--        transaction-capable session so you can roll back on error.
--
--   Option B — Supabase CLI
--     1. `supabase link --project-ref <project-ref>`
--     2. `supabase db push`
--
-- PREREQUISITE (must be done BEFORE running this file):
--   The representative must have already created the bootstrap super_admin
--   Auth user in Supabase Dashboard > Authentication > Users, with email
--   `jhc@ylia.io` (confirmed §2.6 / checklist "확정 완료" 2026-08-25). §11 of
--   the bootstrap admin_user + role linkage (near the end of this file) looks
--   this user up by email and will silently no-op with a NOTICE if the auth
--   user does not exist yet — safe to run this file first and create the
--   Auth user afterward, then re-run just that DO block (or the whole file).
--
-- AFTER applying this file, from the Supabase Dashboard (cannot be done via
-- SQL migration):
--   1. Authentication > Providers > Email > "Allow new users to sign up" ->
--      OFF. Re-confirm (P3-1 checklist item, regression risk called out
--      explicitly in the privacy review — dashboard settings are not covered
--      by code review).
--   2. Authentication > Multi-Factor > enable TOTP enforcement for all users
--      (§6.5 — MFA required for every admin account, no exceptions).
--   3. Authentication > Sessions: JWT expiry 30 min, inactivity timeout 30
--      min, time-box 8h, refresh token rotation ON (§6.2).
--   4. Authentication > Policies: password minimum length 12, leaked-password
--      protection ON if available on the current plan (§6.3).
--   5. Project Settings > API > Exposed schemas — re-confirm `private` is NOT
--      in the list (unchanged from Phase 1, second independent defense layer
--      for everything in the `private` schema below).
--   6. Database > Extensions — enable `pg_cron` if the `create extension`
--      statement in §10 below could not run automatically (this file
--      tolerates that and logs a NOTICE instead of failing; re-run just the
--      cron section afterward, see the NOTICE text for the exact command).
--
-- How this was checked (no live DB / no service_role key in this
-- environment, same constraint backend-developer had for Phase 1):
--   - Read start-to-finish for balanced begin/end, quoting, and dependency
--     order (tables before functions before triggers before policies before
--     seed data before ALTERs against Phase 1 tables).
--   - Cross-checked every SECURITY DEFINER function against
--     `set search_path = ''` + fully-schema-qualified references (no bare
--     table/function names anywhere in a definer body).
--   - Could NOT run this against a real or local Postgres instance in this
--     environment. qa-reviewer must run this (or an equivalent) against a
--     disposable Supabase project / local `supabase start` instance before
--     the representative applies it to production, per the Phase 3 DoD.
--
-- =============================================================================


-- =============================================================================
-- §0. Preconditions / conventions (mirrors Phase 1 §0)
-- =============================================================================
-- - Enum-like columns use `text` + `check` (not native Postgres ENUM types),
--   same reasoning as Phase 1: adding a new value later is a plain
--   `ALTER TABLE ... DROP/ADD CONSTRAINT`, not the awkward `ALTER TYPE ADD
--   VALUE` workflow. This applies to `audit_log.action` (privacy review §3.2:
--   "action 컬럼은 <domain>.<verb> 문자열 + CHECK 제약을 권고합니다... Phase 1과
--   동일 컨벤션").
-- - The `private` schema already exists (Phase 1 §1) with `usage` revoked
--   from anon/authenticated. This migration ADDS `grant usage on schema
--   private to authenticated` (only) further down — required so RLS policies
--   evaluated as `authenticated` can call `private.*` judgment functions
--   directly from a `using`/`with check` clause (function-to-function calls
--   from inside another SECURITY DEFINER function do NOT need this, because
--   the privilege check for those happens against the function owner, not
--   the original caller — see the review §1.2/§7.2 discussion; `anon` is
--   deliberately NOT granted schema usage, it only ever reaches `private.*`
--   indirectly through narrow `public.*` wrapper functions).
-- - Every GRANT in this file targets `authenticated` (or `anon` + `authenticated`
--   only for the handful of pre-login functions that must work without a
--   session) explicitly — never bare `to public` for anything that returns
--   data or allows a write (review doc A-10 / P3-1 checklist item). `to
--   public` is used ONLY for explicit `using (false)` deny policies, which is
--   safe (it denies everyone, including anon, which is the point).
-- =============================================================================


-- =============================================================================
-- §1. `role` — role catalog (INV-4, INV-6, §8.2 can_access_pii)
-- =============================================================================

create table if not exists public.role (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]{1,49}$'),
  display_name text not null check (char_length(display_name) between 1 and 100),
  description text check (description is null or char_length(description) <= 500),

  -- INV-6 §4.2-b: system roles cannot be deleted, and their code/is_system
  -- flag cannot be changed after creation (enforced by
  -- trg_role_protect_system below, not just documented here).
  is_system boolean not null default false,

  -- §8.2: role-level PII visibility flag. Deliberately NOT a menu-level flag
  -- (see the review's ①/②/③ comparison) — "can this role see personal data
  -- at all" is a property of the role/person, not of any one screen.
  -- INV-5 (§9): when a user holds multiple roles, can_access_pii is a union
  -- (true if ANY held role has it true) — see private.has_pii_access().
  can_access_pii boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.role is
  'Role catalog. code is immutable post-creation for system roles (see '
  'trg_role_protect_system); super_admin is the sole is_system=true row and '
  'bypasses role_menu_permission entirely (INV-4 exception, §4.2-c / §9).';

alter table public.role enable row level security;
alter table public.role force row level security;

revoke all on public.role from anon, authenticated;


-- =============================================================================
-- §2. `admin_user` — operator accounts, 1:1 with auth.users (§2.2)
-- =============================================================================

create table if not exists public.admin_user (
  id uuid primary key default gen_random_uuid(),

  -- Nullable (not "not null") specifically so §2.4 step 8 (anonymize after
  -- the retention window post-withdrawal) can NULL this out once the
  -- auth.users row itself is removed, without violating this FK. In normal
  -- operation this is always set at creation time.
  -- ON DELETE RESTRICT: an accidental Auth-user deletion in the Supabase
  -- console must not silently break audit trail linkage (§2.2).
  auth_user_id uuid unique references auth.users (id) on delete restrict,

  -- Deliberately NO email column here — auth.users is the SSOT (§2.2). The
  -- only intentional duplication of email in this whole schema is
  -- audit_log.actor_email_snapshot (§3.3), which exists for a different
  -- reason (preserving "who did it" after account anonymization).
  display_name text not null check (char_length(display_name) between 1 and 100),

  status text not null default 'invited' check (status in ('invited', 'active', 'suspended', 'withdrawn')),

  invited_by uuid references public.admin_user (id) on delete restrict,
  invited_at timestamptz,
  activated_at timestamptz,
  suspended_at timestamptz,
  suspended_by uuid references public.admin_user (id) on delete restrict,
  withdrawn_at timestamptz,
  status_reason text check (status_reason is null or char_length(status_reason) <= 500),

  last_login_at timestamptz,

  -- §2.4 step 7: set when display_name is replaced with a fixed placeholder
  -- at the end of the audit-log retention window post-withdrawal.
  anonymized_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.admin_user is
  'Operator accounts. Never hard-deleted (§2.4) — status transitions to '
  '''withdrawn'' instead, to preserve the access-record retention obligation '
  '(안전성 확보조치 기준 제8조①). Rows referencing auth.users are only invalidated '
  '(auth_user_id set NULL) once the audit-log retention window has also '
  'elapsed for that person. No self-service withdrawal (§2.4): status writes '
  'are not exposed as a direct GRANT to authenticated at all in this '
  'migration — the operator-management round (next slice) adds dedicated '
  'SECURITY DEFINER functions (admin_suspend_user etc.) that combine the '
  'INV-6 checks, audit logging, and session invalidation atomically.';

create index if not exists idx_admin_user_status on public.admin_user (status);

alter table public.admin_user enable row level security;
alter table public.admin_user force row level security;

revoke all on public.admin_user from anon, authenticated;


-- =============================================================================
-- §3. `admin_user_role` — N:M account <-> role mapping (INV-5 union)
-- =============================================================================

create table if not exists public.admin_user_role (
  admin_user_id uuid not null references public.admin_user (id) on delete restrict,
  role_id uuid not null references public.role (id) on delete restrict,
  granted_by uuid references public.admin_user (id) on delete restrict,
  granted_at timestamptz not null default now(),
  primary key (admin_user_id, role_id)
);

comment on table public.admin_user_role is
  'INV-5: multiple roles per account are allowed; effective permission is the '
  'UNION across held roles (see private.has_menu_permission / '
  'private.has_pii_access). ON DELETE RESTRICT everywhere on purpose — this '
  'table is never touched by cascading deletes; every write is protected by '
  'the INV-6 triggers below regardless of which role/tool performs it.';

create index if not exists idx_admin_user_role_role_id on public.admin_user_role (role_id);

alter table public.admin_user_role enable row level security;
alter table public.admin_user_role force row level security;

revoke all on public.admin_user_role from anon, authenticated;


-- =============================================================================
-- §4. `menu` — menu tree, DB is SSOT (INV-1, INV-2)
-- =============================================================================

create table if not exists public.menu (
  id uuid primary key default gen_random_uuid(),

  -- INV-1: code is immutable post-creation (trg_menu_protect_code below).
  -- All permission checks in code use `code`, never `path` or `id`.
  code text not null unique check (code ~ '^[a-z][a-z0-9_]{1,49}$'),

  parent_id uuid references public.menu (id) on delete restrict,
  display_name text not null check (char_length(display_name) between 1 and 100),
  path text check (path is null or char_length(path) <= 200),
  icon text check (icon is null or char_length(icon) <= 100),
  menu_type text not null default 'page' check (menu_type in ('group', 'page')),
  sort_order integer not null default 0,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.menu is
  'Menu tree. Single source of truth for admin navigation (INV-2) — the CRUD '
  'screen for this table (권한관리 > 메뉴관리, E3-R5) ships in a later round; '
  'this migration only creates the table, its guardrails, and the initial '
  'seed rows the Admin login shell needs to exist. code is immutable '
  '(trg_menu_protect_code) so a later reorg/rename of display_name/path never '
  'breaks a role_menu_permission mapping or a hard-coded permission check.';

create index if not exists idx_menu_parent_id on public.menu (parent_id);

alter table public.menu enable row level security;
alter table public.menu force row level security;

revoke all on public.menu from anon, authenticated;


-- =============================================================================
-- §5. `role_menu_permission` — role x menu permission matrix (INV-4 allow-list)
-- =============================================================================

create table if not exists public.role_menu_permission (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.role (id) on delete cascade,
  menu_id uuid not null references public.menu (id) on delete cascade,
  can_read boolean not null default false,
  can_create boolean not null default false,
  can_update boolean not null default false,
  can_delete boolean not null default false,
  -- "export" means "PII-inclusive export" specifically (privacy review §5.1),
  -- not just "any download" — the read-only aggregate/statistics export
  -- variant only needs can_read (§5.1 export scope table).
  can_export boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role_id, menu_id)
);

comment on table public.role_menu_permission is
  'Explicit allow-list (INV-4): no row = no access, for every role EXCEPT '
  'super_admin, which bypasses this table entirely (see '
  'private.has_menu_permission — this is the INV-6-enabling exception '
  'required by §4.2-c / §9 INV-4 amendment). §8.3: a `scope` column (all/own) '
  'is intentionally NOT added yet (E3-R14 Won''t) — private.has_menu_permission '
  'is the single choke point future rounds would extend, so no caller needs '
  'to change when that lands.';

create index if not exists idx_role_menu_permission_menu_id on public.role_menu_permission (menu_id);

alter table public.role_menu_permission enable row level security;
alter table public.role_menu_permission force row level security;

revoke all on public.role_menu_permission from anon, authenticated;


-- =============================================================================
-- §6. `audit_log` — append-only access log (E3-R8, §3)
-- =============================================================================

create table if not exists public.audit_log (
  -- bigint identity, NOT uuid: monotonic increase makes gaps from deletion
  -- attempts detectable (§3.3). There is no legitimate way to create a gap
  -- (see §8 below), but the column type itself documents the intent.
  id bigint generated always as identity primary key,

  occurred_at timestamptz not null default now(),

  actor_user_id uuid references public.admin_user (id) on delete restrict,
  actor_auth_uid uuid,
  -- Intentional, documented duplication (§2.2 exception, §3.3): audit
  -- records must remain attributable even after the account is anonymized.
  actor_email_snapshot text,
  actor_name_snapshot text,
  -- Role codes AT THE TIME of the action, not a live join — a later role
  -- change must not rewrite history (§3.3).
  actor_role_codes text[] not null default '{}',
  actor_kind text not null default 'system' check (actor_kind in ('admin', 'system', 'anon')),

  action text not null check (action in (
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
    'role.create', 'role.update', 'role.delete',
    'menu.create', 'menu.update', 'menu.delete',
    'role_menu_permission.change',
    -- D. Audit log itself (§3.2-D)
    'audit.view', 'audit.export', 'audit.review'
  )),

  target_table text check (target_table is null or char_length(target_table) <= 100),
  target_id text check (target_id is null or char_length(target_id) <= 100),

  -- Capped at 200 ids by convention (enforced in private.log_audit, not by a
  -- CHECK here, since the cap is about payload size discipline rather than a
  -- hard data-integrity rule) — beyond that, rely on result_count/query_filter.
  subject_ids uuid[],
  result_count integer,
  -- Search terms MUST be hashed/length-only before reaching this column —
  -- never store the raw query string (§3.4: emails/company names can appear
  -- in search boxes). Enforced by convention at the call site, not by the DB
  -- (jsonb shape varies), documented here as the load-bearing rule.
  query_filter jsonb,
  before_summary jsonb,
  after_summary jsonb,

  result text not null default 'success' check (result in ('success', 'denied', 'error')),
  error_code text check (error_code is null or char_length(error_code) <= 100),

  ip inet,
  user_agent text check (user_agent is null or char_length(user_agent) <= 500),
  request_id text check (request_id is null or char_length(request_id) <= 100),
  session_id text check (session_id is null or char_length(session_id) <= 100),

  export_reason text check (export_reason is null or char_length(export_reason) <= 1000),

  -- §5.2 item 1: sanctioned dump actions require a >=10 char reason. This is
  -- the DB-level backstop for "사유 입력 필수" — server code must still collect
  -- it via a form field, this CHECK just makes it impossible to route around.
  constraint chk_audit_export_reason check (
    action not in ('lead.export', 'audit.export')
    or (export_reason is not null and char_length(export_reason) >= 10)
  )

  -- Deliberately NO `updated_at` column (§3.5): its mere existence would
  -- imply this table is mutable.
);

comment on table public.audit_log is
  'Append-only access log (안전성 확보조치 기준 제2조/제8조, E3-R8). Three independent '
  'layers make UPDATE/DELETE impossible even for a leaked service_role key or '
  'the table owner (§3.5): (1) GRANT revocation below — no UPDATE/DELETE '
  'privilege exists for ANY role including service_role; (2) RLS — only a '
  '`for select` policy is defined, no update/delete policy exists at all, '
  'and policy absence is a hard deny; (3) trg_audit_log_append_only, a '
  'BEFORE UPDATE OR DELETE trigger that raises unless the '
  '`fkp.audit_purge` GUC is set (only true inside '
  'private.purge_expired_audit_log, via `set local`, §3.6). Triggers are not '
  'bypassed by BYPASSRLS, so layer 3 holds even against `postgres`/table '
  'owner access from the SQL Editor.';

create index if not exists idx_audit_log_occurred_at on public.audit_log (occurred_at desc);
create index if not exists idx_audit_log_actor_occurred_at on public.audit_log (actor_user_id, occurred_at desc);
create index if not exists idx_audit_log_action_occurred_at on public.audit_log (action, occurred_at desc);
create index if not exists idx_audit_log_subject_ids on public.audit_log using gin (subject_ids);

alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;

-- Layer 1 (§3.5): revoke EVERYTHING from every role, including service_role.
-- BYPASSRLS (which service_role and postgres both have) bypasses layers 2
-- and would bypass layer 3 too if it were GRANT-based, but GRANT itself is
-- never bypassed by BYPASSRLS (privacy review §1.2 / §3.5's core citation).
-- A leaked service_role key still cannot UPDATE or DELETE a single row here.
revoke all on public.audit_log from anon, authenticated, service_role;


-- =============================================================================
-- §7. `private.login_lockout` — best-effort brute-force lockout (§6.3)
-- =============================================================================
-- Supabase Auth has rate limits but no account-lockout primitive of its own
-- (§6.3: "Supabase는 rate limit은 있으나 계정 잠금은 제공하지 않음 -> 앱/DB 레벨
-- 구현 필요"). Deliberately a separate lightweight table, not a column on
-- admin_user, per the review's explicit "계정 상태와 혼동 방지" note. Lives in
-- `private` (never exposed via PostgREST) and is written only through the
-- two narrow `public.*` wrapper functions in §9 below — never queried or
-- written directly by anon/authenticated.

create table if not exists private.login_lockout (
  email_lower text primary key,
  failed_count integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

comment on table private.login_lockout is
  'Best-effort, DB-level login lockout keyed on lower(email) (not on '
  'admin_user, so it also covers login attempts against emails that are not '
  'yet — or no longer — a valid admin account, which is itself useful signal '
  'for §3.7 monthly review). 5 consecutive failures locks the identifier for '
  '15 minutes. Known limitation, accepted at this scale (documented in the '
  'implementation report): since this keys on the *submitted* email with no '
  'proof of ownership, an attacker can lock out a real admin''s email by '
  'submitting failed attempts against it. Mitigated by IP-based rate '
  'limiting on the /api/admin/auth/login route (app layer) and by the small, '
  'known set of admin accounts (3) making this easy to notice via §3.7 '
  'monthly review of auth.login_failed volume.';

alter table private.login_lockout enable row level security;
alter table private.login_lockout force row level security;

revoke all on private.login_lockout from anon, authenticated;


-- =============================================================================
-- §8. Permission *judgment* functions — `private` schema, SECURITY DEFINER
-- =============================================================================
-- Privacy review §1.2 (the single most important design rule in this whole
-- file): these functions NEVER return row data from admin_user/requests/etc.
-- — they return a boolean (or, for get_my_admin_context in §9, a small
-- self-describing jsonb blob about the CALLING user only). Because they
-- return no arbitrary row data, using SECURITY DEFINER here does not create
-- the "RLS bypass returns everything" failure mode the review warns about —
-- that failure mode is specifically about definer functions that `select *`
-- and return it. Lead/admin_user LIST and DETAIL data is never returned by a
-- definer function in this migration; that access goes through RLS-checked
-- `authenticated` queries (§12) except for the two single-column, single-row
-- exceptions in §11 (contact, internal_note) which are audit-bound by design.

grant usage on schema private to authenticated;


create or replace function private.is_active_admin(p_auth_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_user au
    where au.auth_user_id = p_auth_uid
      and au.status = 'active'
  );
$$;

comment on function private.is_active_admin is
  'INV-7: reads admin_user.status directly on every call (never cached in a '
  'JWT claim), so a suspend takes effect on the very next request regardless '
  'of how much of the access-token TTL remains (§6.1). SECURITY DEFINER here '
  'is safe (§1.2) because this returns only a boolean.';

revoke all on function private.is_active_admin(uuid) from public;
grant execute on function private.is_active_admin(uuid) to authenticated;


create or replace function private.is_aal2()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

comment on function private.is_aal2 is
  '§6.5 / §7.1-A-3: reads the aal claim straight off the current request''s '
  'JWT (no table access, so no SECURITY DEFINER needed). true only once the '
  'session has completed an MFA (TOTP) challenge this session — a valid '
  'password-only (aal1) session is not enough for ANY admin/lead data path '
  'in this migration.';

revoke all on function private.is_aal2() from public;
grant execute on function private.is_aal2() to authenticated;


create or replace function private.is_super_admin(p_auth_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_user au
    join public.admin_user_role aur on aur.admin_user_id = au.id
    join public.role r on r.id = aur.role_id
    where au.auth_user_id = p_auth_uid
      and au.status = 'active'
      and r.code = 'super_admin'
  );
$$;

revoke all on function private.is_super_admin(uuid) from public;
-- Intentionally NOT granted to authenticated directly: only used inside
-- other SECURITY DEFINER functions in this file (private.has_menu_permission,
-- the INV-6 triggers, public.get_my_admin_context). Not referenced by any
-- RLS policy, so no direct grant is required (see §0 note on function-call
-- privilege boundaries).


create or replace function private.has_pii_access(p_auth_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- INV-5: union across all held roles' can_access_pii, with the INV-4
  -- super_admin exception spelled out explicitly rather than relied upon
  -- implicitly (super_admin's can_access_pii seed value is also true, but
  -- this must not depend on that seed row never being edited by mistake).
  select private.is_super_admin(p_auth_uid) or exists (
    select 1
    from public.admin_user au
    join public.admin_user_role aur on aur.admin_user_id = au.id
    join public.role r on r.id = aur.role_id
    where au.auth_user_id = p_auth_uid
      and au.status = 'active'
      and r.can_access_pii = true
  );
$$;

revoke all on function private.has_pii_access(uuid) from public;
-- Not granted directly to authenticated: only called from
-- public.get_request_contact / public.get_my_admin_context (§9/§11).


create or replace function private.has_menu_permission(p_menu_code text, p_action text, p_auth_uid uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid;
begin
  if p_auth_uid is null then
    return false;
  end if;

  select au.id into v_admin_id
  from public.admin_user au
  where au.auth_user_id = p_auth_uid
    and au.status = 'active';

  if v_admin_id is null then
    return false;
  end if;

  -- INV-4 exception (§4.2-c / §9): super_admin does not consult
  -- role_menu_permission at all. This is what makes the "権限관리 매트릭스에서
  -- super_admin 체크를 실수로/악의로 해제해도 락아웃이 물리적으로 불가능" property
  -- true — there is nothing in the matrix for super_admin to lose.
  if exists (
    select 1
    from public.admin_user_role aur
    join public.role r on r.id = aur.role_id
    where aur.admin_user_id = v_admin_id
      and r.code = 'super_admin'
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.admin_user_role aur
    join public.role_menu_permission rmp on rmp.role_id = aur.role_id
    join public.menu m on m.id = rmp.menu_id
    where aur.admin_user_id = v_admin_id
      and m.code = p_menu_code
      and m.is_active = true
      and case p_action
            when 'read' then rmp.can_read
            when 'create' then rmp.can_create
            when 'update' then rmp.can_update
            when 'delete' then rmp.can_delete
            when 'export' then rmp.can_export
            else false
          end
  );
end;
$$;

comment on function private.has_menu_permission is
  'The single choke point for menu-scoped authorization (§8.3: "권한 판정을 '
  'private.has_menu_permission() 단일 함수로 캡슐화"). INV-4: no matching row = '
  'deny. Called directly from RLS policies (requests, admin_user, role, '
  'menu, role_menu_permission, audit_log) AND from every SECURITY DEFINER '
  'data function in this file (§11) — both layers of INV-8''s "double '
  'defense" go through the exact same rule set, so they cannot silently '
  'diverge.';

revoke all on function private.has_menu_permission(text, text, uuid) from public;
grant execute on function private.has_menu_permission(text, text, uuid) to authenticated;


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
    else 'system'
  end;

  -- §3.3: cap subject_ids payload size, fall back to result_count/query_filter.
  if v_subject_ids is not null and array_length(v_subject_ids, 1) > 200 then
    v_subject_ids := null;
  end if;

  insert into public.audit_log (
    actor_user_id, actor_auth_uid, actor_email_snapshot, actor_name_snapshot,
    actor_role_codes, actor_kind, action, target_table, target_id,
    subject_ids, result_count, query_filter, before_summary, after_summary,
    result, error_code, ip, user_agent, request_id, session_id, export_reason
  ) values (
    v_admin_id, v_auth_uid, v_email, v_display_name,
    coalesce(v_role_codes, '{}'), v_actor_kind, p_action, p_target_table, p_target_id,
    v_subject_ids, p_result_count, p_query_filter, p_before_summary, p_after_summary,
    coalesce(p_result, 'success'), p_error_code, p_ip, left(p_user_agent, 500), p_request_id, p_session_id,
    p_export_reason
  )
  returning id into v_id;

  return v_id;
exception when others then
  -- §3.5: log_audit must never break the calling feature by raising — EXCEPT
  -- that callers for lead.contact_reveal / lead.export / audit.export MUST
  -- check for a NULL return and raise themselves (see public.get_request_contact
  -- in §11), because for those specific actions "no audit record" must mean
  -- "the underlying action also failed".
  raise warning 'private.log_audit failed for action=%: %', p_action, sqlerrm;
  return null;
end;
$$;

revoke all on function private.log_audit(
  text, text, text, text, uuid[], integer, jsonb, jsonb, jsonb, text, text, inet, text, text, text
) from public;
grant execute on function private.log_audit(
  text, text, text, text, uuid[], integer, jsonb, jsonb, jsonb, text, text, inet, text, text, text
) to authenticated;


-- =============================================================================
-- §9. Auth-event / login-lockout wrapper functions — `public` schema
-- =============================================================================
-- These MUST live in `public` (private.log_audit itself is unreachable via
-- PostgREST RPC, since `private` is not an Exposed Schema — see §0). Kept
-- deliberately narrow (only a fixed set of auth.* actions is accepted) so
-- granting EXECUTE to `anon` here does not become a general-purpose "write
-- anything to audit_log" hole for pre-login callers.

create or replace function public.log_auth_event(
  p_action text,
  p_result text default 'success',
  p_error_code text default null,
  p_ip inet default null,
  p_user_agent text default null,
  p_session_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_action not in (
    'auth.login_success', 'auth.login_failed', 'auth.logout', 'auth.session_expired',
    'auth.mfa_enrolled', 'auth.mfa_reset',
    'auth.password_reset_requested', 'auth.password_changed'
  ) then
    raise exception 'invalid_auth_action: %', p_action;
  end if;

  perform private.log_audit(
    p_action := p_action,
    p_result := coalesce(p_result, 'success'),
    p_error_code := p_error_code,
    p_ip := p_ip,
    p_user_agent := p_user_agent,
    p_session_id := p_session_id
  );
end;
$$;

revoke all on function public.log_auth_event(text, text, text, inet, text, text) from public;
grant execute on function public.log_auth_event(text, text, text, inet, text, text) to anon, authenticated;


create or replace function public.check_login_lockout(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.login_lockout%rowtype;
begin
  select * into v_row from private.login_lockout where email_lower = lower(p_email);

  if v_row.locked_until is not null and v_row.locked_until > now() then
    return jsonb_build_object('locked', true, 'locked_until', v_row.locked_until);
  end if;

  return jsonb_build_object('locked', false);
end;
$$;

revoke all on function public.check_login_lockout(text) from public;
grant execute on function public.check_login_lockout(text) to anon, authenticated;


create or replace function public.record_login_result(p_email text, p_success boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(p_email);
  v_count integer;
  v_locked_until timestamptz;
begin
  if p_success then
    delete from private.login_lockout where email_lower = v_email;
    return jsonb_build_object('locked', false);
  end if;

  insert into private.login_lockout (email_lower, failed_count, updated_at)
  values (v_email, 1, now())
  on conflict (email_lower) do update
    set failed_count = private.login_lockout.failed_count + 1,
        updated_at = now()
  returning failed_count into v_count;

  if v_count >= 5 then
    update private.login_lockout
    set locked_until = now() + interval '15 minutes'
    where email_lower = v_email
    returning locked_until into v_locked_until;
  end if;

  return jsonb_build_object('locked', v_locked_until is not null, 'locked_until', v_locked_until, 'failed_count', v_count);
end;
$$;

revoke all on function public.record_login_result(text, boolean) from public;
grant execute on function public.record_login_result(text, boolean) to anon, authenticated;


create or replace function public.get_my_admin_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_admin record;
  v_role_codes text[];
  v_is_super boolean;
  v_can_access_pii boolean;
  v_aal2 boolean := private.is_aal2();
begin
  if v_auth_uid is null then
    return jsonb_build_object('authenticated', false, 'is_active_admin', false, 'aal2', v_aal2);
  end if;

  select au.id, au.display_name, au.status
  into v_admin
  from public.admin_user au
  where au.auth_user_id = v_auth_uid;

  if v_admin.id is null then
    return jsonb_build_object('authenticated', true, 'is_active_admin', false, 'aal2', v_aal2);
  end if;

  select coalesce(array_agg(r.code), '{}'), coalesce(bool_or(r.code = 'super_admin'), false), coalesce(bool_or(r.can_access_pii), false)
  into v_role_codes, v_is_super, v_can_access_pii
  from public.admin_user_role aur
  join public.role r on r.id = aur.role_id
  where aur.admin_user_id = v_admin.id;

  return jsonb_build_object(
    'authenticated', true,
    'is_active_admin', (v_admin.status = 'active') and v_aal2,
    'admin_user_id', v_admin.id,
    'display_name', v_admin.display_name,
    'status', v_admin.status,
    'aal2', v_aal2,
    'role_codes', v_role_codes,
    'is_super_admin', v_is_super,
    'can_access_pii', v_can_access_pii
  );
end;
$$;

comment on function public.get_my_admin_context is
  'The permission helper backend-developer item 4 ("현재 로그인한 운영자가 특정 '
  '메뉴 코드에 대해 어떤 권한을 갖는지") builds on: returns only facts about the '
  'CALLING user (never another admin''s row), so it is safe to expose to '
  '`authenticated` unconditionally. is_active_admin here folds in aal2 '
  '(§6.1/§6.5) so a single boolean tells the app whether to redirect to '
  '/admin/login, /admin/mfa/enroll, /admin/mfa/verify, or let the request '
  'through — the DB-level RLS/definer-function checks are the real '
  'enforcement (INV-3); this is UX routing only.';

revoke all on function public.get_my_admin_context() from public;
grant execute on function public.get_my_admin_context() to authenticated;


create or replace function public.has_menu_permission_check(p_menu_code text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_admin() and private.is_aal2() and private.has_menu_permission(p_menu_code, p_action);
$$;

comment on function public.has_menu_permission_check is
  'RPC-reachable wrapper around private.has_menu_permission for future '
  'screens (INV-3: server/RSC re-checks permission independently of menu '
  'visibility). Applies the same 3-factor AND (§7.1-A-3) as every RLS policy '
  'in this file so a screen-level check and a row-level check can never '
  'disagree.';

revoke all on function public.has_menu_permission_check(text, text) from public;
grant execute on function public.has_menu_permission_check(text, text) to authenticated;


create or replace function public.my_menu_tree()
returns table (
  id uuid,
  code text,
  parent_id uuid,
  display_name text,
  path text,
  icon text,
  menu_type text,
  sort_order integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.code, m.parent_id, m.display_name, m.path, m.icon, m.menu_type, m.sort_order
  from public.menu m
  where m.is_active = true
    and private.is_active_admin()
    and private.is_aal2()
    and private.has_menu_permission(m.code, 'read')
  order by m.sort_order;
$$;

comment on function public.my_menu_tree is
  'INV-2: "내 권한으로 접근 가능한 메뉴 트리" in a single API call, menus without '
  'read access silently absent from the result (INV-3: absence is a UX '
  'convenience, not the security boundary). Not wired to any UI yet in this '
  'round (sidebar ships with the next round''s screens) — included now '
  'because it is part of the permission MODEL, not the admin UI.';

revoke all on function public.my_menu_tree() from public;
grant execute on function public.my_menu_tree() to authenticated;


-- =============================================================================
-- §10. INV-6 self-lockout protection — triggers (§4.2)
-- =============================================================================

-- (a) At least one active super_admin at all times, enforced at COMMIT time
--     (deferred), serialized against concurrent transactions with an
--     advisory lock (§4.2-a). This is the ONLY layer that survives even a
--     `service_role` key or the `postgres` role itself, because triggers are
--     never bypassed by BYPASSRLS (§4.1 table).

create or replace function private.check_active_super_admin_exists()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  -- Fixed, arbitrary advisory-lock key dedicated to this single invariant.
  -- Concurrency note (§4.2-a point 1, qa-reviewer test #3): without this
  -- lock, two transactions that each demote a different super_admin can
  -- both observe "still >=1 active super_admin" and both commit, leaving 0.
  perform pg_advisory_xact_lock(872314001);

  select count(*) into v_count
  from public.admin_user au
  join public.admin_user_role aur on aur.admin_user_id = au.id
  join public.role r on r.id = aur.role_id
  where au.status = 'active'
    and r.code = 'super_admin';

  if v_count = 0 then
    raise exception 'last_super_admin_protected: at least one active super_admin account is required'
      using errcode = 'P0001';
  end if;

  return null; -- return value of a constraint trigger is ignored by Postgres
end;
$$;

comment on function private.check_active_super_admin_exists is
  'INV-6(a). Attached as a DEFERRABLE INITIALLY DEFERRED constraint trigger '
  '(fires once at COMMIT, not per-statement) so a transaction may pass '
  'through a transient state of 0 active super_admins (e.g. re-granting the '
  'role to a different account within one transaction) as long as the FINAL '
  'state has >=1. An immediate (non-deferred) trigger would block that '
  'entirely legitimate operation.';

drop trigger if exists trg_admin_user_role_super_admin_guard on public.admin_user_role;
create constraint trigger trg_admin_user_role_super_admin_guard
  after insert or update or delete on public.admin_user_role
  deferrable initially deferred
  for each row execute function private.check_active_super_admin_exists();

drop trigger if exists trg_admin_user_super_admin_guard on public.admin_user;
create constraint trigger trg_admin_user_super_admin_guard
  after update of status on public.admin_user
  deferrable initially deferred
  for each row execute function private.check_active_super_admin_exists();

drop trigger if exists trg_role_super_admin_guard on public.role;
create constraint trigger trg_role_super_admin_guard
  after update or delete on public.role
  deferrable initially deferred
  for each row execute function private.check_active_super_admin_exists();


-- (b) System roles cannot be deleted; code/is_system are immutable for them
--     (§4.2-b).

create or replace function private.protect_system_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system then
      raise exception 'system_role_protected: system roles cannot be deleted' using errcode = 'P0001';
    end if;
    return old;
  end if;

  if old.is_system then
    if new.code is distinct from old.code then
      raise exception 'system_role_protected: system role code is immutable' using errcode = 'P0001';
    end if;
    if new.is_system is distinct from old.is_system then
      raise exception 'system_role_protected: the is_system flag cannot be changed' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_role_protect_system on public.role;
create trigger trg_role_protect_system
  before update or delete on public.role
  for each row execute function private.protect_system_role();


-- (c) Nobody can remove their OWN super_admin role, or suspend/withdraw
--     their OWN account (§4.2-c second half). Combined with (INV-4 exception
--     in private.has_menu_permission) super_admin never loses access to the
--     permission screen even via matrix edits, which is the structural half
--     of this same guarantee.

create or replace function private.protect_self_admin_actions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_role_code text;
begin
  if v_auth_uid is null then
    -- No session (service_role script / pg_cron / SQL Editor as postgres):
    -- self-protection cannot apply (there is no "self"). The count-based
    -- guard (a) above still fully applies regardless.
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_table_name = 'admin_user_role' then
    if tg_op in ('DELETE', 'UPDATE') then
      select r.code into v_role_code from public.role r where r.id = old.role_id;

      if v_role_code = 'super_admin' and exists (
        select 1 from public.admin_user au
        where au.id = old.admin_user_id and au.auth_user_id = v_auth_uid
      ) then
        raise exception 'self_lockout_protected: cannot remove your own super_admin role' using errcode = 'P0001';
      end if;
    end if;
  elsif tg_table_name = 'admin_user' then
    if tg_op = 'UPDATE' and new.status in ('suspended', 'withdrawn') and old.status is distinct from new.status then
      if new.auth_user_id = v_auth_uid then
        raise exception 'self_lockout_protected: cannot suspend or withdraw your own account' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists trg_admin_user_role_protect_self on public.admin_user_role;
create trigger trg_admin_user_role_protect_self
  before update or delete on public.admin_user_role
  for each row execute function private.protect_self_admin_actions();

drop trigger if exists trg_admin_user_protect_self on public.admin_user;
create trigger trg_admin_user_protect_self
  before update on public.admin_user
  for each row execute function private.protect_self_admin_actions();


-- INV-1: menu.code is immutable post-creation.

create or replace function private.protect_menu_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.code is distinct from old.code then
    raise exception 'menu_code_immutable: menu.code cannot be changed after creation' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_menu_protect_code on public.menu;
create trigger trg_menu_protect_code
  before update on public.menu
  for each row execute function private.protect_menu_code();


-- Append-only enforcement for audit_log (§3.5 layer 3 — see the table
-- comment in §6 for the full 3-layer explanation).

create or replace function private.protect_audit_log_append_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('fkp.audit_purge', true), 'off') = 'on' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  raise exception 'audit_log_append_only: audit_log rows cannot be updated or deleted (attempted %)', tg_op
    using errcode = 'P0001';
end;
$$;

drop trigger if exists trg_audit_log_append_only on public.audit_log;
create trigger trg_audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function private.protect_audit_log_append_only();


-- shared `updated_at` maintenance, reused by a few tables below.

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_role_set_updated_at on public.role;
create trigger trg_role_set_updated_at before update on public.role for each row execute function private.set_updated_at();

drop trigger if exists trg_admin_user_set_updated_at on public.admin_user;
create trigger trg_admin_user_set_updated_at before update on public.admin_user for each row execute function private.set_updated_at();

drop trigger if exists trg_menu_set_updated_at on public.menu;
create trigger trg_menu_set_updated_at before update on public.menu for each row execute function private.set_updated_at();

drop trigger if exists trg_role_menu_permission_set_updated_at on public.role_menu_permission;
create trigger trg_role_menu_permission_set_updated_at before update on public.role_menu_permission for each row execute function private.set_updated_at();


-- =============================================================================
-- §11. `requests` — column-scoped GRANT, contact_masked, RLS (§7.2, §8.4)
-- =============================================================================

-- §7.2 decision 2: masked column for list/detail display. Built only from
-- IMMUTABLE string functions (required for a `generated always as` column).
alter table public.requests add column if not exists contact_masked text
  generated always as (
    case
      when position('@' in contact) > 1 then
        left(contact, 1) || repeat('*', greatest(position('@' in contact) - 2, 1)) || substr(contact, position('@' in contact))
      else '***'
    end
  ) stored;

comment on column public.requests.contact_masked is
  'DB-enforced masking (§7.2 decision 2, §8.4 OQ-16): the ONLY contact '
  'representation ever granted to authenticated via plain SELECT. viewer '
  'never sees anything else (no reveal function access, §8.4). operator / '
  'super_admin can additionally call public.get_request_contact() for the '
  'raw value, which is audit-bound (§7.3, §11 below).';

-- §7.2 decision 1 / §7.1-A-1: explicit column list, `contact` excluded.
-- Also excludes nothing else — every other column is safe for any
-- lead_management-read role to see (per §8.4, only `contact` needs masking;
-- purpose/description/company_name_website stay in the clear even for
-- viewer, per the OQ-16 decision and its stated rationale).
grant select (
  id, what_looking_for, category, partner_type, purpose, description,
  budget, timeline, english_speaking, company_name_website,
  status, assignee_id, source, locale,
  privacy_consent, consent_version, consented_at, consent_locale,
  terms_consent, terms_version, marketing_consent, marketing_consented_at,
  third_party_consent, third_party_consented_at, third_party_recipient,
  retention_expires_at, anonymized_at, created_at, updated_at, contact_masked
) on public.requests to authenticated;

-- §7.2 decision 3: only status/assignee are writable; the PII/free-text
-- columns have zero UPDATE grant for any role including super_admin.
grant update (status, assignee_id) on public.requests to authenticated;

-- Replace the Phase 1 deny-all placeholders (migration §9) with real,
-- role-scoped policies. INSERT/DELETE stay explicitly denied to everyone —
-- INSERT remains submit_request()-only (unchanged from Phase 1, still
-- bypasses RLS as a SECURITY DEFINER function owned by postgres); DELETE has
-- no GRANT and no policy anywhere (A-6 — deletion only ever happens through
-- the retention batch in §14, itself SECURITY DEFINER).

drop policy if exists requests_deny_select on public.requests;
drop policy if exists requests_deny_insert on public.requests;
drop policy if exists requests_deny_update on public.requests;
drop policy if exists requests_deny_delete on public.requests;

create policy requests_deny_insert on public.requests for insert to public with check (false);
create policy requests_deny_delete on public.requests for delete to public using (false);

-- A-8: each condition wrapped in `(select ...)` so the planner can cache it
-- as an initplan instead of re-evaluating per row.
create policy requests_admin_select on public.requests
  for select to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('lead_management', 'read'))
  );

create policy requests_admin_update on public.requests
  for update to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('lead_management', 'update'))
  )
  with check (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('lead_management', 'update'))
  );


-- §7.3: contact reveal, audit-bound in a single atomic function.

create or replace function public.get_request_contact(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_contact text;
  v_audit_id bigint;
begin
  if not (private.is_active_admin(v_auth_uid) and private.is_aal2()) then
    perform private.log_audit(
      p_action := 'auth.access_denied', p_result := 'denied',
      p_target_table := 'requests', p_target_id := p_request_id::text
    );
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if not private.has_menu_permission('lead_management', 'read', v_auth_uid) then
    perform private.log_audit(
      p_action := 'auth.access_denied', p_result := 'denied',
      p_target_table := 'requests', p_target_id := p_request_id::text
    );
    raise exception 'access_denied' using errcode = '42501';
  end if;

  -- §8.4 OQ-16: viewer is excluded here, permanently, by design (no reveal
  -- escape hatch — "역할을 올리는 것이 올바른 경로").
  if not private.has_pii_access(v_auth_uid) then
    perform private.log_audit(
      p_action := 'lead.contact_reveal', p_result := 'denied',
      p_target_table := 'requests', p_target_id := p_request_id::text,
      p_subject_ids := array[p_request_id]
    );
    raise exception 'pii_access_denied' using errcode = '42501';
  end if;

  select r.contact into v_contact from public.requests r where r.id = p_request_id;

  if v_contact is null then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;

  -- §3.5: this action's audit record and the data access it describes are
  -- atomically the same transaction. If the insert fails, the exception
  -- below rolls back the entire function invocation, INCLUDING the select
  -- above — the caller never receives the contact value on a failed log.
  v_audit_id := private.log_audit(
    p_action := 'lead.contact_reveal', p_result := 'success',
    p_target_table := 'requests', p_target_id := p_request_id::text,
    p_subject_ids := array[p_request_id]
  );

  if v_audit_id is null then
    raise exception 'audit_log_write_failed: contact reveal aborted because the audit record could not be written'
      using errcode = '55000';
  end if;

  return v_contact;
end;
$$;

comment on function public.get_request_contact is
  '§7.3: the ONLY path to a raw `contact` value anywhere in this schema — '
  '`contact` has zero GRANT to authenticated (§11 above), so there is no way '
  'to bypass this function short of a direct postgres/service_role SQL '
  'connection. Every call is audited; every DENIED call is also audited '
  '(auth.access_denied / lead.contact_reveal result=denied), satisfying '
  '§3.2-A "누락하면 내부 오남용을 영원히 탐지할 수 없습니다".';

revoke all on function public.get_request_contact(uuid) from public;
grant execute on function public.get_request_contact(uuid) to authenticated;


-- =============================================================================
-- §12. `private.request_meta` (internal_note) — grants + RLS + RPC wrappers
-- =============================================================================
-- §7.2 backend-developer note: `private` is not a PostgREST Exposed Schema,
-- so column-level GRANT+RLS on the table itself (kept below for structural
-- completeness / defense-in-depth, matching the review's first bullet) is
-- NOT reachable from the app today — the actual access path the Next.js
-- server uses is the two `public.*` wrapper functions further down (the
-- review's explicit recommendation: "public에 뷰를 두지 말고, 메모 읽기/쓰기
-- 전용 security definer 함수 2개").

drop policy if exists request_meta_deny_select on private.request_meta;
drop policy if exists request_meta_deny_update on private.request_meta;
-- insert/delete deny placeholders from Phase 1 are left exactly as-is —
-- nobody gets an insert/delete GRANT on this table in this migration either.

grant select (request_id, internal_note) on private.request_meta to authenticated;
grant update (internal_note) on private.request_meta to authenticated;
-- consent_ip / consent_ip_expires_at: deliberately NEVER granted to
-- authenticated (§7.2: "운영자가 볼 업무상 이유가 없습니다").

create policy request_meta_admin_select on private.request_meta
  for select to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('lead_management', 'read'))
  );

create policy request_meta_admin_update on private.request_meta
  for update to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('lead_management', 'update'))
  )
  with check (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('lead_management', 'update'))
  );


create or replace function public.get_request_internal_note(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_note text;
begin
  if not (
    private.is_active_admin(v_auth_uid)
    and private.is_aal2()
    and private.has_menu_permission('lead_management', 'read', v_auth_uid)
  ) then
    perform private.log_audit(
      p_action := 'auth.access_denied', p_result := 'denied',
      p_target_table := 'request_meta', p_target_id := p_request_id::text
    );
    raise exception 'access_denied' using errcode = '42501';
  end if;

  select rm.internal_note into v_note
  from private.request_meta rm
  where rm.request_id = p_request_id;

  -- Not individually audited (§3.2-B note: covered by the lead.view event
  -- the detail-page route logs for the surrounding request, once that route
  -- ships in the next round) — the note's CONTENT is never logged either
  -- way (§3.4).
  return v_note;
end;
$$;

revoke all on function public.get_request_internal_note(uuid) from public;
grant execute on function public.get_request_internal_note(uuid) to authenticated;


create or replace function public.set_request_internal_note(p_request_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_len integer;
begin
  if not (
    private.is_active_admin(v_auth_uid)
    and private.is_aal2()
    and private.has_menu_permission('lead_management', 'update', v_auth_uid)
  ) then
    perform private.log_audit(
      p_action := 'auth.access_denied', p_result := 'denied',
      p_target_table := 'request_meta', p_target_id := p_request_id::text
    );
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if p_note is not null and char_length(p_note) > 5000 then
    raise exception 'note_too_long';
  end if;

  insert into private.request_meta (request_id, internal_note)
  values (p_request_id, p_note)
  on conflict (request_id) do update
    set internal_note = excluded.internal_note, updated_at = now();

  v_len := coalesce(char_length(p_note), 0);

  -- §3.4: length + fact-of-change only, never the note body.
  perform private.log_audit(
    p_action := 'lead.note_write',
    p_target_table := 'request_meta',
    p_target_id := p_request_id::text,
    p_subject_ids := array[p_request_id],
    p_after_summary := jsonb_build_object('note_length', v_len)
  );
end;
$$;

revoke all on function public.set_request_internal_note(uuid, text) from public;
grant execute on function public.set_request_internal_note(uuid, text) to authenticated;


-- =============================================================================
-- §13. RLS for the remaining admin tables (super_admin-only surface for now)
-- =============================================================================
-- No CRUD screens ship in this round (operator-management / permission-
-- management UI are next round), but the read path is wired now so that
-- round only has to build UI, not schema. All four tables below are, in
-- practice, only readable by super_admin today (INV-4: no role_menu_permission
-- rows exist yet for operator/viewer against these menu codes).

create policy role_admin_select on public.role
  for select to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('operator_management', 'read'))
  );
grant select on public.role to authenticated;

create policy admin_user_role_admin_select on public.admin_user_role
  for select to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('operator_management', 'read'))
  );
grant select on public.admin_user_role to authenticated;

create policy menu_admin_select on public.menu
  for select to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('menu_management', 'read'))
  );
grant select on public.menu to authenticated;

create policy role_menu_permission_admin_select on public.role_menu_permission
  for select to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('role_menu_permission_management', 'read'))
  );
grant select on public.role_menu_permission to authenticated;


-- §2.3: admin_user self-row + operator_management-permission read/update.
create policy admin_user_select on public.admin_user
  for select to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (
      auth_user_id = auth.uid()
      or (select private.has_menu_permission('operator_management', 'read'))
    )
  );

create policy admin_user_update on public.admin_user
  for update to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (
      auth_user_id = auth.uid()
      or (select private.has_menu_permission('operator_management', 'update'))
    )
  )
  with check (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (
      auth_user_id = auth.uid()
      or (select private.has_menu_permission('operator_management', 'update'))
    )
  );

grant select on public.admin_user to authenticated;
grant update (display_name) on public.admin_user to authenticated;
-- status / auth_user_id / suspended_by / withdrawn_at etc.: NO grant to
-- authenticated at all in this round (§2.3: "GRANT 없음. 오직 security definer
-- 함수 경유"). Those functions (admin_suspend_user, admin_invite_user, ...)
-- ship with the operator-management round; the INV-6 triggers in §10
-- protect the columns regardless of which mechanism eventually writes them.


-- audit_log read policy (§3.5 layer 2 — see §6 table comment for full detail).
create policy audit_log_admin_select on public.audit_log
  for select to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('audit_log', 'read'))
  );
grant select on public.audit_log to authenticated;
-- No 'audit_log' menu row is seeded in §15 yet (the 감사로그 screen is not in
-- this round's scope) — this policy is correct and future-proof regardless:
-- INV-4 means nobody but super_admin (matrix bypass) can read audit_log
-- until a future round both seeds that menu row AND grants role_menu_permission
-- rows for it.


-- =============================================================================
-- §14. P3-3 / P3-4 — Phase 1 follow-ups called out by the privacy review
-- =============================================================================

-- P3-3: requests.assignee_id -> admin_user(id), restrict (never silently
-- orphaned by an admin_user deletion — which cannot happen anyway, §2.4).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_requests_assignee_id'
  ) then
    alter table public.requests
      add constraint fk_requests_assignee_id
      foreign key (assignee_id) references public.admin_user (id) on delete restrict;
  end if;
end;
$$;

-- P3-4: retention_jobs.job_type CHECK widened to include the two new batch
-- types this migration introduces (§14). Looked up by definition text rather
-- than a guessed constraint name, so this is correct even if Postgres
-- auto-named the original CHECK differently than expected.
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
    check (job_type in ('anonymize', 'hard_delete', 'audit_purge', 'failed_submission_purge'));
end;
$$;


-- =============================================================================
-- §15. Retention batches — P3-5 / P3-6 (audit_log 2yr, leads 12/24mo/30d,
--      failed_submissions 7d), scheduled via pg_cron
-- =============================================================================

create or replace function private.purge_expired_audit_log()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  -- §3.5 layer 3 escape hatch: ONLY this function, and only for the
  -- duration of this transaction (`set local`), may delete audit_log rows.
  set local fkp.audit_purge = 'on';

  delete from public.audit_log where occurred_at < now() - interval '2 years';
  get diagnostics v_deleted = row_count;

  insert into public.retention_jobs (job_type, target_condition, deleted_count, notes)
  values (
    'audit_purge',
    'occurred_at < now() - interval ''2 years''',
    v_deleted,
    '§3.6: 2-year audit_log retention (statutory minimum is 1 year, 2y is the deliberate margin).'
  );

  return v_deleted;
end;
$$;

comment on function private.purge_expired_audit_log is
  '§3.6: deletes rows older than the 2-year retention window. This is the '
  'sole legitimate caller of the `fkp.audit_purge` GUC escape hatch in '
  'trg_audit_log_append_only (§10/§6). Deletion here is deliberate and '
  'lawful — §3.6 forbids EARLY deletion within the retention window for any '
  'reason, but does not forbid deletion once the window has elapsed.';


create or replace function private.purge_expired_failed_submissions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.failed_submissions where expires_at < now();
  get diagnostics v_deleted = row_count;

  insert into public.retention_jobs (job_type, target_condition, deleted_count, notes)
  values (
    'failed_submission_purge',
    'expires_at < now()',
    v_deleted,
    'P3-5: failed_submissions 7-day retention (Phase 1 left this batch unbuilt).'
  );

  return v_deleted;
end;
$$;


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
  'the privacy policy but never implemented. See the inline NOTE above for '
  'one deliberate deviation from the literal oq4 §2.3 wording (sentinel '
  'values instead of NULL, required by Phase 1''s existing NOT NULL/CHECK '
  'constraints) — flagged for privacy-security-officer sign-off.';


create or replace function private.run_daily_retention_batches()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Each batch is independently fault-isolated: one failing must not block
  -- the other two (this function itself is what pg_cron calls once/day).
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
end;
$$;


-- pg_cron scheduling. Wrapped so this migration does not hard-fail on a
-- project where pg_cron has not been enabled yet (Database > Extensions) —
-- see the header notes at the top of this file for the manual follow-up.

do $$
begin
  create extension if not exists pg_cron;
exception when insufficient_privilege then
  raise notice 'pg_cron extension could not be created automatically (insufficient '
    'privilege in this session). Enable it via Supabase Dashboard > Database > '
    'Extensions > pg_cron, then re-run this migration file (idempotent) to '
    'register the retention_jobs cron schedule.';
end;
$$;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'fkp-daily-retention-batches';
exception when undefined_table then
  null; -- pg_cron not enabled yet; the schedule attempt below will notice and explain
end;
$$;

do $$
begin
  perform cron.schedule(
    'fkp-daily-retention-batches',
    '0 18 * * *', -- 18:00 UTC = 03:00 KST, low-traffic window
    $cron$select private.run_daily_retention_batches();$cron$
  );
exception when undefined_table or undefined_function then
  raise notice 'pg_cron scheduling skipped (extension not enabled yet). After enabling '
    'pg_cron via Supabase Dashboard > Database > Extensions, run: '
    'select cron.schedule(''fkp-daily-retention-batches'', ''0 18 * * *'', '
    '''select private.run_daily_retention_batches();'');';
end;
$$;


-- =============================================================================
-- §16. Seed data — initial roles + menu tree + role_menu_permission matrix
-- =============================================================================
-- §9 initial role table (super_admin/operator/viewer) + the menu tree the
-- task asked for (dashboard / lead_management / content_management
-- placeholder / operator_management / permission_management > menu_management
-- + role_menu_permission_management). No screens exist for most of these
-- yet — this is the data model the next rounds' screens will read.

insert into public.role (code, display_name, description, is_system, can_access_pii)
values
  ('super_admin', '최고관리자', '전 메뉴와 권한관리에 대한 무제한 접근. 시스템 역할 — 삭제·권한박탈 불가, role_menu_permission 매트릭스를 참조하지 않음(INV-4 예외).', true, true),
  ('operator', '운영자', '리드 처리 및 콘텐츠 관리. 연락처 원문 열람 가능(get_request_contact 경유, 감사 기록).', false, true),
  ('viewer', '조회전용', '현황 파악 목적의 읽기 전용 접근. 연락처는 영구 마스킹(OQ-16), 해제 기능 없음.', false, false)
on conflict (code) do nothing;

insert into public.menu (code, parent_id, display_name, path, menu_type, sort_order, is_active)
values
  ('dashboard', null, '대시보드', '/admin', 'page', 10, true),
  ('lead_management', null, '요청관리', '/admin/leads', 'page', 20, true),
  ('content_management', null, '콘텐츠관리', '/admin/content', 'page', 30, true),
  ('operator_management', null, '운영자관리', '/admin/operators', 'page', 40, true),
  ('permission_management', null, '권한관리', null, 'group', 50, true)
on conflict (code) do nothing;

insert into public.menu (code, parent_id, display_name, path, menu_type, sort_order, is_active)
select 'menu_management', m.id, '메뉴관리', '/admin/permissions/menus', 'page', 10, true
from public.menu m where m.code = 'permission_management'
on conflict (code) do nothing;

insert into public.menu (code, parent_id, display_name, path, menu_type, sort_order, is_active)
select 'role_menu_permission_management', m.id, '메뉴권한관리', '/admin/permissions/matrix', 'page', 20, true
from public.menu m where m.code = 'permission_management'
on conflict (code) do nothing;

-- super_admin: seeded with full flags on every menu for documentation /
-- future-UI-display purposes only — private.has_menu_permission never
-- actually consults this table for super_admin (INV-4 bypass, §9). Editing
-- or deleting these rows has zero effect on what super_admin can do.
insert into public.role_menu_permission (role_id, menu_id, can_read, can_create, can_update, can_delete, can_export)
select r.id, m.id, true, true, true, true, true
from public.role r cross join public.menu m
where r.code = 'super_admin'
on conflict (role_id, menu_id) do update set
  can_read = true, can_create = true, can_update = true, can_delete = true, can_export = true;

insert into public.role_menu_permission (role_id, menu_id, can_read, can_create, can_update, can_delete, can_export)
select r.id, m.id, true, false, false, false, false
from public.role r join public.menu m on m.code = 'dashboard'
where r.code in ('operator', 'viewer')
on conflict (role_id, menu_id) do nothing;

insert into public.role_menu_permission (role_id, menu_id, can_read, can_create, can_update, can_delete, can_export)
select r.id, m.id, true, false, true, false, false
from public.role r join public.menu m on m.code = 'lead_management'
where r.code = 'operator'
on conflict (role_id, menu_id) do nothing;

insert into public.role_menu_permission (role_id, menu_id, can_read, can_create, can_update, can_delete, can_export)
select r.id, m.id, true, false, false, false, false
from public.role r join public.menu m on m.code = 'lead_management'
where r.code = 'viewer'
on conflict (role_id, menu_id) do nothing;

insert into public.role_menu_permission (role_id, menu_id, can_read, can_create, can_update, can_delete, can_export)
select r.id, m.id, true, true, true, false, false
from public.role r join public.menu m on m.code = 'content_management'
where r.code = 'operator'
on conflict (role_id, menu_id) do nothing;

-- operator_management / permission_management / menu_management /
-- role_menu_permission_management: deliberately NO rows for operator/viewer
-- (INV-4 default deny — only super_admin''s matrix bypass reaches these).


-- =============================================================================
-- §17. Bootstrap account linkage (§2.6) — connect the representative's
--      already-created Auth user to admin_user + super_admin
-- =============================================================================
-- Does NOT create the Auth user (the representative already did, via the
-- Supabase Dashboard, per the confirmed decision — §2.6 / checklist "확정
-- 완료 jhc@ylia.io"). This block only links auth.users -> admin_user and
-- grants the super_admin role. Safe to run before or after that account is
-- created — it no-ops with a NOTICE if the email is not found yet, and is
-- idempotent (ON CONFLICT) if run again after the account does exist.

do $$
declare
  v_auth_id uuid;
  v_admin_id uuid;
  v_role_id uuid;
begin
  select id into v_auth_id from auth.users where email = 'jhc@ylia.io' limit 1;

  if v_auth_id is null then
    raise notice 'Bootstrap skipped: no auth.users row for jhc@ylia.io yet. Create the '
      'account in Supabase Dashboard > Authentication > Users first (§2.6), then '
      're-run this DO block (or this whole migration file — it is idempotent).';
    return;
  end if;

  insert into public.admin_user (auth_user_id, display_name, status, activated_at)
  values (v_auth_id, '대표', 'active', now())
  on conflict (auth_user_id) do update set status = 'active'
  returning id into v_admin_id;

  select id into v_role_id from public.role where code = 'super_admin';

  insert into public.admin_user_role (admin_user_id, role_id)
  values (v_admin_id, v_role_id)
  on conflict (admin_user_id, role_id) do nothing;

  raise notice 'Bootstrap complete: admin_user % linked to auth.users % as super_admin. '
    'Register TOTP MFA for this account immediately after first login (§6.5) — until '
    'MFA is completed, private.is_aal2() is false and every lead/admin data path in '
    'this migration stays blocked for this session, by design.', v_admin_id, v_auth_id;
end;
$$;


-- =============================================================================
-- §18. Realtime — explicitly NOT enabled (mirrors Phase 1 §10 / A-9)
-- =============================================================================
-- Do not run `alter publication supabase_realtime add table ...` for any
-- table in this migration.


-- =============================================================================
-- End of Phase 3 slice 3-A/3-B migration.
-- =============================================================================
