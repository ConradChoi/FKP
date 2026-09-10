// Design Ref: docs/02-design/features/seepn-buyer-web-p5a.screen-spec.md §4.2 (D-S4) — L1(대분류)
// is always shown with a "(N)" badge (N = rollup: itself + every descendant, from
// public.get_standard_category_rollup_counts()), disabled when N=0. L2/L3 nodes with a direct
// link count of 0 are hidden entirely (not shown, not disabled) — screen-spec's stated reason is
// "374개 대부분을 다 보여주면 스크롤이 압도적으로 길어지고 골라도 빈 화면이 반복된다".
//
// Counts are computed with NO other filter applied (privacy review §3.3 / screen-spec OQ-B6
// "단순화(미적용 기준) 권고" — adopted as-is, no per-combination live recompute).
//
// Selecting a node filters partners to that node AND every descendant (matches the same
// ancestor-closure semantics the L1 badge count already promises — selecting a category and
// getting 0 results despite a positive badge would be a worse UX bug than the extra join here).
import type { SupabaseClient } from '@supabase/supabase-js'

export interface CategoryNode {
  id: string
  parentId: string | null
  name: string
  isRoot: boolean
  directCount: number
  rollupCount: number
  children: CategoryNode[]
}

interface RawCategory {
  id: string
  parent_id: string | null
}

export async function fetchPublicCategoryTree(supabase: SupabaseClient): Promise<CategoryNode[]> {
  const [{ data: categories }, { data: translations }, { data: directCounts }, { data: rollupCounts }] = await Promise.all([
    supabase.from('standard_category').select('id, parent_id').eq('is_active', true),
    supabase.from('standard_category_translation').select('category_id, name').eq('locale', 'ko'),
    supabase.from('partner_category_count_public').select('standard_category_id, partner_count'),
    supabase.rpc('get_standard_category_rollup_counts'),
  ])

  const rows = (categories ?? []) as RawCategory[]
  const nameById = new Map<string, string>((translations ?? []).map((t) => [t.category_id, t.name]))
  const directById = new Map<string, number>(
    (directCounts ?? []).map((c: { standard_category_id: string; partner_count: number }) => [c.standard_category_id, c.partner_count]),
  )
  const rollupById = new Map<string, number>(
    (rollupCounts ?? []).map((c: { standard_category_id: string; partner_count: number }) => [c.standard_category_id, c.partner_count]),
  )

  const nodeById = new Map<string, CategoryNode>()
  for (const row of rows) {
    nodeById.set(row.id, {
      id: row.id,
      parentId: row.parent_id,
      name: nameById.get(row.id) ?? '(이름 없음)',
      isRoot: row.parent_id === null,
      directCount: directById.get(row.id) ?? 0,
      rollupCount: rollupById.get(row.id) ?? 0,
      children: [],
    })
  }

  const roots: CategoryNode[] = []
  for (const node of nodeById.values()) {
    if (node.parentId && nodeById.has(node.parentId)) {
      nodeById.get(node.parentId)!.children.push(node)
    } else if (node.isRoot) {
      roots.push(node)
    }
  }

  const sortByName = (a: CategoryNode, b: CategoryNode) => a.name.localeCompare(b.name, 'ko')
  function sortTree(nodes: CategoryNode[]) {
    nodes.sort(sortByName)
    for (const n of nodes) sortTree(n.children)
  }
  sortTree(roots)

  return roots
}

// Expands a selected category id to itself + every descendant id (ancestor-closure semantics —
// keeps "select this node" consistent with the rollup count shown on L1 badges).
export function expandCategoryIdsWithDescendants(tree: CategoryNode[], selectedIds: string[]): string[] {
  const byId = new Map<string, CategoryNode>()
  function index(nodes: CategoryNode[]) {
    for (const n of nodes) {
      byId.set(n.id, n)
      index(n.children)
    }
  }
  index(tree)

  const result = new Set<string>()
  function collect(id: string) {
    if (result.has(id)) return
    result.add(id)
    const node = byId.get(id)
    if (!node) return
    for (const child of node.children) collect(child.id)
  }
  for (const id of selectedIds) collect(id)
  return Array.from(result)
}

export function findCategoryPath(tree: CategoryNode[], id: string): CategoryNode[] | null {
  for (const node of tree) {
    if (node.id === id) return [node]
    const childPath = findCategoryPath(node.children, id)
    if (childPath) return [node, ...childPath]
  }
  return null
}
