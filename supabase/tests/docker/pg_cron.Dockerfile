# Base image for the SQL regression harness (supabase/tests/run_regression.sh).
#
# postgres:15 + the postgresql-15-cron apt package, so that migrations which
# do `create extension if not exists pg_cron;` and register a job via
# `cron.schedule(...)` (see supabase/migrations/20260825120000_phase3_admin_rbac.sql
# §15, replayed by every run of this harness) actually succeed instead of
# silently falling through their insufficient_privilege guard clause. Docker
# layer caching means the `apt-get install` step only re-runs when this file
# changes, so this does not meaningfully slow down repeat local runs.
#
# No new project dependency is introduced by this file: it only affects the
# throwaway container this harness spins up and tears down locally, never
# anything shipped or deployed.
FROM postgres:15
RUN apt-get update -qq \
    && apt-get install -y -qq --no-install-recommends postgresql-15-cron \
    && rm -rf /var/lib/apt/lists/*
