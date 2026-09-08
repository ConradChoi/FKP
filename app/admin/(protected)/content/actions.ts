'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import type { ActionResult } from '@/lib/supabase/adminAuthActions'
import { translateBatch, translateOne } from '@/lib/server/googleTranslate'
import {
  type AiFillResult,
  translateErrorToAiFillFailure,
  validateSourceFields,
  validateTargetLocale,
} from '@/lib/server/aiFill'

export interface CreateCategoryInput {
  code: string
  sortOrder: number
  name: string
  keywords: string[]
}

// Design Ref: E3-R? 콘텐츠관리(Phase 5-B). create_category (base row, code/sort_order)
// and upsert_category_translation (en 번역) are two separate SECURITY DEFINER calls —
// there is no single atomic "create category with translation" RPC, so a failure between
// the two calls can leave a category with no 'en' translation yet. That's an acceptable,
// recoverable partial state (the row simply shows "미번역" until the admin fills it in via
// the same form this screen already offers for editing), not a data-integrity problem.
export async function createCategoryAction(input: CreateCategoryInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  if (!/^[a-z][a-z0-9-]{1,49}$/.test(input.code)) {
    return { success: false, error: 'invalid_code', errorCode: 'VALIDATION_ERROR' }
  }

  const { error: createError } = await supabase.rpc('create_category', {
    p_code: input.code,
    p_sort_order: input.sortOrder,
  })
  if (createError) return { success: false, error: createError.message, errorCode: 'CREATE_FAILED' }

  const { error: translationError } = await supabase.rpc('upsert_category_translation', {
    p_category_code: input.code,
    p_locale: 'en',
    p_name: input.name,
    p_keywords: input.keywords,
    p_status: 'draft',
  })
  if (translationError) return { success: false, error: translationError.message, errorCode: 'CREATE_FAILED' }

  revalidatePath('/admin/content')
  return { success: true }
}

export interface UpdateCategoryInput {
  code: string
  sortOrder: number
  isActive: boolean
}

export async function updateCategoryAction(input: UpdateCategoryInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('update_category', {
    p_code: input.code,
    p_sort_order: input.sortOrder,
    p_is_active: input.isActive,
  })
  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  revalidatePath('/admin/content')
  return { success: true }
}

export async function deleteCategoryAction(code: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('delete_category', { p_code: code })
  if (error) return { success: false, error: error.message, errorCode: 'DELETE_FAILED' }

  revalidatePath('/admin/content')
  return { success: true }
}

export interface UpsertCategoryTranslationInput {
  categoryCode: string
  locale: 'en' | 'ja' | 'ko' | 'zh'
  name: string
  keywords: string[]
  status: 'draft' | 'translated' | 'published'
}

export async function upsertCategoryTranslationAction(input: UpsertCategoryTranslationInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('upsert_category_translation', {
    p_category_code: input.categoryCode,
    p_locale: input.locale,
    p_name: input.name,
    p_keywords: input.keywords,
    p_status: input.status,
  })
  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  revalidatePath('/admin/content')
  return { success: true }
}

// =============================================================================
// AI 초벌 채우기 (screen-spec §3.2 CMS 카테고리, §6 서버 액션 계약)
// =============================================================================

const CMS_CATEGORY_SOURCE_LOCALE = 'en'

export interface AiFillCategoryTranslationInput {
  categoryCode: string
  targetLocale: 'en' | 'ja' | 'ko' | 'zh'
}

export interface AiFillCategoryTranslationBody {
  name: string
  keywords: string[]
}

// name + keywords는 카드 버튼 1개가 함께 번역하는 다중 필드 — screen-spec §6.2 step 5의
// "여러 필드를 한 API 호출에 배열로 담는 것은... 원칙 위반 아님"에 따라 translateBatch 1회
// 호출로 [name, ...keywords]를 함께 보내고 응답을 다시 분해한다(name과 keywords를 각각
// translateOne/translateBatch로 나눠 부르면 API 호출이 2회가 되어 이 원칙에서 멀어짐).
// keywords의 빈 문자열 항목은 required:false로 넘겨 E-16(빈 키워드는 에러 아님)을 만족한다.
export async function aiFillCategoryTranslationAction(
  input: AiFillCategoryTranslationInput,
): Promise<AiFillResult<AiFillCategoryTranslationBody>> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, errorCode: 'CONFIG_ERROR' }

  const { data: allowed } = await supabase.rpc('has_menu_permission_check', {
    p_menu_code: 'content_management',
    p_action: 'update',
  })
  if (!allowed) return { success: false, errorCode: 'ACCESS_DENIED' }

  // qa-reviewer (blocking, 2026-09-08) — server-side re-check that targetLocale isn't the
  // source locale itself; the UI never renders this button on the source card, but a Server
  // Action is directly callable regardless of what actually rendered.
  const targetLocaleError = validateTargetLocale(input.targetLocale, CMS_CATEGORY_SOURCE_LOCALE)
  if (targetLocaleError) return targetLocaleError

  const { data: sourceRow, error: sourceError } = await supabase
    .from('content_category_translation')
    .select('name, keywords')
    .eq('category_code', input.categoryCode)
    .eq('locale', CMS_CATEGORY_SOURCE_LOCALE)
    .maybeSingle()
  if (sourceError) return { success: false, errorCode: 'SAVE_FAILED', message: sourceError.message }

  const sourceName = sourceRow?.name ?? ''
  const sourceKeywords: string[] = Array.isArray(sourceRow?.keywords) ? (sourceRow.keywords as string[]) : []

  const validationError = validateSourceFields([
    { field: 'name', value: sourceName },
    ...sourceKeywords.map((keyword, index) => ({ field: `keywords[${index}]`, value: keyword, required: false })),
  ])
  if (validationError) return validationError

  const batchResult = await translateBatch({
    texts: [sourceName, ...sourceKeywords],
    sourceLocale: CMS_CATEGORY_SOURCE_LOCALE,
    targetLocale: input.targetLocale,
  })
  if (!batchResult.ok) return translateErrorToAiFillFailure(batchResult)

  const [translatedName, ...translatedKeywords] = batchResult.translations

  const { error: upsertError } = await supabase.rpc('upsert_category_translation', {
    p_category_code: input.categoryCode,
    p_locale: input.targetLocale,
    p_name: translatedName,
    p_keywords: translatedKeywords,
    p_status: 'draft',
    p_translation_source: 'ai',
  })
  if (upsertError) return { success: false, errorCode: 'SAVE_FAILED', message: upsertError.message }

  revalidatePath('/admin/content')

  return {
    success: true,
    body: { name: translatedName, keywords: translatedKeywords },
    status: 'draft',
    translationSource: 'ai',
  }
}

export interface UpsertContentTranslationInput {
  contentItemId: string
  locale: 'en' | 'ja' | 'ko' | 'zh'
  text: string
  status: 'draft' | 'translated' | 'published'
}

export async function upsertContentTranslationAction(input: UpsertContentTranslationInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('upsert_content_translation', {
    p_content_item_id: input.contentItemId,
    p_locale: input.locale,
    p_body: { text: input.text },
    p_status: input.status,
  })
  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  revalidatePath('/admin/content')
  return { success: true }
}

// =============================================================================
// AI 초벌 채우기 (screen-spec §3.1 랜딩 카피, §6 서버 액션 계약)
// =============================================================================

export interface AiFillContentTranslationInput {
  contentItemId: string
  targetLocale: 'en' | 'ja' | 'ko' | 'zh'
}

export interface AiFillContentTranslationBody {
  text: string
}

// screen-spec §6.2 처리 순서 그대로:
//  (1) upsertContentTranslationAction과 동일한 인증/권한 재검증(content_management/update) —
//      RPC가 자체 재검증하기 전에 미리 걸러 불필요한 Google Translate 호출을 막는다.
//  (2) 원문은 클라이언트 값이 아니라 서버가 content_item.source_locale로 content_translation을
//      직접 재조회(§4 E-13).
//  (3) trim 후 빈 값 EMPTY_SOURCE / 20,000자 초과 SOURCE_TOO_LONG.
//  (4) (해당 없음 — case_study 방어는 ArticleRow 전용, board/actions.ts 참고)
//  (5) Google Cloud Translation API 호출.
//  (6) 성공 시 upsert_content_translation을 p_status='draft', p_translation_source='ai'로 호출.
//  (7) 번역 결과를 응답으로 반환(§6.1 shape) — router.refresh()에 의존하지 않고 클라이언트가
//      이 반환값으로 로컬 state를 직접 갱신해야 함(§6.4, frontend-developer 몫).
export async function aiFillContentTranslationAction(
  input: AiFillContentTranslationInput,
): Promise<AiFillResult<AiFillContentTranslationBody>> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, errorCode: 'CONFIG_ERROR' }

  const { data: allowed } = await supabase.rpc('has_menu_permission_check', {
    p_menu_code: 'content_management',
    p_action: 'update',
  })
  if (!allowed) return { success: false, errorCode: 'ACCESS_DENIED' }

  const { data: item, error: itemError } = await supabase
    .from('content_item')
    .select('source_locale')
    .eq('id', input.contentItemId)
    .maybeSingle()
  if (itemError || !item) {
    return { success: false, errorCode: 'SAVE_FAILED', message: itemError?.message ?? 'content_item_not_found' }
  }

  // qa-reviewer (blocking, 2026-09-08) — server-side re-check that targetLocale isn't the
  // source locale itself (see lib/server/aiFill.ts's comment on INVALID_TARGET_LOCALE for why
  // this can't be left to the UI alone).
  const targetLocaleError = validateTargetLocale(input.targetLocale, item.source_locale)
  if (targetLocaleError) return targetLocaleError

  const { data: sourceRow, error: sourceError } = await supabase
    .from('content_translation')
    .select('body')
    .eq('content_item_id', input.contentItemId)
    .eq('locale', item.source_locale)
    .maybeSingle()
  if (sourceError) return { success: false, errorCode: 'SAVE_FAILED', message: sourceError.message }

  const sourceBody = (sourceRow?.body ?? {}) as { text?: string }
  const sourceText = typeof sourceBody.text === 'string' ? sourceBody.text : ''

  const validationError = validateSourceFields([{ field: 'text', value: sourceText }])
  if (validationError) return validationError

  const translated = await translateOne({
    text: sourceText,
    sourceLocale: item.source_locale,
    targetLocale: input.targetLocale,
  })
  if (!translated.ok) return translateErrorToAiFillFailure(translated)

  const { error: upsertError } = await supabase.rpc('upsert_content_translation', {
    p_content_item_id: input.contentItemId,
    p_locale: input.targetLocale,
    p_body: { text: translated.translation },
    p_status: 'draft',
    p_translation_source: 'ai',
  })
  if (upsertError) return { success: false, errorCode: 'SAVE_FAILED', message: upsertError.message }

  revalidatePath('/admin/content')

  return { success: true, body: { text: translated.translation }, status: 'draft', translationSource: 'ai' }
}
