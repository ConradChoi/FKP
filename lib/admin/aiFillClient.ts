// Design Ref: docs/02-design/features/admin-ai-translation-draft.{screen-spec,ui-spec,copy}.md —
// client-side helpers shared by the 5 "AI 초벌 채우기" card editors (LandingCopyRow,
// CategoryRow, CategoryDetailPanel, FaqRow, ArticleRow). Kept separate from lib/server/aiFill.ts
// on purpose: that module's neighbor lib/server/googleTranslate.ts carries an explicit
// "DO NOT import this module from a 'use client' file" warning (credential leak, not just a
// bug) — this file only takes `type`-only imports from lib/server/aiFill.ts (fully erased by
// TypeScript at compile time, zero runtime coupling) so nothing here can accidentally drag a
// server-only runtime value into a client bundle.
import type { AiFillFailure } from '@/lib/server/aiFill'

// Mirrors lib/server/aiFill.ts's AI_FILL_MAX_FIELD_LENGTH (screen-spec §1.4). Duplicated as a
// plain number (not imported) for the reason above — if OQ-3 changes this value, update both
// this constant and lib/server/aiFill.ts's.
export const AI_FILL_MAX_FIELD_LENGTH = 20000

// copy.md §1
export const AI_FILL_BUTTON_LABEL = 'AI 초벌 채우기'
export const AI_FILL_BUTTON_LOADING_LABEL = '번역 중…'
export const AI_FILL_STALE_SOURCE_CAPTION =
  '원문을 방금 수정했다면, 저장하기 전까지는 AI 초벌에 반영되지 않습니다.'

// copy.md §5.2 (dropdown guard caption) / §3.1 (server-side rejection fallback message)
export const AI_DRAFT_PUBLISH_GUARD_CAPTION = 'AI 초안은 검수 후에만 게시할 수 있습니다.'
export const AI_DRAFT_PUBLISH_SAVE_REJECTED_MESSAGE =
  'AI 초안 상태에서는 게시할 수 없습니다. 먼저 내용을 검수한 뒤 다시 저장해주세요.'

// copy.md §3 (옵션 A, 권장)
export const AI_REVIEW_SAVE_CONFIRM_MESSAGE =
  "저장하면 이 번역이 '검수완료'로 표시됩니다. 내용을 확인한 것으로 표시할까요?"

export interface AiFillSourceField {
  // copy.md §4.1's exact particle-inflected label for this field, e.g. '텍스트가', '카테고리명이'
  // — used verbatim as "{label} 너무 깁니다(...)" so the sentence reads correctly in Korean.
  label: string
  value: string
  // Default true. False only for CMS 카테고리 keyword entries (screen-spec E-16: blank keyword
  // items are not an error) — length is still checked regardless.
  required?: boolean
}

// screen-spec §1.4/E-1/E-2 — client-side pre-check so the button can be disabled before ever
// calling the server (server re-validates independently via lib/server/aiFill.ts's
// validateSourceFields; this is the UX-side mirror, not the security boundary). Checks fields in
// the given order and returns the first failure, matching the server's "reject the whole card on
// the first failing field" behavior.
export function getAiFillDisabledReason(fields: AiFillSourceField[]): string | null {
  for (const field of fields) {
    const required = field.required ?? true
    if (required && field.value.trim() === '') {
      return '원문이 비어 있어 번역할 수 없습니다. 원본 카드에 내용을 먼저 입력해주세요.'
    }
    if (field.value.length > AI_FILL_MAX_FIELD_LENGTH) {
      return `${field.label} 너무 깁니다(${field.value.length.toLocaleString('ko-KR')}자 / 최대 ${AI_FILL_MAX_FIELD_LENGTH.toLocaleString('ko-KR')}자). 원문을 줄이거나 직접 입력해주세요.`
    }
  }
  return null
}

// screen-spec §2.1 Tier 1/2/3, copy.md §2 최종 카피 (Tier 3 = 옵션 A, 멀티라인). Returns null
// when no confirmation is needed at all (no existing translation yet — §2.1 흐름의 "확인창 없이
// 진행" 분기).
export function getAiFillConfirmMessage(params: {
  hasTranslation: boolean
  status: 'draft' | 'translated' | 'published'
  translationSource: 'human' | 'ai' | 'ai_reviewed'
  localeLabel: string
}): string | null {
  const { hasTranslation, status, translationSource, localeLabel } = params
  if (!hasTranslation) return null

  // E-4/Tier 3 takes priority over source-based tiers regardless of translation_source — this is
  // the "최우선" edge case (screen-spec §4 E-4).
  if (status === 'published') {
    return `⚠ 지금 사이트에 게시 중인 ${localeLabel} 번역입니다.\nAI 초안으로 다시 채우면 상태가 즉시 '초안'으로 바뀌며 화면에서 내려갑니다(비공개).\n다시 게시하려면 내용을 검수한 뒤 상태를 '게시됨'으로 바꿔 다시 저장해야 합니다.\n\n계속할까요?`
  }
  if (translationSource === 'human' || translationSource === 'ai_reviewed') {
    return '사람이 직접 작성했거나 검수를 마친 번역입니다. AI 초안으로 다시 채우면 이 내용이 사라집니다. 계속할까요?'
  }
  return '이미 AI 초안이 있습니다. 새로 받으면 지금 내용을 덮어씁니다. 계속할까요?'
}

// screen-spec §4 엣지케이스 표 → copy.md §4 최종 카피 매핑. `fieldLabels`는 화면별 §4.1 매핑을
// 호출부가 주입한다(예: { text: '텍스트가' }, { name: '카테고리명이', keywords: '키워드가' }).
// 정의되지 않은 errorCode(예: fetch 자체 실패)는 마지막 default 분기로 떨어진다 —
// copy.md §4 "매칭 실패/네트워크 단절 등 알 수 없는 실패"의 fallback 문구, 반드시 필요
// (copy.md §7: "errorCode가 위 목록 어디에도 없을 때의 기본값... 반드시 넣어둘 것").
export function getAiFillErrorMessage(failure: AiFillFailure, fieldLabels: Record<string, string>): string {
  switch (failure.errorCode) {
    case 'EMPTY_SOURCE':
      return '원문이 비어 있어 번역할 수 없습니다. 원본 카드에 내용을 먼저 입력해주세요.'
    case 'SOURCE_TOO_LONG': {
      const baseField = (failure.field ?? '').replace(/\[\d+\]$/, '')
      const label = fieldLabels[baseField] ?? '내용이'
      const n = failure.actualLength ?? 0
      return `${label} 너무 깁니다(${n.toLocaleString('ko-KR')}자 / 최대 ${AI_FILL_MAX_FIELD_LENGTH.toLocaleString('ko-KR')}자). 원문을 줄이거나 직접 입력해주세요.`
    }
    case 'TRANSLATE_TIMEOUT':
      return '번역 서비스 응답이 늦어지고 있습니다. 잠시 후 다시 시도해주세요.'
    case 'RATE_LIMITED':
      return '번역 요청이 많아 일시적으로 제한되었습니다. 잠시 후 다시 시도해주세요.'
    case 'TRANSLATE_API_ERROR':
      return '번역 서비스에서 오류가 발생했습니다. 잠시 후 다시 시도하거나 직접 입력해주세요.'
    case 'ACCESS_DENIED':
      return '권한이 없거나 로그인이 만료되었습니다. 다시 로그인해주세요.'
    case 'CONFIG_ERROR':
      return '번역 기능에 일시적인 문제가 있어 사용할 수 없습니다. 개발팀에 문의해주세요.'
    case 'CASE_STUDY_NOT_ALLOWED':
      return '사례 콘텐츠는 AI 번역 대상이 아닙니다.'
    case 'INVALID_TARGET_LOCALE':
      return '원본 로케일은 번역 대상으로 지정할 수 없습니다.'
    case 'SAVE_FAILED':
      return 'AI 초벌 채우기에 실패했습니다. 다시 시도해주세요.'
    default:
      return 'AI 초벌 채우기에 실패했습니다. 잠시 후 다시 시도해주세요.'
  }
}
