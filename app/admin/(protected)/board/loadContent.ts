// Design Ref: 게시판관리(board_management) 메뉴 아래 블로그/사례/FAQ 각 화면이 공유하는
// content_item/content_translation 조회+조립 로직. 이전에는 /admin/content 한 페이지가
// 세 타입을 한 번에 조회했지만, 메뉴가 3개 경로로 나뉘면서 각 페이지가 자기 타입만 조회한다.
import type { SupabaseClient } from '@supabase/supabase-js'
import { slugFromContentKey, type ArticleContentType } from '@/lib/content/contentTypes'
import type { ArticleRecord, ArticleTranslationRow } from './ArticleRow'
import type { FaqRecord, FaqTranslationRow } from './FaqRow'

async function loadContentItemsWithTranslations(supabase: SupabaseClient, contentType: string) {
  // notice-board-v1.0.prd.md §2/screen-spec §2 — target_audience is only meaningful for
  // content_type='notice' (null for case_study/faq), selected unconditionally here since this
  // helper is shared by loadArticleRecords/loadFaqRecords and an extra null column costs
  // nothing for the callers that ignore it.
  const { data: items, error: itemsError } = await supabase
    .from('content_item')
    .select('id, content_key, sort_order, is_active, target_audience')
    .eq('content_type', contentType)
    .order('sort_order')

  const ids = (items ?? []).map((i) => i.id)
  const { data: translations, error: translationsError } =
    ids.length > 0
      ? await supabase
          .from('content_translation')
          .select('content_item_id, locale, body, status, source_synced_at, updated_at, translation_source')
          .in('content_item_id', ids)
      : { data: [], error: null }

  return { items: items ?? [], translations: translations ?? [], error: itemsError ?? translationsError }
}

export async function loadArticleRecords(
  supabase: SupabaseClient,
  contentType: ArticleContentType,
): Promise<{ records: ArticleRecord[]; error: { message: string } | null }> {
  const { items, translations, error } = await loadContentItemsWithTranslations(supabase, contentType)

  const records: ArticleRecord[] = items.map((item) => {
    // notice-board-v1.0.prd.md §7.5 G-2′ — this used to hardcode `{ en: null, ja: null }` and
    // skip any other locale. case_study/faq only ever have en/ja rows so that was harmless for
    // them, but a 'partner' notice is ko-only and a 'seepn_user' notice has ko/en/ja — hardcoding
    // would silently drop the ko row (and any future zh row). Every content_translation row is
    // now kept, keyed by its own locale; ArticleRow.tsx's `locales` prop (caller-supplied,
    // per-content-type/per-audience) decides which of these keys actually get rendered.
    const t: Record<string, ArticleTranslationRow | null> = {}
    for (const row of translations) {
      if (row.content_item_id !== item.id) continue
      const body = row.body as { title?: string; excerpt?: string; body_markdown?: string }
      t[row.locale] = {
        title: body?.title ?? '',
        excerpt: body?.excerpt ?? '',
        bodyMarkdown: body?.body_markdown ?? '',
        status: row.status,
        source_synced_at: row.source_synced_at,
        updated_at: row.updated_at,
        translation_source: row.translation_source,
      }
    }
    return {
      contentItemId: item.id,
      slug: slugFromContentKey(contentType, item.content_key),
      sortOrder: item.sort_order,
      isActive: item.is_active,
      translations: t,
      // null for case_study/faq (column is notice-only, PRD §7.2); 'partner' | 'seepn_user' for
      // notice rows (DB CHECK guarantees non-null there, privacy review §5 NB-B5).
      targetAudience: (item.target_audience ?? null) as ArticleRecord['targetAudience'],
    }
  })

  return { records, error }
}

export async function loadFaqRecords(
  supabase: SupabaseClient,
): Promise<{ records: FaqRecord[]; error: { message: string } | null }> {
  const { items, translations, error } = await loadContentItemsWithTranslations(supabase, 'faq')

  const records: FaqRecord[] = items.map((item) => {
    const t: Record<string, FaqTranslationRow | null> = { en: null, ja: null }
    for (const row of translations) {
      if (row.content_item_id !== item.id) continue
      if (row.locale !== 'en' && row.locale !== 'ja') continue
      const body = row.body as { question?: string; answer?: string }
      t[row.locale] = {
        question: body?.question ?? '',
        answer: body?.answer ?? '',
        status: row.status,
        source_synced_at: row.source_synced_at,
        updated_at: row.updated_at,
        translation_source: row.translation_source,
      }
    }
    return {
      contentItemId: item.id,
      slug: slugFromContentKey('faq', item.content_key),
      sortOrder: item.sort_order,
      isActive: item.is_active,
      translations: t,
    }
  })

  return { records, error }
}
