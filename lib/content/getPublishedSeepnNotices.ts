// SEEPN 회원용 공지 조회 (target_audience='seepn_user'). getPublishedNotices.ts(파트너용)와 같은 규칙:
//   1. anon 클라이언트로만 읽는다(content_item/translation의 공개 RLS는 `to anon`). 게시된(published)
//      + 활성 행만 읽히며, 공지 본문에는 개인정보를 넣지 않는다 — 로그인 여부와 무관하게 공개 데이터다.
//   2. 대상 필터는 DB의 positive match(`.eq('target_audience','seepn_user')`)만 쓴다. JS의 부정 필터는
//      NULL 행이 새는 fail-open이므로 쓰지 않는다. 파트너용 공지(partner)는 절대 이 경로로 나오지 않는다.
//   3. 잘못된 대상/초안/비활성은 모두 동일한 null로 접혀 404가 된다.
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { toContentKey } from './contentTypes'

const AUDIENCE = 'seepn_user' as const
const LOCALE = 'ko'

type TranslationRow = { locale: string; body: Record<string, unknown> | null; status: string }
type NoticeItemRow = {
  id: string
  content_key: string
  target_audience: string | null
  created_at: string
  content_translation: TranslationRow[]
}

function pickPublishedKoBody(rows: TranslationRow[]): Record<string, unknown> | null {
  const row = rows.find((r) => r.locale === LOCALE && r.status === 'published')
  return row?.body ?? null
}

export interface SeepnNoticeListItem {
  slug: string
  title: string
  createdAt: string
}

export async function getPublishedSeepnNotices(limit?: number): Promise<SeepnNoticeListItem[]> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return []

  let query = supabase
    .from('content_item')
    .select('id, content_key, target_audience, created_at, content_translation(locale, body, status)')
    .eq('content_type', 'notice')
    .eq('target_audience', AUDIENCE)
    .eq('is_active', true)
    .in('content_translation.locale', [LOCALE])
    .eq('content_translation.status', 'published')
    .order('sort_order', { ascending: false })
  if (typeof limit === 'number') query = query.limit(limit)

  const { data, error } = await query
  if (error || !data) return []

  const items: SeepnNoticeListItem[] = []
  for (const row of data as unknown as NoticeItemRow[]) {
    if (row.target_audience !== AUDIENCE) continue
    const body = pickPublishedKoBody(row.content_translation ?? [])
    const title = typeof body?.title === 'string' ? body.title : null
    if (!title) continue
    items.push({ slug: row.content_key.slice('notice.'.length), title, createdAt: row.created_at })
  }
  return items
}

export interface SeepnNoticeDetail extends SeepnNoticeListItem {
  bodyMarkdown: string
}

export async function getPublishedSeepnNoticeBySlug(slug: string): Promise<SeepnNoticeDetail | null> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('content_item')
    .select('id, content_key, target_audience, created_at, content_translation(locale, body, status)')
    .eq('content_type', 'notice')
    .eq('content_key', toContentKey('notice', slug))
    .eq('target_audience', AUDIENCE)
    .eq('is_active', true)
    .in('content_translation.locale', [LOCALE])
    .eq('content_translation.status', 'published')
    .maybeSingle()
  if (error || !data) return null

  const row = data as unknown as NoticeItemRow
  if (row.target_audience !== AUDIENCE) return null
  const body = pickPublishedKoBody(row.content_translation ?? [])
  const title = typeof body?.title === 'string' ? body.title : null
  if (!title) return null

  return { slug, title, bodyMarkdown: typeof body?.body_markdown === 'string' ? body.body_markdown : '', createdAt: row.created_at }
}
