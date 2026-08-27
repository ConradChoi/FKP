// Design Ref: Phase 5-C — 랜딩페이지 마케팅 카피를 content_item/content_translation에서
// 읽어온다. DB 조회가 실패하거나 특정 content_key가 아직 없으면 호출부가 lib/i18n 정적
// 사전값으로 폴백하도록, 이 함수는 항상 부분적이거나 빈 Record를 반환할 뿐 예외를 던지지
// 않는다 — 카피 한 줄이 비어 있다고 랜딩페이지 전체가 깨지면 안 된다.
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import type { Locale } from '@/lib/i18n/types'

type ContentTranslationRow = {
  locale: string
  body: { text?: string } | null
  content_item: { content_key: string } | { content_key: string }[] | null
}

export async function getLandingCopyMap(locale: Locale): Promise<Record<string, string>> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return {}

  const locales = locale === 'en' ? ['en'] : [locale, 'en']

  const { data, error } = await supabase
    .from('content_translation')
    .select('locale, body, content_item!inner(content_key)')
    .eq('content_item.content_type', 'landing_copy')
    .eq('status', 'published')
    .in('locale', locales)

  if (error || !data) return {}

  const byKey: Record<string, { target?: string; source?: string }> = {}
  for (const row of data as ContentTranslationRow[]) {
    const item = Array.isArray(row.content_item) ? row.content_item[0] : row.content_item
    const key = item?.content_key
    const text = row.body?.text
    if (!key || typeof text !== 'string') continue
    const entry = (byKey[key] ??= {})
    if (row.locale === locale) entry.target = text
    if (row.locale === 'en') entry.source = text
  }

  const result: Record<string, string> = {}
  for (const [key, { target, source }] of Object.entries(byKey)) {
    const value = target ?? source
    if (value !== undefined) result[key] = value
  }
  return result
}
