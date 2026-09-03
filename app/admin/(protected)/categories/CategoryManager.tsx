'use client'

// Design Ref: docs/02-design/features/partner-category-management.screen-spec.md §3.1
// (master-detail 2-pane layout), §3.2 (트리 패널 동작 — 검색/기본펼침/출처배지/참조카운트),
// seepn-admin-ui-design-system.spec.md §6.3 (380+ 노드 규모를 다루려면 마스터-디테일이 필요한
// 이유). buildMenuTree(lib/admin/menuTree.ts)는 그대로 재사용하지만 flattenMenuTree는 재사용하지
// 않는다 — 모든 깊이를 무조건 평탄화해 접힘 상태를 표현할 수 없기 때문(§3.2). 대신 이 컴포넌트가
// 직접 재귀 렌더링하며 depth/isFirst/isLast를 그때그때 계산한다.
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { buildMenuTree } from '@/lib/admin/menuTree'
import { adminInputClass } from '@/components/admin/styles'
import { CategoryTreeRow, type CategoryTreeNode } from './CategoryTreeRow'
import { CategoryDetailPanel } from './CategoryDetailPanel'
import { NewCategoryForm } from './NewCategoryForm'
import type { StandardCategoryRecord } from './page'
import { buildById, getAncestorIds, matchesFilters, FKP_EXPOSURE_RECOMMENDED_MAX, type CategoryFilterParams } from './categoryTreeUtils'

type SourceFilter = CategoryFilterParams['source']
type ActiveFilter = CategoryFilterParams['active']

export function CategoryManager({ initialCategories }: { initialCategories: StandardCategoryRecord[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initialCategories.filter((c) => !c.parent_id).map((c) => c.id)),
  )

  const categories = initialCategories
  const byId = useMemo(() => buildById(categories), [categories])
  const tree = useMemo(() => buildMenuTree<StandardCategoryRecord>(categories) as CategoryTreeNode[], [categories])

  const isFiltering = search.trim().length > 0 || sourceFilter !== 'all' || activeFilter !== 'all'

  const visibleIds = useMemo(() => {
    if (!isFiltering) return null
    const params: CategoryFilterParams = { search, source: sourceFilter, active: activeFilter }
    const matched = categories.filter((c) => matchesFilters(c, params))
    const visible = new Set<string>()
    for (const m of matched) {
      visible.add(m.id)
      for (const ancestorId of getAncestorIds(m.id, byId)) visible.add(ancestorId)
    }
    return visible
  }, [isFiltering, search, sourceFilter, activeFilter, categories, byId])

  const exposedCount = useMemo(() => categories.filter((c) => c.exposed_to_fkp).length, [categories])

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleClearFilters() {
    setSearch('')
    setSourceFilter('all')
    setActiveFilter('all')
  }

  function handleCreated(id: string, parentId: string | null) {
    // Design Ref: screen-spec §3.2 — 새로 만든 노드가 즉시 보이도록 그 부모(있다면)를 펼침
    // 상태에 추가하고 선택한다. L1로 새로 생성된 경우 자기 자신을 펼침 상태에 넣어둔다(향후
    // 자식이 생겼을 때 접혀 있지 않도록).
    setExpanded((prev) => {
      const next = new Set(prev)
      next.add(parentId ?? id)
      return next
    })
    setSelectedId(id)
    router.refresh()
  }

  function renderNode(node: CategoryTreeNode, depth: number): React.ReactNode {
    if (visibleIds && !visibleIds.has(node.id)) return null

    const hasChildren = node.children.length > 0
    const isExpanded = isFiltering ? true : expanded.has(node.id)

    return (
      <div key={node.id}>
        <CategoryTreeRow
          node={node}
          depth={depth}
          isSelected={selectedId === node.id}
          isExpanded={isExpanded}
          expandDisabled={isFiltering}
          onToggleExpand={() => toggleExpand(node.id)}
          onSelect={() => setSelectedId(node.id)}
        />
        {hasChildren && isExpanded && <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>}
      </div>
    )
  }

  const selected = selectedId ? (byId.get(selectedId) ?? null) : null

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${adminInputClass} w-64`}
          placeholder="검색: 카테고리명 또는 코드"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={adminInputClass} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}>
          <option value="all">출처: 전체</option>
          <option value="narajangter_standard">출처: 나라장터 표준</option>
          <option value="seepn_custom">출처: SEEPN 자체 신설</option>
        </select>
        <select className={adminInputClass} value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}>
          <option value="all">활성: 전체</option>
          <option value="active">활성: 활성만</option>
          <option value="inactive">활성: 비활성만</option>
        </select>
        {isFiltering && (
          <button type="button" onClick={handleClearFilters} className="admin-body-sm text-neutral-500 hover:underline">
            지우기
          </button>
        )}
        <span className={`ml-auto admin-body-sm ${exposedCount > FKP_EXPOSURE_RECOMMENDED_MAX ? 'text-accent-700' : 'text-neutral-500'}`}>
          FKP 노출: {exposedCount}/{FKP_EXPOSURE_RECOMMENDED_MAX}
          {exposedCount > FKP_EXPOSURE_RECOMMENDED_MAX && ' (권장 상한 초과)'}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="h-[calc(100vh-220px)] min-h-[400px] overflow-y-auto rounded-card border border-neutral-200 bg-neutral-0 p-2">
            {tree.length === 0 && <p className="p-4 admin-body-sm text-neutral-400">등록된 카테고리가 없습니다.</p>}
            {tree.map((node) => renderNode(node, 0))}
            {tree.length > 0 && isFiltering && visibleIds?.size === 0 && (
              <p className="p-4 admin-body-sm text-neutral-400">조건에 맞는 카테고리가 없습니다.</p>
            )}
          </div>
        </div>
        <div className="lg:col-span-2">
          <CategoryDetailPanel categories={categories} selected={selected} onDeleted={() => setSelectedId(null)} />
        </div>
      </div>

      <div className="mt-4">
        <NewCategoryForm categories={categories} onCreated={handleCreated} />
      </div>
    </div>
  )
}
