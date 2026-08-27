// Design Ref: 콘텐츠관리(Phase 5-B/5-C/5-D) — 카테고리 마스터 데이터, 랜딩페이지 마케팅 카피,
// 블로그/사례/FAQ. 전부 같은 content_management 권한 코드를 공유하므로 화면이 늘어나도 새
// 메뉴/권한 코드 없이 탭만 추가한다 (fkp-v0.2-phase5d-blog-case-faq.spec.md §6.1/§6.5).
import { redirect } from 'next/navigation'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { CategoryRow, type CategoryRecord, type CategoryTranslationRow } from './CategoryRow'
import { NewCategoryForm } from './NewCategoryForm'
import { LandingCopyRow, type LandingCopyItem, type ContentTextTranslationRow } from './LandingCopyRow'
import { ArticleRow, type ArticleRecord, type ArticleTranslationRow } from './ArticleRow'
import { NewArticleForm } from './NewArticleForm'
import { FaqRow, type FaqRecord, type FaqTranslationRow } from './FaqRow'
import { NewFaqForm } from './NewFaqForm'
import { ContentTabs } from './ContentTabs'
import { LANDING_COPY_SECTIONS, LANDING_COPY_LABELS } from '@/lib/admin/landingCopyLabels'
import { CONTENT_TYPE_URL_SEGMENT, slugFromContentKey } from '@/lib/content/contentTypes'

export default async function ContentManagementPage() {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  const [
    { data: categories, error: categoriesError },
    { data: categoryTranslations, error: categoryTranslationsError },
    { data: allContentItems, error: contentItemsError },
  ] = await Promise.all([
    supabase.from('content_category').select('code, sort_order, is_active').order('sort_order'),
    supabase
      .from('content_category_translation')
      .select('category_code, locale, name, keywords, status, source_synced_at, updated_at'),
    supabase.from('content_item').select('id, content_type, content_key, sort_order, is_active').order('sort_order'),
  ])

  const contentItemIds = (allContentItems ?? []).map((i) => i.id)
  const { data: allContentTranslations, error: contentTranslationsError } =
    contentItemIds.length > 0
      ? await supabase
          .from('content_translation')
          .select('content_item_id, locale, body, status, source_synced_at, updated_at')
          .in('content_item_id', contentItemIds)
      : { data: [], error: null }

  const error = categoriesError ?? categoryTranslationsError ?? contentItemsError ?? contentTranslationsError

  // ---- 카테고리 (Phase 5-B) ----
  const categoryRecords: CategoryRecord[] = (categories ?? []).map((cat) => {
    const translationsForCategory: Record<string, CategoryTranslationRow | null> = { en: null, ja: null }
    for (const t of categoryTranslations ?? []) {
      if (t.category_code !== cat.code) continue
      if (t.locale !== 'en' && t.locale !== 'ja') continue
      translationsForCategory[t.locale] = {
        name: t.name,
        keywords: (t.keywords as string[]) ?? [],
        status: t.status,
        source_synced_at: t.source_synced_at,
        updated_at: t.updated_at,
      }
    }
    return { code: cat.code, sort_order: cat.sort_order, is_active: cat.is_active, translations: translationsForCategory }
  })
  const nextCategorySortOrder = categoryRecords.length > 0 ? Math.max(...categoryRecords.map((r) => r.sort_order)) + 10 : 10

  // ---- 랜딩카피 (Phase 5-C) ----
  const landingCopyContentItems = (allContentItems ?? []).filter((i) => i.content_type === 'landing_copy')
  const itemByKey = new Map(landingCopyContentItems.map((i) => [i.content_key, i.id as string]))
  const landingCopyItems: LandingCopyItem[] = LANDING_COPY_SECTIONS.flatMap((section) =>
    section.keys.map((key) => {
      const contentItemId = itemByKey.get(key) ?? ''
      const translations: Record<string, ContentTextTranslationRow | null> = { en: null, ja: null }
      for (const t of allContentTranslations ?? []) {
        if (t.content_item_id !== contentItemId) continue
        if (t.locale !== 'en' && t.locale !== 'ja') continue
        translations[t.locale] = {
          text: (t.body as { text?: string })?.text ?? '',
          status: t.status,
          source_synced_at: t.source_synced_at,
          updated_at: t.updated_at,
        }
      }
      return { contentItemId, contentKey: key, label: LANDING_COPY_LABELS[key] ?? key, translations }
    }),
  ).filter((item) => item.contentItemId)

  // ---- 블로그 / 사례 (Phase 5-D) ----
  function buildArticleRecords(contentType: 'blog' | 'case_study'): ArticleRecord[] {
    return (allContentItems ?? [])
      .filter((i) => i.content_type === contentType)
      .map((item) => {
        const translations: Record<string, ArticleTranslationRow | null> = { en: null, ja: null }
        for (const t of allContentTranslations ?? []) {
          if (t.content_item_id !== item.id) continue
          if (t.locale !== 'en' && t.locale !== 'ja') continue
          const body = t.body as { title?: string; excerpt?: string; body_markdown?: string }
          translations[t.locale] = {
            title: body?.title ?? '',
            excerpt: body?.excerpt ?? '',
            bodyMarkdown: body?.body_markdown ?? '',
            status: t.status,
            source_synced_at: t.source_synced_at,
            updated_at: t.updated_at,
          }
        }
        return {
          contentItemId: item.id,
          slug: slugFromContentKey(contentType, item.content_key),
          sortOrder: item.sort_order,
          isActive: item.is_active,
          translations,
        }
      })
  }
  const blogRecords = buildArticleRecords('blog')
  const caseStudyRecords = buildArticleRecords('case_study')
  const nextBlogSortOrder = blogRecords.length > 0 ? Math.max(...blogRecords.map((r) => r.sortOrder)) + 10 : 10
  const nextCaseStudySortOrder = caseStudyRecords.length > 0 ? Math.max(...caseStudyRecords.map((r) => r.sortOrder)) + 10 : 10

  // ---- FAQ (Phase 5-D) ----
  const faqRecords: FaqRecord[] = (allContentItems ?? [])
    .filter((i) => i.content_type === 'faq')
    .map((item) => {
      const translations: Record<string, FaqTranslationRow | null> = { en: null, ja: null }
      for (const t of allContentTranslations ?? []) {
        if (t.content_item_id !== item.id) continue
        if (t.locale !== 'en' && t.locale !== 'ja') continue
        const body = t.body as { question?: string; answer?: string }
        translations[t.locale] = {
          question: body?.question ?? '',
          answer: body?.answer ?? '',
          status: t.status,
          source_synced_at: t.source_synced_at,
          updated_at: t.updated_at,
        }
      }
      return {
        contentItemId: item.id,
        slug: slugFromContentKey('faq', item.content_key),
        sortOrder: item.sort_order,
        isActive: item.is_active,
        translations,
      }
    })
  const nextFaqSortOrder = faqRecords.length > 0 ? Math.max(...faqRecords.map((r) => r.sortOrder)) + 10 : 10

  return (
    <div className="mx-auto max-w-[1000px]">
      <h1 className="text-h3 text-primary-900">콘텐츠관리</h1>
      <p className="mt-1 text-body-sm text-neutral-600">
        카테고리, 랜딩페이지 마케팅 카피, 블로그, 사례, FAQ를 관리합니다. 게시(published) 상태인 내용은 최대 1분(ISR) 이내
        공개 사이트에 반영됩니다.
      </p>

      {error && <p className="mt-4 text-body-sm text-error">불러오지 못했습니다: {error.message}</p>}

      <ContentTabs
        tabs={[
          {
            key: 'categories',
            label: '카테고리',
            content: (
              <div className="space-y-4">
                <NewCategoryForm nextSortOrder={nextCategorySortOrder} />
                <div className="space-y-3">
                  {categoryRecords.map((record) => (
                    <CategoryRow key={record.code} category={record} />
                  ))}
                </div>
              </div>
            ),
          },
          {
            key: 'landing-copy',
            label: '랜딩카피',
            content: (
              <div className="space-y-6">
                {LANDING_COPY_SECTIONS.map((section) => (
                  <div key={section.label}>
                    <h2 className="text-body-sm font-semibold text-neutral-500">{section.label}</h2>
                    <div className="mt-2 space-y-2">
                      {landingCopyItems
                        .filter((item) => section.keys.includes(item.contentKey))
                        .map((item) => (
                          <LandingCopyRow key={item.contentKey} item={item} />
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            ),
          },
          {
            key: 'blog',
            label: '블로그',
            content: (
              <div className="space-y-4">
                <NewArticleForm contentType="blog" nextSortOrder={nextBlogSortOrder} />
                <div className="space-y-3">
                  {blogRecords.map((record) => (
                    <ArticleRow key={record.contentItemId} article={record} urlSegment={CONTENT_TYPE_URL_SEGMENT.blog} />
                  ))}
                </div>
              </div>
            ),
          },
          {
            key: 'case-studies',
            label: '사례',
            content: (
              <div className="space-y-4">
                <NewArticleForm contentType="case_study" nextSortOrder={nextCaseStudySortOrder} />
                <div className="space-y-3">
                  {caseStudyRecords.map((record) => (
                    <ArticleRow key={record.contentItemId} article={record} urlSegment={CONTENT_TYPE_URL_SEGMENT.case_study} />
                  ))}
                </div>
              </div>
            ),
          },
          {
            key: 'faq',
            label: 'FAQ',
            content: (
              <div className="space-y-4">
                <NewFaqForm nextSortOrder={nextFaqSortOrder} />
                <div className="space-y-3">
                  {faqRecords.map((record) => (
                    <FaqRow key={record.contentItemId} faq={record} />
                  ))}
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
