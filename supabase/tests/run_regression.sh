#!/usr/bin/env bash
# =============================================================================
# supabase/tests/run_regression.sh
#
# Reusable version of the "spin up a throwaway Docker Postgres, replay every
# migration in order, assert the resulting RLS/view/function behaviour with
# SQL, tear the container down" pattern that was used ad hoc (and re-typed
# from scratch) several times during the 2026-09-10 SEEPN buyer-web session.
# This script fixes that pattern in place so it never has to be re-derived.
#
# Docker is kept installed on this local environment for occasional use like
# this harness (not removed) — if you're wondering why a backend task in a
# Next.js/Supabase repo has a Docker dependency at all, this is why: it is
# the only practical way to get a REAL Postgres evaluating REAL RLS
# policies/views for a local, disposable, throwaway test run (see "Why not
# pgTAP / a remote disposable project" below).
#
# What it does, in order:
#   1. Builds a local-only Docker image (postgres:15 + the postgresql-15-cron
#      apt package — see docker/pg_cron.Dockerfile) so migrations that touch
#      pg_cron do not silently no-op.
#   2. Starts a container from that image with pg_cron preloaded
#      (shared_preload_libraries=pg_cron), no host port published (everything
#      goes through `docker exec`, so it never collides with a local Postgres
#      you may already have running).
#   3. Runs a bootstrap script that stubs the parts of a real Supabase project
#      this repo's migrations assume already exist, but a bare postgres:15
#      image does not ship: the `anon` / `authenticated` / `service_role`
#      roles, a minimal `auth.users` + `auth.uid()` / `auth.jwt()` (reading
#      session GUCs the way PostgREST would set them per-request), and a
#      minimal `storage.buckets` / `storage.objects` / `storage.foldername()`.
#   4. Replays every file in supabase/migrations/ in filename (timestamp)
#      order, exactly as they would apply to a fresh project.
#   5. Runs supabase/tests/seepn_buyer_regression.sql, which seeds a handful
#      of fixture rows and asserts the SEEPN buyer-web invariants qa-reviewer
#      re-verified by hand on 2026-09-10 (see that file's header for the
#      full list, and this directory's README.md for when to update it).
#   6. ALWAYS tears the container down (trap on EXIT), regardless of whether
#      any step above failed.
#
# Usage:
#   ./supabase/tests/run_regression.sh
#
# Exit code: 0 if every migration replayed cleanly AND every assertion in
# seepn_buyer_regression.sql passed. 1 otherwise (a migration failed to
# apply, or at least one assertion's RAISE EXCEPTION fired).
#
# Requires: Docker running locally. Nothing else — no new project dependency,
# no pgTAP, no CI config. This is intentionally just a shell script + psql
# (run inside the container via `docker exec`, so a native psql binary on
# the host is NOT required either).
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
ASSERTIONS_FILE="$SCRIPT_DIR/seepn_buyer_regression.sql"
DOCKERFILE="$SCRIPT_DIR/docker/pg_cron.Dockerfile"

IMAGE_TAG="fkp-seepn-regression-pg:15-cron"
CONTAINER_NAME="fkp-seepn-regression-$$"
DB_USER="postgres"
DB_NAME="postgres"

RESULT=1 # pessimistic default; only set to 0 on full success below

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "== supabase/tests/run_regression.sh =="
echo "Repo root:        $REPO_ROOT"
echo "Migrations dir:    $MIGRATIONS_DIR"
echo "Assertions file:   $ASSERTIONS_FILE"
echo

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is not installed or not on PATH." >&2
  exit 1
fi

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "ERROR: migrations directory not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

if [ ! -f "$ASSERTIONS_FILE" ]; then
  echo "ERROR: assertions file not found: $ASSERTIONS_FILE" >&2
  exit 1
fi

echo "-- Building regression Postgres image (postgres:15 + pg_cron) --"
if ! docker build -q -t "$IMAGE_TAG" -f "$DOCKERFILE" "$SCRIPT_DIR/docker" >/dev/null; then
  echo "ERROR: docker build failed." >&2
  exit 1
fi

echo "-- Starting container $CONTAINER_NAME --"
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
if ! docker run -d --name "$CONTAINER_NAME" \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  "$IMAGE_TAG" \
  postgres -c shared_preload_libraries=pg_cron -c cron.database_name=postgres \
  >/dev/null; then
  echo "ERROR: docker run failed." >&2
  exit 1
fi

echo "-- Waiting for Postgres to accept connections --"
READY=0
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done
if [ "$READY" -ne 1 ]; then
  echo "ERROR: Postgres did not become ready in time." >&2
  echo "---- container logs ----" >&2
  docker logs "$CONTAINER_NAME" >&2 || true
  exit 1
fi

psql_exec() {
  # $1 = human label, $2 = sql file on the HOST to pipe in
  local label="$1"
  local file="$2"
  echo "-- $label --"
  if ! docker exec -i "$CONTAINER_NAME" \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -q < "$file"; then
    echo "FAILED: $label" >&2
    return 1
  fi
  return 0
}

BOOTSTRAP_SQL="$(mktemp)"
trap 'rm -f "$BOOTSTRAP_SQL"; cleanup' EXIT

cat > "$BOOTSTRAP_SQL" <<'SQL'
-- =============================================================================
-- Local-replay bootstrap: stubs the slice of a real Supabase project this
-- repo's migrations assume already exists (Supabase-managed roles, GoTrue's
-- auth.users + auth.uid()/auth.jwt(), Storage's storage.buckets/objects/
-- foldername()). NONE of this ships to production — it exists only inside
-- this throwaway container, purely so supabase/migrations/*.sql can replay
-- unmodified against a bare postgres:15 image.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Supabase-managed roles. Every migration in this repo GRANTs/REVOKEs
-- against these by name without ever creating them (they are provisioned by
-- the Supabase platform itself in a real project).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

-- The migration-running superuser (postgres, here) needs to be able to
-- `SET ROLE anon` / `SET ROLE authenticated` / `SET ROLE service_role` to
-- simulate sessions in the assertions file below (a real Postgres superuser
-- can always SET ROLE to anything regardless of membership, but grant
-- membership anyway so this also works unmodified against a non-superuser
-- migration role, matching how Supabase's own `postgres` role is set up).
grant anon, authenticated, service_role to postgres;

-- ---------------------------------------------------------------------------
-- auth schema stub — only the parts this repo's migrations/RLS ever touch:
-- auth.users (id / email / email_confirmed_at), auth.uid(), auth.jwt().
-- Supabase's real auth.uid()/auth.jwt() read the current request's JWT off
-- PostgREST-set session GUCs (request.jwt.claim.sub / request.jwt.claims).
-- We reproduce exactly that contract here, so "simulating a session" in the
-- assertions file is just `select set_config('request.jwt.claim.sub', ...)`
-- + `set role authenticated` — the same mental model as a real HTTP request.
-- ---------------------------------------------------------------------------
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.jwt()
returns jsonb
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

-- ---------------------------------------------------------------------------
-- storage schema stub — only what supabase/migrations/*.sql references:
-- bucket seeds (`insert into storage.buckets ...`) and the
-- storage.objects RLS policies' use of storage.foldername(name).
-- ---------------------------------------------------------------------------
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  allowed_mime_types text[],
  file_size_limit bigint,
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language plpgsql
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1 : array_length(_parts, 1) - 1];
end;
$$;
SQL

STEP_FAILED=0

if ! psql_exec "Bootstrap (roles / auth stub / storage stub)" "$BOOTSTRAP_SQL"; then
  STEP_FAILED=1
fi

if [ "$STEP_FAILED" -eq 0 ]; then
  echo "-- Replaying supabase/migrations/*.sql in filename order --"
  while IFS= read -r -d '' migration_file; do
    label="migration: $(basename "$migration_file")"
    if ! psql_exec "$label" "$migration_file"; then
      STEP_FAILED=1
      break
    fi
  done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' -print0 | sort -z)
fi

if [ "$STEP_FAILED" -eq 0 ]; then
  if psql_exec "seepn_buyer_regression.sql assertions" "$ASSERTIONS_FILE"; then
    RESULT=0
  else
    STEP_FAILED=1
  fi
fi

echo
if [ "$RESULT" -eq 0 ]; then
  echo "== RESULT: PASS — all migrations replayed cleanly and every assertion passed. =="
else
  echo "== RESULT: FAIL — see the FAILED step above for details. ==" >&2
fi

exit "$RESULT"
