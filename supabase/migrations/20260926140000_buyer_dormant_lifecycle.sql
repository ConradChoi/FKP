-- =============================================================================
-- SEEPN 회원 휴면 계정 수명주기 (대표 확정 2026-09-26)
--
--   * 마지막 로그인 후 1년 동안 이용이 없으면 휴면 계정으로 전환한다(status='dormant').
--   * 휴면 상태로 1년 동안 해제하지 않으면 계정을 삭제한다(개인 정보 삭제 + 로그인 계정 삭제).
--   * 휴면 계정으로 로그인을 시도하면 해제 여부를 확인한다: 비밀번호 재입력 + 이용약관·개인정보
--     처리방침 재동의 + 비밀번호 변경을 마쳐야 이용할 수 있다(public.buyer_release_dormant()는
--     그 절차를 마친 /api/seepn/dormant/release 에서만 호출된다).
--
-- 이전 정책(12개월 후 안내, 6개월 뒤 '탈퇴 처리'하되 데이터 보존)을 대체한다. 휴면 계정은
-- is_active_buyer()가 false라 모든 회원 기능·RLS에서 자동 배제되고, 그 리뷰·커뮤니티 게시물은
-- 게시되지 않는다(공개 뷰가 ba.status='active'만 노출).
--
-- 삭제(purge)는 buyer_withdraw()의 데이터 삭제(관심등록·저장 비교·리뷰·커뮤니티·문의 본문)에 더해
-- 표시명·닉네임을 비식별화하고, 로그인 계정(auth.users)은 서비스 롤 전용 함수·크론 라우트
-- (/api/cron/purge-dormant-buyers)가 삭제한다. 동의 기록은 입증을 위해 처리방침이 정한 기간 보관한다.
--
-- 안내 메일: 이 프로젝트에는 대량 메일 발송 수단이 없어 휴면 전환·삭제 예정 안내 메일은 아직
-- 발송하지 않는다(legal-review-queue.md P-19).
--
-- Re-runnable. Not yet executed against Supabase — paste into the SQL Editor manually.
-- =============================================================================

-- ---- status / columns ----
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.buyer_account'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%pending_email%';
  if v_conname is not null then
    execute format('alter table public.buyer_account drop constraint %I', v_conname);
  end if;
end;
$$;

alter table public.buyer_account
  add constraint buyer_account_status_check
  check (status in ('pending_email', 'active', 'dormant', 'suspended', 'withdrawn'));

alter table public.buyer_account add column if not exists dormant_at timestamptz;
alter table public.buyer_account add column if not exists auth_purge_pending boolean not null default false;


-- ---- 1) mark: 1 year without login -> dormant ----
create or replace function private.mark_dormant_buyer_accounts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.buyer_account
  set status = 'dormant', dormant_at = now()
  where status = 'active'
    and coalesce(last_login_at, created_at) < now() - interval '1 year';
  get diagnostics v_count = row_count;

  perform private.log_audit(p_action := 'buyer.dormant_mark', p_result_count := v_count);

  insert into public.retention_jobs (job_type, target_condition, anonymized_count, notes)
  values (
    'buyer_account_dormant_purge',
    'status=''active'' and coalesce(last_login_at, created_at) < now() - interval ''1 year'' -> dormant',
    v_count,
    '휴면 전환(2026-09-26 대표 확정): 마지막 로그인 후 1년. 계정 데이터는 삭제하지 않고 이용만 제한한다.'
  );
  return v_count;
end;
$$;


-- ---- 2) purge: 1 year dormant -> delete ----
create or replace function private.purge_dormant_buyer_accounts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account record;
  v_count integer := 0;
begin
  for v_account in
    select id from public.buyer_account
    where status = 'dormant' and dormant_at is not null and dormant_at < now() - interval '1 year'
  loop
    -- Same personal-data removal as buyer_withdraw() (self-service withdrawal).
    delete from public.buyer_bookmark where buyer_account_id = v_account.id;
    delete from public.buyer_saved_comparison where buyer_account_id = v_account.id;
    delete from public.partner_review where buyer_account_id = v_account.id;
    delete from public.partner_review_block where buyer_account_id = v_account.id;
    delete from public.community_post where buyer_account_id = v_account.id;
    delete from public.community_comment where buyer_account_id = v_account.id;
    delete from public.community_post_like where buyer_account_id = v_account.id;
    delete from public.community_report where reporter_buyer_account_id = v_account.id;
    update public.seepn_inquiry
    set status = 'closed', closed_at = coalesce(closed_at, now()), body = '[파기됨]', updated_at = now()
    where buyer_account_id = v_account.id and body <> '[파기됨]';

    -- De-identify the account row (statistics/consent proof keep referencing it) and queue the
    -- login account (auth.users) for deletion by the cron route.
    update public.buyer_account
    set status = 'withdrawn', withdrawn_at = now(), display_name = '(삭제된 회원)', nickname = null,
        nickname_changed_at = null, auth_purge_pending = true
    where id = v_account.id;

    perform private.log_audit(
      p_action := 'buyer.dormant_purge',
      p_target_table := 'buyer_account', p_target_id := v_account.id::text,
      p_subject_ids := array[v_account.id]
    );
    v_count := v_count + 1;
  end loop;

  insert into public.retention_jobs (job_type, target_condition, anonymized_count, notes)
  values (
    'buyer_account_dormant_purge',
    'status=''dormant'' and dormant_at < now() - interval ''1 year'' -> deleted',
    v_count,
    '휴면 1년 경과 계정 삭제(2026-09-26 대표 확정): 회원 작성 데이터 삭제 + 계정 행 비식별화 + 로그인 계정은 auth_purge_pending으로 표시해 크론 라우트가 삭제한다.'
  );
  return v_count;
end;
$$;


-- ---- 3) release: password re-entry + re-consent + password change are done by the caller ----
create or replace function public.buyer_release_dormant(p_terms_version text, p_privacy_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_status text;
begin
  select ba.id, ba.status into v_account_id, v_status from public.buyer_account ba where ba.auth_user_id = auth.uid();
  if v_account_id is null or v_status is distinct from 'dormant' then
    raise exception 'not_dormant' using errcode = '42501';
  end if;
  if coalesce(p_terms_version, '') = '' or coalesce(p_privacy_version, '') = '' then
    raise exception 'consent_version_required';
  end if;

  -- Re-consent to the current terms and privacy policy (append-only consent rows).
  insert into public.buyer_consent (buyer_account_id, consent_type, granted, document_version, consent_locale, collected_at)
  values (v_account_id, 'terms', true, p_terms_version, 'ko', now()),
         (v_account_id, 'privacy', true, p_privacy_version, 'ko', now());

  update public.buyer_account
  set status = 'active', dormant_at = null, last_login_at = now(), dormant_notice_sent_at = null
  where id = v_account_id;

  perform private.log_audit(
    p_action := 'buyer.dormant_release',
    p_target_table := 'buyer_account',
    p_target_id := v_account_id::text
  );
end;
$$;

comment on function public.buyer_release_dormant is
  '휴면 해제. 이 함수 자체는 비밀번호 재확인·비밀번호 변경을 검증하지 않는다 — 그 절차를 마친 서버 라우트(/api/seepn/dormant/release)만 호출해야 한다(회원 화면에서 직접 호출하지 말 것).';

revoke all on function public.buyer_release_dormant(text, text) from public;
grant execute on function public.buyer_release_dormant(text, text) to authenticated;


-- ---- 4) login account deletion (service_role only; used by /api/cron/purge-dormant-buyers) ----
create or replace function public.select_buyer_auth_purge_pending(p_limit integer default 50)
returns table (account_id uuid, auth_user_id uuid)
language sql
security definer
set search_path = ''
as $$
  select ba.id, ba.auth_user_id
  from public.buyer_account ba
  where ba.auth_purge_pending and ba.auth_user_id is not null
  order by ba.withdrawn_at
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;
revoke all on function public.select_buyer_auth_purge_pending(integer) from public;
grant execute on function public.select_buyer_auth_purge_pending(integer) to service_role;

create or replace function public.buyer_detach_auth_principal(p_account_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid;
begin
  select auth_user_id into v_auth_uid from public.buyer_account where id = p_account_id and auth_purge_pending;
  if v_auth_uid is null then
    return null;
  end if;
  update public.buyer_account set auth_user_id = null, auth_purge_pending = false where id = p_account_id;
  delete from public.auth_principal where auth_user_id = v_auth_uid;
  return v_auth_uid;
end;
$$;
comment on function public.buyer_detach_auth_principal is
  'Step before auth.admin.deleteUser() (buyer_account.auth_user_id is ON DELETE RESTRICT). service_role only; returns the detached auth user id (null if nothing pending).';
revoke all on function public.buyer_detach_auth_principal(uuid) from public;
grant execute on function public.buyer_detach_auth_principal(uuid) to service_role;


-- ---- 5) daily batch runner: the dormant-mark block now calls mark_dormant_buyer_accounts() ----
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

  begin
    perform private.purge_orphan_match_freetext();
  exception when others then
    raise warning 'purge_orphan_match_freetext failed: %', sqlerrm;
  end;

  -- SEEPN buyer web (P5a): independent blocks, added 20260910100000. Must
  -- never be merged into any block above.
  begin
    perform private.mark_dormant_buyer_accounts();
  exception when others then
    raise warning 'mark_dormant_buyer_accounts failed: %', sqlerrm;
  end;

  begin
    perform private.purge_dormant_buyer_accounts();
  exception when others then
    raise warning 'purge_dormant_buyer_accounts failed: %', sqlerrm;
  end;

  begin
    perform private.purge_expired_seepn_inquiry_body();
  exception when others then
    raise warning 'purge_expired_seepn_inquiry_body failed: %', sqlerrm;
  end;

  -- 탈퇴 사유 직접 입력(reason_text) 12개월 파기 — 20260924120000. Independent block; must
  -- never be merged into any block above.
  begin
    perform private.purge_expired_seepn_withdrawal_text();
  exception when others then
    raise warning 'purge_expired_seepn_withdrawal_text failed: %', sqlerrm;
  end;

  -- 커뮤니티 신고 보유기간 파기 — 20260926120000. Independent block; must never be merged above.
  begin
    perform private.purge_expired_community_reports();
  exception when others then
    raise warning 'purge_expired_community_reports failed: %', sqlerrm;
  end;
end;
$$;
