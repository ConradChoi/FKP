'use client'

// Design Ref: seepn-admin-ui-design-system.spec.md §6.1 ("활성/비활성 체크박스 |
// MenuRowEditor.tsx | A2-R2에 그대로 이식") — 활성/FKP 노출 두 체크박스의 실제 편집 지점은
// (메뉴관리 트리 행 컨벤션을 그대로 따라) 이 행 자체다. 상세 패널(CategoryDetailPanel)은 이
// 값을 다시 편집 가능하게 중복 렌더링하지 않고 읽기전용 요약만 보여준다 — 같은 두 불리언을
// 두 곳에서 각각 dirty-state로 들고 있으면 동기화 버그가 생기기 쉽고, 380행 규모에서 상세
// 패널의 존재 이유는 (§6.3) "ko/en/ja 3개 언어 편집 폭"이지 이 두 체크박스가 아니기 때문.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCategoryStatusAction } from './actions'
import type { StandardCategoryRecord } from './page'
import { displayName } from './categoryTreeUtils'

export interface CategoryTreeNode extends StandardCategoryRecord {
  children: CategoryTreeNode[]
}

const SOURCE_BADGE: Record<StandardCategoryRecord['source'], { label: string; className: string }> = {
  narajangter_standard: { label: '표준', className: 'bg-neutral-100 text-neutral-600' },
  seepn_custom: { label: '신설', className: 'bg-primary-50 text-primary-700' },
}

export function CategoryTreeRow({
  node,
  depth,
  isSelected,
  isExpanded,
  expandDisabled,
  onToggleExpand,
  onSelect,
}: {
  node: CategoryTreeNode
  depth: number
  isSelected: boolean
  isExpanded: boolean
  expandDisabled: boolean
  onToggleExpand: () => void
  onSelect: () => void
}) {
  const router = useRouter()
  const [isActive, setIsActive] = useState(node.is_active)
  const [exposedToFkp, setExposedToFkp] = useState(node.exposed_to_fkp)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasChildren = node.children.length > 0
  const dirty = isActive !== node.is_active || exposedToFkp !== node.exposed_to_fkp
  const sourceBadge = SOURCE_BADGE[node.source]
  const isEmpty = node.partnerCount === 0

  function handleToggleFkp(checked: boolean) {
    // Design Ref: screen-spec §3.2 — L2/L3(depth>0, parent_id 존재) 노드를 FKP 노출로 켜려 할
    // 때 확인 툴팁("L1 레벨 노출을 권장합니다") — 막지 않고 경고만 한다.
    if (checked && node.parent_id) {
      const ok = window.confirm('L1 레벨 노출을 권장합니다(PRD 권고: 8~15개 이내) — 계속하시겠습니까?')
      if (!ok) return
    }
    setExposedToFkp(checked)
  }

  function collectDescendantIds(n: CategoryTreeNode): string[] {
    const result: string[] = []
    for (const child of n.children) {
      result.push(child.id, ...collectDescendantIds(child))
    }
    return result
  }

  async function save() {
    // Design Ref: screen-spec §3.6 E9/E10 — DB does not propagate is_active or auto-clear
    // exposed_to_fkp to descendants (no trigger). Ask once, at save time, rather than on every
    // checkbox click, so a single "저장" click both flips this node and (opt-in) its subtree.
    let nextExposed = exposedToFkp
    let cascadeIds: string[] = []
    const turningOff = node.is_active && !isActive
    if (turningOff) {
      const descendantIds = collectDescendantIds(node)
      if (descendantIds.length > 0 && window.confirm(`하위 카테고리가 ${descendantIds.length}개 있습니다. 함께 비활성화할까요?`)) {
        cascadeIds = descendantIds
      }
      if (nextExposed && window.confirm('FKP 노출도 함께 해제할까요?')) {
        nextExposed = false
      }
    }

    setSaving(true)
    setError(null)
    const result = await updateCategoryStatusAction({
      id: node.id,
      isActive,
      exposedToFkp: nextExposed,
      cascadeDeactivateIds: cascadeIds,
    })
    setSaving(false)
    if (!result.success) {
      setError('저장 실패')
      return
    }
    setExposedToFkp(nextExposed)
    router.refresh()
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-input px-2 py-1.5 ${isSelected ? 'bg-primary-50' : 'hover:bg-neutral-50'} ${isEmpty ? 'opacity-50' : ''}`}
      style={{ paddingLeft: `${8 + depth * 20}px` }}
    >
      {hasChildren ? (
        <button
          type="button"
          onClick={onToggleExpand}
          disabled={expandDisabled}
          aria-label={isExpanded ? '접기' : '펼치기'}
          className="w-4 shrink-0 text-neutral-400 hover:text-neutral-600 disabled:cursor-default"
        >
          {isExpanded ? '▾' : '▸'}
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}

      <label className="flex shrink-0 items-center" title="활성">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
      </label>

      <button type="button" onClick={onSelect} className="min-w-0 flex-1 truncate text-left admin-body text-neutral-900">
        {displayName(node)}
      </button>

      <span className={`shrink-0 rounded-sm px-1.5 py-0.5 admin-label-sm ${sourceBadge.className}`}>{sourceBadge.label}</span>

      <label
        className="flex shrink-0 items-center gap-1 rounded-sm border border-primary-200 bg-primary-50/60 px-1.5 py-0.5"
        title="FKP 노출"
      >
        <input
          type="checkbox"
          checked={exposedToFkp}
          onChange={(e) => handleToggleFkp(e.target.checked)}
          className="accent-primary-600"
        />
        <span className="admin-label-sm font-medium text-primary-700">FKP</span>
      </label>

      <span className="w-14 shrink-0 text-right admin-body-sm text-neutral-400">· {node.partnerCount}곳</span>

      {dirty && (
        <button type="button" onClick={save} disabled={saving} className="shrink-0 admin-label-sm text-primary-600 hover:underline">
          저장
        </button>
      )}
      {error && <span className="shrink-0 admin-label-sm text-error">{error}</span>}
    </div>
  )
}
