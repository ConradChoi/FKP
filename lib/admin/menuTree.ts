// Design Ref: INV-2 — shared tree-building helper for anything that renders public.menu
// rows hierarchically. Generic over the row shape so both the sidebar (my_menu_tree()'s
// narrower, already-permission-filtered rows) and the 메뉴관리 screen (raw public.menu rows,
// including inactive ones an operator might want to reactivate) can reuse it.
export interface MenuTreeNode<T> {
  children: MenuTreeNode<T>[]
}

export function buildMenuTree<T extends { id: string; parent_id: string | null }>(
  rows: T[],
): (T & MenuTreeNode<T>)[] {
  type Node = T & MenuTreeNode<T>
  const byId = new Map<string, Node>(rows.map((r) => [r.id, { ...r, children: [] }] as [string, Node]))
  const roots: Node[] = []
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

export function flattenMenuTree<T>(
  nodes: (T & MenuTreeNode<T>)[],
  depth = 0,
): { node: T; depth: number; isFirst: boolean; isLast: boolean }[] {
  // isFirst/isLast are computed among `nodes` itself (the siblings at this recursion
  // level — either all roots, or one parent's children), which is exactly the scope
  // move_menu (20260827150000) swaps sort_order within.
  return nodes.flatMap((n, i) => [
    { node: n, depth, isFirst: i === 0, isLast: i === nodes.length - 1 },
    ...flattenMenuTree(n.children as (T & MenuTreeNode<T>)[], depth + 1),
  ])
}

// Design Ref: seepn-admin-ui-design-system.spec.md §3.3 (AdminTopbar) — derives the page title
// from the same DB-driven menu tree (INV-2 SSOT) instead of a new per-page title prop, so
// adding a menu row is enough to give a new screen a topbar title. Longest-prefix match (not
// exact-path match) so a dynamic detail route like /admin/leads/[id] still resolves to its
// list screen's menu entry (/admin/leads) rather than falling back to no title at all.
export function findMenuForPath<T extends { path: string | null }>(
  flatNodes: { node: T }[],
  pathname: string,
): T | undefined {
  let best: T | undefined
  let bestLength = -1
  for (const { node } of flatNodes) {
    if (!node.path) continue
    const isMatch = node.path === pathname || pathname.startsWith(`${node.path}/`)
    if (isMatch && node.path.length > bestLength) {
      best = node
      bestLength = node.path.length
    }
  }
  return best
}
