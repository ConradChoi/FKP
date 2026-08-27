'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateMenuAction, deleteMenuAction } from './actions'
import type { MenuRecord } from './page'
import { errorTextClass } from '@/components/RequestForm/styles'

// Design Ref: 대표 피드백(2026-08-27) — 메뉴관리 표가 메뉴권한관리(체크박스 + 일반 텍스트,
// 테두리 없음)와 다르게 모든 칸에 항상 테두리 있는 입력창이 보여 화면 톤이 어긋났다.
// 같은 값이라도 평소엔 일반 텍스트처럼 보이다가 hover/focus 시에만 편집 가능한 입력창
// 느낌이 나도록 통일한다(둘 다 border-transparent 기본, focus 시에만 테두리/배경 표시).
const cellInputClass =
  'w-full rounded-input border border-transparent bg-transparent px-2 py-1 text-body-sm text-neutral-900 hover:border-neutral-200 focus:border-primary-500 focus:bg-neutral-0 focus:outline-none focus:ring-1 focus:ring-primary-500'

export function MenuRowEditor({ menu, depth }: { menu: MenuRecord; depth: number }) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(menu.display_name)
  const [path, setPath] = useState(menu.path ?? '')
  const [sortOrder, setSortOrder] = useState(menu.sort_order)
  const [isActive, setIsActive] = useState(menu.is_active)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = displayName !== menu.display_name || path !== (menu.path ?? '') || sortOrder !== menu.sort_order || isActive !== menu.is_active

  async function save() {
    setSaving(true)
    setError(null)
    const result = await updateMenuAction({ id: menu.id, displayName, path: path || null, sortOrder, isActive })
    setSaving(false)
    if (!result.success) {
      setError('저장 실패')
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
      <td className="px-2 py-2" style={{ paddingLeft: `${16 + depth * 20}px` }}>
        <input className={cellInputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        {menu.menu_type === 'group' && <span className="ml-1 text-label-caption text-neutral-400">(그룹)</span>}
      </td>
      <td className="px-4 py-2 font-mono text-label-caption text-neutral-500">{menu.code}</td>
      <td className="px-2 py-2">
        <input
          className={cellInputClass}
          value={path}
          placeholder="(그룹은 경로 없음)"
          onChange={(e) => setPath(e.target.value)}
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="number"
          className={`${cellInputClass} w-16 text-center`}
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
        />
      </td>
      <td className="px-4 py-2 text-center">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-3 text-body-sm">
          {dirty && (
            <button type="button" onClick={save} disabled={saving} className="text-primary-600 hover:underline">
              저장
            </button>
          )}
          <button type="button" onClick={remove} className="text-error hover:underline">
            삭제
          </button>
        </div>
        {error && <p className={errorTextClass}>{error}</p>}
      </td>
    </tr>
  )
}
