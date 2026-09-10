-- =============================================================================
-- private.purge_dormant_buyer_accounts() 정책 변경 (2026-09-10 대표 결정)
--
-- 대상: 20260910100000_seepn_buyer_web_p5a.sql §(1578행 부근)에서 정의된
-- private.purge_dormant_buyer_accounts()는 이미 프로덕션에 배포되어
-- run_daily_retention_batches()를 통해 매일 자동 실행 중이다(2026-09-10
-- 대표가 Supabase Dashboard에서 cron.job active=true 확인). 따라서 그
-- 파일을 직접 고치지 않고, 이 새 마이그레이션에서
-- `create or replace function`으로 재정의한다. 함수 시그니처(이름·인자
-- 없음·리턴 integer)는 run_daily_retention_batches()가 그대로 호출하므로
-- 변경하지 않는다.
--
-- 짝 함수인 private.mark_dormant_buyer_accounts_for_notice()(12개월 휴면
-- 기준으로 dormant_notice_sent_at을 세팅)는 이번 변경 대상이 아니며 그대로
-- 둔다.
--
-- 변경 내용:
--
--   1) 유예기간 30일 → 6개월
--      원래 코드는 dormant_notice_sent_at으로부터 '30 days' 후 자동
--      탈퇴였다. 이 함수의 주석(및 mark_dormant_buyer_accounts_for_notice()
--      주석)에 이미 명시되어 있듯, "안내 발송"(dormant_notice_sent_at 세팅)은
--      실제로 이메일을 보내는 것이 아니라 타임스탬프만 남기는 것이다 — 이
--      프로젝트에는 현재 대량 메일 발송 수단이 없다
--      (data-breach-response-procedure-v1.0.md §5-2와 동일한 제약). 즉
--      지금까지는 "안내 후 30일"이 지나면 실제로는 아무 안내도 받지 못한
--      채 조용히 탈퇴 처리되는 구조였다. 대표는 이 위험을 완화하기 위해
--      유예기간을 6개월로 대폭 늘리기로 결정했다. 다만 이는 "안내가 실제로
--      나가는지"의 근본 문제 자체를 해결하는 것은 아니다 — 그 문제는
--      docs/03-security/legal-review-queue.md의 법무 자문(P-19/T-9) 회신
--      대기 중이며, 이번 변경은 그 판단과 무관하게 대표가 확정한 정책
--      파라미터(30일→6개월) 변경일 뿐이다.
--
--   2) 데이터 삭제 없이 계정 상태만 변경
--      기존 코드는 자동 탈퇴 시 buyer_bookmark를 삭제하고
--      seepn_inquiry.status='closed' + body='[파기됨]'으로 강제 파기했다
--      — 이는 이용자가 스스로 선택하는 buyer_withdraw()(즉시 관심목록
--      삭제 + 미종결 문의 강제종료·본문파기)와 동일한 처리를 회사 주도의
--      휴면 자동탈퇴에도 그대로 적용한 것이었다. 대표는 이 둘을 의도적으로
--      분리하기로 결정했다: 휴면 자동탈퇴는 회사가 주도하는 처리이고,
--      이용자가 나중에 재로그인 등으로 문제를 제기할 가능성에 대비해
--      관심목록·문의 데이터를 삭제하지 않고 그대로 보존해야 한다. 따라서
--      이 함수는 이제
--        update public.buyer_account set status = 'withdrawn', ...
--      한 줄만 데이터를 변경하고, buyer_bookmark delete /
--      seepn_inquiry 강제종료·본문파기 블록은 완전히 제거한다.
--      (단, status='withdrawn'이 되면 로그인 자체가 막히므로, 데이터가
--      남아 있어도 이용자 입장에서 서비스를 계속 이용할 수 있는 것은
--      아니다 — 실질적으로는 회원 탈퇴와 동일한 효과다. 즉 "보존"은
--      어디까지나 회사 측 분쟁 대비 목적이며 이용자에게 서비스 접근권을
--      돌려주는 것이 아니다.)
--
--   3) private.log_audit() 호출은 그대로 유지한다 — 'buyer.dormant_purge'
--      감사 기록은 이번 정책 변경과 무관하다.
--
-- 이 변경은 private.mark_dormant_buyer_accounts_for_notice()가 여전히
-- 실제 이메일을 보내지 않는다는 사실 자체는 바꾸지 않는다. 그 근본 문제는
-- 법무 회신(P-19/T-9) 이후 별도 마이그레이션으로 다뤄야 한다.
-- =============================================================================

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
    where status = 'active'
      and dormant_notice_sent_at is not null
      and dormant_notice_sent_at < now() - interval '6 months'
  loop
    -- 2026-09-10 대표 결정: 계정 상태만 'withdrawn'으로 바꾸고(로그인
    -- 차단), 관심목록(buyer_bookmark)·문의(seepn_inquiry) 데이터는
    -- 삭제/파기하지 않고 그대로 보존한다. 이용자가 스스로 탈퇴하는
    -- buyer_withdraw()와 달리, 회사 주도의 휴면 자동탈퇴이므로 이용자가
    -- 나중에 재로그인 등으로 문제를 제기할 가능성에 대비해 데이터를
    -- 남겨둔다.
    update public.buyer_account
    set status = 'withdrawn', withdrawn_at = now()
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
    'status=''active'' and dormant_notice_sent_at < now() - interval ''6 months''',
    v_count,
    'D-14④ / 2026-09-10 대표 결정: 12-month dormancy notice, then 6 months
    (changed from 30 days) later this batch withdraws the account. Unlike
    buyer_withdraw() (self-service withdrawal: immediate bookmark deletion +
    forced-closure/body-purge of open inquiries), this batch is now
    account-status-only — 이 배치는 더 이상 buyer_withdraw()와 동일한
    파기를 수행하지 않는다 — 계정 상태만 변경, 관심목록·문의 데이터는
    보존 — 2026-09-10 대표 결정. Rationale: company-initiated dormancy
    handling must preserve data in case the affected user later disputes the
    withdrawal (e.g. attempts to log back in); login itself is still blocked
    by status=''withdrawn'', so in practice service access is equivalent to a
    full withdrawal even though the underlying rows survive. This parameter
    change is independent of the still-pending legal review
    (docs/03-security/legal-review-queue.md P-19/T-9) on whether
    mark_dormant_buyer_accounts_for_notice() actually needs to send a real
    notification (it currently only timestamps dormant_notice_sent_at — no
    bulk-email sender exists in this project).'
  );

  return v_count;
end;
$$;
