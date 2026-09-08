'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import type { ActionResult } from '@/lib/supabase/adminAuthActions'
import { isValidSlug, toContentKey, type ArticleContentType } from '@/lib/content/contentTypes'
import { translateBatch } from '@/lib/server/googleTranslate'
import {
  type AiFillResult,
  translateErrorToAiFillFailure,
  validateSourceFields,
  validateTargetLocale,
} from '@/lib/server/aiFill'

// Design Ref: 대표 피드백(2026-08-27) — 메뉴관리에서 게시판관리(board_management) 그룹 아래
// 블로그/사례/FAQ 메뉴를 직접 구성했으므로, 그동안 /admin/content 탭 안에 있던 기능을 각자의
// 메뉴 경로로 옮긴다. 실제 데이터 접근 권한은 여전히 content_management RLS/RPC가 게이트하고
// (테이블 정책이 하드코딩한 권한 코드라 메뉴 이동과 무관), 이 admin 경로들은 순수하게
// 내비게이션 구조만 바꾼다.
const ADMIN_PATH: Record<ArticleContentType, string> = {
  blog: '/admin/board/blog',
  case_study: '/admin/board/example',
}
const FAQ_ADMIN_PATH = '/admin/board/faq'
const ALL_BOARD_PATHS = [ADMIN_PATH.blog, ADMIN_PATH.case_study, FAQ_ADMIN_PATH]

// create_content_item + upsert_content_translation(en, draft) 2단계 호출 — 슬러그는 생성 후
// 불변(lib/content/contentTypes 참고), 부분 실패 허용 정책은 createCategoryAction과 동일.
export interface CreateArticleInput {
  contentType: ArticleContentType
  slug: string
  sortOrder: number
  title: string
  excerpt: string
  bodyMarkdown: string
}

export async function createArticleAction(input: CreateArticleInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  if (!isValidSlug(input.slug)) {
    return { success: false, error: 'invalid_slug', errorCode: 'VALIDATION_ERROR' }
  }

  const contentKey = toContentKey(input.contentType, input.slug)

  const { data: itemId, error: createError } = await supabase.rpc('create_content_item', {
    p_content_type: input.contentType,
    p_content_key: contentKey,
    p_sort_order: input.sortOrder,
  })
  if (createError) return { success: false, error: createError.message, errorCode: 'CREATE_FAILED' }

  const { error: translationError } = await supabase.rpc('upsert_content_translation', {
    p_content_item_id: itemId,
    p_locale: 'en',
    p_body: { title: input.title, excerpt: input.excerpt, body_markdown: input.bodyMarkdown },
    p_status: 'draft',
  })
  if (translationError) return { success: false, error: translationError.message, errorCode: 'CREATE_FAILED' }

  revalidatePath(ADMIN_PATH[input.contentType])
  return { success: true }
}

export interface UpdateArticleItemInput {
  contentItemId: string
  sortOrder: number
  isActive: boolean
}

export async function updateArticleItemAction(input: UpdateArticleItemInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('update_content_item', {
    p_id: input.contentItemId,
    p_sort_order: input.sortOrder,
    p_is_active: input.isActive,
  })
  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  // 이 함수는 블로그/사례/FAQ 공용이라 어떤 게시판 소속인지 모른다 — 셋 다 revalidate(저비용).
  for (const path of ALL_BOARD_PATHS) revalidatePath(path)
  return { success: true }
}

export async function deleteContentItemAction(contentItemId: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('delete_content_item', { p_id: contentItemId })
  if (error) return { success: false, error: error.message, errorCode: 'DELETE_FAILED' }

  for (const path of ALL_BOARD_PATHS) revalidatePath(path)
  return { success: true }
}

export interface UpsertArticleTranslationInput {
  contentItemId: string
  locale: 'en' | 'ja' | 'ko' | 'zh'
  title: string
  excerpt: string
  bodyMarkdown: string
  status: 'draft' | 'translated' | 'published'
}

export async function upsertArticleTranslationAction(input: UpsertArticleTranslationInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('upsert_content_translation', {
    p_content_item_id: input.contentItemId,
    p_locale: input.locale,
    p_body: { title: input.title, excerpt: input.excerpt, body_markdown: input.bodyMarkdown },
    p_status: input.status,
  })
  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  for (const path of ALL_BOARD_PATHS) revalidatePath(path)
  return { success: true }
}

// =============================================================================
// AI 초벌 채우기 (screen-spec §3.5 게시판 블로그, §6 서버 액션 계약, Gap G-2 서버 측 방어)
// =============================================================================

export interface AiFillArticleTranslationInput {
  contentItemId: string
  targetLocale: 'en' | 'ja' | 'ko' | 'zh'
}

export interface AiFillArticleTranslationBody {
  title: string
  excerpt: string
  bodyMarkdown: string
}

// screen-spec §3.5 — "서버 측 방어(필수, UI만 믿지 않음)": ArticleRow가 case_study일 때 버튼을
// 렌더링하지 않는 것은 frontend-developer 몫(Gap G-2, 이번 작업 범위 아님)이고, 이 서버 액션은
// 그 UI 분기와 무관하게 항상 content_item.content_type을 재조회해 case_study면 즉시 거부한다
// (E-15). 이 체크는 원문 재조회(§6.2 step 2)에 필요한 바로 그 content_item 조회에 곁다리로
// 얹혀 있으므로, 별도 쿼리를 추가하지 않고도 "Google Translate 호출 전에 즉시 반환"을 만족한다.
export async function aiFillArticleTranslationAction(
  input: AiFillArticleTranslationInput,
): Promise<AiFillResult<AiFillArticleTranslationBody>> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, errorCode: 'CONFIG_ERROR' }

  // (1) 인증/권한 재검증 — upsertArticleTranslationAction과 동일하게 content_management/update
  // (board 화면들도 실제 데이터 접근 권한은 content_management RLS/RPC가 게이트한다, 파일 상단
  // 주석 참고).
  const { data: allowed } = await supabase.rpc('has_menu_permission_check', {
    p_menu_code: 'content_management',
    p_action: 'update',
  })
  if (!allowed) return { success: false, errorCode: 'ACCESS_DENIED' }

  const { data: item, error: itemError } = await supabase
    .from('content_item')
    .select('content_type, source_locale')
    .eq('id', input.contentItemId)
    .maybeSingle()
  if (itemError || !item) {
    return { success: false, errorCode: 'SAVE_FAILED', message: itemError?.message ?? 'content_item_not_found' }
  }

  // qa-reviewer (blocking, 2026-09-08) — server-side re-check that targetLocale isn't the
  // source locale itself (see lib/server/aiFill.ts's comment on INVALID_TARGET_LOCALE).
  const targetLocaleError = validateTargetLocale(input.targetLocale, item.source_locale)
  if (targetLocaleError) return targetLocaleError

  // (4) case_study 서버 방어 — UI 비노출과 무관하게 항상 유효한 방어선(§3.5, E-15).
  if (item.content_type === 'case_study') {
    return { success: false, errorCode: 'CASE_STUDY_NOT_ALLOWED' }
  }

  // (2) 원문 재조회.
  const { data: sourceRow, error: sourceError } = await supabase
    .from('content_translation')
    .select('body')
    .eq('content_item_id', input.contentItemId)
    .eq('locale', item.source_locale)
    .maybeSingle()
  if (sourceError) return { success: false, errorCode: 'SAVE_FAILED', message: sourceError.message }

  const sourceBody = (sourceRow?.body ?? {}) as { title?: string; excerpt?: string; body_markdown?: string }
  const sourceTitle = typeof sourceBody.title === 'string' ? sourceBody.title : ''
  const sourceExcerpt = typeof sourceBody.excerpt === 'string' ? sourceBody.excerpt : ''
  const sourceBodyMarkdown = typeof sourceBody.body_markdown === 'string' ? sourceBody.body_markdown : ''

  // (3) trim 후 빈 값 EMPTY_SOURCE / 필드별 20,000자 초과 SOURCE_TOO_LONG — bodyMarkdown이 세
  // 필드 중 가장 길어 초과 가능성이 가장 높은 필드(screen-spec §3.5).
  const validationError = validateSourceFields([
    { field: 'title', value: sourceTitle },
    { field: 'excerpt', value: sourceExcerpt },
    { field: 'bodyMarkdown', value: sourceBodyMarkdown },
  ])
  if (validationError) return validationError

  // (5) 3개 필드를 translateBatch 1회 호출로 함께 번역(§6.2 step 5 — "1클릭 = 서버 액션 1회
  // 호출"의 구현 디테일로서 여러 필드를 배열로 담는 것은 원칙 위반 아님).
  const batchResult = await translateBatch({
    texts: [sourceTitle, sourceExcerpt, sourceBodyMarkdown],
    sourceLocale: item.source_locale,
    targetLocale: input.targetLocale,
  })
  if (!batchResult.ok) return translateErrorToAiFillFailure(batchResult)

  const [translatedTitle, translatedExcerpt, translatedBodyMarkdown] = batchResult.translations

  // (6) 성공 시 upsert RPC를 p_status='draft', p_translation_source='ai'로 호출.
  const { error: upsertError } = await supabase.rpc('upsert_content_translation', {
    p_content_item_id: input.contentItemId,
    p_locale: input.targetLocale,
    p_body: { title: translatedTitle, excerpt: translatedExcerpt, body_markdown: translatedBodyMarkdown },
    p_status: 'draft',
    p_translation_source: 'ai',
  })
  if (upsertError) return { success: false, errorCode: 'SAVE_FAILED', message: upsertError.message }

  for (const path of ALL_BOARD_PATHS) revalidatePath(path)

  // (7) 번역 결과 반환 — router.refresh()에 의존하지 않고 클라이언트가 이 값으로 로컬 state를
  // 직접 갱신해야 함(§6.4, frontend-developer 몫).
  return {
    success: true,
    body: { title: translatedTitle, excerpt: translatedExcerpt, bodyMarkdown: translatedBodyMarkdown },
    status: 'draft',
    translationSource: 'ai',
  }
}

export interface CreateFaqInput {
  slug: string
  sortOrder: number
  question: string
  answer: string
}

export async function createFaqAction(input: CreateFaqInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  if (!isValidSlug(input.slug)) {
    return { success: false, error: 'invalid_slug', errorCode: 'VALIDATION_ERROR' }
  }

  const contentKey = toContentKey('faq', input.slug)

  const { data: itemId, error: createError } = await supabase.rpc('create_content_item', {
    p_content_type: 'faq',
    p_content_key: contentKey,
    p_sort_order: input.sortOrder,
  })
  if (createError) return { success: false, error: createError.message, errorCode: 'CREATE_FAILED' }

  const { error: translationError } = await supabase.rpc('upsert_content_translation', {
    p_content_item_id: itemId,
    p_locale: 'en',
    p_body: { question: input.question, answer: input.answer },
    p_status: 'draft',
  })
  if (translationError) return { success: false, error: translationError.message, errorCode: 'CREATE_FAILED' }

  revalidatePath(FAQ_ADMIN_PATH)
  return { success: true }
}

export interface UpsertFaqTranslationInput {
  contentItemId: string
  locale: 'en' | 'ja' | 'ko' | 'zh'
  question: string
  answer: string
  status: 'draft' | 'translated' | 'published'
}

export async function upsertFaqTranslationAction(input: UpsertFaqTranslationInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('upsert_content_translation', {
    p_content_item_id: input.contentItemId,
    p_locale: input.locale,
    p_body: { question: input.question, answer: input.answer },
    p_status: input.status,
  })
  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  revalidatePath(FAQ_ADMIN_PATH)
  return { success: true }
}

// =============================================================================
// AI 초벌 채우기 (screen-spec §3.4 게시판 FAQ, §6 서버 액션 계약)
// =============================================================================

export interface AiFillFaqTranslationInput {
  contentItemId: string
  targetLocale: 'en' | 'ja' | 'ko' | 'zh'
}

export interface AiFillFaqTranslationBody {
  question: string
  answer: string
}

// question + answer는 카드 버튼 1개가 함께 번역하는 다중 필드 — translateBatch 1회 호출로
// [question, answer]를 함께 보낸다(§6.2 step 5).
export async function aiFillFaqTranslationAction(
  input: AiFillFaqTranslationInput,
): Promise<AiFillResult<AiFillFaqTranslationBody>> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, errorCode: 'CONFIG_ERROR' }

  // (1) 인증/권한 재검증 — upsertFaqTranslationAction과 동일하게 content_management/update.
  const { data: allowed } = await supabase.rpc('has_menu_permission_check', {
    p_menu_code: 'content_management',
    p_action: 'update',
  })
  if (!allowed) return { success: false, errorCode: 'ACCESS_DENIED' }

  // (2) 원문 재조회.
  const { data: item, error: itemError } = await supabase
    .from('content_item')
    .select('source_locale')
    .eq('id', input.contentItemId)
    .maybeSingle()
  if (itemError || !item) {
    return { success: false, errorCode: 'SAVE_FAILED', message: itemError?.message ?? 'content_item_not_found' }
  }

  // qa-reviewer (blocking, 2026-09-08) — server-side re-check that targetLocale isn't the
  // source locale itself (see lib/server/aiFill.ts's comment on INVALID_TARGET_LOCALE).
  const targetLocaleError = validateTargetLocale(input.targetLocale, item.source_locale)
  if (targetLocaleError) return targetLocaleError

  const { data: sourceRow, error: sourceError } = await supabase
    .from('content_translation')
    .select('body')
    .eq('content_item_id', input.contentItemId)
    .eq('locale', item.source_locale)
    .maybeSingle()
  if (sourceError) return { success: false, errorCode: 'SAVE_FAILED', message: sourceError.message }

  const sourceBody = (sourceRow?.body ?? {}) as { question?: string; answer?: string }
  const sourceQuestion = typeof sourceBody.question === 'string' ? sourceBody.question : ''
  const sourceAnswer = typeof sourceBody.answer === 'string' ? sourceBody.answer : ''

  // (3) trim 후 빈 값 EMPTY_SOURCE / 필드별 20,000자 초과 SOURCE_TOO_LONG.
  const validationError = validateSourceFields([
    { field: 'question', value: sourceQuestion },
    { field: 'answer', value: sourceAnswer },
  ])
  if (validationError) return validationError

  // (5) Google Cloud Translation API 호출.
  const batchResult = await translateBatch({
    texts: [sourceQuestion, sourceAnswer],
    sourceLocale: item.source_locale,
    targetLocale: input.targetLocale,
  })
  if (!batchResult.ok) return translateErrorToAiFillFailure(batchResult)

  const [translatedQuestion, translatedAnswer] = batchResult.translations

  // (6) 성공 시 upsert RPC를 p_status='draft', p_translation_source='ai'로 호출.
  const { error: upsertError } = await supabase.rpc('upsert_content_translation', {
    p_content_item_id: input.contentItemId,
    p_locale: input.targetLocale,
    p_body: { question: translatedQuestion, answer: translatedAnswer },
    p_status: 'draft',
    p_translation_source: 'ai',
  })
  if (upsertError) return { success: false, errorCode: 'SAVE_FAILED', message: upsertError.message }

  for (const path of ALL_BOARD_PATHS) revalidatePath(path)

  // (7) 번역 결과 반환 — router.refresh()에 의존하지 않고 클라이언트가 이 값으로 로컬 state를
  // 직접 갱신해야 함(§6.4, frontend-developer 몫).
  return {
    success: true,
    body: { question: translatedQuestion, answer: translatedAnswer },
    status: 'draft',
    translationSource: 'ai',
  }
}
