// SEEPN 인사이트(seepn_insight)·FAQ(seepn_faq) 공개 조회 — 한국어 단일 언어, anon 클라이언트, 게시
// (published) + 활성 행만. getPublishedSeepnNotices.ts와 같은 원칙: DB의 positive match만 쓰고, 초안/
// 비활성/없는 slug는 모두 null(404)로 접는다. 본문에는 개인정보를 넣지 않는다(공개 데이터).
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { toContentKey } from './contentTypes'

const LOCALE = 'ko'

export const SEEPN_INSIGHT_CATEGORIES = ['시장동향', '조달전략', '인증/품질'] as const
export type SeepnInsightCategory = (typeof SEEPN_INSIGHT_CATEGORIES)[number]

type TranslationRow = { locale: string; body: Record<string, unknown> | null; status: string }
type ItemRow = { id: string; content_key: string; created_at: string; content_translation: TranslationRow[] }

function publishedKoBody(rows: TranslationRow[] | null): Record<string, unknown> | null {
  return (rows ?? []).find((r) => r.locale === LOCALE && r.status === 'published')?.body ?? null
}
const str = (v: unknown) => (typeof v === 'string' ? v : '')

export interface SeepnInsightListItem {
  slug: string
  title: string
  excerpt: string
  category: string
  createdAt: string
}

export interface SeepnInsightDetail extends SeepnInsightListItem {
  bodyMarkdown: string
}

function toInsight(row: ItemRow): SeepnInsightListItem | null {
  const body = publishedKoBody(row.content_translation)
  const title = str(body?.title)
  if (!title) return null
  return { slug: row.content_key.slice('seepn_insight.'.length), title, excerpt: str(body?.excerpt), category: str(body?.category), createdAt: row.created_at }
}

export async function getPublishedSeepnInsights(limit?: number): Promise<SeepnInsightListItem[]> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return []
  let query = supabase
    .from('content_item')
    .select('id, content_key, created_at, content_translation(locale, body, status)')
    .eq('content_type', 'seepn_insight')
    .eq('is_active', true)
    .in('content_translation.locale', [LOCALE])
    .eq('content_translation.status', 'published')
    .order('sort_order', { ascending: false })
  if (typeof limit === 'number') query = query.limit(limit)
  const { data, error } = await query
  if (error || !data) return []
  return (data as unknown as ItemRow[]).map(toInsight).filter((i): i is SeepnInsightListItem => i !== null)
}

export async function getPublishedSeepnInsightBySlug(slug: string): Promise<SeepnInsightDetail | null> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('content_item')
    .select('id, content_key, created_at, content_translation(locale, body, status)')
    .eq('content_type', 'seepn_insight')
    .eq('content_key', toContentKey('seepn_insight', slug))
    .eq('is_active', true)
    .in('content_translation.locale', [LOCALE])
    .eq('content_translation.status', 'published')
    .maybeSingle()
  if (error || !data) return null
  const row = data as unknown as ItemRow
  const base = toInsight(row)
  if (!base) return null
  return { ...base, bodyMarkdown: str(publishedKoBody(row.content_translation)?.body_markdown) }
}

export interface SeepnFaqItem {
  slug: string
  question: string
  answer: string
}

export async function getPublishedSeepnFaqs(): Promise<SeepnFaqItem[]> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('content_item')
    .select('id, content_key, created_at, content_translation(locale, body, status)')
    .eq('content_type', 'seepn_faq')
    .eq('is_active', true)
    .in('content_translation.locale', [LOCALE])
    .eq('content_translation.status', 'published')
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  const items: SeepnFaqItem[] = []
  for (const row of data as unknown as ItemRow[]) {
    const body = publishedKoBody(row.content_translation)
    const question = str(body?.question)
    if (!question) continue
    items.push({ slug: row.content_key.slice('seepn_faq.'.length), question, answer: str(body?.answer) })
  }
  return items
}
