'use client'

// Design Ref: docs/02-design/features/partner-supplier-app.screen-spec.md §1.1 (D-5) —
// "CategoryPicker.tsx + categoryOptions.ts ... import 시 admin 전용 스타일(adminInputClass)
// 의존을 buyer 토큰으로 바꾼 로컬 복제본을 두거나, 스타일 prop을 인자로 뺀 공용 버전으로 소폭
// 리팩터링 필요 (현재는 adminInputClass 하드코딩)". This task chose the LOCAL COPY option
// (not the prop-based refactor of app/admin/(protected)/partners/CategoryPicker.tsx) —
// deliberately: refactoring the admin component's public API risks a regression in an
// already-shipped Admin screen for a change whose only other consumer is this one new tab,
// and the two copies are ~90 lines of pure presentation with zero business logic (all of that
// lives in categoryOptions.ts's fetchCategoryOptions(), which IS reused as-is, no fork). If a
// third caller ever needs this widget, that's the right time to do the prop-based refactor
// instead of maintaining a third copy.
import { useMemo, useState } from 'react'
import { inputClass } from '@/components/RequestForm/styles'
import type { CategoryOption } from '@/app/admin/(protected)/partners/categoryOptions'

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
              className="inline-flex items-center gap-1 rounded-sm bg-primary-50 px-2 py-0.5 text-label-caption text-primary-700"
              title={o.path}
            >
              {o.name}
              <button type="button" onClick={() => remove(o.id)} aria-label={`${o.name} 선택 해제`} className="hover:text-primary-900">
                ×
              </button>
            </span>
          ))}
          {unresolvedIds.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-sm bg-neutral-100 px-2 py-0.5 text-label-caption text-neutral-400">
              (비활성 카테고리)
              <button type="button" onClick={() => remove(id)} aria-label="선택 해제" className="hover:text-neutral-600">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className={`${inputClass} w-full`}
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
          {matches.length === 0 && <p className="px-3 py-2 text-body-sm text-neutral-400">일치하는 카테고리가 없습니다.</p>}
          {matches.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              className={`block w-full px-3 py-2 text-left text-body-sm hover:bg-neutral-50 ${
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
