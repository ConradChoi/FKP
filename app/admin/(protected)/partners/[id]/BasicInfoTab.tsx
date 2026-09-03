'use client'

// Design Ref: screen-spec §2.5.3(제출 체크리스트) + §2.5.4 공통 코어 필드 표. 이 화면정의서는
// "Capability 필드 편집(Common Core)은 [기본정보] 탭에 있다"고 명시하므로, 공통 코어(회사
// 아이덴티티) 필드는 이 탭에서 편집하고 버티컬별 확장 필드(Vertical A/B)는 [Capability]
// 탭(CapabilityTab.tsx)에 둔다 — 문서에 "#### 2.5.4"가 중복 번호로 두 번 등장해(기본정보 뒤
// 절과 Capability 탭 절이 같은 번호를 공유) 정확한 절 경계가 모호했던 부분에 대한 구현 판단.
import { useMemo, useState } from 'react'
import { adminInputClass, adminButtonPrimaryClass } from '@/components/admin/styles'
import { LANGUAGE_OPTIONS, REGION_OPTIONS, EMPLOYEE_BAND_LABELS } from '@/lib/admin/partnerLabels'
import { computeSubmissionGaps } from '@/lib/admin/partnerSubmissionGaps'
import { updatePartnerCapabilityAction, type PartnerCapabilityPatch } from './actions'
import { checkDuplicateCandidatesAction, type DuplicateCandidate } from '../actions'
import type { PartnerDetail } from './page'

export function BasicInfoTab({
  partner,
  hasBizCertDocument,
  hasContact,
  canUpdate,
}: {
  partner: PartnerDetail
  hasBizCertDocument: boolean
  hasContact: boolean
  canUpdate: boolean
}) {
  const [form, setForm] = useState({
    business_entity_type: partner.business_entity_type ?? '',
    company_name_ko: partner.company_name_ko ?? '',
    company_name_en: partner.company_name_en ?? '',
    business_registration_number: partner.business_registration_number ?? '',
    founded_year: partner.founded_year,
    employee_band: partner.employee_band ?? '',
    location_region: partner.location_region ?? '',
    website_url: partner.website_url ?? '',
    supported_languages: partner.supported_languages,
    overseas_experience: partner.overseas_experience,
    overseas_experience_countries: partner.overseas_experience_countries,
    company_intro_text: partner.company_intro_text ?? '',
    company_intro_locale: partner.company_intro_locale ?? 'ko',
    representative_offerings: partner.representative_offerings,
    certifications: partner.certifications,
    vertical: partner.vertical ?? '',
  })
  const [updatedAt, setUpdatedAt] = useState(partner.updated_at)
  const [countryInput, setCountryInput] = useState('')
  const [certInput, setCertInput] = useState('')
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const gaps = useMemo(
    () =>
      computeSubmissionGaps(
        {
          business_entity_type: form.business_entity_type || null,
          company_name_ko: form.company_name_ko || null,
          business_registration_number: form.business_registration_number || null,
          supported_languages: form.supported_languages,
          overseas_experience: form.overseas_experience,
          company_intro_text: form.company_intro_text || null,
          representative_offerings: form.representative_offerings,
          vertical: form.vertical || null,
          moq: partner.moq,
          lead_time_days: partner.lead_time_days,
          oem_odm_type: partner.oem_odm_type,
          service_types: partner.service_types,
          project_min_size: partner.project_min_size,
          pricing_model: partner.pricing_model,
          standard_lead_time: partner.standard_lead_time,
          reference_projects: partner.reference_projects,
        },
        hasBizCertDocument,
        hasContact,
      ),
    [form, partner, hasBizCertDocument, hasContact],
  )
  const unmetCount = gaps.filter((g) => !g.satisfied).length

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function toggleLanguage(code: string) {
    set('supported_languages', form.supported_languages.includes(code) ? form.supported_languages.filter((l) => l !== code) : [...form.supported_languages, code])
  }

  function addCountry() {
    if (!countryInput.trim()) return
    set('overseas_experience_countries', [...form.overseas_experience_countries, countryInput.trim()])
    setCountryInput('')
  }
  function removeCountry(idx: number) {
    set('overseas_experience_countries', form.overseas_experience_countries.filter((_, i) => i !== idx))
  }

  function addCert() {
    if (!certInput.trim()) return
    set('certifications', [...form.certifications, certInput.trim()])
    setCertInput('')
  }
  function removeCert(idx: number) {
    set('certifications', form.certifications.filter((_, i) => i !== idx))
  }

  function addOffering() {
    if (form.representative_offerings.length >= 3) return
    set('representative_offerings', [...form.representative_offerings, { name: '', description: '' }])
  }
  function updateOffering(idx: number, patch: Partial<{ name: string; description: string }>) {
    set(
      'representative_offerings',
      form.representative_offerings.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
    )
  }
  function removeOffering(idx: number) {
    set('representative_offerings', form.representative_offerings.filter((_, i) => i !== idx))
  }

  async function handleBrnBlur() {
    if (!form.business_registration_number.trim()) return
    const result = await checkDuplicateCandidatesAction(form.business_registration_number)
    if (result.success && result.data) {
      setCandidates(result.data.candidates.filter((c) => c.id !== partner.id))
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const patch: PartnerCapabilityPatch = {
      business_entity_type: form.business_entity_type || null,
      company_name_ko: form.company_name_ko || null,
      company_name_en: form.company_name_en || null,
      business_registration_number: form.business_registration_number || null,
      founded_year: form.founded_year,
      employee_band: form.employee_band || null,
      location_region: form.location_region || null,
      website_url: form.website_url || null,
      supported_languages: form.supported_languages,
      overseas_experience: form.overseas_experience,
      overseas_experience_countries: form.overseas_experience_countries,
      company_intro_text: form.company_intro_text || null,
      company_intro_locale: form.company_intro_locale || null,
      representative_offerings: form.representative_offerings,
      certifications: form.certifications,
      vertical: form.vertical || null,
    }
    const result = await updatePartnerCapabilityAction(partner.id, patch, updatedAt)
    setSaving(false)
    if (!result.success || !result.data) {
      setError(result.errorCode === 'CONFLICT' ? '다른 사용자가 방금 이 정보를 수정했습니다. 새로고침 후 다시 시도하세요.' : '저장 실패')
      return
    }
    setUpdatedAt(result.data.updatedAt)
    setSaved(true)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
        <div className="flex items-center justify-between">
          <h2 className="admin-heading-3 text-neutral-900">제출 가능 여부</h2>
          <span className="admin-body-sm text-neutral-500">
            {gaps.length - unmetCount}/{gaps.length} 완료
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {gaps.map((g) => (
            <label key={g.key} className="flex items-center gap-2 admin-body-sm text-neutral-700">
              <input type="checkbox" checked={g.satisfied} readOnly />
              <span className={g.satisfied ? '' : 'text-neutral-500'}>{g.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
        <h2 className="admin-heading-3 text-neutral-900">회사 정보 (공통 코어)</h2>
        <p className="mt-1 admin-label-sm text-neutral-400">이 섹션의 수정은 활동 이력에 별도로 기록되지 않습니다 (변경이력 탭 참고).</p>
        {!canUpdate && <p className="mt-1 admin-label-sm text-accent-700">수정 권한이 없어 조회만 가능합니다.</p>}

        <fieldset disabled={!canUpdate} className="contents">
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="admin-label-sm text-neutral-500">법인/개인사업자</label>
            <div className="mt-1 flex gap-4">
              <label className="flex items-center gap-1.5 admin-body">
                <input type="radio" checked={form.business_entity_type === 'corporation'} onChange={() => set('business_entity_type', 'corporation')} /> 법인
              </label>
              <label className="flex items-center gap-1.5 admin-body">
                <input
                  type="radio"
                  checked={form.business_entity_type === 'sole_proprietor'}
                  onChange={() => set('business_entity_type', 'sole_proprietor')}
                />{' '}
                개인사업자
              </label>
            </div>
          </div>
          <div>
            <label className="admin-label-sm text-neutral-500">버티컬</label>
            <div className="mt-1 flex gap-4">
              <label className="flex items-center gap-1.5 admin-body">
                <input type="radio" checked={form.vertical === 'product'} onChange={() => set('vertical', 'product')} /> 제품
              </label>
              <label className="flex items-center gap-1.5 admin-body">
                <input type="radio" checked={form.vertical === 'service'} onChange={() => set('vertical', 'service')} /> 서비스
              </label>
            </div>
          </div>
          <div>
            <label className="admin-label-sm text-neutral-500">회사명(한글)</label>
            <input className={`${adminInputClass} mt-1 w-full`} value={form.company_name_ko} onChange={(e) => set('company_name_ko', e.target.value)} />
          </div>
          <div>
            <label className="admin-label-sm text-neutral-500">회사명(영문)</label>
            <input className={`${adminInputClass} mt-1 w-full`} value={form.company_name_en} onChange={(e) => set('company_name_en', e.target.value)} />
          </div>
          <div>
            <label className="admin-label-sm text-neutral-500">사업자등록번호</label>
            <input
              className={`${adminInputClass} mt-1 w-full`}
              value={form.business_registration_number}
              onChange={(e) => set('business_registration_number', e.target.value)}
              onBlur={handleBrnBlur}
            />
            {candidates.length > 0 && (
              <p className="mt-1 admin-label-sm text-accent-700">
                동일 사업자번호의 다른 파트너가 있습니다: {candidates.map((c) => c.company_name_ko).join(', ')}
              </p>
            )}
          </div>
          <div>
            <label className="admin-label-sm text-neutral-500">설립연도</label>
            <input
              type="number"
              className={`${adminInputClass} mt-1 w-full`}
              value={form.founded_year ?? ''}
              onChange={(e) => set('founded_year', e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div>
            <label className="admin-label-sm text-neutral-500">직원 규모</label>
            <select className={`${adminInputClass} mt-1 w-full`} value={form.employee_band} onChange={(e) => set('employee_band', e.target.value)}>
              <option value="">(선택 안함)</option>
              {Object.entries(EMPLOYEE_BAND_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="admin-label-sm text-neutral-500">지역(시/도)</label>
            <select className={`${adminInputClass} mt-1 w-full`} value={form.location_region} onChange={(e) => set('location_region', e.target.value)}>
              <option value="">(선택 안함)</option>
              {REGION_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="admin-label-sm text-neutral-500">웹사이트</label>
            <input className={`${adminInputClass} mt-1 w-full`} value={form.website_url} onChange={(e) => set('website_url', e.target.value)} />
          </div>
        </div>

        <div className="mt-4">
          <span className="admin-label-sm text-neutral-500">대응 가능 언어</span>
          <div className="mt-1 flex flex-wrap gap-3">
            {LANGUAGE_OPTIONS.map((l) => (
              <label key={l.value} className="flex items-center gap-1.5 admin-body-sm text-neutral-700">
                <input type="checkbox" checked={form.supported_languages.includes(l.value)} onChange={() => toggleLanguage(l.value)} />
                {l.label}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <span className="admin-label-sm text-neutral-500">해외거래 경험</span>
          <div className="mt-1 flex gap-4">
            <label className="flex items-center gap-1.5 admin-body">
              <input type="radio" checked={form.overseas_experience === true} onChange={() => set('overseas_experience', true)} /> 있음
            </label>
            <label className="flex items-center gap-1.5 admin-body">
              <input type="radio" checked={form.overseas_experience === false} onChange={() => set('overseas_experience', false)} /> 없음
            </label>
          </div>
          {form.overseas_experience && (
            <div className="mt-2">
              <div className="flex gap-2">
                <input
                  className={`${adminInputClass} flex-1`}
                  placeholder="국가명 입력 후 추가"
                  value={countryInput}
                  onChange={(e) => setCountryInput(e.target.value)}
                />
                <button type="button" onClick={addCountry} className="admin-body-sm text-primary-600 hover:underline">
                  추가
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.overseas_experience_countries.map((c, i) => (
                  <span key={`${c}-${i}`} className="inline-flex items-center gap-1 rounded-sm bg-neutral-100 px-2 py-0.5 admin-label-sm text-neutral-600">
                    {c}
                    <button type="button" onClick={() => removeCountry(i)}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-2">
            <label className="admin-label-sm text-neutral-500">회사소개</label>
            <select
              className={`${adminInputClass} py-1`}
              value={form.company_intro_locale}
              onChange={(e) => set('company_intro_locale', e.target.value)}
            >
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  원문언어: {l.label}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className={`${adminInputClass} mt-1 w-full`}
            rows={4}
            value={form.company_intro_text}
            onChange={(e) => set('company_intro_text', e.target.value)}
          />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="admin-label-sm text-neutral-500">대표 제품/서비스 (최대 3개)</span>
            <button
              type="button"
              onClick={addOffering}
              disabled={form.representative_offerings.length >= 3}
              className="admin-body-sm text-primary-600 hover:underline disabled:cursor-not-allowed disabled:text-neutral-300"
            >
              + 추가
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {form.representative_offerings.map((o, i) => (
              <div key={i} className="flex gap-2 rounded-input border border-neutral-200 p-2">
                <input
                  className={`${adminInputClass} w-1/3`}
                  placeholder="명칭"
                  value={o.name}
                  onChange={(e) => updateOffering(i, { name: e.target.value })}
                />
                <input
                  className={`${adminInputClass} flex-1`}
                  placeholder="설명"
                  value={o.description}
                  onChange={(e) => updateOffering(i, { description: e.target.value })}
                />
                <button type="button" onClick={() => removeOffering(i)} className="admin-body-sm text-error">
                  삭제
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <span className="admin-label-sm text-neutral-500">보유 인증</span>
          <div className="mt-1 flex gap-2">
            <input className={`${adminInputClass} flex-1`} placeholder="인증명 입력 후 추가" value={certInput} onChange={(e) => setCertInput(e.target.value)} />
            <button type="button" onClick={addCert} className="admin-body-sm text-primary-600 hover:underline">
              추가
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {form.certifications.map((c, i) => (
              <span key={`${c}-${i}`} className="inline-flex items-center gap-1 rounded-sm bg-neutral-100 px-2 py-0.5 admin-label-sm text-neutral-600">
                {c}
                <button type="button" onClick={() => removeCert(i)}>
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {error && <p className="mt-3 admin-body-sm text-error">{error}</p>}
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={handleSave} disabled={saving} className={adminButtonPrimaryClass}>
            {saving ? '저장 중...' : '저장'}
          </button>
          {saved && <span className="admin-body-sm text-success">저장되었습니다.</span>}
        </div>
        </fieldset>
      </section>
    </div>
  )
}
