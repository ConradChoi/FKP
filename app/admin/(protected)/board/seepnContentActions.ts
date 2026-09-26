'use server'

// SEEPN 인사이트/FAQ 관리 서버 액션 (2026-09-25). 권한은 RPC(create/update/delete_content_item,
// upsert_content_translation — content_management + AAL2)가 검증한다. 입력 검증(슬러그·길이·카테고리)은
// 여기서 다시 한다: 클라이언트가 보낸 값을 그대로 저장하지 않는다.
import { revalidatePath } from 'next/cache'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import type { ActionResult } from '@/lib/supabase/adminAuthActions'
import { isValidSlug, toContentKey } from '@/lib/content/contentTypes'
import { SEEPN_INSIGHT_CATEGORIES } from '@/lib/content/getPublishedSeepnContent'

export type SeepnContentKind = 'insight' | 'faq'
export type SeepnContentStatus = 'draft' | 'published'

const PATHS: Record<SeepnContentKind, string> = { insight: '/admin/board/seepn-insight', faq: '/admin/board/seepn-faq' }
const CONTENT_TYPE: Record<SeepnContentKind, string> = { insight: 'seepn_insight', faq: 'seepn_faq' }

export interface SeepnContentFields {
  title?: string
  excerpt?: string
  category?: string
  bodyMarkdown?: string
  question?: string
  answer?: string
}

function buildBody(kind: SeepnContentKind, f: SeepnContentFields): Record<string, string> | null {
  const t = (v: string | undefined, max: number) => (v ?? '').trim().slice(0, max)
  if (kind === 'insight') {
    const title = t(f.title, 200)
    const category = t(f.category, 30)
    if (!title || !(SEEPN_INSIGHT_CATEGORIES as readonly string[]).includes(category)) return null
    return { title, excerpt: t(f.excerpt, 300), category, body_markdown: t(f.bodyMarkdown, 20000) }
  }
  const question = t(f.question, 300)
  const answer = t(f.answer, 5000)
  if (!question || !answer) return null
  return { question, answer }
}

function revalidate(kind: SeepnContentKind) {
  revalidatePath(PATHS[kind])
  revalidatePath(kind === 'insight' ? '/seepn/insights' : '/seepn/faq')
  if (kind === 'insight') revalidatePath('/seepn/home')
}

export async function createSeepnContentAction(input: {
  kind: SeepnContentKind
  slug: string
  sortOrder: number
  fields: SeepnContentFields
  status: SeepnContentStatus
}): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }
  if (!isValidSlug(input.slug)) return { success: false, error: 'invalid_slug', errorCode: 'VALIDATION_ERROR' }
  const body = buildBody(input.kind, input.fields)
  if (!body) return { success: false, error: 'invalid_fields', errorCode: 'VALIDATION_ERROR' }

  const contentType = CONTENT_TYPE[input.kind]
  const { data: itemId, error: createError } = await supabase.rpc('create_content_item', {
    p_content_type: contentType,
    p_content_key: toContentKey(contentType, input.slug),
    p_sort_order: Math.trunc(input.sortOrder) || 0,
    p_is_active: true,
    p_source_locale: 'ko',
    p_target_audience: null,
  })
  if (createError) return { success: false, error: createError.message, errorCode: 'CREATE_FAILED' }

  const { error: translationError } = await supabase.rpc('upsert_content_translation', {
    p_content_item_id: itemId,
    p_locale: 'ko',
    p_body: body,
    p_status: input.status,
  })
  if (translationError) return { success: false, error: translationError.message, errorCode: 'CREATE_FAILED' }

  revalidate(input.kind)
  return { success: true }
}

export async function saveSeepnContentAction(input: {
  kind: SeepnContentKind
  contentItemId: string
  sortOrder: number
  isActive: boolean
  fields: SeepnContentFields
  status: SeepnContentStatus
}): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }
  const body = buildBody(input.kind, input.fields)
  if (!body) return { success: false, error: 'invalid_fields', errorCode: 'VALIDATION_ERROR' }

  const { error: itemError } = await supabase.rpc('update_content_item', {
    p_id: input.contentItemId,
    p_sort_order: Math.trunc(input.sortOrder) || 0,
    p_is_active: input.isActive,
  })
  if (itemError) return { success: false, error: itemError.message, errorCode: 'UPDATE_FAILED' }

  const { error: translationError } = await supabase.rpc('upsert_content_translation', {
    p_content_item_id: input.contentItemId,
    p_locale: 'ko',
    p_body: body,
    p_status: input.status,
  })
  if (translationError) return { success: false, error: translationError.message, errorCode: 'UPDATE_FAILED' }

  revalidate(input.kind)
  return { success: true }
}

export async function deleteSeepnContentAction(kind: SeepnContentKind, contentItemId: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }
  const { error } = await supabase.rpc('delete_content_item', { p_id: contentItemId })
  if (error) return { success: false, error: error.message, errorCode: 'DELETE_FAILED' }
  revalidate(kind)
  return { success: true }
}
