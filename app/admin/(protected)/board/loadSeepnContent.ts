// SEEPN 인사이트/FAQ 관리 화면용 조회 (ko 단일 언어). RLS(content_management read)가 게이트한다.
import type { SupabaseClient } from '@supabase/supabase-js'
import { slugFromContentKey } from '@/lib/content/contentTypes'
import type { SeepnContentKind } from './seepnContentActions'

export interface SeepnAdminItem {
  contentItemId: string
  slug: string
  sortOrder: number
  isActive: boolean
  status: 'draft' | 'published'
  fields: Record<string, string>
}

const CONTENT_TYPE: Record<SeepnContentKind, string> = { insight: 'seepn_insight', faq: 'seepn_faq' }

export async function loadSeepnContent(supabase: SupabaseClient, kind: SeepnContentKind): Promise<{ items: SeepnAdminItem[]; error: string | null }> {
  const contentType = CONTENT_TYPE[kind]
  const { data: rows, error } = await supabase
    .from('content_item')
    .select('id, content_key, sort_order, is_active')
    .eq('content_type', contentType)
    .order('sort_order', { ascending: false })
  if (error) return { items: [], error: error.message }

  const ids = (rows ?? []).map((r) => r.id as string)
  const { data: translations } =
    ids.length > 0
      ? await supabase.from('content_translation').select('content_item_id, body, status').eq('locale', 'ko').in('content_item_id', ids)
      : { data: [] as { content_item_id: string; body: Record<string, unknown>; status: string }[] }

  const byItem = new Map((translations ?? []).map((t) => [t.content_item_id as string, t]))
  const items: SeepnAdminItem[] = (rows ?? []).map((r) => {
    const t = byItem.get(r.id as string)
    const b = (t?.body ?? {}) as Record<string, unknown>
    const s = (v: unknown) => (typeof v === 'string' ? v : '')
    return {
      contentItemId: r.id as string,
      slug: slugFromContentKey(contentType, r.content_key as string),
      sortOrder: r.sort_order as number,
      isActive: r.is_active as boolean,
      status: t?.status === 'published' ? 'published' : 'draft',
      fields: { title: s(b.title), excerpt: s(b.excerpt), category: s(b.category), bodyMarkdown: s(b.body_markdown), question: s(b.question), answer: s(b.answer) },
    }
  })
  return { items, error: null }
}
