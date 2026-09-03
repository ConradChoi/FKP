// Design Ref: docs/02-design/features/partner-category-management.screen-spec.md §3
// (/admin/categories — master-detail 2-pane layout) and
// docs/02-design/features/seepn-admin-ui-design-system.spec.md §6 (CategoryTree component
// spec). No RPC exists for public.standard_category (20260829150000's design is plain
// column-grant CRUD, unlike public.menu's create_menu/update_menu/move_menu/delete_menu) —
// this page fetches the full tree + ko/en/ja translations + partner_standard_category
// counts directly and hands flat, merged rows to the client CategoryManager, which builds
// the nested tree itself (buildMenuTree is reused as-is; flattenMenuTree is deliberately
// NOT reused — see CategoryManager.tsx — because it cannot express collapsed state, and at
// ~380+ nodes (PRD §3.5.3) a fully flattened, always-expanded table is unusable).
import { redirect } from 'next/navigation'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { CategoryManager } from './CategoryManager'

export type CategorySource = 'narajangter_standard' | 'seepn_custom'
export type CategoryLocale = 'ko' | 'en' | 'ja'
export type TranslationStatus = 'draft' | 'translated' | 'published'

export interface CategoryTranslationRecord {
  name: string
  status: TranslationStatus
  source_synced_at: string | null
  updated_at: string
}

export interface StandardCategoryRecord {
  id: string
  parent_id: string | null
  code: string | null
  source: CategorySource
  is_active: boolean
  sort_order: number
  exposed_to_fkp: boolean
  created_at: string
  updated_at: string
  translations: Record<CategoryLocale, CategoryTranslationRecord | null>
  partnerCount: number
}

export default async function CategoriesPage() {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  const [
    { data: categories, error: categoryError },
    { data: translations, error: translationError },
    { data: links, error: linksError },
  ] = await Promise.all([
    supabase
      .from('standard_category')
      .select('id, parent_id, code, source, is_active, sort_order, exposed_to_fkp, created_at, updated_at')
      .order('sort_order'),
    supabase.from('standard_category_translation').select('category_id, locale, name, status, source_synced_at, updated_at'),
    supabase.from('partner_standard_category').select('standard_category_id'),
  ])

  const translationsByCategory = new Map<string, Record<CategoryLocale, CategoryTranslationRecord | null>>()
  for (const t of translations ?? []) {
    const bucket = translationsByCategory.get(t.category_id) ?? { ko: null, en: null, ja: null }
    bucket[t.locale as CategoryLocale] = {
      name: t.name,
      status: t.status,
      source_synced_at: t.source_synced_at,
      updated_at: t.updated_at,
    }
    translationsByCategory.set(t.category_id, bucket)
  }

  const partnerCountByCategory = new Map<string, number>()
  for (const link of links ?? []) {
    partnerCountByCategory.set(link.standard_category_id, (partnerCountByCategory.get(link.standard_category_id) ?? 0) + 1)
  }

  const records: StandardCategoryRecord[] = (categories ?? []).map((c) => ({
    ...c,
    translations: translationsByCategory.get(c.id) ?? { ko: null, en: null, ja: null },
    partnerCount: partnerCountByCategory.get(c.id) ?? 0,
  }))

  const loadError = categoryError ?? translationError ?? linksError

  return (
    <div>
      <p className="admin-body-sm text-neutral-600">
        나라장터 표준 카테고리와 SEEPN 자체 신설 카테고리를 함께 관리합니다. FKP 요청폼에는 여기서
        &ldquo;FKP 노출&rdquo;로 명시적으로 켠 카테고리만 노출됩니다(기본값 비노출).
      </p>

      {loadError && <p className="mt-4 admin-body-sm text-error">목록을 불러오지 못했습니다: {loadError.message}</p>}

      <div className="mt-4">
        <CategoryManager initialCategories={records} />
      </div>
    </div>
  )
}
