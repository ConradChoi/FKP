// Design Ref: docs/02-design/features/admin-ai-translation-draft.screen-spec.md §6.1/§6.2 —
// shared request/response shapes and source-field validation for the 5 "AI 초벌 채우기" server
// actions:
//   - aiFillContentTranslationAction         (app/admin/(protected)/content/actions.ts)
//   - aiFillCategoryTranslationAction        (app/admin/(protected)/content/actions.ts)
//   - aiFillStandardCategoryTranslationAction (app/admin/(protected)/categories/actions.ts)
//   - aiFillFaqTranslationAction             (app/admin/(protected)/board/actions.ts)
//   - aiFillArticleTranslationAction         (app/admin/(protected)/board/actions.ts)
// Factored out once instead of re-implemented 5 times, since all 5 follow the exact same §6.2
// step order. SERVER-ONLY module (no 'use client' — see lib/server/googleTranslate.ts's header
// for why that boundary matters in this repo).

import type { GoogleTranslateErrorCode } from './googleTranslate'

// screen-spec §1.4 — 20,000자, 필드 1개당(합산 아님). This is privacy-security-officer's
// PROPOSED value, not yet finalized (screen-spec §8 OQ-3) — flagged here so whoever revisits
// OQ-3 only has to change this one constant.
export const AI_FILL_MAX_FIELD_LENGTH = 20000

// screen-spec §6.1's error code set, plus two additions:
//   - 'SAVE_FAILED' — NOT in the screen-spec's §6.1 list. Added for failures at the final
//     upsert-RPC step (step 6) that are neither a translation-API failure nor an auth failure
//     (e.g. content_item_not_found, an unexpected DB error). The spec's list covers every
//     failure mode it explicitly designed for; this is a catch-all for ones it didn't name.
//     Flagging explicitly per this task's instruction to call out any spec deviation.
//   - 'INVALID_TARGET_LOCALE' — NOT in the screen-spec's §6.1 list. qa-reviewer (blocking,
//     2026-09-08): none of the 5 actions independently re-verified server-side that
//     targetLocale != sourceLocale. The UI never renders the AI-fill button on the source
//     locale's own card, but a Server Action is directly callable regardless of what the UI
//     renders (Next.js action IDs aren't gated by which components actually mounted) — an
//     already-permissioned caller could pass targetLocale == sourceLocale and have the SOURCE
//     row itself overwritten with "itself translated into its own language" at
//     status='draft'+translation_source='ai', which (if the source row was published) demotes
//     live content to draft — the exact accident class §4 E-4 exists to prevent, just reached
//     through a different door. validateTargetLocale() below closes it for all 5 actions.
//   - 'NOTICE_NOT_ALLOWED' — notice-board-v1.0.prd.md (v3.0 Final) §7.5 G-6 / screen-spec
//     §3.6 / §6 N-E3: the blog->notice physical transition (see contentTypes.ts) reuses
//     ArticleRow/aiFillArticleTranslationAction, and that action currently only rejects
//     content_type === 'case_study'. Left unguarded, a 'notice' item would pass straight
//     through: `partner` notices are ko-only (nothing to translate — the button showing up
//     at all would be a bug) and `seepn_user` notices, while they DO have real translation
//     targets (en/ja), are explicitly out of scope for AI-fill until W-N6 is picked up
//     (Google Translate credentials aren't configured yet, and the per-audience UI branching
//     this needs hasn't been built). Deliberately a DIFFERENT code from
//     CASE_STUDY_NOT_ALLOWED (not reused) — case_study is permanently excluded, notice is a
//     "not yet" exclusion that a future seepn_user AI-fill feature will need to distinguish
//     from case_study's permanent one.
export type AiFillErrorCode =
  | 'EMPTY_SOURCE'
  | 'SOURCE_TOO_LONG'
  | 'TRANSLATE_TIMEOUT'
  | 'RATE_LIMITED'
  | 'TRANSLATE_API_ERROR'
  | 'ACCESS_DENIED'
  | 'CONFIG_ERROR'
  | 'CASE_STUDY_NOT_ALLOWED'
  | 'NOTICE_NOT_ALLOWED'
  | 'SAVE_FAILED'
  | 'INVALID_TARGET_LOCALE'

export interface AiFillSuccess<TBody> {
  success: true
  body: TBody
  status: 'draft'
  translationSource: 'ai'
}

export interface AiFillFailure {
  success: false
  errorCode: AiFillErrorCode
  message?: string
  // Present for SOURCE_TOO_LONG (and included on EMPTY_SOURCE for debuggability) — screen-spec
  // §6.1: "SOURCE_TOO_LONG // + maxLength, actualLength, field".
  field?: string
  maxLength?: number
  actualLength?: number
}

export type AiFillResult<TBody> = AiFillSuccess<TBody> | AiFillFailure

export interface SourceFieldSpec {
  field: string
  value: string
  // Default true. Set false for fields the screen-spec explicitly allows to be blank without
  // treating the whole card as EMPTY_SOURCE (currently only CMS category keyword array entries
  // — screen-spec E-16: "빈 문자열 항목은 번역 호출에서 제외하고 그대로 빈 값 유지(에러 아님)").
  // Length is still checked regardless of `required`.
  required?: boolean
}

// screen-spec §6.2 step 3: "원문 trim 후 빈 값이면 EMPTY_SOURCE, 필드별 20,000자 초과면
// SOURCE_TOO_LONG." §1.4: multi-field cards reject the WHOLE card if ANY field fails either
// check — implemented here as "return on first failing spec", checked in the given order.
export function validateSourceFields(specs: SourceFieldSpec[]): AiFillFailure | null {
  for (const spec of specs) {
    const required = spec.required ?? true
    if (required && spec.value.trim() === '') {
      return { success: false, errorCode: 'EMPTY_SOURCE', field: spec.field, message: `${spec.field} is empty` }
    }
    if (spec.value.length > AI_FILL_MAX_FIELD_LENGTH) {
      return {
        success: false,
        errorCode: 'SOURCE_TOO_LONG',
        field: spec.field,
        maxLength: AI_FILL_MAX_FIELD_LENGTH,
        actualLength: spec.value.length,
        message: `${spec.field} exceeds ${AI_FILL_MAX_FIELD_LENGTH} characters (${spec.value.length})`,
      }
    }
  }
  return null
}

// Runtime re-check that targetLocale isn't the source locale — MUST be called with the
// sourceLocale actually read back from the DB (not a client-supplied or type-narrowed value;
// TypeScript unions like Exclude<CategoryLocale, 'ko'> do not exist at runtime and are not a
// defense on their own, qa-reviewer 2026-09-08). Call this right after the source row/locale is
// fetched, before any Google Translate call.
export function validateTargetLocale(targetLocale: string, sourceLocale: string): AiFillFailure | null {
  if (targetLocale === sourceLocale) {
    return {
      success: false,
      errorCode: 'INVALID_TARGET_LOCALE',
      message: `targetLocale must differ from the source locale (${sourceLocale})`,
    }
  }
  return null
}

// Google Translate's error code set is a strict subset of AiFillErrorCode (CONFIG_ERROR /
// TRANSLATE_TIMEOUT / RATE_LIMITED / TRANSLATE_API_ERROR all pass through unchanged) — this
// just narrows the failure shape returned by lib/server/googleTranslate.ts into an AiFillFailure
// so every action's `if (!result.ok) return ...` line reads the same way.
export function translateErrorToAiFillFailure(error: {
  errorCode: GoogleTranslateErrorCode
  message?: string
}): AiFillFailure {
  return { success: false, errorCode: error.errorCode, message: error.message }
}
