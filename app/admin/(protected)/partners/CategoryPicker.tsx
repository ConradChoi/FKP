'use client'

// Design Ref: screen-spec §2.2.3 필터바 "카테고리" 행 — "일반 <select> 불가... 프론트 구현 시
// CategoryTree 컴포넌트를 필터 위젯으로도 재사용할 것을 권장" 및 작업지시서의 "카테고리
// 선택기는 380여 개 트리에서 몇 개를 고르는 UI이므로 전체 트리 화면과는 다른, 간단한 검색+선택
// 위젯이어야 합니다"를 반영해, /admin/categories의 전체 트리 컴포넌트를 재사용하지 않고 검색
// input + 매칭 드롭다운 + 선택 칩만으로 구성된 별도의 작고 단순한 위젯을 새로 만든다. 목록
// 필터(§2.2.3)와 Capability 탭의 표준 카테고리 다중선택(§2.5.4) 양쪽에서 그대로 재사용된다.
import { useMemo, useState } from 'react'
import { adminInputClass } from '@/components/admin/styles'
import type { CategoryOption } from './categoryOptions'

export function CategoryPicker({
  options,
  selectedIds,
  onChange,
  placeholder = '검색: 카테고리명',
}: {
  options: CategoryOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options])
  const selected = selectedIds.map((id) => byId.get(id)).filter((o): o is CategoryOption => !!o)
  const unresolvedIds = selectedIds.filter((id) => !byId.has(id))

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase()
    const pool = term ? options.filter((o) => o.path.toLowerCase().includes(term)) : options
    return pool.slice(0, 30)
  }, [options, query])

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  function remove(id: string) {
    onChange(selectedIds.filter((s) => s !== id))
  }

  return (
    <div className="relative">
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((o) => (
            <span
              key={o.id}
              className="inline-flex items-center gap-1 rounded-sm bg-primary-50 px-2 py-0.5 admin-label-sm text-primary-700"
              title={o.path}
            >
              {o.name}
              <button type="button" onClick={() => remove(o.id)} aria-label={`${o.name} 선택 해제`} className="hover:text-primary-900">
                ×
              </button>
            </span>
          ))}
          {unresolvedIds.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-sm bg-neutral-100 px-2 py-0.5 admin-label-sm text-neutral-400">
              (비활성 카테고리)
              <button type="button" onClick={() => remove(id)} aria-label="선택 해제" className="hover:text-neutral-600">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className={`${adminInputClass} w-full`}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-card border border-neutral-200 bg-neutral-0 shadow-lg">
          {matches.length === 0 && <p className="px-3 py-2 admin-body-sm text-neutral-400">일치하는 카테고리가 없습니다.</p>}
          {matches.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              className={`block w-full px-3 py-2 text-left admin-body-sm hover:bg-neutral-50 ${
                selectedIds.includes(o.id) ? 'bg-primary-50 text-primary-700' : 'text-neutral-700'
              }`}
            >
              {selectedIds.includes(o.id) ? '✓ ' : ''}
              {o.path}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
