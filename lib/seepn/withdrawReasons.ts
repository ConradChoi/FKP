// Shared by the 회원 탈퇴 form (client) and POST /api/seepn/withdraw (server validation) so the
// allowed reason codes cannot drift; the DB CHECK on seepn_withdrawal_feedback.reason_code mirrors it.
export const WITHDRAW_REASONS = [
  { code: 'not_using', label: '서비스를 더 이상 이용하지 않아요' },
  { code: 'cannot_find_supplier', label: '원하는 공급사를 찾지 못했어요' },
  { code: 'inconvenient', label: '서비스 이용이 불편해요' },
  { code: 'privacy_concern', label: '개인정보가 걱정돼요' },
  { code: 'other_service', label: '다른 서비스를 이용해요' },
  { code: 'other', label: '기타 (직접 입력)' },
] as const

export type WithdrawReasonCode = (typeof WITHDRAW_REASONS)[number]['code']
export const WITHDRAW_REASON_CODES = WITHDRAW_REASONS.map((r) => r.code) as string[]
export const WITHDRAW_REASON_TEXT_MAX = 500
