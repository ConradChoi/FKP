// Design Ref: docs/02-design/features/human-matching.ui-spec.md §7(색상 매핑 총정리)/§8
// item 1 — judge_status/outcome 9종은 StatusBadge의 Tone 5종에 맞춰 매핑하되, StatusBadge
// 자체는 수정하지 않는다. deal/repeat의 secondary(Emerald) 채움색은 5톤에 없으므로 트래커
// 노드 컴포넌트(components/admin/OutcomeTracker.tsx)에서만 직접 클래스를 적용하고, 배지
// 형태(이력 리스트 등)에서는 success로 표기한다(ui-spec §8 item 1 마지막 문단).
import type { BadgeTone } from '@/components/admin/StatusBadge'
import type { JudgeStatus, OutcomeState } from '@/lib/admin/matchTags'

export const JUDGE_STATUS_TONE: Record<JudgeStatus, BadgeTone> = {
  pending: 'neutral',
  shortlisted: 'success',
  excluded: 'error',
}

export const OUTCOME_STATE_TONE: Record<OutcomeState, BadgeTone> = {
  recommended: 'neutral',
  viewed: 'neutral',
  responded: 'neutral',
  meeting: 'success',
  quote: 'success',
  sample: 'success',
  negotiation: 'success',
  deal: 'success',
  repeat: 'success',
}

// match.third_party_share_consent_method CHECK — supabase/migrations/20260906100000 §1.
// Distinct from lib/admin/partnerLabels.ts's CONSENT_METHOD_LABELS (that one includes
// 'paper', which is not a valid value here).
export const THIRD_PARTY_CONSENT_METHOD_LABELS: Record<string, string> = {
  online_self: '본인 온라인',
  phone: '전화',
  in_person: '대면',
  email: '이메일',
}

// match.evidence_kind CHECK — supabase/migrations/20260906100000 §1. Distinct vocabulary
// from lib/admin/partnerLabels.ts's EVIDENCE_KIND_LABELS (partner's own platform-consent
// evidence kinds are a different, larger set).
export const THIRD_PARTY_EVIDENCE_KIND_LABELS: Record<string, string> = {
  email_thread: '이메일 확인 발송',
  verbal_only: '구두 동의만',
  other: '기타',
}

// match.consent_scope CHECK — supabase/migrations/20260906100000 §1 (ceo-decision.md §2
// "범위 최소화 기본값": name/title/email 기본, phone은 파트너가 먼저 원할 때만).
export const CONSENT_SCOPE_LABELS: Record<string, string> = {
  name: '성명',
  title: '직함',
  email: '이메일',
  phone: '휴대폰',
}
