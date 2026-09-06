// Design Ref: docs/02-design/features/human-matching.screen-spec.md §3
// (구조화 태그 — 고정 vocabulary로 채택, 자유 태그 추가는 금지)
//
// These value sets MUST mirror the CHECK constraints on public.match in
// supabase/migrations/20260906100000_human_matching_schema.sql exactly
// (selection_tags <@ ..., exclusion_tags <@ ..., judge_status/current_outcome_state
// in (...)). Keep both in sync by hand if the vocabulary ever changes —
// screen-spec §3.2 is explicit that vocabulary changes are a code deploy
// (product-manager revises the PRD, backend-developer updates the DB CHECK
// AND this file together), never a free-text/operator-defined addition.

/** M-R4: reasons an operator may cite when marking a candidate "추천"(shortlisted). */
export const SHORTLIST_TAGS = [
  '카테고리 적합',
  'MOQ 충족',
  '언어 대응',
  '해외경험',
  '인증 보유',
  '가격대 적합',
  '납기 적합',
  '응답 이력 양호',
] as const

/** M-R5: reasons an operator may cite when marking a candidate "제외"(excluded). */
export const EXCLUSION_TAGS = [
  'MOQ 미달',
  '카테고리 불일치',
  '언어 미대응',
  '응답 없음',
  '가격 불일치',
  '납기 불가',
  '파트너 거절',
  '중복',
] as const

export type ShortlistTag = (typeof SHORTLIST_TAGS)[number]
export type ExclusionTag = (typeof EXCLUSION_TAGS)[number]

export const JUDGE_STATUS_VALUES = ['pending', 'shortlisted', 'excluded'] as const
export type JudgeStatus = (typeof JUDGE_STATUS_VALUES)[number]

export const JUDGE_STATUS_LABELS: Record<JudgeStatus, string> = {
  pending: '보류',
  shortlisted: '추천',
  excluded: '제외',
}

/**
 * Tag vocabulary for the currently-selected judgment. There is deliberately
 * no "직접 입력"(free text) option in the UI (screen-spec §3.2) — the
 * paired free-form field is `selection_memo` / `exclusion_memo`, not a new tag.
 */
export const TAGS_BY_JUDGE_STATUS: Record<'shortlisted' | 'excluded', readonly string[]> = {
  shortlisted: SHORTLIST_TAGS,
  excluded: EXCLUSION_TAGS,
}

// M-R7 (screen-spec §2.4) — 9-step Outcome state machine. The arrows are
// display order only, not an enforced sequence: any state may be entered or
// re-entered directly (§6.4 "단조 진행 강제 금지").
export const OUTCOME_STATE_ORDER = [
  'recommended',
  'viewed',
  'responded',
  'meeting',
  'quote',
  'sample',
  'negotiation',
  'deal',
  'repeat',
] as const

export type OutcomeState = (typeof OUTCOME_STATE_ORDER)[number]

export const OUTCOME_STATE_LABELS: Record<OutcomeState, string> = {
  recommended: '추천됨',
  viewed: '열람됨',
  responded: '응답함',
  meeting: '미팅',
  quote: '견적',
  sample: '샘플',
  negotiation: '협상',
  deal: '계약',
  repeat: '재거래',
}

export function isShortlistTag(tag: string): tag is ShortlistTag {
  return (SHORTLIST_TAGS as readonly string[]).includes(tag)
}

export function isExclusionTag(tag: string): tag is ExclusionTag {
  return (EXCLUSION_TAGS as readonly string[]).includes(tag)
}
