'use client'

// Design Ref: human-matching.screen-spec.md §6.1 / ui-spec §3 — (a) 후보 검색/필터 패널.
// G-2/G-3/G-4 (screen-spec §0): 국가/버티컬/카테고리는 Requirement에서 자동 프리필되지
//않는다 — 기본값은 빈 값/전체, 운영자가 "개요" 탭을 보고 수동 선택한다. 언어만 requests.locale
// 기준으로 근사 프리필한다(screen-spec §6.1).
import { useState } from 'react'
import { Avatar } from '@/components/admin/Avatar'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { ProgressBar } from '@/components/admin/ProgressBar'
import { adminInputClass, adminButtonPrimaryClass, adminButtonSecondaryClass } from '@/components/admin/styles'
import { LANGUAGE_OPTIONS, REGION_OPTIONS, VERIFICATION_STATE_LABELS, VERIFICATION_STATE_TONE, VERTICAL_LABELS } from '@/lib/admin/partnerLabels'
import { CategoryPicker } from '@/app/admin/(protected)/partners/CategoryPicker'
import type { CategoryOption } from '@/app/admin/(protected)/partners/categoryOptions'
import { searchPartnerCandidatesAction, addCandidateAction, type CandidateSearchResultRow } from './actions'

const VERIFICATION_FILTER_STATES = ['draft', 'submitted', 'under_review', 'verified'] as const

export function CandidateSearchPanel({
  requirementId,
  candidateCount,
  existingPartnerIds,
  categoryOptions,
  localePrefill,
  disabled,
  disabledReason,
  onAdded,
}: {
  requirementId: string
  candidateCount: number
  existingPartnerIds: Set<string>
  categoryOptions: CategoryOption[]
  localePrefill: string | null
  disabled: boolean
  disabledReason: string | null
  onAdded: () => void
}) {
  const [open, setOpen] = useState(candidateCount === 0)

  const [q, setQ] = useState('')
  const [vertical, setVertical] = useState('all')
  const [region, setRegion] = useState('all')
  const [languages, setLanguages] = useState<string[]>(localePrefill ? [localePrefill] : [])
  const [countryInput, setCountryInput] = useState('')
  const [countries, setCountries] = useState<string[]>([])
  const [verificationStates, setVerificationStates] = useState<string[]>([...VERIFICATION_FILTER_STATES])
  const [includeExcluded, setIncludeExcluded] = useState(false)
  const [categoryIds, setCategoryIds] = useState<string[]>([])

  const [results, setResults] = useState<CandidateSearchResultRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)

  function toggleLanguage(code: string) {
    setLanguages((prev) => (prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]))
  }

  function toggleVerificationState(state: string) {
    setVerificationStates((prev) => (prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state]))
  }

  function addCountry() {
    const v = countryInput.trim()
    if (v && !countries.includes(v)) setCountries((prev) => [...prev, v])
    setCountryInput('')
  }

  function removeCountry(v: string) {
    setCountries((prev) => prev.filter((c) => c !== v))
  }

  function resetFilters() {
    setQ('')
    setVertical('all')
    setRegion('all')
    setLanguages(localePrefill ? [localePrefill] : [])
    setCountries([])
    setVerificationStates([...VERIFICATION_FILTER_STATES])
    setIncludeExcluded(false)
    setCategoryIds([])
    setResults(null)
    setError(null)
  }

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault()
    setLoading(true)
    setError(null)
    const result = await searchPartnerCandidatesAction(requirementId, {
      q,
      vertical,
      region,
      languages,
      countries,
      verificationStates,
      includeExcluded,
      categoryIds,
    })
    setLoading(false)
    if (!result.success || !result.data) {
      setError('검색에 실패했습니다. 다시 시도해주세요.')
      return
    }
    setResults(result.data)
  }

  async function handleAdd(partnerId: string) {
    setAddingId(partnerId)
    const result = await addCandidateAction(requirementId, partnerId)
    setAddingId(null)
    if (result.success) onAdded()
  }

  return (
    <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
      <div className="flex items-center justify-between">
        <p className="admin-heading-3 text-neutral-900">
          후보 검색 <span className="ml-2 admin-body-sm font-normal text-neutral-500">담긴 후보 {candidateCount}건</span>
        </p>
        {open ? (
          candidateCount > 0 && (
            <button type="button" onClick={() => setOpen(false)} className="admin-body-sm text-neutral-500 hover:underline">
              ▴ 접기
            </button>
          )
        ) : (
          <button type="button" onClick={() => setOpen(true)} className="admin-body-sm text-primary-600 hover:underline">
            + 후보 더 찾기
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4">
          {disabled ? (
            <p className="rounded-input bg-neutral-50 px-3 py-2 admin-body-sm text-neutral-500">{disabledReason}</p>
          ) : (
            <>
              <form onSubmit={runSearch} className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <input className={`${adminInputClass} w-64`} placeholder="회사명 또는 사업자번호 검색" value={q} onChange={(e) => setQ(e.target.value)} />
                  <select className={adminInputClass} value={vertical} onChange={(e) => setVertical(e.target.value)}>
                    <option value="all">버티컬: 전체</option>
                    <option value="product">버티컬: {VERTICAL_LABELS.product}</option>
                    <option value="service">버티컬: {VERTICAL_LABELS.service}</option>
                  </select>
                  <select className={adminInputClass} value={region} onChange={(e) => setRegion(e.target.value)}>
                    <option value="all">지역: 전체</option>
                    {REGION_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="admin-label-sm text-neutral-500">대응언어</span>
                    {LANGUAGE_OPTIONS.map((l) => (
                      <label key={l.value} className="flex items-center gap-1 admin-body-sm text-neutral-700">
                        <input type="checkbox" checked={languages.includes(l.value)} onChange={() => toggleLanguage(l.value)} />
                        {l.label}
                      </label>
                    ))}
                  </div>
                  {localePrefill && (
                    <p className="mt-1 admin-label-sm text-neutral-400">요청 locale 기준 추정값 — 필요시 수정하세요</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="admin-label-sm text-neutral-500">검증상태</span>
                  {VERIFICATION_FILTER_STATES.map((s) => (
                    <label key={s} className="flex items-center gap-1 admin-body-sm text-neutral-700">
                      <input type="checkbox" checked={verificationStates.includes(s)} onChange={() => toggleVerificationState(s)} />
                      {VERIFICATION_STATE_LABELS[s]}
                    </label>
                  ))}
                  <span className="ml-1 border-l border-neutral-200 pl-3 admin-body-sm text-neutral-700">
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={includeExcluded} onChange={(e) => setIncludeExcluded(e.target.checked)} />
                      제외된 파트너도 보기(반려/중단)
                    </label>
                  </span>
                </div>

                <div>
                  <span className="admin-label-sm text-neutral-500">국가(해외경험)</span>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <input
                      className={`${adminInputClass} w-48`}
                      placeholder="예: 베트남"
                      value={countryInput}
                      onChange={(e) => setCountryInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addCountry()
                        }
                      }}
                    />
                    <button type="button" onClick={addCountry} className={adminButtonSecondaryClass}>
                      추가
                    </button>
                    {countries.map((c) => (
                      <span key={c} className="inline-flex items-center gap-1 rounded-sm bg-neutral-100 px-2 py-0.5 admin-label-sm text-neutral-700">
                        {c}
                        <button type="button" onClick={() => removeCountry(c)} aria-label={`${c} 제거`}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="max-w-md">
                  <span className="admin-label-sm text-neutral-500">카테고리</span>
                  <div className="mt-1">
                    <CategoryPicker options={categoryOptions} selectedIds={categoryIds} onChange={setCategoryIds} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button type="submit" disabled={loading} className={adminButtonPrimaryClass}>
                    {loading ? '검색 중...' : '검색'}
                  </button>
                  <button type="button" onClick={resetFilters} className="admin-body-sm text-neutral-500 hover:underline">
                    필터 초기화
                  </button>
                </div>
              </form>

              <div className="mt-4 overflow-x-auto rounded-card border border-neutral-200">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col className="w-64" />
                    <col className="w-28" />
                    <col className="w-40" />
                    <col className="w-32" />
                    <col className="w-24" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-neutral-200 text-left">
                      <th className="whitespace-nowrap px-4 py-2 admin-body-sm font-medium text-neutral-500">회사명</th>
                      <th className="whitespace-nowrap px-4 py-2 admin-body-sm font-medium text-neutral-500">검증상태</th>
                      <th className="whitespace-nowrap px-4 py-2 admin-body-sm font-medium text-neutral-500">지역/언어</th>
                      <th className="whitespace-nowrap px-4 py-2 admin-body-sm font-medium text-neutral-500">Completeness</th>
                      <th className="whitespace-nowrap px-4 py-2 admin-body-sm font-medium text-neutral-500">담기</th>
                    </tr>
                  </thead>
                  <tbody>
                    {error && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center admin-body-sm text-error">
                          {error}
                        </td>
                      </tr>
                    )}
                    {!error && results === null && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center admin-body-sm text-neutral-400">
                          검색어/필터를 지정하고 검색을 실행하세요.
                        </td>
                      </tr>
                    )}
                    {!error && results !== null && results.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center admin-body-sm text-neutral-400">
                          조건에 맞는 파트너가 없습니다. 필터를 조정해보세요.
                        </td>
                      </tr>
                    )}
                    {!error &&
                      results?.map((p) => {
                        const alreadyAdded = existingPartnerIds.has(p.id)
                        return (
                          <tr key={p.id} className="border-b border-neutral-100 last:border-0">
                            <td className="px-4 py-3 admin-body">
                              <div className="flex items-center gap-2.5">
                                <Avatar name={p.company_name_ko || '(회사명 미입력)'} size="sm" />
                                <span className="min-w-0">
                                  <span className="block truncate font-medium text-neutral-900">{p.company_name_ko || '(회사명 미입력)'}</span>
                                  <span className="block truncate admin-body-sm text-neutral-400">
                                    {p.company_name_en ?? ''} {p.vertical ? VERTICAL_LABELS[p.vertical] : ''}
                                  </span>
                                </span>
                              </div>
                              {p.other_requirement_match_count > 0 && (
                                <p className="mt-1 admin-label-sm text-neutral-400">다른 요청에서도 후보 중({p.other_requirement_match_count})</p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge tone={VERIFICATION_STATE_TONE[p.verification_state]} label={VERIFICATION_STATE_LABELS[p.verification_state]} />
                            </td>
                            <td className="px-4 py-3 admin-body-sm text-neutral-600">
                              {p.location_region ?? '-'} · {p.supported_languages.join(', ') || '-'}
                            </td>
                            <td className="px-4 py-3">
                              <ProgressBar value={p.capability_completeness_pct} total={100} tone={p.capability_completeness_pct >= 80 ? 'complete' : 'in-progress'} />
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                disabled={alreadyAdded || addingId === p.id}
                                onClick={() => handleAdd(p.id)}
                                className={adminButtonSecondaryClass}
                              >
                                {alreadyAdded ? '담김' : addingId === p.id ? '담는 중...' : '담기'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
