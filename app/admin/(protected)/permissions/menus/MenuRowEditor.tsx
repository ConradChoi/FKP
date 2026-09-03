'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateMenuAction, deleteMenuAction, moveMenuAction } from './actions'
import type { MenuRecord } from './page'

// Design Ref: 대표 피드백(2026-08-27) — 메뉴관리 표가 메뉴권한관리(체크박스 + 일반 텍스트,
// 테두리 없음)와 다르게 모든 칸에 항상 테두리 있는 입력창이 보여 화면 톤이 어긋났다.
// 같은 값이라도 평소엔 일반 텍스트처럼 보이다가 hover/focus 시에만 편집 가능한 입력창
// 느낌이 나도록 통일한다(둘 다 border-transparent 기본, focus 시에만 테두리/배경 표시).
const cellInputClass =
  'w-full rounded-input border border-transparent bg-transparent px-2 py-1 admin-body text-neutral-900 hover:border-neutral-200 focus:border-primary-500 focus:bg-neutral-0 focus:outline-none focus:ring-1 focus:ring-primary-500'

export function MenuRowEditor({
  menu,
  depth,
  isFirst,
  isLast,
}: {
  menu: MenuRecord
  depth: number
  isFirst: boolean
  isLast: boolean
}) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(menu.display_name)
  const [path, setPath] = useState(menu.path ?? '')
  const [isActive, setIsActive] = useState(menu.is_active)
  const [saving, setSaving] = useState(false)
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = displayName !== menu.display_name || path !== (menu.path ?? '') || isActive !== menu.is_active

  async function save() {
    setSaving(true)
    setError(null)
    const result = await updateMenuAction({ id: menu.id, displayName, path: path || null, sortOrder: menu.sort_order, isActive })
    setSaving(false)
    if (!result.success) {
      setError('저장 실패')
      return
    }
    router.refresh()
  }

  // Design Ref: 대표 피드백(2026-08-27) — sort_order 숫자를 직접 계산해 입력하는 방식이
  // 불편하다는 지적에 따라 위/아래 버튼으로 형제 메뉴와 순서를 맞바꾼다(20260827150000
  // move_menu). isFirst/isLast는 같은 부모를 둔 형제 범위에서 계산된다(lib/admin/menuTree).
  async function move(direction: 'up' | 'down') {
    setMoving(true)
    setError(null)
    const result = await moveMenuAction(menu.id, direction)
    setMoving(false)
    if (!result.success) {
      setError('순서 변경 실패')
      return
    }
    router.refresh()
  }

  async function remove() {
    if (!window.confirm(`"${menu.display_name}" 메뉴를 삭제할까요? 이 메뉴에 대한 권한 매트릭스 설정도 함께 삭제됩니다.`)) return
    const result = await deleteMenuAction(menu.id)
    if (!result.success) {
      window.alert('삭제 실패 — 하위 메뉴가 있으면 먼저 삭제해주세요.')
      return
    }
    router.refresh()
  }

  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <td className="px-4 py-2" style={{ paddingLeft: `${16 + depth * 20}px` }}>
        <input className={cellInputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        {menu.menu_type === 'group' && <span className="ml-1 admin-label-sm text-neutral-400">(그룹)</span>}
      </td>
      <td className="px-4 py-2 font-mono admin-label-sm text-neutral-500">{menu.code}</td>
      <td className="px-4 py-2">
        <input
          className={cellInputClass}
          value={path}
          placeholder="(그룹은 경로 없음)"
          onChange={(e) => setPath(e.target.value)}
        />
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => move('up')}
            disabled={isFirst || moving}
            aria-label="위로 이동"
            className="rounded-input px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => move('down')}
            disabled={isLast || moving}
            aria-label="아래로 이동"
            className="rounded-input px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            ▼
          </button>
        </div>
      </td>
      <td className="px-4 py-2 text-center">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-3 admin-body-sm">
          {dirty && (
            <button type="button" onClick={save} disabled={saving} className="text-primary-600 hover:underline">
              저장
            </button>
          )}
          <button type="button" onClick={remove} className="text-error hover:underline">
            삭제
          </button>
        </div>
        {error && <p className="admin-label-sm text-error">{error}</p>}
      </td>
    </tr>
  )
}
