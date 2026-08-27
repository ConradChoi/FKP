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

export function flattenMenuTree<T>(nodes: (T & MenuTreeNode<T>)[], depth = 0): { node: T; depth: number }[] {
  return nodes.flatMap((n) => [{ node: n, depth }, ...flattenMenuTree(n.children as (T & MenuTreeNode<T>)[], depth + 1)])
}
