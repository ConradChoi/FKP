'use client'

// Design Ref: screen-spec §2.2.3 필터바. LeadFilters.tsx의 "상태는 탭이 처리, 나머지만 폼으로"
// 패턴을 그대로 따르되 필드 수가 많아 여러 줄로 구성한다. 제출(적용) 시 현재 탭(state)과 검색어
// 등은 유지한 채 나머지 필터만 URL 쿼리스트링으로 반영한다.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminInputClass, adminButtonPrimaryClass } from '@/components/admin/styles'
import { LANGUAGE_OPTIONS, REGION_OPTIONS } from '@/lib/admin/partnerLabels'
import { CategoryPicker } from './CategoryPicker'
import type { CategoryOption } from './categoryOptions'

export interface PartnerFilterValues {
  state?: string
  q?: string
  vertical?: string
  region?: string
  languages?: string // comma-separated
  overseas?: string // all|yes|no
  intakeSource?: string
  category?: string // comma-separated ids
  sort?: string
}

export function PartnerFilters({ initial, categoryOptions }: { initial: PartnerFilterValues; categoryOptions: CategoryOption[] }) {
  const router = useRouter()
  const [q, setQ] = useState(initial.q ?? '')
  const [vertical, setVertical] = useState(initial.vertical ?? 'all')
  const [region, setRegion] = useState(initial.region ?? 'all')
  const [languages, setLanguages] = useState<string[]>(initial.languages ? initial.languages.split(',') : [])
  const [overseas, setOverseas] = useState(initial.overseas ?? 'all')
  const [intakeSource, setIntakeSource] = useState(initial.intakeSource ?? 'all')
  const [categoryIds, setCategoryIds] = useState<string[]>(initial.category ? initial.category.split(',') : [])
  const [sort, setSort] = useState(initial.sort ?? 'recent')

  function toggleLanguage(code: string) {
    setLanguages((prev) => (prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]))
  }

  function apply(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (initial.state) params.set('state', initial.state)
    if (q.trim()) params.set('q', q.trim())
    if (vertical !== 'all') params.set('vertical', vertical)
    if (region !== 'all') params.set('region', region)
    if (languages.length > 0) params.set('languages', languages.join(','))
    if (overseas !== 'all') params.set('overseas', overseas)
    if (intakeSource !== 'all') params.set('intakeSource', intakeSource)
    if (categoryIds.length > 0) params.set('category', categoryIds.join(','))
    if (sort !== 'recent') params.set('sort', sort)
    const qs = params.toString()
    router.push(qs ? `/admin/partners?${qs}` : '/admin/partners')
  }

  function reset() {
    setQ('')
    setVertical('all')
    setRegion('all')
    setLanguages([])
    setOverseas('all')
    setIntakeSource('all')
    setCategoryIds([])
    setSort('recent')
    router.push(initial.state ? `/admin/partners?state=${initial.state}` : '/admin/partners')
  }

  return (
    <form onSubmit={apply} className="mt-4 space-y-3 rounded-card border border-neutral-200 bg-neutral-0 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${adminInputClass} w-64`}
          placeholder="회사명 또는 사업자번호 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className={adminInputClass} value={vertical} onChange={(e) => setVertical(e.target.value)}>
          <option value="all">버티컬: 전체</option>
          <option value="product">버티컬: 제품</option>
          <option value="service">버티컬: 서비스</option>
        </select>
        <select className={adminInputClass} value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="all">지역: 전체</option>
          {REGION_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select className={adminInputClass} value={overseas} onChange={(e) => setOverseas(e.target.value)}>
          <option value="all">해외경험: 전체</option>
          <option value="yes">해외경험: 있음</option>
          <option value="no">해외경험: 없음</option>
        </select>
        <select className={adminInputClass} value={intakeSource} onChange={(e) => setIntakeSource(e.target.value)}>
          <option value="all">유입경로: 전체</option>
          <option value="self_service">유입경로: 자가등록</option>
          <option value="admin_entry">유입경로: 예외입력</option>
        </select>
        <select className={adminInputClass} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="recent">정렬: 등록일 최신순</option>
          <option value="completeness">정렬: Completeness 낮은순</option>
          <option value="name">정렬: 회사명 가나다순</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="admin-label-sm text-neutral-500">대응언어</span>
        {LANGUAGE_OPTIONS.map((l) => (
          <label key={l.value} className="flex items-center gap-1 admin-body-sm text-neutral-700">
            <input type="checkbox" checked={languages.includes(l.value)} onChange={() => toggleLanguage(l.value)} />
            {l.label}
          </label>
        ))}
      </div>

      <div className="max-w-md">
        <span className="admin-label-sm text-neutral-500">카테고리</span>
        <div className="mt-1">
          <CategoryPicker options={categoryOptions} selectedIds={categoryIds} onChange={setCategoryIds} />
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" className={adminButtonPrimaryClass}>
          적용
        </button>
        <button type="button" onClick={reset} className="admin-body-sm text-neutral-500 hover:underline">
          초기화
        </button>
      </div>
    </form>
  )
}
