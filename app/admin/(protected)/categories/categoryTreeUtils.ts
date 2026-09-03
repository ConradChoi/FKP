// Design Ref: screen-spec §3.2 (search — highlight matches, auto-expand ancestors, hide
// everything else) and §3.5 (선제적 삭제 가능 여부 판단 — 하위 노드 전체 카운트/id 목록).
// Pure helpers shared by CategoryManager/CategoryDetailPanel — kept framework-free so they're
// trivially testable and reusable from either a client component or (if ever needed) a server
// action.
import type { StandardCategoryRecord, CategoryLocale } from './page'

export function buildById(categories: StandardCategoryRecord[]): Map<string, StandardCategoryRecord> {
  return new Map(categories.map((c) => [c.id, c]))
}

export function getAncestorIds(id: string, byId: Map<string, StandardCategoryRecord>): string[] {
  const result: string[] = []
  let current = byId.get(id)
  while (current?.parent_id) {
    result.push(current.parent_id)
    current = byId.get(current.parent_id)
  }
  return result
}

// Breadcrumb from root down to (and including) `id`.
export function getBreadcrumb(id: string, byId: Map<string, StandardCategoryRecord>): StandardCategoryRecord[] {
  const chain: StandardCategoryRecord[] = []
  let current = byId.get(id)
  while (current) {
    chain.unshift(current)
    current = current.parent_id ? byId.get(current.parent_id) : undefined
  }
  return chain
}

export function getChildren(id: string, categories: StandardCategoryRecord[]): StandardCategoryRecord[] {
  return categories.filter((c) => c.parent_id === id).sort((a, b) => a.sort_order - b.sort_order)
}

export function getDescendantIds(id: string, categories: StandardCategoryRecord[]): string[] {
  const childrenByParent = new Map<string, string[]>()
  for (const c of categories) {
    if (!c.parent_id) continue
    const list = childrenByParent.get(c.parent_id) ?? []
    list.push(c.id)
    childrenByParent.set(c.parent_id, list)
  }
  const result: string[] = []
  const stack = [...(childrenByParent.get(id) ?? [])]
  while (stack.length > 0) {
    const next = stack.pop()!
    result.push(next)
    stack.push(...(childrenByParent.get(next) ?? []))
  }
  return result
}

export function displayName(record: StandardCategoryRecord, locale: CategoryLocale = 'ko'): string {
  return record.translations[locale]?.name ?? record.translations.ko?.name ?? '(이름 없음)'
}

export interface CategoryFilterParams {
  search: string
  source: 'all' | StandardCategoryRecord['source']
  active: 'all' | 'active' | 'inactive'
}

export function matchesFilters(record: StandardCategoryRecord, params: CategoryFilterParams): boolean {
  if (params.source !== 'all' && record.source !== params.source) return false
  if (params.active !== 'all' && record.is_active !== (params.active === 'active')) return false

  const term = params.search.trim().toLowerCase()
  if (!term) return true

  const nameMatch = (['ko', 'en', 'ja'] as const).some((l) => record.translations[l]?.name.toLowerCase().includes(term))
  const codeMatch = record.code?.toLowerCase().includes(term) ?? false
  return nameMatch || codeMatch
}

export const FKP_EXPOSURE_RECOMMENDED_MAX = 15
