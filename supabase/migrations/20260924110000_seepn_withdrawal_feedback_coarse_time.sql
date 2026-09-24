-- =============================================================================
-- seepn_withdrawal_feedback: 정밀 시각(created_at) 제거 -> 월 단위(created_month)
-- (privacy-security-officer 검토 B1, 2026-09-24)
--
-- 피드백 insert는 buyer_withdraw() 커밋 직후 같은 요청에서 일어나므로 created_at이
-- buyer_account.withdrawn_at / audit_log(buyer.withdraw) 시각과 수 ms 차이가 된다 — 시각만
-- 대조해도 사유와 계정(이메일)이 재결합된다. 시각을 월 단위로 낮춰 그 결합을 끊는다.
-- 잔여 위험(행 물리 순서 추정)은 service_role 전용 접근 + 내부관리계획의 "재식별 시도 금지"로
-- 관리한다. 테이블 접근 권한은 service_role 전용(Supabase 기본 권한상 update/delete도 가짐).
--
-- Not yet executed against Supabase — paste into the SQL Editor manually.
-- =============================================================================

alter table public.seepn_withdrawal_feedback add column if not exists created_month date;

update public.seepn_withdrawal_feedback
  set created_month = date_trunc('month', created_at at time zone 'Asia/Seoul')::date
  where created_month is null;

alter table public.seepn_withdrawal_feedback
  alter column created_month set not null,
  alter column created_month set default (date_trunc('month', now() at time zone 'Asia/Seoul'))::date;

alter table public.seepn_withdrawal_feedback drop column if exists created_at;
