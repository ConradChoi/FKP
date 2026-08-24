# Supabase — FKP Phase 1 (Lead Pipeline)

This directory contains the SQL migrations for the Supabase-backed lead
pipeline (PRD `docs/01-plan/features/fkp-v0.2-platform-foundation.prd.md`
§4.1 Epic 1, Phase 1).

## Migrations were NOT applied by backend-developer

No DB password or `service_role` key was available in this environment, so
the SQL in `migrations/` has been written and reviewed but **not executed
against the live project**. The representative (or whoever holds Supabase
project access) needs to apply it.

## How to apply

**Option A — Supabase Dashboard SQL Editor**
1. Open `https://supabase.com/dashboard/project/<project-ref>/sql/new`
2. Paste the full contents of `migrations/20260824120000_phase1_requests_pipeline.sql`
3. Run it. Read through the file first — it creates tables, revokes default
   grants, enables RLS, and creates two `SECURITY DEFINER` RPC functions.

**Option B — Supabase CLI**
```
supabase link --project-ref <project-ref>
supabase db push
```

## Manual steps that cannot be done via SQL migration

After applying the migration:

1. **Authentication > Providers > Email > "Allow new users to sign up" → OFF.**
   This was already flagged as an immediate action item in the privacy
   review (`fkp-v0.2-privacy-review-oq4-tv4.md` §5.1, item S-1) — confirm it
   is still off. Public sign-up has nothing to do with this migration, but
   it is a prerequisite gate for Phase 1 the privacy review calls out
   explicitly.
2. **Project Settings > API > Exposed schemas** — make sure `private` is
   **not** in the list. Only `public` should be exposed via PostgREST. The
   `private.request_meta` table (holding masked consent IP + future admin
   notes) relies on this as a second, independent layer of defense on top
   of the GRANT/RLS lockdown already in the SQL.

## Verifying the RLS/GRANT lockdown (do this before relying on it)

The privacy review (R-10) requires raw-HTTP verification, not just
library-mediated checks, before Phase 1 is considered done. Example (fill in
`<PROJECT_URL>` / `<ANON_KEY>`):

```bash
# 1. anon key must NOT be able to read leads
curl -i "<PROJECT_URL>/rest/v1/requests?select=*" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
# expect: 401/403/empty — never actual rows

# 2. anon key must NOT be able to insert directly into the table
curl -i -X POST "<PROJECT_URL>/rest/v1/requests" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"what_looking_for":"x"}'
# expect: 401/403 (permission denied) — not a validation error

# 3. the RPC path must succeed with a full, valid payload
curl -i -X POST "<PROJECT_URL>/rest/v1/rpc/submit_request" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"p_what_looking_for":"...", "...": "..."}'
# expect: 200/201 with { id, created_at }
```

Run this together with qa-reviewer before the Phase 1 deploy, per the
privacy review's DoD checklist.

## Explicitly out of scope for this migration (documented, not forgotten)

- `pg_cron` retention batch (anonymization / hard-delete). `retention_jobs`
  and `retention_expires_at` / `anonymized_at` columns exist so this can be
  added later without another schema migration. See the migration file's
  §5 and §8 comments.
- Phase 3 admin RBAC (`admin_user`, `role`, `menu`, `role_menu_permission`,
  `audit_log`). The current RLS policies on `requests` /
  `private.request_meta` / `failed_submissions` / `retention_jobs` are
  explicit deny-all placeholders (see migration §9) that a Phase 3
  migration will replace with real admin-role-scoped policies.
- Operator notification channel (OQ-14) and Apps Script dual-write
  (E1-R11, "Could" priority). Neither was in this task's explicit scope
  ("접수 폼 → Supabase 저장 경로에만 집중"). See the top-level task summary
  for follow-up recommendations.
