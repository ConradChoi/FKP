// Design Ref: 콘텐츠관리(Phase 5-B/5-C) — 카테고리 마스터 데이터 + 랜딩페이지 마케팅 카피.
// 블로그/사례/FAQ(Phase 5-D)는 대표 피드백(2026-08-27)에 따라 메뉴관리에서 새로 구성한
// 게시판관리(board_management) > 블로그/사례/FAQ 메뉴로 이동했다(app/admin/(protected)/board/*).
// 데이터 접근 권한(content_management RLS/RPC)은 메뉴 이동과 무관하게 그대로 공유한다.
import { redirect } from 'next/navigation'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { CategoryRow, type CategoryRecord, type CategoryTranslationRow } from './CategoryRow'
import { NewCategoryForm } from './NewCategoryForm'
import { LandingCopyRow, type LandingCopyItem, type ContentTextTranslationRow } from './LandingCopyRow'
import { ContentTabs } from './ContentTabs'
import { LANDING_COPY_SECTIONS, LANDING_COPY_LABELS } from '@/lib/admin/landingCopyLabels'

export default async function ContentManagementPage() {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  const [
    { data: categories, error: categoriesError },
    { data: categoryTranslations, error: categoryTranslationsError },
    { data: contentItems, error: contentItemsError },
  ] = await Promise.all([
    supabase.from('content_category').select('code, sort_order, is_active').order('sort_order'),
    supabase
      .from('content_category_translation')
      .select('category_code, locale, name, keywords, status, source_synced_at, updated_at'),
    supabase.from('content_item').select('id, content_key').eq('content_type', 'landing_copy').order('sort_order'),
  ])

  const contentItemIds = (contentItems ?? []).map((i) => i.id)
  const { data: contentTranslations, error: contentTranslationsError } =
    contentItemIds.length > 0
      ? await supabase
          .from('content_translation')
          .select('content_item_id, locale, body, status, source_synced_at, updated_at')
          .in('content_item_id', contentItemIds)
      : { data: [], error: null }

  const error = categoriesError ?? categoryTranslationsError ?? contentItemsError ?? contentTranslationsError

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
  const nextSortOrder = categoryRecords.length > 0 ? Math.max(...categoryRecords.map((r) => r.sort_order)) + 10 : 10

  const itemByKey = new Map((contentItems ?? []).map((i) => [i.content_key, i.id as string]))
  const landingCopyItems: LandingCopyItem[] = LANDING_COPY_SECTIONS.flatMap((section) =>
    section.keys.map((key) => {
      const contentItemId = itemByKey.get(key) ?? ''
      const translations: Record<string, ContentTextTranslationRow | null> = { en: null, ja: null }
      for (const t of contentTranslations ?? []) {
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

  return (
    <div className="mx-auto max-w-[1000px]">
      <h1 className="text-h3 text-primary-900">콘텐츠관리</h1>
      <p className="mt-1 text-body-sm text-neutral-600">
        카테고리 마스터 데이터와 랜딩페이지 마케팅 카피를 관리합니다. 게시(published) 상태인 내용은 최대 1분(ISR) 이내
        공개 사이트에 반영됩니다. 블로그/사례/FAQ는 좌측 게시판관리 메뉴로 이동했습니다.
      </p>

      {error && <p className="mt-4 text-body-sm text-error">불러오지 못했습니다: {error.message}</p>}

      <ContentTabs
        tabs={[
          {
            key: 'categories',
            label: '카테고리',
            content: (
              <div className="space-y-4">
                <NewCategoryForm nextSortOrder={nextSortOrder} />
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
        ]}
      />
    </div>
  )
}
