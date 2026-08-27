'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import type { ActionResult } from '@/lib/supabase/adminAuthActions'
import { isValidSlug, toContentKey, type ArticleContentType } from '@/lib/content/contentTypes'

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
