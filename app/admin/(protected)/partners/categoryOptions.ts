// Design Ref: docs/02-design/features/partner-category-management.screen-spec.md §2.2.3 —
// "카테고리 선택기는 380여 개 트리에서 몇 개를 고르는 UI이므로 전체 트리 화면과는 다른, 간단한
// 검색+선택 위젯이어야 합니다" (CategoryPicker.tsx). This helper fetches the flat option list
// shared by the list filter bar and the Capability tab's category selector — both need the same
// {id, name, parent breadcrumb} shape, so it lives here once rather than being re-derived twice.
// standard_category has no RPC (20260829150000's design is plain column-grant CRUD, same as
// /admin/categories) — this is a direct two-table SELECT + client-side merge, same pattern as
// app/admin/(protected)/categories/page.tsx.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface CategoryOption {
  id: string
  parentId: string | null
  code: string | null
  name: string
  path: string // breadcrumb "L1 > L2 > L3", ko-name based
}

export async function fetchCategoryOptions(supabase: SupabaseClient): Promise<CategoryOption[]> {
  const [{ data: categories }, { data: translations }] = await Promise.all([
    supabase.from('standard_category').select('id, parent_id, code'),
    supabase.from('standard_category_translation').select('category_id, name').eq('locale', 'ko'),
  ])

  const nameByCategory = new Map<string, string>((translations ?? []).map((t) => [t.category_id, t.name]))
  const rows = categories ?? []
  const byId = new Map(rows.map((c) => [c.id, c]))

  function nameOf(id: string): string {
    return nameByCategory.get(id) ?? '(이름 없음)'
  }

  function pathOf(id: string): string {
    const chain: string[] = []
    let current: { id: string; parent_id: string | null } | undefined = byId.get(id)
    while (current) {
      chain.unshift(nameOf(current.id))
      current = current.parent_id ? byId.get(current.parent_id) : undefined
    }
    return chain.join(' > ')
  }

  return rows
    .map((c) => ({ id: c.id, parentId: c.parent_id, code: c.code, name: nameOf(c.id), path: pathOf(c.id) }))
    .sort((a, b) => a.path.localeCompare(b.path, 'ko'))
}
