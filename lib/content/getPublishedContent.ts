// Design Ref: fkp-v0.2-phase5d-blog-case-faq.spec.md §6.6 — public read functions for
// blog/case_study/faq, mirroring lib/content/getLandingCopy.ts's graceful-degradation
// contract: never throw, return an empty list / null on any failure so a DB hiccup
// degrades to an empty-state page rather than a crashed one (§4.1).
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import type { Locale } from '@/lib/i18n/types'
import { toContentKey, type ArticleContentType } from './contentTypes'

type TranslationRow = { locale: string; body: Record<string, unknown> | null; status: string }
type ItemRow = { id: string; content_key: string; sort_order: number; content_translation: TranslationRow[] }

function pickTranslation(rows: TranslationRow[], locale: Locale): Record<string, unknown> | null {
  const target = rows.find((r) => r.locale === locale)
  if (target?.body) return target.body
  const source = rows.find((r) => r.locale === 'en')
  return source?.body ?? null
}

export interface PublishedListItem {
  slug: string
  title: string
  excerpt: string
}

export async function getPublishedContentList(contentType: ArticleContentType, locale: Locale): Promise<PublishedListItem[]> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return []

  const locales = locale === 'en' ? ['en'] : [locale, 'en']

  const { data, error } = await supabase
    .from('content_item')
    .select('id, content_key, sort_order, content_translation(locale, body, status)')
    .eq('content_type', contentType)
    .eq('is_active', true)
    .in('content_translation.locale', locales)
    .order('sort_order', { ascending: false })

  if (error || !data) return []

  const items: PublishedListItem[] = []
  for (const row of data as unknown as ItemRow[]) {
    const body = pickTranslation(row.content_translation ?? [], locale)
    const title = typeof body?.title === 'string' ? body.title : null
    const excerpt = typeof body?.excerpt === 'string' ? body.excerpt : ''
    if (!title) continue
    items.push({ slug: row.content_key.slice(contentType.length + 1), title, excerpt })
  }
  return items
}

export interface PublishedDetailItem {
  slug: string
  title: string
  excerpt: string
  bodyMarkdown: string
}

export async function getPublishedContentBySlug(
  contentType: ArticleContentType,
  slug: string,
  locale: Locale,
): Promise<PublishedDetailItem | null> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return null

  const locales = locale === 'en' ? ['en'] : [locale, 'en']
  const contentKey = toContentKey(contentType, slug)

  const { data, error } = await supabase
    .from('content_item')
    .select('id, content_key, content_translation(locale, body, status)')
    .eq('content_type', contentType)
    .eq('content_key', contentKey)
    .eq('is_active', true)
    .in('content_translation.locale', locales)
    .maybeSingle()

  if (error || !data) return null

  const row = data as unknown as ItemRow
  const body = pickTranslation(row.content_translation ?? [], locale)
  const title = typeof body?.title === 'string' ? body.title : null
  if (!title) return null

  return {
    slug,
    title,
    excerpt: typeof body?.excerpt === 'string' ? body.excerpt : '',
    bodyMarkdown: typeof body?.body_markdown === 'string' ? body.body_markdown : '',
  }
}

export interface PublishedFaqItem {
  slug: string
  question: string
  answer: string
}

export async function getPublishedFaqList(locale: Locale): Promise<PublishedFaqItem[]> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return []

  const locales = locale === 'en' ? ['en'] : [locale, 'en']

  const { data, error } = await supabase
    .from('content_item')
    .select('id, content_key, sort_order, content_translation(locale, body, status)')
    .eq('content_type', 'faq')
    .eq('is_active', true)
    .in('content_translation.locale', locales)
    .order('sort_order', { ascending: true })

  if (error || !data) return []

  const items: PublishedFaqItem[] = []
  for (const row of data as unknown as ItemRow[]) {
    const body = pickTranslation(row.content_translation ?? [], locale)
    const question = typeof body?.question === 'string' ? body.question : null
    const answer = typeof body?.answer === 'string' ? body.answer : ''
    if (!question) continue
    items.push({ slug: row.content_key.slice('faq.'.length), question, answer })
  }
  return items
}
