// Design Ref: docs/02-design/features/partner-category-management.screen-spec.md §2.2.3 —
// "카테고리 선택기는 380여 개 트리에서 몇 개를 고르는 UI이므로 전체 트리 화면과는 다른, 간단한
// 검색+선택 위젯이어야 합니다" (CategoryPicker.tsx). This helper fetches the flat option list
// shared by the list filter bar and the Capability tab's category selector — both need the same
// {id, name, parent breadcrumb} shape, so it lives here once rather than being re-derived twice.
// standard_category has no RPC (20260829150000's design is plain column-grant CRUD, same as
// /admin/categories) — this is a direct two-table SELECT + client-side merge, same pattern as
// app/admin/(protected)/categories/page.tsx.
import type { SupabaseClient } from '@supabase/supabase-js'

// Design Ref: partner-standard-category-picker-redesign.screen-spec.md §13(2026-09-13, D-9/D-10).
// L0(최상위)은 정확히 3개 노드로 확인됨(data/seepn_standard_categories_2.0.xlsx "📋 표준 카테고리"
// 시트 직접 파싱, 3+10+6=20 L1) — "상품"(product vertical), "서비스"(service vertical),
// "상품+서비스"(vertical 무관, 두 vertical 모두에게 노출되어야 하는 branch). partner.vertical
// 자체는 여전히 'product'|'service' 두 값뿐이다(제3값 아님).
export const CATEGORY_ROOT_NAME_PRODUCT = '상품'
export const CATEGORY_ROOT_NAME_SERVICE = '서비스'
export const CATEGORY_ROOT_NAME_BOTH = '상품+서비스'

export type PartnerCategoryVertical = 'product' | 'service'

export interface CategoryOption {
  id: string
  parentId: string | null
  code: string | null
  name: string
  path: string // breadcrumb "L0 > L1 > L2 > L3", 루트 포함(ko-name 기반) — 기존 소비자(목록 필터 등) 하위호환용
  rootId: string // 이 노드가 속한 L0 노드의 id (노드 자신이 L0이면 자기 자신의 id)
  rootName: string // 이 노드가 속한 L0 노드의 이름("상품"/"서비스"/"상품+서비스")
  depth: number // 0=L0(루트), 1=L1, 2=L2, 3=L3
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

  // parent_id 체인을 루트까지 따라 올라가며 각 노드의 이름을 모은다. D-9(vertical 필터)/D-10(L0
  // 숨김) 둘 다 이 체인 하나로 계산 가능 — chain[0]이 L0(루트), chain.length-1이 depth.
  function chainOf(id: string): string[] {
    const chain: string[] = []
    const visited = new Set<string>()
    let current: { id: string; parent_id: string | null } | undefined = byId.get(id)
    while (current && !visited.has(current.id)) {
      visited.add(current.id)
      chain.unshift(nameOf(current.id))
      current = current.parent_id ? byId.get(current.parent_id) : undefined
    }
    return chain
  }

  function rootIdOf(id: string): string {
    let current = byId.get(id)
    if (!current) return id
    const visited = new Set<string>([current.id])
    while (current.parent_id && byId.has(current.parent_id) && !visited.has(current.parent_id)) {
      current = byId.get(current.parent_id)!
      visited.add(current.id)
    }
    return current.id
  }

  return rows
    .map((c) => {
      const chain = chainOf(c.id)
      const rootId = rootIdOf(c.id)
      return {
        id: c.id,
        parentId: c.parent_id,
        code: c.code,
        name: nameOf(c.id),
        path: chain.join(' > '),
        rootId,
        rootName: nameOf(rootId),
        depth: chain.length - 1,
      }
    })
    .sort((a, b) => a.path.localeCompare(b.path, 'ko'))
}

/**
 * D-9 + D-10: 파트너 자신의 vertical 하위 트리 ∪ "상품+서비스" 하위 트리만 남기고, L0(루트)
 * 노드 자체는 제거하며, path에서 L0 세그먼트를 숨긴다(L1부터 표시). CapabilityForm.tsx(파트너
 * 자가입력)·CapabilityTab.tsx(Admin 대행입력) 두 곳의 카테고리 모달 전용 — 목록 필터
 * (PartnerFilters.tsx/CategoryPicker.tsx)는 전체 트리를 그대로 써야 하므로 이 함수를 쓰지
 * 않는다(§13.3).
 *
 * vertical이 아직 선택되지 않은 경우(null/undefined) 필터링 기준이 없으므로 빈 배열을 반환한다
 * — 호출부(CapabilityForm/CapabilityTab)가 이 경우 카테고리 선택 UI 자체를 비활성화하고 "먼저
 * 기본정보에서 상품/서비스를 선택하세요" 안내로 대체해야 한다.
 */
export function filterCategoryOptionsForVertical(
  options: CategoryOption[],
  // 호출부의 vertical 필드 타입이 스키마별로 'product'|'service'|null(PartnerProfile)이거나
  // string|null(PartnerDetail 등 더 넓은 DB row 타입)일 수 있어 string도 받아들인다 — 'product'/
  // 'service' 외의 값(빈 값 포함)은 필터링 기준이 없다고 보고 빈 배열을 반환한다.
  vertical: PartnerCategoryVertical | string | null | undefined,
): CategoryOption[] {
  if (vertical !== 'product' && vertical !== 'service') return []
  const ownRootName = vertical === 'product' ? CATEGORY_ROOT_NAME_PRODUCT : CATEGORY_ROOT_NAME_SERVICE

  return options
    .filter((o) => o.depth > 0 && (o.rootName === ownRootName || o.rootName === CATEGORY_ROOT_NAME_BOTH))
    .map((o) => ({ ...o, path: pathWithoutRootSegment(o.path) }))
}

function pathWithoutRootSegment(path: string): string {
  const separatorIndex = path.indexOf(' > ')
  return separatorIndex === -1 ? path : path.slice(separatorIndex + 3)
}
