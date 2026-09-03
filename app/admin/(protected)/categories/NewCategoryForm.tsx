'use client'

// Design Ref: screen-spec §3.4 (신설 카테고리 추가). "상위 카테고리 — 트리에서 선택, 검색
// 가능한 콤보박스"를 별도 UI 라이브러리 없이 (코드베이스에 콤보박스/오토컴플리트 의존성이
// 전혀 없다 — MenuIcon 설계 결정과 같은 이유로 신규 의존성을 넣지 않았다) 텍스트 입력 +
// 필터링된 드롭다운 목록으로 직접 구현한다.
import { useEffect, useMemo, useState } from 'react'
import { createCategoryAction } from './actions'
import { adminInputClass, adminButtonPrimaryClass } from '@/components/admin/styles'
import type { StandardCategoryRecord } from './page'
import { displayName } from './categoryTreeUtils'

export function NewCategoryForm({
  categories,
  onCreated,
}: {
  categories: StandardCategoryRecord[]
  onCreated: (id: string, parentId: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [parentId, setParentId] = useState<string | null>(null)
  const [parentQuery, setParentQuery] = useState('')
  const [parentDropdownOpen, setParentDropdownOpen] = useState(false)
  const [nameKo, setNameKo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parentMatches = useMemo(() => {
    const term = parentQuery.trim().toLowerCase()
    const pool = term ? categories.filter((c) => displayName(c).toLowerCase().includes(term)) : categories
    return pool.slice(0, 20)
  }, [categories, parentQuery])

  const defaultSortOrder = useMemo(() => {
    const siblings = categories.filter((c) => c.parent_id === parentId)
    return siblings.length > 0 ? Math.max(...siblings.map((c) => c.sort_order)) + 1 : 0
  }, [categories, parentId])
  const [sortOrder, setSortOrder] = useState(defaultSortOrder)
  // Design Ref: screen-spec §3.4 — "정렬순서 [숫자, 기본값 = 형제 중 최댓값+1]": the default
  // re-derives whenever the chosen parent (i.e. the sibling group) changes; the operator can
  // still override it before submitting.
  useEffect(() => setSortOrder(defaultSortOrder), [defaultSortOrder])

  function selectParent(id: string | null, label: string) {
    setParentId(id)
    setParentQuery(label)
    setParentDropdownOpen(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const result = await createCategoryAction({ parentId, nameKo, sortOrder })
    setSaving(false)
    if (!result.success) {
      if (result.errorCode === 'TRANSLATION_FAILED' && result.data?.id) {
        setError('카테고리는 생성되었지만 이름 저장에 실패했습니다. 트리에서 방금 추가된 항목을 다시 열어 이름을 입력해주세요.')
        onCreated(result.data.id, parentId)
        return
      }
      setError('생성 실패')
      return
    }
    setParentId(null)
    setParentQuery('')
    setNameKo('')
    setOpen(false)
    if (result.data) onCreated(result.data.id, parentId)
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={adminButtonPrimaryClass}>
        + 신설 카테고리 추가
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card border border-neutral-200 bg-neutral-0 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="relative">
          <label className="admin-label-sm text-neutral-500">상위 카테고리</label>
          <input
            className={`${adminInputClass} mt-1 w-full`}
            placeholder="검색 — 미선택 시 최상위(L1)로 생성"
            value={parentQuery}
            onChange={(e) => {
              setParentQuery(e.target.value)
              setParentId(null)
              setParentDropdownOpen(true)
            }}
            onFocus={() => setParentDropdownOpen(true)}
            onBlur={() => setTimeout(() => setParentDropdownOpen(false), 150)}
          />
          {parentDropdownOpen && (
            <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-card border border-neutral-200 bg-neutral-0 shadow-lg">
              <button
                type="button"
                onClick={() => selectParent(null, '')}
                className="block w-full px-3 py-2 text-left admin-body-sm text-neutral-500 hover:bg-neutral-50"
              >
                (선택 안 함 — 최상위 L1로 생성)
              </button>
              {parentMatches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectParent(c.id, displayName(c))}
                  className="block w-full px-3 py-2 text-left admin-body-sm text-neutral-700 hover:bg-neutral-50"
                >
                  {displayName(c)}
                </button>
              ))}
              {parentMatches.length === 0 && (
                <p className="px-3 py-2 admin-body-sm text-neutral-400">일치하는 카테고리가 없습니다.</p>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="admin-label-sm text-neutral-500">명칭 (ko)</label>
          <input
            className={`${adminInputClass} mt-1 w-full`}
            placeholder="예: 번역·로컬라이제이션"
            value={nameKo}
            onChange={(e) => setNameKo(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="admin-label-sm text-neutral-500">정렬순서</label>
          <input
            className={`${adminInputClass} mt-1 w-full`}
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
          />
        </div>
      </div>

      {error && <p className="mt-2 admin-label-sm text-error">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={saving || !nameKo.trim()} className={adminButtonPrimaryClass}>
          추가
        </button>
        <button type="button" onClick={() => setOpen(false)} className="admin-body-sm text-neutral-500 hover:underline">
          취소
        </button>
      </div>
    </form>
  )
}
