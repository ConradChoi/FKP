'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import type { ActionResult } from '@/lib/supabase/adminAuthActions'
import { isValidSlug, toContentKey, type ArticleContentType } from '@/lib/content/contentTypes'

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

// Design Ref: fkp-v0.2-phase5d-blog-case-faq.spec.md §6.5 — 슬러그는 생성 후 불변(§2.1).
// create_content_item + upsert_content_translation(en, draft) 2단계 호출, 카테고리 생성과
// 동일한 부분 실패 허용 정책(§createCategoryAction 주석 참고).
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

  revalidatePath('/admin/content')
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

  revalidatePath('/admin/content')
  return { success: true }
}

export async function deleteContentItemAction(contentItemId: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('delete_content_item', { p_id: contentItemId })
  if (error) return { success: false, error: error.message, errorCode: 'DELETE_FAILED' }

  revalidatePath('/admin/content')
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

  revalidatePath('/admin/content')
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

  revalidatePath('/admin/content')
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

  revalidatePath('/admin/content')
  return { success: true }
}
