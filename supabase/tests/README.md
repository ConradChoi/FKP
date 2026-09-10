# supabase/tests/ — SEEPN buyer-web DB-level regression harness

## Why this exists

During the 2026-09-10 SEEPN buyer-web (P5a) DoD re-verification, qa-reviewer
found that every RLS policy / view gate / `principal_kind` isolation
guarantee in this codebase had only ever been checked by hand — an agent
would spin up a throwaway Docker Postgres, replay the migrations, run some
SQL, read the output, and throw the container away. That pattern was correct
but **not reusable**: the same manual verification was independently
re-derived at least 5-6 times in a single day.

This directory fixes that pattern in place. It is **DB-level SQL, not
Playwright** — the existing `tests/e2e/` suite mocks Supabase out entirely
(`mockFormEndpoint` etc.), which means it cannot catch the actual risk here:
someone editing an RLS policy's `USING` clause, a view's `WHERE` clause, or a
`principal_kind` judgment function and silently breaking an invariant. Only a
real Postgres evaluating real RLS/policies/views catches that.

## Docker dependency, explained

This harness needs a real, disposable, local Postgres to replay migrations
against and evaluate real RLS policies/views — Docker is the practical way
to get that. Docker is kept installed on this local development environment
specifically for occasional use like this (it is not part of this project's
runtime stack — see the root `CLAUDE.md` stack list — and nothing else in
this repo depends on it). If you're wondering why a Next.js/Supabase repo
has a Docker dependency at all, this is why.

## How to run

```bash
./supabase/tests/run_regression.sh
```

Requires Docker running locally. Nothing else — the script builds its own
throwaway image, starts a container (no host port published, no auth
required beyond `docker exec`), runs everything through that, and always
tears the container down on exit (`trap ... EXIT`), whether the run passed
or failed.

Exit code `0` = every migration replayed cleanly and every assertion passed.
Exit code `1` = something failed; the script's own output names exactly
which step (which migration file, or which lettered/labelled assertion in
`seepn_buyer_regression.sql`) failed.

## What it covers

`seepn_buyer_regression.sql` asserts (see that file's own header for the
exact list with rationale):

- **a.** `principal_kind` mutual exclusion — `is_active_admin()` /
  `is_active_partner()` / `is_active_buyer()` never overlap for the same
  `auth.uid()`.
- **b.** The public-listing 3-layer gate (`verification_state='verified'`
  AND `public_listing_state='on'` AND latest `public_listing` consent
  `granted=true`) on `private.partner_public_base` / `partner_list_public` —
  one broken condition at a time, plus the all-satisfied case.
- **c.** `partner_detail_buyer` access control — buyer session sees the row,
  partner session sees zero rows, anon has no grant at all.
- **d.** `buyer_bookmark` RLS — a buyer can only select/delete their own row,
  never another buyer's.
- **e.** `get_own_buyer_consents()` / `buyer_grant_consent()` access control
  — an inactive (suspended) buyer is denied (`42501`), and
  `third_party_share` is rejected as a self-service consent target even for
  an active buyer.
- **f.** `purge_dormant_buyer_accounts()` — the 2026-09-10 policy (6-month
  grace period from `dormant_notice_sent_at`, account-status-only —
  `buyer_bookmark` / `seepn_inquiry` data preserved, not deleted).
- **g.** `purge_expired_audit_log()` — permission-related actions
  (`admin_access_request.approve` etc.) are held indefinitely past the
  2-year window; unrelated actions are purged as normal.

## When you MUST re-run this (and update it if it no longer covers your change)

Run `./supabase/tests/run_regression.sh` — and update
`seepn_buyer_regression.sql` if your change isn't covered by the list above —
whenever a migration touches any of:

- An RLS policy's `USING` / `WITH CHECK` clause on `buyer_account`,
  `buyer_bookmark`, `buyer_consent`, `seepn_inquiry`, `partner`,
  `partner_consent`, `partner_account`, `admin_user`, or `audit_log`.
- A view's `WHERE` clause that gates public/buyer-facing data:
  `private.partner_public_base`, `public.partner_list_public`,
  `public.partner_detail_buyer`, `public.partner_category_public`.
- A `principal_kind` judgment function: `private.is_active_admin()`,
  `private.is_active_partner()`, `private.is_active_buyer()`, or the
  `auth_principal` mutual-exclusion registry itself.
- A self-service RPC touched by this file's assertions:
  `buyer_grant_consent()`, `get_own_buyer_consents()`, `buyer_withdraw()`,
  `create_seepn_inquiry()`.
- A retention/purge batch: `purge_dormant_buyer_accounts()`,
  `mark_dormant_buyer_accounts_for_notice()`, `purge_expired_audit_log()`,
  `purge_expired_seepn_inquiry_body()`.

If your change adds a NEW invariant in one of these areas that isn't listed
in "What it covers" above, add a new lettered section to
`seepn_buyer_regression.sql` (same `regtest.assert(...)` / `do $$ ... $$`
pattern) rather than opening a new ad hoc Docker/psql session by hand —
that is exactly the one-off pattern this harness exists to replace.

## Why not pgTAP

Explicitly out of scope for this task — the goal was fixing the "Docker
Postgres + psql assertions" pattern already used successfully several times
in a single session in place, not introducing a new testing framework
dependency. `seepn_buyer_regression.sql` is plain SQL (`DO` blocks,
`RAISE EXCEPTION` / `RAISE NOTICE`, a tiny local `regtest.assert()` helper)
run through `psql -v ON_ERROR_STOP=1`, nothing more.
