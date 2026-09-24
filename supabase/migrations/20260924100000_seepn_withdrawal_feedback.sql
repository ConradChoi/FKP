-- =============================================================================
-- SEEPN 회원 탈퇴 사유 수집 (마이페이지 > 회원 탈퇴, 2026-09-24 요청)
--
-- 탈퇴 시 사유(선택지 + 선택적 자유서술)를 저장한다. 의도적으로 buyer_account/auth_user와
-- 연결 키를 두지 않는다 — 탈퇴한 사람을 식별할 수 없는 익명 통계용이다. 자유서술에 개인정보가
-- 섞일 수 있어 화면에서 입력 금지 안내 + 500자 제한을 두며, service_role(탈퇴 API)만 쓴다.
-- 보관기간/파기 정책은 privacy-security-officer 검토 후 확정할 것(임시: 무기한, 익명).
--
-- Not yet executed against Supabase — paste into the SQL Editor manually.
-- =============================================================================

create table if not exists public.seepn_withdrawal_feedback (
  id uuid primary key default gen_random_uuid(),
  reason_code text not null
    check (reason_code in ('not_using', 'cannot_find_supplier', 'inconvenient', 'privacy_concern', 'other_service', 'other')),
  reason_text text check (reason_text is null or char_length(reason_text) <= 500),
  created_at timestamptz not null default now()
);

alter table public.seepn_withdrawal_feedback enable row level security;
alter table public.seepn_withdrawal_feedback force row level security;
revoke all on public.seepn_withdrawal_feedback from anon, authenticated;
grant select, insert on public.seepn_withdrawal_feedback to service_role;

comment on table public.seepn_withdrawal_feedback is
  'Anonymous withdrawal reasons (no account link by design). Written only by POST /api/seepn/withdraw via service_role.';
