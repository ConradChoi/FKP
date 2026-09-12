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
--   h. (added 2026-09-10, 20260910180000 GAP-C1) create_seepn_inquiry(uuid[], text)
--      multi-partner behaviour — 1..5 partners inserted into
--      seepn_inquiry_partner, >5 rejected, duplicate partner ids rejected,
--      a non-publicly-listed partner id rejected (partner_not_found)
--   i. (added 2026-09-11, 20260911100000 GAP-C3/EDGE-C11) B-12e operator
--      curation — admin_set_partner_featured() access control, and the
--      critical EDGE-C11 property: a partner designated "featured" while it
--      still satisfies the 3-layer public-listing gate disappears from
--      public.partner_featured_public THE MOMENT it stops satisfying that
--      gate (verification revoked / public_listing_state flipped off),
--      even though its partner_featured_pick.active row is untouched — i.e.
--      the curation feature cannot be used to route around the same gate
--      every other buyer-facing surface enforces.
--   j. (added 2026-09-12, 20260912100000, SUP-15/P6 dashboard) B-19
--      get_own_partner_inquiry_count() — self-only aggregate count (own
--      partner row's seepn_inquiry_partner rows only, another partner's
--      inquiries never counted), total-cumulative/status-agnostic count
--      (OQ-D2), zero-inquiry default, and non-partner callers (buyer/admin/
--      anon) all falling through to 0 or an EXECUTE-grant denial exactly
--      like get_own_partner_bookmark_count().
--   k. (added 2026-09-12, 20260912110000, 표준 카테고리 주1+서브2 재설계)
--      partner_set_standard_categories() / admin_set_partner_standard_
--      categories() — 주 1개 부분 유니크 인덱스, 서브 2개 초과 트리거, 원자적
--      전체 교체(직전 선택을 실제로 지우고 새로 넣는지), 중복/비활성/미존재
--      카테고리 거부, "완전 해제"(primary=null, subs=[]) 허용, Admin RPC의
--      권한 체크 + 감사로그, partner_category_public 뷰의 role 컬럼 노출,
--      그리고 레거시 백필 규칙(created_at 오름차순 1번째=primary,
--      2~3번째=sub, 4번째 이후는 role=null로 보존) 재현 검증.
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

-- Grant the regtest admin the seeded 'super_admin' role (20260825120000 §16)
-- so has_menu_permission()-gated RPCs (e.g. admin_set_partner_featured, §i
-- below) do not spuriously deny — super_admin is the INV-4 exception that
-- does not consult role_menu_permission at all, so this fixture never needs
-- updating when a new menu_code/action pair is added by a later migration.
insert into public.admin_user_role (admin_user_id, role_id)
select '22222222-2222-2222-2222-222222222b01', r.id from public.role r where r.code = 'super_admin';

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

-- 20260910180000 GAP-C1: seepn_inquiry no longer has a partner_id column —
-- referenced partner(s) go in the seepn_inquiry_partner join table.
insert into public.seepn_inquiry (id, buyer_account_id, body, status) values
  ('55555555-5555-5555-5555-555555555f01', '11111111-1111-1111-1111-111111111a04',
   'Regression-test inquiry body — must survive dormant auto-withdrawal untouched.', 'new');
insert into public.seepn_inquiry_partner (inquiry_id, partner_id) values
  ('55555555-5555-5555-5555-555555555f01', '44444444-4444-4444-4444-444444444405');

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
-- §h. create_seepn_inquiry(uuid[], text) multi-partner behaviour
--     (added 2026-09-10, 20260910180000, GAP-C1)
-- =============================================================================

-- 5 more fully-satisfied (verified/on/consented) partners, so combinations of
-- 3 and 6 distinct valid partner ids are available without reusing case5.
insert into public.partner (id, intake_source, verification_state, public_listing_state, company_name_ko, vertical)
values
  ('44444444-4444-4444-4444-444444444406', 'self_service', 'verified', 'on', 'Regtest Case6 Valid Co',  'product'),
  ('44444444-4444-4444-4444-444444444407', 'self_service', 'verified', 'on', 'Regtest Case7 Valid Co',  'product'),
  ('44444444-4444-4444-4444-444444444408', 'self_service', 'verified', 'on', 'Regtest Case8 Valid Co',  'product'),
  ('44444444-4444-4444-4444-444444444409', 'self_service', 'verified', 'on', 'Regtest Case9 Valid Co',  'product'),
  ('44444444-4444-4444-4444-444444444410', 'self_service', 'verified', 'on', 'Regtest Case10 Valid Co', 'product');

insert into public.partner_consent (partner_id, consent_type, granted, method, collected_at)
values
  ('44444444-4444-4444-4444-444444444406', 'public_listing', true, 'online_self', now()),
  ('44444444-4444-4444-4444-444444444407', 'public_listing', true, 'online_self', now()),
  ('44444444-4444-4444-4444-444444444408', 'public_listing', true, 'online_self', now()),
  ('44444444-4444-4444-4444-444444444409', 'public_listing', true, 'online_self', now()),
  ('44444444-4444-4444-4444-444444444410', 'public_listing', true, 'online_self', now());

-- NOTE on the exception-block pattern below: a bare `raise exception 'FAIL: ...'`
-- (no `using errcode`) defaults to SQLSTATE P0001 — the SAME code
-- create_seepn_inquiry raises for invalid_partner_count/duplicate_partner_ids.
-- If the FAIL branch's raise were left at the default P0001, a broken RPC that
-- wrongly SUCCEEDED would have its own "FAIL: ..." raise re-caught by
-- `exception when sqlstate 'P0001'` below and misreported as PASS. Each FAIL
-- raise in this section therefore uses an explicit, non-colliding SQLSTATE
-- ('ZZ001') so an unexpectedly-successful call always propagates as a real
-- failure instead of being swallowed by the very handler meant to catch the
-- RPC's own rejection.

do $$
declare
  v_id uuid;
begin
  -- h1: buyer B, 3 distinct valid partner ids -> success, exactly 3 rows land
  -- in seepn_inquiry_partner for the returned inquiry id.
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111a02', false);
  set role authenticated;

  select public.create_seepn_inquiry(
    array[
      '44444444-4444-4444-4444-444444444405',
      '44444444-4444-4444-4444-444444444406',
      '44444444-4444-4444-4444-444444444407'
    ]::uuid[],
    'Regression-test multi-partner inquiry body, long enough to pass the 20-char minimum.'
  ) into v_id;

  if (select count(*) from public.seepn_inquiry_partner where inquiry_id = v_id) <> 3 then
    raise exception 'FAIL: h1: create_seepn_inquiry with 3 partner ids must insert exactly 3 seepn_inquiry_partner rows' using errcode = 'ZZ001';
  end if;
  raise notice 'PASS: h1: create_seepn_inquiry with 3 partner ids inserts exactly 3 seepn_inquiry_partner rows';

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
begin
  -- h2: 6 distinct valid partner ids -> rejected (max 5), no row inserted.
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111a02', false);
  set role authenticated;

  begin
    perform public.create_seepn_inquiry(
      array[
        '44444444-4444-4444-4444-444444444405', '44444444-4444-4444-4444-444444444406',
        '44444444-4444-4444-4444-444444444407', '44444444-4444-4444-4444-444444444408',
        '44444444-4444-4444-4444-444444444409', '44444444-4444-4444-4444-444444444410'
      ]::uuid[],
      'Regression-test six-partner inquiry body, must be rejected before any insert happens.'
    );
    raise exception 'FAIL: h2: create_seepn_inquiry with 6 partner ids must be rejected (max 5)' using errcode = 'ZZ001';
  exception
    when sqlstate 'P0001' then
      raise notice 'PASS: h2: create_seepn_inquiry with 6 partner ids is rejected (P0001 invalid_partner_count)';
  end;

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
begin
  -- h3: duplicate partner ids in the array -> rejected, no row inserted.
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111a02', false);
  set role authenticated;

  begin
    perform public.create_seepn_inquiry(
      array[
        '44444444-4444-4444-4444-444444444408',
        '44444444-4444-4444-4444-444444444408'
      ]::uuid[],
      'Regression-test duplicate-partner-id inquiry body, must be rejected before any insert.'
    );
    raise exception 'FAIL: h3: create_seepn_inquiry with a duplicated partner id must be rejected' using errcode = 'ZZ001';
  exception
    when sqlstate 'P0001' then
      raise notice 'PASS: h3: create_seepn_inquiry with a duplicated partner id is rejected (P0001 duplicate_partner_ids)';
  end;

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
begin
  -- h4: one partner id (case1) fails the public-listing gate (verification_state
  -- != verified) -> the whole call is rejected as partner_not_found, even
  -- though the other id (case5) is fully valid.
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111a02', false);
  set role authenticated;

  begin
    perform public.create_seepn_inquiry(
      array[
        '44444444-4444-4444-4444-444444444401',
        '44444444-4444-4444-4444-444444444405'
      ]::uuid[],
      'Regression-test inquiry body referencing one gate-failing partner id, must be rejected.'
    );
    raise exception 'FAIL: h4: create_seepn_inquiry with one non-publicly-listed partner id must be rejected' using errcode = 'ZZ001';
  exception
    when sqlstate 'P0002' then
      raise notice 'PASS: h4: create_seepn_inquiry with one non-publicly-listed partner id is rejected (P0002 partner_not_found)';
  end;

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;


-- =============================================================================
-- §i. B-12e operator curation — admin_set_partner_featured() access control +
--     EDGE-C11 (added 2026-09-11, 20260911100000 GAP-C3)
-- =============================================================================

do $$
begin
  -- i1: a buyer (non-admin) session must be denied by admin_set_partner_featured().
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111a01', false);
  set role authenticated;

  begin
    perform public.admin_set_partner_featured('44444444-4444-4444-4444-444444444405'::uuid, true, null);
    raise exception 'FAIL: i1: a buyer session must NOT be able to call admin_set_partner_featured()' using errcode = 'ZZ001';
  exception when sqlstate '42501' then
    raise notice 'PASS: i1: admin_set_partner_featured() raises access_denied (42501) for a buyer session';
  end;

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
begin
  -- i2: a partner (non-admin) session must also be denied.
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333c01', false);
  set role authenticated;

  begin
    perform public.admin_set_partner_featured('44444444-4444-4444-4444-444444444405'::uuid, true, null);
    raise exception 'FAIL: i2: a partner session must NOT be able to call admin_set_partner_featured()' using errcode = 'ZZ001';
  exception when sqlstate '42501' then
    raise notice 'PASS: i2: admin_set_partner_featured() raises access_denied (42501) for a partner session';
  end;

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
declare
  v_partner_id uuid;
  v_active boolean;
  v_order integer;
begin
  -- i3: an active admin CAN feature a fully-gate-satisfying partner (case5),
  -- and it shows up via public.partner_featured_public.
  -- request.jwt.claims aal2: admin_set_partner_featured() is gated on
  -- private.is_aal2() (like every other admin-mutation RPC in this schema),
  -- which reads auth.jwt()->>'aal' — an aal1-only session (the default when
  -- only request.jwt.claim.sub is set) would be denied even with the
  -- super_admin role granted above.
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222b01', false);
  perform set_config('request.jwt.claims', '{"aal":"aal2"}', false);
  set role authenticated;

  select f.partner_id, f.active, f.display_order
  into v_partner_id, v_active, v_order
  from public.admin_set_partner_featured('44444444-4444-4444-4444-444444444405'::uuid, true, 0) f;

  if v_partner_id is null or v_active is not true or v_order <> 0 then
    raise exception 'FAIL: i3: admin_set_partner_featured() must return the upserted (partner_id, active=true, display_order=0) row' using errcode = 'ZZ001';
  end if;
  raise notice 'PASS: i3: an active admin can feature a fully-gate-satisfying partner, RPC returns the upserted row';

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '', false);
end;
$$;

select regtest.assert(
  (select count(*) from public.partner_featured_public where id = '44444444-4444-4444-4444-444444444405') = 1,
  'i4: the featured, fully-gate-satisfying partner (case5) appears in public.partner_featured_public');

do $$
begin
  -- i5: featuring a partner that does NOT currently satisfy the 3-layer gate
  -- (case1: verification_state='submitted', not 'verified') is ALLOWED at
  -- write time (admin may pre-designate before verification lands) but must
  -- NOT appear in the public view — the gate is enforced at read time.
  -- request.jwt.claims aal2: admin_set_partner_featured() is gated on
  -- private.is_aal2() (like every other admin-mutation RPC in this schema),
  -- which reads auth.jwt()->>'aal' — an aal1-only session (the default when
  -- only request.jwt.claim.sub is set) would be denied even with the
  -- super_admin role granted above.
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222b01', false);
  perform set_config('request.jwt.claims', '{"aal":"aal2"}', false);
  set role authenticated;

  perform public.admin_set_partner_featured('44444444-4444-4444-4444-444444444401'::uuid, true, 1);

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '', false);
end;
$$;

select regtest.assert(
  (select active from public.partner_featured_pick where partner_id = '44444444-4444-4444-4444-444444444401') = true,
  'i5a: partner_featured_pick.active=true for the gate-failing partner (write succeeded, as designed)');

select regtest.assert(
  (select count(*) from public.partner_featured_public where id = '44444444-4444-4444-4444-444444444401') = 0,
  'i5b: EDGE-C11: a partner that never satisfied the 3-layer gate does NOT appear in public.partner_featured_public, even though its featured-pick row is active=true');

-- =============================================================================
-- §i (core EDGE-C11 scenario): feature a partner that CURRENTLY satisfies
-- the gate, confirm it is visible, then flip it private (mirrors the
-- screen-spec's own EDGE-C11 wording: "그 파트너가 나중에 비공개 전환되거나
-- 검증이 취소되면 추천 노출에서도 즉시 빠져야 한다") and confirm it
-- disappears from public.partner_featured_public WITHOUT touching
-- partner_featured_pick at all.
-- =============================================================================

do $$
begin
  -- request.jwt.claims aal2: admin_set_partner_featured() is gated on
  -- private.is_aal2() (like every other admin-mutation RPC in this schema),
  -- which reads auth.jwt()->>'aal' — an aal1-only session (the default when
  -- only request.jwt.claim.sub is set) would be denied even with the
  -- super_admin role granted above.
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222b01', false);
  perform set_config('request.jwt.claims', '{"aal":"aal2"}', false);
  set role authenticated;

  -- case6 was inserted in §h as verification_state='verified',
  -- public_listing_state='on', with a granted public_listing consent — i.e.
  -- it currently satisfies the 3-layer gate.
  perform public.admin_set_partner_featured('44444444-4444-4444-4444-444444444406'::uuid, true, 2);

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '', false);
end;
$$;

select regtest.assert(
  (select count(*) from public.partner_featured_public where id = '44444444-4444-4444-4444-444444444406') = 1,
  'i6: case6 (currently gate-satisfying) appears in public.partner_featured_public right after being featured');

-- Flip case6 private (as postgres, bypassing RLS — the same fixture-seeding
-- privilege already used throughout this file). No write to
-- partner_featured_pick happens here at all.
update public.partner set public_listing_state = 'off' where id = '44444444-4444-4444-4444-444444444406';

select regtest.assert(
  (select active from public.partner_featured_pick where partner_id = '44444444-4444-4444-4444-444444444406') = true,
  'i7: case6''s partner_featured_pick row is UNCHANGED (still active=true) after being made private — this migration never touches that table when a partner''s own state changes');

select regtest.assert(
  (select count(*) from public.partner_featured_public where id = '44444444-4444-4444-4444-444444444406') = 0,
  'i8: EDGE-C11 (core case): case6 disappears from public.partner_featured_public THE MOMENT it goes private, even though it is still actively featured in partner_featured_pick — the gate is inherited from partner_list_public, not evaluated separately');

-- Restore case6 to public for good measure (does not affect any assertion
-- after this point, but keeps the fixture state predictable for anyone
-- extending this file later).
update public.partner set public_listing_state = 'on' where id = '44444444-4444-4444-4444-444444444406';

select regtest.assert(
  (select count(*) from public.partner_featured_public where id = '44444444-4444-4444-4444-444444444406') = 1,
  'i9: case6 reappears in public.partner_featured_public once public_listing_state is restored to ''on'' (confirms i8 was the gate, not a stale/cached row)');

do $$
begin
  -- i10: unsetting (p_featured=false) removes case5 from the public view
  -- even though case5 itself still fully satisfies the 3-layer gate.
  -- request.jwt.claims aal2: admin_set_partner_featured() is gated on
  -- private.is_aal2() (like every other admin-mutation RPC in this schema),
  -- which reads auth.jwt()->>'aal' — an aal1-only session (the default when
  -- only request.jwt.claim.sub is set) would be denied even with the
  -- super_admin role granted above.
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222b01', false);
  perform set_config('request.jwt.claims', '{"aal":"aal2"}', false);
  set role authenticated;

  perform public.admin_set_partner_featured('44444444-4444-4444-4444-444444444405'::uuid, false, null);

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '', false);
end;
$$;

select regtest.assert(
  (select count(*) from public.partner_featured_public where id = '44444444-4444-4444-4444-444444444405') = 0,
  'i10: case5 disappears from public.partner_featured_public after being explicitly un-featured (active=false), independent of its own gate status');

select regtest.assert(
  (select count(*) from private.partner_public_base where id = '44444444-4444-4444-4444-444444444405') = 1,
  'i10b (sanity): case5 itself is still fully gate-satisfying — i10''s disappearance is caused by un-featuring, not by a gate change');

do $$
begin
  -- i11: a non-admin authenticated session (buyer) must see ZERO rows via a
  -- direct select on partner_featured_pick (admin-only RLS) — the public
  -- read path is partner_featured_public only.
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111a01', false);
  set role authenticated;

  if (select count(*) from public.partner_featured_pick) <> 0 then
    raise exception 'FAIL: i11: a buyer session must see ZERO rows via a direct select on partner_featured_pick (admin-only RLS)';
  end if;
  raise notice 'PASS: i11: a buyer session sees zero rows via a direct select on partner_featured_pick';

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
begin
  -- i12: anon must not even be able to query partner_featured_pick directly
  -- (no SELECT grant at all — mirrors §c3's partner_detail_buyer check).
  set role anon;
  begin
    perform count(*) from public.partner_featured_pick;
    raise exception 'FAIL: i12: anon must not even be able to query partner_featured_pick (no SELECT grant)';
  exception when insufficient_privilege then
    raise notice 'PASS: i12: anon querying partner_featured_pick raises insufficient_privilege (no SELECT grant)';
  end;
  reset role;
end;
$$;

do $$
begin
  -- i13: anon CAN query partner_featured_public (the sanctioned public
  -- read path) and see the currently-featured, gate-satisfying set.
  set role anon;
  if (select count(*) from public.partner_featured_public where id = '44444444-4444-4444-4444-444444444406') <> 1 then
    raise exception 'FAIL: i13: anon must be able to see case6 via public.partner_featured_public';
  end if;
  raise notice 'PASS: i13: anon sees the currently-featured, gate-satisfying partner via public.partner_featured_public';
  reset role;
end;
$$;


-- =============================================================================
-- §j. get_own_partner_inquiry_count() (added 2026-09-12, 20260912100000,
--     SUP-15/P6 dashboard) — self-only aggregate count, cross-partner
--     isolation, zero-count default, non-partner callers fall through to 0
-- =============================================================================

-- Two more partner-login accounts + owned partner rows, dedicated to this
-- section (not reusing c01/case5 so this section stays independent of
-- earlier sections' state).
insert into auth.users (id, email, email_confirmed_at) values
  ('33333333-3333-3333-3333-333333333c02', 'regtest-partner-2@example.test', now()),
  ('33333333-3333-3333-3333-333333333c03', 'regtest-partner-3@example.test', now());

insert into public.auth_principal (auth_user_id, principal_kind) values
  ('33333333-3333-3333-3333-333333333c02', 'partner'),
  ('33333333-3333-3333-3333-333333333c03', 'partner');

insert into public.partner_account (id, auth_user_id, status, display_name) values
  ('33333333-3333-3333-3333-333333333c02', '33333333-3333-3333-3333-333333333c02', 'active', 'Regtest Partner Two (inquiry-owner)'),
  ('33333333-3333-3333-3333-333333333c03', '33333333-3333-3333-3333-333333333c03', 'active', 'Regtest Partner Three (zero-inquiry)');

insert into public.partner (id, owner_account_id, intake_source, verification_state, public_listing_state, company_name_ko, vertical)
values
  ('44444444-4444-4444-4444-444444444411', '33333333-3333-3333-3333-333333333c02', 'self_service', 'verified', 'on', 'Regtest Case11 InquiryOwner Co',       'product'),
  ('44444444-4444-4444-4444-444444444412', '33333333-3333-3333-3333-333333333c03', 'self_service', 'verified', 'on', 'Regtest Case12 ZeroInquiry Co',        'product'),
  ('44444444-4444-4444-4444-444444444413', null,                                   'self_service', 'verified', 'on', 'Regtest Case13 OtherUnownedPartner Co','product');

-- Buyer A creates 2 inquiries referencing case11 (owned by c02, one 'new'
-- and one 'closed' — deliberately mixed status to confirm OQ-D2's
-- "total cumulative, no status filter") and 1 inquiry referencing case13
-- (a different, unowned partner) that must never be counted toward c02.
insert into public.seepn_inquiry (id, buyer_account_id, body, status) values
  ('55555555-5555-5555-5555-555555555f02', '11111111-1111-1111-1111-111111111a01', 'Regression-test j1 inquiry body, long enough to satisfy the length check.', 'new'),
  ('55555555-5555-5555-5555-555555555f03', '11111111-1111-1111-1111-111111111a01', 'Regression-test j2 inquiry body, long enough to satisfy the length check.', 'closed'),
  ('55555555-5555-5555-5555-555555555f04', '11111111-1111-1111-1111-111111111a01', 'Regression-test j3 inquiry body referencing a different, unowned partner.', 'new');

insert into public.seepn_inquiry_partner (inquiry_id, partner_id) values
  ('55555555-5555-5555-5555-555555555f02', '44444444-4444-4444-4444-444444444411'),
  ('55555555-5555-5555-5555-555555555f03', '44444444-4444-4444-4444-444444444411'),
  ('55555555-5555-5555-5555-555555555f04', '44444444-4444-4444-4444-444444444413');

do $$
declare
  v_count integer;
begin
  -- j1: partner Two (c02, owns case11) sees exactly 2 — both statuses
  -- ('new' and 'closed') counted, confirming OQ-D2 ("total cumulative, no
  -- status filter"), and the case13 inquiry (a different, unowned partner)
  -- is NOT counted.
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333c02', false);
  set role authenticated;

  select public.get_own_partner_inquiry_count() into v_count;
  if v_count <> 2 then
    raise exception 'FAIL: j1: partner Two must see exactly 2 (own inquiries only, status-agnostic), got %', v_count using errcode = 'ZZ001';
  end if;
  raise notice 'PASS: j1: partner Two sees exactly 2 (own inquiries only, both new+closed counted, other partner excluded)';

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
declare
  v_count integer;
begin
  -- j2: partner Three (c03, owns case12, zero inquiries referencing it)
  -- sees exactly 0 — confirms the zero-inquiry default, not an exception.
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333c03', false);
  set role authenticated;

  select public.get_own_partner_inquiry_count() into v_count;
  if v_count <> 0 then
    raise exception 'FAIL: j2: partner Three (zero referencing inquiries) must see exactly 0, got %', v_count using errcode = 'ZZ001';
  end if;
  raise notice 'PASS: j2: partner Three (zero referencing inquiries) sees exactly 0';

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
declare
  v_count integer;
begin
  -- j3: a buyer session (not a partner at all) must NOT error and must NOT
  -- see anyone's inquiry count — private.current_partner_id() resolves to
  -- null for a buyer, so the aggregate falls through to 0, exactly like
  -- get_own_partner_bookmark_count()'s documented behaviour for a
  -- non-partner caller.
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111a01', false);
  set role authenticated;

  select public.get_own_partner_inquiry_count() into v_count;
  if v_count <> 0 then
    raise exception 'FAIL: j3: a buyer session calling get_own_partner_inquiry_count() must see 0 (not another partner''s count, not an error), got %', v_count using errcode = 'ZZ001';
  end if;
  raise notice 'PASS: j3: a buyer session calling get_own_partner_inquiry_count() sees 0 (non-partner caller, same as bookmark_count)';

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
declare
  v_count integer;
begin
  -- j4: an admin session (also not a partner) must equally fall through to 0.
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222b01', false);
  set role authenticated;

  select public.get_own_partner_inquiry_count() into v_count;
  if v_count <> 0 then
    raise exception 'FAIL: j4: an admin session calling get_own_partner_inquiry_count() must see 0, got %', v_count using errcode = 'ZZ001';
  end if;
  raise notice 'PASS: j4: an admin session calling get_own_partner_inquiry_count() sees 0 (non-partner caller, same as bookmark_count)';

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
begin
  -- j5: anon must not even be able to call it (no EXECUTE grant), matching
  -- get_own_partner_bookmark_count()'s grant posture (authenticated only).
  set role anon;
  begin
    perform public.get_own_partner_inquiry_count();
    raise exception 'FAIL: j5: anon must NOT be able to call get_own_partner_inquiry_count() (no EXECUTE grant)' using errcode = 'ZZ001';
  exception when insufficient_privilege then
    raise notice 'PASS: j5: anon calling get_own_partner_inquiry_count() raises insufficient_privilege (no EXECUTE grant)';
  end;
  reset role;
end;
$$;


-- =============================================================================
-- §k. 표준 카테고리 주1+서브2 재설계 (added 2026-09-12, 20260912110000)
-- =============================================================================

-- Fixtures: 5 active standard_category rows + 1 inactive, 2 partner-login
-- accounts each owning one partner row (independent of earlier sections).
insert into public.standard_category (id, source, is_active) values
  ('66666666-6666-6666-6666-666666666601', 'narajangter_standard', true),  -- catA
  ('66666666-6666-6666-6666-666666666602', 'narajangter_standard', true),  -- catB
  ('66666666-6666-6666-6666-666666666603', 'narajangter_standard', true),  -- catC
  ('66666666-6666-6666-6666-666666666604', 'narajangter_standard', true),  -- catD
  ('66666666-6666-6666-6666-666666666605', 'narajangter_standard', false); -- catF (inactive)

insert into auth.users (id, email, email_confirmed_at) values
  ('33333333-3333-3333-3333-333333333c04', 'regtest-partner-4@example.test', now()),
  ('33333333-3333-3333-3333-333333333c05', 'regtest-partner-5@example.test', now());

insert into public.auth_principal (auth_user_id, principal_kind) values
  ('33333333-3333-3333-3333-333333333c04', 'partner'),
  ('33333333-3333-3333-3333-333333333c05', 'partner');

insert into public.partner_account (id, auth_user_id, status, display_name) values
  ('33333333-3333-3333-3333-333333333c04', '33333333-3333-3333-3333-333333333c04', 'active', 'Regtest Partner Four (category-owner)'),
  ('33333333-3333-3333-3333-333333333c05', '33333333-3333-3333-3333-333333333c05', 'active', 'Regtest Partner Five (admin-managed)');

-- case21: self-service, owned by c04, and made fully public-listing-gate-
-- satisfying so §k12 (partner_category_public exposure) can reuse it.
insert into public.partner (id, owner_account_id, intake_source, verification_state, public_listing_state, company_name_ko, vertical)
values
  ('44444444-4444-4444-4444-444444444421', '33333333-3333-3333-3333-333333333c04', 'self_service', 'verified', 'on', 'Regtest Case21 CategoryOwner Co', 'product'),
  ('44444444-4444-4444-4444-444444444422', '33333333-3333-3333-3333-333333333c05', 'self_service', 'draft',    'off','Regtest Case22 AdminManaged Co',  'product');

insert into public.partner_consent (partner_id, consent_type, granted, method, collected_at)
values ('44444444-4444-4444-4444-444444444421', 'public_listing', true, 'online_self', now());

do $$
declare
  v_primary_count integer;
  v_sub_count integer;
begin
  -- k1: partner Four sets primary=catA + sub={catB,catC} via the self-service
  -- RPC — all 3 rows land with the correct role.
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333c04', false);
  set role authenticated;

  perform public.partner_set_standard_categories(
    '66666666-6666-6666-6666-666666666601',
    array['66666666-6666-6666-6666-666666666602', '66666666-6666-6666-6666-666666666603']::uuid[]
  );

  select count(*) into v_primary_count from public.partner_standard_category
    where partner_id = '44444444-4444-4444-4444-444444444421' and role = 'primary';
  select count(*) into v_sub_count from public.partner_standard_category
    where partner_id = '44444444-4444-4444-4444-444444444421' and role = 'sub';
  if v_primary_count <> 1 or v_sub_count <> 2 then
    raise exception 'FAIL: k1: expected 1 primary + 2 sub rows after partner_set_standard_categories, got % primary / % sub', v_primary_count, v_sub_count using errcode = 'ZZ001';
  end if;
  raise notice 'PASS: k1: partner_set_standard_categories writes exactly 1 primary + 2 sub rows';

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
declare
  v_old_present integer;
  v_new_primary uuid;
  v_total integer;
begin
  -- k2: calling the RPC again with a DIFFERENT final state atomically
  -- replaces the previous selection (D-3) — old rows gone, only the new
  -- state remains, in the same statement.
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333c04', false);
  set role authenticated;

  perform public.partner_set_standard_categories('66666666-6666-6666-6666-666666666604', '{}'::uuid[]);

  select count(*) into v_old_present from public.partner_standard_category
    where partner_id = '44444444-4444-4444-4444-444444444421'
      and standard_category_id in ('66666666-6666-6666-6666-666666666601', '66666666-6666-6666-6666-666666666602', '66666666-6666-6666-6666-666666666603')
      and role is not null;
  select count(*) into v_total from public.partner_standard_category
    where partner_id = '44444444-4444-4444-4444-444444444421' and role is not null;
  select standard_category_id into v_new_primary from public.partner_standard_category
    where partner_id = '44444444-4444-4444-4444-444444444421' and role = 'primary';

  if v_old_present <> 0 or v_total <> 1 or v_new_primary <> '66666666-6666-6666-6666-666666666604' then
    raise exception 'FAIL: k2: atomic replace must remove every previous role-tagged row and leave only the new primary, got % old rows / % total / new_primary=%', v_old_present, v_total, v_new_primary using errcode = 'ZZ001';
  end if;
  raise notice 'PASS: k2: partner_set_standard_categories atomically replaces the entire prior selection';

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
begin
  -- k3: more than 2 sub ids is rejected.
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333c04', false);
  set role authenticated;
  begin
    perform public.partner_set_standard_categories(
      '66666666-6666-6666-6666-666666666601',
      array['66666666-6666-6666-6666-666666666602', '66666666-6666-6666-6666-666666666603', '66666666-6666-6666-6666-666666666604']::uuid[]
    );
    raise exception 'FAIL: k3: 3 sub ids must be rejected (max 2)' using errcode = 'ZZ001';
  exception when sqlstate 'P0001' then
    raise notice 'PASS: k3: > 2 sub ids raises (too_many_sub_categories): %', sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
begin
  -- k4: same category as both primary and sub is rejected.
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333c04', false);
  set role authenticated;
  begin
    perform public.partner_set_standard_categories(
      '66666666-6666-6666-6666-666666666601',
      array['66666666-6666-6666-6666-666666666601']::uuid[]
    );
    raise exception 'FAIL: k4: primary id duplicated inside sub_ids must be rejected' using errcode = 'ZZ001';
  exception when sqlstate 'P0001' then
    raise notice 'PASS: k4: primary id duplicated in sub_ids raises (duplicate_category_role): %', sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
begin
  -- k5: sub ids without a primary is rejected (screen-spec §6 "서브만 있고
  -- 주가 없는 상태" defensive check) — NOT the "full clear" escape hatch,
  -- because sub_ids is non-empty here.
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333c04', false);
  set role authenticated;
  begin
    perform public.partner_set_standard_categories(null, array['66666666-6666-6666-6666-666666666602']::uuid[]);
    raise exception 'FAIL: k5: sub ids with a null primary must be rejected' using errcode = 'ZZ001';
  exception when sqlstate 'P0001' then
    raise notice 'PASS: k5: sub ids with null primary raises (sub_category_requires_primary): %', sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
declare
  v_invalid_uuid uuid := '99999999-9999-9999-9999-999999999999';
begin
  -- k6: a nonexistent / inactive category id is rejected for both primary
  -- and sub roles.
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333c04', false);
  set role authenticated;

  begin
    perform public.partner_set_standard_categories(v_invalid_uuid, '{}'::uuid[]);
    raise exception 'FAIL: k6a: a nonexistent primary category id must be rejected' using errcode = 'ZZ001';
  exception when sqlstate 'P0002' then
    raise notice 'PASS: k6a: nonexistent primary category id raises (invalid_primary_category): %', sqlerrm;
  end;

  begin
    perform public.partner_set_standard_categories('66666666-6666-6666-6666-666666666605', '{}'::uuid[]);
    raise exception 'FAIL: k6b: an inactive (is_active=false) primary category id must be rejected' using errcode = 'ZZ001';
  exception when sqlstate 'P0002' then
    raise notice 'PASS: k6b: inactive primary category id raises (invalid_primary_category): %', sqlerrm;
  end;

  begin
    perform public.partner_set_standard_categories('66666666-6666-6666-6666-666666666601', array['66666666-6666-6666-6666-666666666605']::uuid[]);
    raise exception 'FAIL: k6c: an inactive sub category id must be rejected' using errcode = 'ZZ001';
  exception when sqlstate 'P0002' then
    raise notice 'PASS: k6c: inactive sub category id raises (invalid_sub_category): %', sqlerrm;
  end;

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
declare
  v_total integer;
begin
  -- k7: "full clear" (primary=null, subs=[]) is the one allowed null-primary
  -- shape — screen-spec EDGE-9 / §9 "카테고리 0개 선택" must stay reachable.
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333c04', false);
  set role authenticated;

  perform public.partner_set_standard_categories(null, '{}'::uuid[]);

  select count(*) into v_total from public.partner_standard_category
    where partner_id = '44444444-4444-4444-4444-444444444421' and role is not null;
  if v_total <> 0 then
    raise exception 'FAIL: k7: full-clear call (null, {}) must leave zero role-tagged rows, got %', v_total using errcode = 'ZZ001';
  end if;
  raise notice 'PASS: k7: partner_set_standard_categories(null, {}) fully clears the selection (0 selected state stays reachable)';

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
begin
  -- k8: the partial unique index rejects a second directly-inserted
  -- role='primary' row for the same partner (bypassing the RPC, run as the
  -- unrestricted migration role) — the DB-level backstop behind the RPC's
  -- own application-level check.
  insert into public.partner_standard_category (partner_id, standard_category_id, role)
  values ('44444444-4444-4444-4444-444444444421', '66666666-6666-6666-6666-666666666601', 'primary');
  begin
    insert into public.partner_standard_category (partner_id, standard_category_id, role)
    values ('44444444-4444-4444-4444-444444444421', '66666666-6666-6666-6666-666666666602', 'primary');
    raise exception 'FAIL: k8: a second role=primary row for the same partner must violate the partial unique index' using errcode = 'ZZ001';
  exception when unique_violation then
    raise notice 'PASS: k8: idx_partner_standard_category_one_primary rejects a 2nd primary row for the same partner';
  end;
end;
$$;

do $$
begin
  -- k9: the sub-limit trigger rejects a 3rd directly-inserted role='sub' row
  -- for the same partner.
  insert into public.partner_standard_category (partner_id, standard_category_id, role)
  values
    ('44444444-4444-4444-4444-444444444421', '66666666-6666-6666-6666-666666666602', 'sub'),
    ('44444444-4444-4444-4444-444444444421', '66666666-6666-6666-6666-666666666603', 'sub');
  begin
    insert into public.partner_standard_category (partner_id, standard_category_id, role)
    values ('44444444-4444-4444-4444-444444444421', '66666666-6666-6666-6666-666666666604', 'sub');
    raise exception 'FAIL: k9: a 3rd role=sub row for the same partner must be rejected by the trigger' using errcode = 'ZZ001';
  exception when sqlstate 'P0001' then
    raise notice 'PASS: k9: trg_partner_category_role_limits rejects a 3rd sub row for the same partner: %', sqlerrm;
  end;

  -- Clean up this raw-insert fixture state so it doesn't leak into k10+.
  delete from public.partner_standard_category where partner_id = '44444444-4444-4444-4444-444444444421';
end;
$$;

do $$
begin
  -- k10: a non-admin session (a plain partner login) cannot call the Admin
  -- RPC at all.
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333c04', false);
  set role authenticated;
  begin
    perform public.admin_set_partner_standard_categories(
      '44444444-4444-4444-4444-444444444422', '66666666-6666-6666-6666-666666666601', '{}'::uuid[]
    );
    raise exception 'FAIL: k10: a partner session must not be able to call admin_set_partner_standard_categories' using errcode = 'ZZ001';
  exception when sqlstate '42501' then
    raise notice 'PASS: k10: a partner session calling admin_set_partner_standard_categories raises access_denied (42501)';
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
declare
  v_primary_count integer;
  v_sub_count integer;
  v_audit_count integer;
begin
  -- k11: an admin session (super_admin, from §b's fixture) CAN call the
  -- Admin RPC for an arbitrary partner id, and it writes the same
  -- role-tagged shape + an audit_log row (PSO-2). request.jwt.claims aal2:
  -- admin_set_partner_standard_categories() is gated on private.is_aal2()
  -- (like every other admin-mutation RPC in this schema, see i3's fixture).
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222b01', false);
  perform set_config('request.jwt.claims', '{"aal":"aal2"}', false);
  set role authenticated;

  perform public.admin_set_partner_standard_categories(
    '44444444-4444-4444-4444-444444444422',
    '66666666-6666-6666-6666-666666666601',
    array['66666666-6666-6666-6666-666666666602']::uuid[]
  );

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '', false);

  -- Verification reads run AFTER `reset role` (back to the unrestricted
  -- migration superuser) — partner_standard_category's admin SELECT policy
  -- itself requires private.is_aal2(), and is_aal2() is a plain (non
  -- SECURITY DEFINER) function that needs schema `auth` USAGE the bare
  -- `authenticated` role doesn't have in this bootstrap stub. Every other
  -- admin-path verification in this file (e.g. i3) sidesteps this the same
  -- way, by reading the RPC's own RETURNING/RETURN value instead of a
  -- separate post-call SELECT while still `set role authenticated`.
  select count(*) into v_primary_count from public.partner_standard_category
    where partner_id = '44444444-4444-4444-4444-444444444422' and role = 'primary';
  select count(*) into v_sub_count from public.partner_standard_category
    where partner_id = '44444444-4444-4444-4444-444444444422' and role = 'sub';
  if v_primary_count <> 1 or v_sub_count <> 1 then
    raise exception 'FAIL: k11a: admin_set_partner_standard_categories must write 1 primary + 1 sub row, got % / %', v_primary_count, v_sub_count using errcode = 'ZZ001';
  end if;
  raise notice 'PASS: k11a: an admin (super_admin) session can call admin_set_partner_standard_categories for an arbitrary partner';

  select count(*) into v_audit_count from public.audit_log
    where action = 'admin_partner.update'
      and target_table = 'partner_standard_category'
      and target_id = '44444444-4444-4444-4444-444444444422';
  if v_audit_count < 1 then
    raise exception 'FAIL: k11b: admin_set_partner_standard_categories must write an audit_log row (PSO-2)' using errcode = 'ZZ001';
  end if;
  raise notice 'PASS: k11b: admin_set_partner_standard_categories writes an audit_log row (action=admin_partner.update)';
end;
$$;

do $$
declare
  v_role text;
begin
  -- k12: partner_category_public now exposes the role column (OQ-2), still
  -- gated by the same 3-layer public-listing join (D-8 unchanged) — case21
  -- (verified/on/consent-granted, from k7 onward has 0 categories though, so
  -- re-seed it here with a role='primary' row directly to check exposure).
  insert into public.partner_standard_category (partner_id, standard_category_id, role)
  values ('44444444-4444-4444-4444-444444444421', '66666666-6666-6666-6666-666666666601', 'primary');

  select role into v_role from public.partner_category_public
    where partner_id = '44444444-4444-4444-4444-444444444421' and standard_category_id = '66666666-6666-6666-6666-666666666601';
  if v_role is distinct from 'primary' then
    raise exception 'FAIL: k12a: partner_category_public must expose role=''primary'' for case21''s designated category, got %', v_role using errcode = 'ZZ001';
  end if;
  raise notice 'PASS: k12a: partner_category_public exposes the role column for a gate-satisfying partner';

  -- case22 is draft/off (never satisfied the 3-layer gate) — its k11 rows
  -- must NOT leak through partner_category_public despite having role data.
  if exists (select 1 from public.partner_category_public where partner_id = '44444444-4444-4444-4444-444444444422') then
    raise exception 'FAIL: k12b: partner_category_public must not expose a non-public-listed partner (case22) even though it has role-tagged rows' using errcode = 'ZZ001';
  end if;
  raise notice 'PASS: k12b: partner_category_public still excludes a gate-FAILING partner (case22) — role column addition did not weaken the join gate';
end;
$$;

do $$
declare
  v_total_rows integer;
  v_role1 text;
  v_role2 text;
  v_role3 text;
  v_role4 text;
begin
  -- k13: reproduces the OQ-3/OQ-4 backfill rule (created_at ascending,
  -- 1st=primary, 2nd-3rd=sub, 4th+ preserved with role=null) by replaying
  -- the exact same ranked-UPDATE pattern the migration's one-time backfill
  -- used (20260912110000 §2), against freshly raw-inserted "legacy-style"
  -- rows (role left null, as every pre-migration row was). This can't
  -- exercise the migration's own backfill statement a second time (it only
  -- runs once, already applied to an empty table earlier in this same
  -- replay) — it verifies the RANKING LOGIC ITSELF produces the documented
  -- outcome, which is the part most likely to have an off-by-one bug.
  insert into public.partner (id, owner_account_id, intake_source, verification_state, public_listing_state, company_name_ko, vertical)
  values ('44444444-4444-4444-4444-444444444423', null, 'self_service', 'draft', 'off', 'Regtest Case23 LegacyOverflow Co', 'product');

  insert into public.partner_standard_category (partner_id, standard_category_id, created_at, role) values
    ('44444444-4444-4444-4444-444444444423', '66666666-6666-6666-6666-666666666601', now() - interval '5 days', null),
    ('44444444-4444-4444-4444-444444444423', '66666666-6666-6666-6666-666666666602', now() - interval '4 days', null),
    ('44444444-4444-4444-4444-444444444423', '66666666-6666-6666-6666-666666666603', now() - interval '3 days', null),
    ('44444444-4444-4444-4444-444444444423', '66666666-6666-6666-6666-666666666604', now() - interval '2 days', null);

  with ranked as (
    select
      partner_id, standard_category_id,
      row_number() over (partition by partner_id order by created_at asc, standard_category_id asc) as rn
    from public.partner_standard_category
    where partner_id = '44444444-4444-4444-4444-444444444423'
  )
  update public.partner_standard_category psc
  set role = case when r.rn = 1 then 'primary' when r.rn in (2, 3) then 'sub' else null end
  from ranked r
  where r.partner_id = psc.partner_id and r.standard_category_id = psc.standard_category_id;

  select role into v_role1 from public.partner_standard_category where partner_id = '44444444-4444-4444-4444-444444444423' and standard_category_id = '66666666-6666-6666-6666-666666666601';
  select role into v_role2 from public.partner_standard_category where partner_id = '44444444-4444-4444-4444-444444444423' and standard_category_id = '66666666-6666-6666-6666-666666666602';
  select role into v_role3 from public.partner_standard_category where partner_id = '44444444-4444-4444-4444-444444444423' and standard_category_id = '66666666-6666-6666-6666-666666666603';
  select role into v_role4 from public.partner_standard_category where partner_id = '44444444-4444-4444-4444-444444444423' and standard_category_id = '66666666-6666-6666-6666-666666666604';

  if v_role1 <> 'primary' or v_role2 <> 'sub' or v_role3 <> 'sub' or v_role4 is not distinct from 'sub' then
    raise exception 'FAIL: k13: backfill ranking must yield primary/sub/sub/null in created_at order, got %/%/%/%', v_role1, v_role2, v_role3, v_role4 using errcode = 'ZZ001';
  end if;
  if v_role4 is not null then
    raise exception 'FAIL: k13: the 4th (overflow) row must be preserved with role=null (not deleted, not defaulted to sub), got %', v_role4 using errcode = 'ZZ001';
  end if;

  select count(*) into v_total_rows from public.partner_standard_category where partner_id = '44444444-4444-4444-4444-444444444423';
  raise notice 'PASS: k13: backfill ranking = primary/sub/sub/null (created_at ascending, overflow preserved not deleted, % rows total kept)', v_total_rows;
end;
$$;

do $$
declare
  v_gaps text[];
  v_partner public.partner%rowtype;
begin
  -- k14: private.partner_profile_submission_gaps() now includes
  -- 'standard_category_primary' when the partner has no role='primary' row,
  -- and drops it once one exists (screen-spec §6/D-6). Dedicated case24
  -- fixture (NOT case23 — that one already got a role='primary' row from
  -- k13's backfill-ranking replay).
  insert into public.partner (id, owner_account_id, intake_source, verification_state, public_listing_state, company_name_ko, vertical)
  values ('44444444-4444-4444-4444-444444444424', null, 'self_service', 'draft', 'off', 'Regtest Case24 GateCheck Co', 'product');

  select * into v_partner from public.partner where id = '44444444-4444-4444-4444-444444444424';

  v_gaps := private.partner_profile_submission_gaps(v_partner);
  if not ('standard_category_primary' = any(v_gaps)) then
    raise exception 'FAIL: k14a: a partner with no role=primary row must have standard_category_primary in its submission gaps' using errcode = 'ZZ001';
  end if;
  raise notice 'PASS: k14a: partner_profile_submission_gaps() flags standard_category_primary when no primary category is set';

  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222b01', false);
  perform set_config('request.jwt.claims', '{"aal":"aal2"}', false);
  set role authenticated;
  perform public.admin_set_partner_standard_categories(
    '44444444-4444-4444-4444-444444444424', '66666666-6666-6666-6666-666666666601', '{}'::uuid[]
  );
  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '', false);

  select * into v_partner from public.partner where id = '44444444-4444-4444-4444-444444444424';
  v_gaps := private.partner_profile_submission_gaps(v_partner);
  if 'standard_category_primary' = any(v_gaps) then
    raise exception 'FAIL: k14b: standard_category_primary must clear once a role=primary row exists' using errcode = 'ZZ001';
  end if;
  raise notice 'PASS: k14b: partner_profile_submission_gaps() clears standard_category_primary once a primary category is set';
end;
$$;


do $$
begin
  -- k15: qa-reviewer 지적 수정 검증 — role=null 직접 insert 우회 경로 차단
  -- (20260912110000 §7). 파트너 자기 세션(authenticated + owns_partner
  -- 조건을 만족하는 c04/case21)으로 partner_standard_category에 직접
  -- INSERT를 시도하면, self_insert 정책이 drop되었을 뿐 아니라 INSERT
  -- grant 자체가 revoke되었으므로 RLS 평가 이전에 권한 오류로 거부되어야
  -- 한다(insufficient_privilege) — role='primary'/'sub'뿐 아니라
  -- role=null로도 절대 뚫려서는 안 된다는 것이 이번 결함의 핵심이므로
  -- role=null로 시도한다.
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333c04', false);
  set role authenticated;
  begin
    insert into public.partner_standard_category (partner_id, standard_category_id, role)
    values ('44444444-4444-4444-4444-444444444421', '66666666-6666-6666-6666-666666666604', null);
    raise exception 'FAIL: k15a: a partner session must NOT be able to directly INSERT into partner_standard_category (even with role=null)' using errcode = 'ZZ001';
  exception when insufficient_privilege then
    raise notice 'PASS: k15a: partner session direct INSERT (role=null) into partner_standard_category raises insufficient_privilege (no INSERT grant)';
  end;

  -- k15b: 같은 세션으로 DELETE 직접 시도도 동일하게 거부되어야 한다.
  begin
    delete from public.partner_standard_category where partner_id = '44444444-4444-4444-4444-444444444421';
    raise exception 'FAIL: k15b: a partner session must NOT be able to directly DELETE from partner_standard_category' using errcode = 'ZZ001';
  exception when insufficient_privilege then
    raise notice 'PASS: k15b: partner session direct DELETE from partner_standard_category raises insufficient_privilege (no DELETE grant)';
  end;

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

do $$
declare
  v_primary_count integer;
begin
  -- k15c: 위 grant/policy 무력화 이후에도 RPC 경유 쓰기는 여전히 정상
  -- 동작해야 한다(SECURITY DEFINER는 함수 소유자 권한으로 실행되므로
  -- GRANT/RLS와 무관 — partner_featured_pick/admin_set_partner_featured와
  -- 동일 원칙). k7에서 case21은 0개로 비워졌으므로 여기서 다시 채워
  -- 검증한다.
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333c04', false);
  set role authenticated;

  perform public.partner_set_standard_categories('66666666-6666-6666-6666-666666666601', '{}'::uuid[]);

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);

  select count(*) into v_primary_count from public.partner_standard_category
    where partner_id = '44444444-4444-4444-4444-444444444421' and role = 'primary';
  if v_primary_count <> 1 then
    raise exception 'FAIL: k15c: partner_set_standard_categories() must still write via SECURITY DEFINER despite the direct-write grant/policy revocation, got % primary rows', v_primary_count using errcode = 'ZZ001';
  end if;
  raise notice 'PASS: k15c: partner_set_standard_categories() RPC still writes normally after direct INSERT/DELETE grants+policies were revoked';
end;
$$;


-- k16: P-A (privacy-security-officer, 2026-09-12, found before this migration's first
-- production deploy) — re-selecting a legacy role=null overflow category as the new
-- primary/sub must NOT fail with a PK violation. The PK on partner_standard_category is
-- (partner_id, standard_category_id); the original delete-then-insert only deleted
-- `role is not null` rows, so re-choosing a role=null row collided with the insert of
-- that same (partner_id, standard_category_id) pair. Fixed by also deleting the
-- specific row(s) being re-selected, regardless of their current role.
insert into auth.users (id, email, email_confirmed_at) values
  ('33333333-3333-3333-3333-333333333c06', 'regtest-partner-6@example.test', now());
insert into public.auth_principal (auth_user_id, principal_kind) values
  ('33333333-3333-3333-3333-333333333c06', 'partner');
insert into public.partner_account (id, auth_user_id, status, display_name) values
  ('33333333-3333-3333-3333-333333333c06', '33333333-3333-3333-3333-333333333c06', 'active', 'Regtest Partner Six (legacy-reselect)');
insert into public.partner (id, owner_account_id, intake_source, verification_state, public_listing_state, company_name_ko, vertical) values
  ('44444444-4444-4444-4444-444444444426', '33333333-3333-3333-3333-333333333c06', 'self_service', 'draft', 'off', 'Regtest Case26 LegacyReselect Co', 'product');

-- Four pre-existing legacy rows, exactly the shape the 20260912110000 backfill would have
-- left behind for a partner who had 4+ categories before this migration ever ran.
insert into public.partner_standard_category (partner_id, standard_category_id, created_at, role) values
  ('44444444-4444-4444-4444-444444444426', '66666666-6666-6666-6666-666666666601', now() - interval '4 days', 'primary'),
  ('44444444-4444-4444-4444-444444444426', '66666666-6666-6666-6666-666666666602', now() - interval '3 days', 'sub'),
  ('44444444-4444-4444-4444-444444444426', '66666666-6666-6666-6666-666666666603', now() - interval '2 days', 'sub'),
  ('44444444-4444-4444-4444-444444444426', '66666666-6666-6666-6666-666666666604', now() - interval '1 day', null);

do $$
declare
  v_role text;
  v_count integer;
begin
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333c06', false);
  set role authenticated;

  -- Re-select the legacy role=null row (...604) as the NEW primary. Before the P-A fix,
  -- this raised 23505 (duplicate key) because only role IS NOT NULL rows were deleted, so
  -- the insert of (partner, 604, 'primary') collided with the surviving (partner, 604, null)
  -- row.
  perform public.partner_set_standard_categories(
    '66666666-6666-6666-6666-666666666604',
    array['66666666-6666-6666-6666-666666666601']::uuid[]
  );

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);

  select role into v_role from public.partner_standard_category
    where partner_id = '44444444-4444-4444-4444-444444444426' and standard_category_id = '66666666-6666-6666-6666-666666666604';
  if v_role <> 'primary' then
    raise exception 'FAIL: k16: re-selected legacy category must become primary, got role=%', v_role using errcode = 'ZZ001';
  end if;

  select count(*) into v_count from public.partner_standard_category
    where partner_id = '44444444-4444-4444-4444-444444444426';
  if v_count <> 2 then
    raise exception 'FAIL: k16: expected exactly 2 role-tagged rows after the swap (604=primary, 601=sub), got % total rows', v_count using errcode = 'ZZ001';
  end if;

  raise notice 'PASS: k16: re-selecting a legacy role=null overflow category no longer raises a PK violation (P-A fix verified)';
end;
$$;


-- =============================================================================
-- End of assertions. Reaching this line means every check above passed —
-- ON_ERROR_STOP=1 (set by run_regression.sh) would have aborted the whole
-- script at the first RAISE EXCEPTION otherwise.
-- =============================================================================
select regtest.assert(true, 'ALL seepn_buyer_regression.sql ASSERTIONS PASSED');
