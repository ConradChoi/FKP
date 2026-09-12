'use client'

// Design Ref: app/admin/(protected)/partners/PartnerFilters.tsx — same "controlled local state,
// push URL query string on 적용" pattern (screen-spec §4.1 B-15: "필터/정렬/검색 상태 ... URL에
// 반영"), independent copy per the buyer-facing screen's own component tree (no admin-styled
// imports). Category filter here is a drilldown tree with counts (D-S4/§4.2), not the admin's
// search-driven CategoryPicker — a fundamentally different interaction (browse a mostly-empty
// tree vs. search-select a few of 374 known ids), so it is NOT built on CategoryPicker.tsx.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { inputClass, primaryButtonClass } from '@/components/RequestForm/styles'
import { LANGUAGE_OPTIONS, REGION_OPTIONS, SERVICE_TYPE_OPTIONS } from '@/lib/seepn/partnerLabels'
import type { CategoryNode } from '@/lib/seepn/categoryTree'

export interface PartnerFilterValues {
  q?: string
  category?: string // comma-separated ids
  region?: string // comma-separated
  languages?: string // comma-separated
  overseas?: string // all|yes|no
  vertical?: string // all|product|service
  serviceTypes?: string // comma-separated
  sort?: string // recent|name
  // Design Ref: partner-standard-category-picker-redesign.screen-spec.md §8/§11 OQ-2(2026-09-12
  // 대표 확정) — "주력분야만 보기" 토글. 카테고리 필터가 선택된 상태에서만 의미가 있다(선택된
  // 카테고리 중 partner_category_public.role='primary'인 파트너만 매칭). 카테고리 필터가
  // 없으면 이 값은 조용히 무시된다(app/seepn/partners/page.tsx 참고) — D-8이 지키던 "전체(주+
  // 서브) 노출" 기본 동작은 이 토글을 켜지 않는 한 그대로다.
  primaryOnly?: string // '1'이면 켜짐
}

function CategoryTreeNode({
  node,
  depth,
  selectedIds,
  onToggle,
}: {
  node: CategoryNode
  depth: number
  selectedIds: string[]
  onToggle: (id: string) => void
}) {
  const [open, setOpen] = useState(false)

  if (node.isRoot) {
    const zero = node.rollupCount === 0
    return (
      <div className="border-b border-neutral-100 py-1.5 last:border-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={zero}
            title={zero ? '아직 등록된 파트너가 없습니다' : undefined}
            onClick={() => {
              if (zero) return
              if (node.children.length > 0) setOpen((v) => !v)
              onToggle(node.id)
            }}
            className={`flex flex-1 items-center justify-between text-left text-body-sm ${
              zero ? 'cursor-not-allowed text-neutral-300' : selectedIds.includes(node.id) ? 'font-medium text-primary-700' : 'text-neutral-800'
            }`}
          >
            <span>
              {selectedIds.includes(node.id) && !zero ? '✓ ' : ''}
              {node.name}
            </span>
            <span className="text-label-caption text-neutral-400">({node.rollupCount})</span>
          </button>
          {node.children.length > 0 && !zero && (
            <button type="button" onClick={() => setOpen((v) => !v)} aria-label="하위 카테고리 펼치기" className="text-neutral-400">
              {open ? '▲' : '▼'}
            </button>
          )}
        </div>
        {open && (
          <div className="mt-1 pl-3">
            {node.children
              .filter((c) => c.directCount > 0 || c.children.some((gc) => gc.directCount > 0))
              .map((child) => (
                <CategoryTreeNode key={child.id} node={child} depth={depth + 1} selectedIds={selectedIds} onToggle={onToggle} />
              ))}
          </div>
        )}
      </div>
    )
  }

  // L2/L3: hidden entirely when directCount is 0 (screen-spec §4.2) — the parent already
  // filters most of these out before rendering, this guard covers L3-under-L2 as well.
  if (node.directCount === 0 && node.children.every((c) => c.directCount === 0)) return null

  return (
    <div className="py-1">
      <label className="flex cursor-pointer items-center justify-between gap-2 text-body-sm text-neutral-700">
        <span className="flex items-center gap-1.5">
          <input type="checkbox" checked={selectedIds.includes(node.id)} onChange={() => onToggle(node.id)} className="h-3.5 w-3.5" />
          {node.name}
        </span>
        <span className="text-label-caption text-neutral-400">({node.directCount})</span>
      </label>
      {node.children.length > 0 && (
        <div className="mt-1 pl-3">
          {node.children
            .filter((c) => c.directCount > 0)
            .map((child) => (
              <CategoryTreeNode key={child.id} node={child} depth={depth + 1} selectedIds={selectedIds} onToggle={onToggle} />
            ))}
        </div>
      )}
    </div>
  )
}

export function PartnerFilters({
  initial,
  categoryTree,
  basePath = '/seepn/partners',
}: {
  initial: PartnerFilterValues
  categoryTree: CategoryNode[]
  basePath?: string
}) {
  const router = useRouter()
  const [q, setQ] = useState(initial.q ?? '')
  const [categoryIds, setCategoryIds] = useState<string[]>(initial.category ? initial.category.split(',') : [])
  const [regions, setRegions] = useState<string[]>(initial.region ? initial.region.split(',') : [])
  const [languages, setLanguages] = useState<string[]>(initial.languages ? initial.languages.split(',') : [])
  const [overseas, setOverseas] = useState(initial.overseas ?? 'all')
  const [vertical, setVertical] = useState(initial.vertical ?? 'all')
  const [serviceTypes, setServiceTypes] = useState<string[]>(initial.serviceTypes ? initial.serviceTypes.split(',') : [])
  const [sort, setSort] = useState(initial.sort ?? 'recent')
  const [primaryOnly, setPrimaryOnly] = useState(initial.primaryOnly === '1')

  function toggleInList(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  function toggleCategory(id: string) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  function apply(e?: React.FormEvent) {
    e?.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (categoryIds.length > 0) params.set('category', categoryIds.join(','))
    if (regions.length > 0) params.set('region', regions.join(','))
    if (languages.length > 0) params.set('languages', languages.join(','))
    if (overseas !== 'all') params.set('overseas', overseas)
    if (vertical !== 'all') params.set('vertical', vertical)
    if (vertical === 'service' && serviceTypes.length > 0) params.set('serviceTypes', serviceTypes.join(','))
    if (sort !== 'recent') params.set('sort', sort)
    if (categoryIds.length > 0 && primaryOnly) params.set('primaryOnly', '1')
    const qs = params.toString()
    router.push(qs ? `${basePath}?${qs}` : basePath)
  }

  function reset() {
    setQ('')
    setCategoryIds([])
    setRegions([])
    setLanguages([])
    setOverseas('all')
    setVertical('all')
    setServiceTypes([])
    setSort('recent')
    setPrimaryOnly(false)
    router.push(basePath)
  }

  return (
    <form onSubmit={apply} className="space-y-4 rounded-card border border-neutral-200 bg-neutral-0 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${inputClass} w-64`}
          placeholder="회사명으로 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className={inputClass} value={vertical} onChange={(e) => setVertical(e.target.value)}>
          <option value="all">버티컬: 전체</option>
          <option value="product">버티컬: 제품</option>
          <option value="service">버티컬: 서비스</option>
        </select>
        <select className={inputClass} value={overseas} onChange={(e) => setOverseas(e.target.value)}>
          <option value="all">해외경험: 전체</option>
          <option value="yes">해외경험: 있음</option>
          <option value="no">해외경험: 없음</option>
        </select>
        <select className={inputClass} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="recent">정렬: 최신순</option>
          <option value="name">정렬: 회사명순</option>
        </select>
      </div>

      <div>
        <span className="text-label-caption text-neutral-500">지역</span>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {REGION_OPTIONS.map((r) => (
            <label key={r} className="flex items-center gap-1 text-body-sm text-neutral-700">
              <input type="checkbox" checked={regions.includes(r)} onChange={() => toggleInList(regions, setRegions, r)} />
              {r}
            </label>
          ))}
        </div>
      </div>

      <div>
        <span className="text-label-caption text-neutral-500">대응언어</span>
        <div className="mt-1 flex flex-wrap gap-3">
          {LANGUAGE_OPTIONS.map((l) => (
            <label key={l.value} className="flex items-center gap-1 text-body-sm text-neutral-700">
              <input type="checkbox" checked={languages.includes(l.value)} onChange={() => toggleInList(languages, setLanguages, l.value)} />
              {l.label}
            </label>
          ))}
        </div>
      </div>

      {vertical === 'service' && (
        <div>
          <span className="text-label-caption text-neutral-500">서비스유형</span>
          <div className="mt-1 flex flex-wrap gap-3">
            {SERVICE_TYPE_OPTIONS.map((s) => (
              <label key={s.value} className="flex items-center gap-1 text-body-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={serviceTypes.includes(s.value)}
                  onChange={() => toggleInList(serviceTypes, setServiceTypes, s.value)}
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {categoryTree.length > 0 && (
        <div className="max-h-80 overflow-y-auto rounded-input border border-neutral-100 p-2">
          <span className="text-label-caption text-neutral-500">카테고리</span>
          <div className="mt-1">
            {categoryTree.map((node) => (
              <CategoryTreeNode key={node.id} node={node} depth={0} selectedIds={categoryIds} onToggle={toggleCategory} />
            ))}
          </div>
        </div>
      )}

      {/* Design Ref: partner-standard-category-picker-redesign.screen-spec.md §11 OQ-2
          (2026-09-12 대표 확정) — "주력분야만 보기". 카테고리를 하나도 선택하지 않았으면 이
          토글은 비활성화한다(적용될 카테고리 기준이 없으므로 의미가 없다). */}
      <label className={`flex items-center gap-1.5 text-body-sm ${categoryIds.length === 0 ? 'text-neutral-400' : 'text-neutral-700'}`}>
        <input
          type="checkbox"
          checked={primaryOnly}
          disabled={categoryIds.length === 0}
          onChange={(e) => setPrimaryOnly(e.target.checked)}
        />
        주력분야만 보기
        {categoryIds.length === 0 && <span className="text-label-caption text-neutral-400">(카테고리를 먼저 선택하세요)</span>}
      </label>

      <div className="flex gap-3">
        <button type="submit" className={primaryButtonClass}>
          필터 적용
        </button>
        <button type="button" onClick={reset} className="text-body-sm text-neutral-500 hover:underline">
          필터 초기화
        </button>
      </div>
    </form>
  )
}
