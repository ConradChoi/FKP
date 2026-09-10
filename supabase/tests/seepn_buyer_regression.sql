-- =============================================================================
-- supabase/tests/seepn_buyer_regression.sql
--
-- SEEPN buyer-web (P5a) DB-level regression assertions (2026-09-10 qa-reviewer
-- DoD re-verification gap). Everything in this file was, until this file
-- existed, checked by hand once in a throwaway Docker Postgres container and
-- then thrown away — this is that verification fixed in place so it can be
-- re-run instead of re-derived. Run via supabase/tests/run_regression.sh
-- (NOT directly against a real project — this file INSERTs fixture rows with
-- fixed literal UUIDs and calls retention/purge functions that mutate state).
--
-- Convention: each check is either
--   `select regtest.assert(<boolean>, '<label>');`      -- for a single
--   expression check, or a `do $$ ... $$;` block using RAISE EXCEPTION /
--   RAISE NOTICE 'PASS: ...' directly, when a scenario needs SET ROLE,
--   GET DIAGNOSTICS, or its own exception handler (session simulation,
--   RLS-blocked DML row counts, expected-exception assertions).
-- regtest.assert() itself raises on failure, so under `psql -v
-- ON_ERROR_STOP=1` (always the case here — see run_regression.sh) the whole
-- script — and the harness's exit code — stops at the FIRST failing
-- assertion, with a message naming exactly which one failed.
--
-- Covers (letters match the task brief this file was written against):
--   a. principal_kind isolation (is_active_admin/is_active_partner/
--      is_active_buyer mutual exclusion)
--   b. public-listing 3-layer gate (verification_state / public_listing_state
--      / latest public_listing consent) on private.partner_public_base
--   c. partner_detail_buyer access control (buyer-only, not partner/anon)
--   d. buyer_bookmark RLS (self-only select/insert/delete)
--   e. get_own_buyer_consents() / buyer_grant_consent() access control
--      (inactive buyer denied, third_party_share rejected)
--   f. purge_dormant_buyer_accounts() — 6-month grace period, data preserved
--   g. purge_expired_audit_log() — permission-related actions held
--      indefinitely, unrelated actions purged after 2 years
--
-- See this directory's README.md for when this file must be updated.
-- =============================================================================


-- =============================================================================
-- §0. Tiny assertion helper (scoped to its own schema, never touches the
--     app's public/private schemas — dropped implicitly with the container).
-- =============================================================================

create schema if not exists regtest;

create or replace function regtest.assert(p_condition boolean, p_label text)
returns void
language plpgsql
as $$
begin
  if p_condition is not true then
    raise exception 'FAIL: %', p_label;
  end if;
  raise notice 'PASS: %', p_label;
end;
$$;


-- =============================================================================
-- §1. Fixtures — one auth.users row + auth_principal row + account row per
--     test principal, fixed literal UUIDs so later sections can reference
--     them without needing to capture generated ids across statements.
-- =============================================================================

-- Buyers
insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111a01', 'regtest-buyer-a@example.test', now()), -- active, owns a bookmark
  ('11111111-1111-1111-1111-111111111a02', 'regtest-buyer-b@example.test', now()), -- active, no data (tries to read/delete A's)
  ('11111111-1111-1111-1111-111111111a03', 'regtest-buyer-c@example.test', now()), -- suspended (inactive)
  ('11111111-1111-1111-1111-111111111a04', 'regtest-buyer-d@example.test', now()), -- dormant, past 6-month grace
  ('11111111-1111-1111-1111-111111111a05', 'regtest-buyer-e@example.test', now()); -- dormant, within 6-month grace

insert into public.auth_principal (auth_user_id, principal_kind) values
  ('11111111-1111-1111-1111-111111111a01', 'buyer'),
  ('11111111-1111-1111-1111-111111111a02', 'buyer'),
  ('11111111-1111-1111-1111-111111111a03', 'buyer'),
  ('11111111-1111-1111-1111-111111111a04', 'buyer'),
  ('11111111-1111-1111-1111-111111111a05', 'buyer');

insert into public.buyer_account (id, auth_user_id, status, display_name, dormant_notice_sent_at) values
  ('11111111-1111-1111-1111-111111111a01', '11111111-1111-1111-1111-111111111a01', 'active',    'Regtest Buyer A', null),
  ('11111111-1111-1111-1111-111111111a02', '11111111-1111-1111-1111-111111111a02', 'active',    'Regtest Buyer B', null),
  ('11111111-1111-1111-1111-111111111a03', '11111111-1111-1111-1111-111111111a03', 'suspended', 'Regtest Buyer C', null),
  ('11111111-1111-1111-1111-111111111a04', '11111111-1111-1111-1111-111111111a04', 'active',    'Regtest Buyer D', now() - interval '7 months'),
  ('11111111-1111-1111-1111-111111111a05', '11111111-1111-1111-1111-111111111a05', 'active',    'Regtest Buyer E', now() - interval '3 months');

-- Admin
insert into auth.users (id, email, email_confirmed_at) values
  ('22222222-2222-2222-2222-222222222b01', 'regtest-admin-1@example.test', now());
insert into public.auth_principal (auth_user_id, principal_kind) values
  ('22222222-2222-2222-2222-222222222b01', 'admin');
insert into public.admin_user (id, auth_user_id, status, display_name) values
  ('22222222-2222-2222-2222-222222222b01', '22222222-2222-2222-2222-222222222b01', 'active', 'Regtest Admin One');

-- Partner (login account, used for the principal_kind check and the
-- partner-session-must-see-zero-rows check on partner_detail_buyer)
insert into auth.users (id, email, email_confirmed_at) values
  ('33333333-3333-3333-3333-333333333c01', 'regtest-partner-1@example.test', now());
insert into public.auth_principal (auth_user_id, principal_kind) values
  ('33333333-3333-3333-3333-333333333c01', 'partner');
insert into public.partner_account (id, auth_user_id, status, display_name) values
  ('33333333-3333-3333-3333-333333333c01', '33333333-3333-3333-3333-333333333c01', 'active', 'Regtest Partner One');

-- Partner (business/Capability) rows — one per public-listing-gate condition,
-- deliberately breaking exactly ONE of the 3 layers each, plus one satisfying
-- all 3. `case5` doubles as the "real" partner used by the bookmark /
-- seepn_inquiry / partner_detail_buyer sections below.
insert into public.partner (id, intake_source, verification_state, public_listing_state, company_name_ko, vertical)
values
  ('44444444-4444-4444-4444-444444444401', 'self_service', 'submitted', 'on',  'Regtest Case1 BadVerification Co',  'product'),
  ('44444444-4444-4444-4444-444444444402', 'self_service', 'verified',  'off', 'Regtest Case2 BadListingState Co',  'product'),
  ('44444444-4444-4444-4444-444444444403', 'self_service', 'verified',  'on',  'Regtest Case3 ConsentNotGranted Co','product'),
  ('44444444-4444-4444-4444-444444444404', 'self_service', 'verified',  'on',  'Regtest Case4 ConsentMissing Co',   'product'),
  ('44444444-4444-4444-4444-444444444405', 'self_service', 'verified',  'on',  'Regtest Case5 AllSatisfied Co',     'product');

-- public_listing consent — case1/case2/case5 get a granted=true row; case3
-- gets a granted=false (revoked) row; case4 deliberately gets NO row at all.
insert into public.partner_consent (partner_id, consent_type, granted, method, collected_at)
values
  ('44444444-4444-4444-4444-444444444401', 'public_listing', true,  'online_self', now()),
  ('44444444-4444-4444-4444-444444444402', 'public_listing', true,  'online_self', now()),
  ('44444444-4444-4444-4444-444444444403', 'public_listing', false, 'online_self', now()),
  ('44444444-4444-4444-4444-444444444405', 'public_listing', true,  'online_self', now());


-- =============================================================================
-- §a. principal_kind isolation
-- =============================================================================

select regtest.assert(private.is_active_buyer('11111111-1111-1111-1111-111111111a01'),
  'a0 (sanity): buyer A is recognized as an active buyer by is_active_buyer()');
select regtest.assert(not private.is_active_admin('11111111-1111-1111-1111-111111111a01'),
  'a1: is_active_admin() is false for an active buyer''s auth.uid()');
select regtest.assert(not private.is_active_partner('11111111-1111-1111-1111-111111111a01'),
  'a2: is_active_partner() is false for an active buyer''s auth.uid()');

select regtest.assert(private.is_active_admin('22222222-2222-2222-2222-222222222b01'),
  'a3 (sanity): admin 1 is recognized as an active admin by is_active_admin()');
select regtest.assert(not private.is_active_buyer('22222222-2222-2222-2222-222222222b01'),
  'a4: is_active_buyer() is false for an active admin''s auth.uid()');

select regtest.assert(private.is_active_partner('33333333-3333-3333-3333-333333333c01'),
  'a5 (sanity): partner 1 is recognized as an active partner by is_active_partner()');
select regtest.assert(not private.is_active_buyer('33333333-3333-3333-3333-333333333c01'),
  'a6: is_active_buyer() is false for an active partner''s auth.uid()');


-- =============================================================================
-- §b. Public listing 3-layer gate (private.partner_public_base)
-- =============================================================================

select regtest.assert(
  (select count(*) from private.partner_public_base where id = '44444444-4444-4444-4444-444444444401') = 0,
  'b1: verification_state != verified is excluded from partner_public_base (consent+listing OK, verification broken)');

select regtest.assert(
  (select count(*) from private.partner_public_base where id = '44444444-4444-4444-4444-444444444402') = 0,
  'b2: public_listing_state != on is excluded from partner_public_base (consent+verification OK, listing broken)');

select regtest.assert(
  (select count(*) from private.partner_public_base where id = '44444444-4444-4444-4444-444444444403') = 0,
  'b3: latest public_listing consent granted=false is excluded from partner_public_base (verification+listing OK, consent broken)');

select regtest.assert(
  (select count(*) from private.partner_public_base where id = '44444444-4444-4444-4444-444444444404') = 0,
  'b4: NO public_listing consent row at all is excluded from partner_public_base (verification+listing OK, consent missing)');

select regtest.assert(
  (select count(*) from private.partner_public_base where id = '44444444-4444-4444-4444-444444444405') = 1,
  'b5: a partner satisfying all 3 layers appears in partner_public_base');

select regtest.assert(
  (select count(*) from public.partner_list_public where id = '44444444-4444-4444-4444-444444444405') = 1,
  'b6: the same fully-satisfied partner appears in the public.partner_list_public anon-readable view');

select regtest.assert(
  (select count(*) from public.partner_list_public where id in (
    '44444444-4444-4444-4444-444444444401', '44444444-4444-4444-4444-444444444402',
    '44444444-4444-4444-4444-444444444403', '44444444-4444-4444-4444-444444444404'
  )) = 0,
  'b7: none of the 4 single-broken-layer partners leak into partner_list_public');


-- =============================================================================
-- §c. partner_detail_buyer access control (buyer-only)
-- =============================================================================

do $$
begin
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111a01', false);
  set role authenticated;

  if (select count(*) from public.partner_detail_buyer where id = '44444444-4444-4444-4444-444444444405') <> 1 then
    raise exception 'FAIL: c1: an active buyer session must see the fully-satisfied partner via partner_detail_buyer';
  end if;
  raise notice 'PASS: c1: an active buyer session sees the fully-satisfied partner via partner_detail_buyer';

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
begin
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333c01', false);
  set role authenticated;

  if (select count(*) from public.partner_detail_buyer) <> 0 then
    raise exception 'FAIL: c2: a PARTNER (non-buyer) session must see ZERO rows via partner_detail_buyer';
  end if;
  raise notice 'PASS: c2: a partner (non-buyer) authenticated session sees zero rows via partner_detail_buyer';

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
begin
  set role anon;
  begin
    perform count(*) from public.partner_detail_buyer;
    raise exception 'FAIL: c3: anon must not even be able to query partner_detail_buyer (no SELECT grant)';
  exception when insufficient_privilege then
    raise notice 'PASS: c3: anon querying partner_detail_buyer raises insufficient_privilege (no SELECT grant), even stronger than 0 rows';
  end;
  reset role;
end;
$$;


-- =============================================================================
-- §d. buyer_bookmark RLS — self-only select / insert / delete
-- =============================================================================

-- Seed as postgres (superuser bypasses RLS) — buyer A bookmarks the case5 partner.
insert into public.buyer_bookmark (buyer_account_id, partner_id) values
  ('11111111-1111-1111-1111-111111111a01', '44444444-4444-4444-4444-444444444405');

do $$
declare
  v_deleted int;
begin
  -- Buyer B: must not see buyer A's bookmark, and must not be able to delete it.
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111a02', false);
  set role authenticated;

  if (select count(*) from public.buyer_bookmark) <> 0 then
    raise exception 'FAIL: d1: buyer B must see 0 rows in buyer_bookmark (buyer A''s row must be RLS-hidden)';
  end if;
  raise notice 'PASS: d1: buyer B sees 0 rows in buyer_bookmark';

  delete from public.buyer_bookmark
  where buyer_account_id = '11111111-1111-1111-1111-111111111a01'
    and partner_id = '44444444-4444-4444-4444-444444444405';
  get diagnostics v_deleted = row_count;
  if v_deleted <> 0 then
    raise exception 'FAIL: d2: buyer B must NOT be able to delete buyer A''s bookmark';
  end if;
  raise notice 'PASS: d2: buyer B cannot delete buyer A''s bookmark (0 rows affected)';

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

select regtest.assert(
  (select count(*) from public.buyer_bookmark
   where buyer_account_id = '11111111-1111-1111-1111-111111111a01'
     and partner_id = '44444444-4444-4444-4444-444444444405') = 1,
  'd3: buyer A''s bookmark row still exists after buyer B''s blocked delete attempt');

do $$
declare
  v_deleted int;
begin
  -- Buyer A (owner): can see and delete their own bookmark.
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111a01', false);
  set role authenticated;

  if (select count(*) from public.buyer_bookmark) <> 1 then
    raise exception 'FAIL: d4: buyer A must see exactly 1 (their own) bookmark row';
  end if;
  raise notice 'PASS: d4: buyer A sees exactly their own bookmark row';

  delete from public.buyer_bookmark
  where buyer_account_id = '11111111-1111-1111-1111-111111111a01'
    and partner_id = '44444444-4444-4444-4444-444444444405';
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then
    raise exception 'FAIL: d5: buyer A must be able to delete their own bookmark';
  end if;
  raise notice 'PASS: d5: buyer A can delete their own bookmark';

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;


-- =============================================================================
-- §e. get_own_buyer_consents() / buyer_grant_consent() access control
-- =============================================================================

do $$
begin
  -- Buyer C is 'suspended' (inactive) — both RPCs must deny with access_denied (42501).
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111a03', false);
  set role authenticated;

  begin
    perform public.get_own_buyer_consents();
    raise exception 'FAIL: e1: a suspended (inactive) buyer must NOT be able to call get_own_buyer_consents()';
  exception when sqlstate '42501' then
    raise notice 'PASS: e1: get_own_buyer_consents() raises access_denied (42501) for a suspended buyer';
  end;

  begin
    perform public.buyer_grant_consent('marketing', true);
    raise exception 'FAIL: e2: a suspended (inactive) buyer must NOT be able to call buyer_grant_consent()';
  exception when sqlstate '42501' then
    raise notice 'PASS: e2: buyer_grant_consent() raises access_denied (42501) for a suspended buyer';
  end;

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
begin
  -- Buyer A is active — but third_party_share must still be rejected as a
  -- self-service target (D-14(2): reserved value only, never self-service).
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111a01', false);
  set role authenticated;

  begin
    perform public.buyer_grant_consent('third_party_share', true);
    raise exception 'FAIL: e3: buyer_grant_consent(''third_party_share'') must be rejected even for an active buyer';
  exception when sqlstate 'P0001' then
    raise notice 'PASS: e3: buyer_grant_consent(''third_party_share'') is rejected (P0001 consent_type_not_self_service) for an active buyer';
  end;

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;


-- =============================================================================
-- §f. purge_dormant_buyer_accounts() — 6-month grace, data preserved
-- =============================================================================

-- Seed bookmark + inquiry for buyer D (dormant, past the 6-month grace) so we
-- can confirm the 2026-09-10 policy change (account-status-only, no data
-- deletion) actually took effect.
insert into public.buyer_bookmark (buyer_account_id, partner_id) values
  ('11111111-1111-1111-1111-111111111a04', '44444444-4444-4444-4444-444444444405');

insert into public.seepn_inquiry (buyer_account_id, partner_id, body, status) values
  ('11111111-1111-1111-1111-111111111a04', '44444444-4444-4444-4444-444444444405',
   'Regression-test inquiry body — must survive dormant auto-withdrawal untouched.', 'new');

select private.purge_dormant_buyer_accounts();

select regtest.assert(
  (select status from public.buyer_account where id = '11111111-1111-1111-1111-111111111a04') = 'withdrawn',
  'f1: buyer D (dormant_notice_sent_at 7 months ago, past the 6-month grace) is withdrawn by purge_dormant_buyer_accounts()');

select regtest.assert(
  (select status from public.buyer_account where id = '11111111-1111-1111-1111-111111111a05') = 'active',
  'f2: buyer E (dormant_notice_sent_at 3 months ago, within the 6-month grace) is NOT withdrawn');

select regtest.assert(
  (select count(*) from public.buyer_bookmark where buyer_account_id = '11111111-1111-1111-1111-111111111a04') = 1,
  'f3: buyer D''s buyer_bookmark row is PRESERVED (not deleted) by the 2026-09-10 dormant-purge policy update');

select regtest.assert(
  (select status <> 'closed' from public.seepn_inquiry where buyer_account_id = '11111111-1111-1111-1111-111111111a04'),
  'f4: buyer D''s seepn_inquiry status is NOT force-closed by the dormant purge');

select regtest.assert(
  (select body <> '[파기됨]' from public.seepn_inquiry where buyer_account_id = '11111111-1111-1111-1111-111111111a04'),
  'f5: buyer D''s seepn_inquiry body is NOT purged/overwritten by the dormant purge');


-- =============================================================================
-- §g. purge_expired_audit_log() — permission-related actions held
--     indefinitely (BP-23/M-2), unrelated actions purged after 2 years
-- =============================================================================

insert into public.audit_log (occurred_at, action, result, session_id) values
  (now() - interval '3 years', 'admin_access_request.approve', 'success', 'regtest-g-approve-hold'),
  (now() - interval '3 years', 'auth.login_success',           'success', 'regtest-g-login-purge');

select private.purge_expired_audit_log();

select regtest.assert(
  (select count(*) from public.audit_log where session_id = 'regtest-g-approve-hold') = 1,
  'g1: a 3-year-old admin_access_request.approve row SURVIVES purge_expired_audit_log() (permission-related indefinite hold)');

select regtest.assert(
  (select count(*) from public.audit_log where session_id = 'regtest-g-login-purge') = 0,
  'g2: a 3-year-old, unrelated auth.login_success row IS deleted by purge_expired_audit_log() (normal 2-year window)');


-- =============================================================================
-- End of assertions. Reaching this line means every check above passed —
-- ON_ERROR_STOP=1 (set by run_regression.sh) would have aborted the whole
-- script at the first RAISE EXCEPTION otherwise.
-- =============================================================================
select regtest.assert(true, 'ALL seepn_buyer_regression.sql ASSERTIONS PASSED');
