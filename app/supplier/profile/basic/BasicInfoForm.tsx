'use client'

// Design Ref: screen-spec §4.1 (SUP-09 필드 표) + §4.2 (BRN 중복확인, POST /api/partner/check-brn
// 경유 필수, 버튼 명시 확인만) + ui-spec §3.7 (라디오는 pill 버튼) +
// docs/03-security/partner-supplier-app-ui-privacy-review.md §7.3 UI-R7 (회사소개 자유서술
// 필드에 제3자 개인정보 입력금지 캡션).
import { useEffect, useState } from 'react'
import { getSupplierBrowserClient } from '@/lib/supabase/supplierBrowserClient'
import { inputClass, primaryButtonClass, secondaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'
import { LANGUAGE_OPTIONS, REGION_OPTIONS, EMPLOYEE_BAND_LABELS } from '@/lib/admin/partnerLabels'
import type { PartnerProfile, RepresentativeOffering } from '@/lib/supplier/types'
import { useDirtyGuard } from '@/components/supplier/DirtyGuard'

function PillRadio<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | null
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`min-h-[40px] rounded-input border px-4 py-2 text-body-sm transition-colors ${
            value === o.value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface FormState {
  business_entity_type: 'corporation' | 'sole_proprietor' | null
  vertical: 'product' | 'service' | null
  company_name_ko: string
  company_name_en: string
  business_registration_number: string
  founded_year: number | null
  employee_band: string
  location_region: string
  website_url: string
  supported_languages: string[]
  overseas_experience: boolean | null
  overseas_experience_countries: string[]
  company_intro_text: string
  company_intro_locale: string
  representative_offerings: RepresentativeOffering[]
  certifications: string[]
}

function toFormState(partner: PartnerProfile): FormState {
  return {
    business_entity_type: partner.business_entity_type,
    vertical: partner.vertical,
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
  }
}

export function BasicInfoForm({ partner }: { partner: PartnerProfile }) {
  const { setDirty } = useDirtyGuard()
  const [form, setForm] = useState<FormState>(() => toFormState(partner))
  const [countryInput, setCountryInput] = useState('')
  const [certInput, setCertInput] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle')
  const [brnCheck, setBrnCheck] = useState<'idle' | 'checking' | 'duplicate' | 'ok'>('idle')

  useEffect(() => {
    setDirty(saveState === 'dirty')
  }, [saveState, setDirty])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaveState('dirty')
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
  function updateOffering(idx: number, patch: Partial<RepresentativeOffering>) {
    set('representative_offerings', form.representative_offerings.map((o, i) => (i === idx ? { ...o, ...patch } : o)))
  }
  function removeOffering(idx: number) {
    set('representative_offerings', form.representative_offerings.filter((_, i) => i !== idx))
  }

  async function handleBrnCheck() {
    const brn = form.business_registration_number.trim()
    if (!/^[0-9-]{10,20}$/.test(brn)) return
    setBrnCheck('checking')
    try {
      const res = await fetch('/api/partner/check-brn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessRegistrationNumber: brn }),
      })
      const data = (await res.json()) as { duplicate?: boolean }
      setBrnCheck(data.duplicate ? 'duplicate' : 'ok')
    } catch {
      setBrnCheck('idle')
    }
  }

  async function handleSave() {
    setSaveState('saving')
    const supabase = getSupplierBrowserClient()
    const { error } = await supabase
      .from('partner')
      .update({
        business_entity_type: form.business_entity_type,
        vertical: form.vertical,
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
      })
      .eq('id', partner.id)

    if (error) {
      setSaveState('error')
      return
    }
    setSaveState('saved')
    setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 3000)
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
        <h2 className="text-body font-medium text-neutral-900">기본정보</h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-body-sm font-medium text-neutral-700">법인/개인사업자</span>
            <PillRadio
              value={form.business_entity_type}
              options={[
                { value: 'corporation', label: '법인' },
                { value: 'sole_proprietor', label: '개인사업자' },
              ]}
              onChange={(v) => set('business_entity_type', v)}
            />
          </div>
          <div>
            <span className="mb-1.5 block text-body-sm font-medium text-neutral-700">버티컬</span>
            <PillRadio
              value={form.vertical}
              options={[
                { value: 'product', label: '제품' },
                { value: 'service', label: '서비스' },
              ]}
              onChange={(v) => set('vertical', v)}
            />
            <p className="mt-1 text-label-caption text-neutral-400">선택 시 역량정보 탭의 입력 항목이 바뀝니다.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">회사명(한글)</label>
            <input className={`${inputClass} w-full`} value={form.company_name_ko} onChange={(e) => set('company_name_ko', e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">회사명(영문)</label>
            <input className={`${inputClass} w-full`} value={form.company_name_en} onChange={(e) => set('company_name_en', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">사업자등록번호</label>
            <div className="flex gap-2">
              <input
                className={`${inputClass} flex-1`}
                value={form.business_registration_number}
                onChange={(e) => {
                  set('business_registration_number', e.target.value)
                  setBrnCheck('idle')
                }}
              />
              <button type="button" onClick={handleBrnCheck} disabled={brnCheck === 'checking'} className={secondaryButtonClass}>
                {brnCheck === 'checking' ? '확인 중...' : '확인'}
              </button>
            </div>
            {brnCheck === 'duplicate' && (
              <p className={`mt-1 ${errorTextClass}`}>
                이 사업자등록번호는 등록할 수 없습니다. 이미 등록된 회사의 담당자시라면 고객센터로 문의해주세요.
              </p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">설립연도</label>
            <input
              type="number"
              className={`${inputClass} w-full`}
              value={form.founded_year ?? ''}
              onChange={(e) => set('founded_year', e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">임직원 규모</label>
            <select className={`${inputClass} w-full`} value={form.employee_band} onChange={(e) => set('employee_band', e.target.value)}>
              <option value="">선택 안 함</option>
              {Object.entries(EMPLOYEE_BAND_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">소재지(시/도)</label>
            <select className={`${inputClass} w-full`} value={form.location_region} onChange={(e) => set('location_region', e.target.value)}>
              <option value="">선택 안 함</option>
              {REGION_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">홈페이지</label>
            <input className={`${inputClass} w-full`} value={form.website_url} onChange={(e) => set('website_url', e.target.value)} />
          </div>
        </div>

        <div className="mt-4">
          <span className="mb-1.5 block text-body-sm font-medium text-neutral-700">대응 가능 언어</span>
          <div className="flex flex-wrap gap-3">
            {LANGUAGE_OPTIONS.map((l) => (
              <label key={l.value} className="flex items-center gap-1.5 text-body-sm text-neutral-700">
                <input type="checkbox" checked={form.supported_languages.includes(l.value)} onChange={() => toggleLanguage(l.value)} />
                {l.label}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <span className="mb-1.5 block text-body-sm font-medium text-neutral-700">해외거래 경험</span>
          <PillRadio
            value={form.overseas_experience === null ? null : form.overseas_experience ? 'yes' : 'no'}
            options={[
              { value: 'yes', label: '있음' },
              { value: 'no', label: '없음' },
            ]}
            onChange={(v) => set('overseas_experience', v === 'yes')}
          />
          {form.overseas_experience && (
            <div className="mt-2">
              <div className="flex gap-2">
                <input
                  className={`${inputClass} flex-1`}
                  placeholder="국가명 입력 후 추가"
                  value={countryInput}
                  onChange={(e) => setCountryInput(e.target.value)}
                />
                <button type="button" onClick={addCountry} className="text-body-sm text-primary-600 hover:underline">
                  추가
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.overseas_experience_countries.map((c, i) => (
                  <span key={`${c}-${i}`} className="inline-flex items-center gap-1 rounded-sm bg-neutral-100 px-2 py-0.5 text-label-caption text-neutral-600">
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
            <label className="text-body-sm font-medium text-neutral-700">회사소개</label>
            <select className={`${inputClass} py-1`} value={form.company_intro_locale} onChange={(e) => set('company_intro_locale', e.target.value)}>
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  원문언어: {l.label}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className={`${inputClass} mt-1 w-full`}
            rows={4}
            maxLength={5000}
            value={form.company_intro_text}
            onChange={(e) => set('company_intro_text', e.target.value)}
          />
          {/* UI-R7 */}
          <p className="mt-1 text-label-caption text-neutral-400">타인의 개인정보나 비밀유지 대상 정보를 입력하지 마세요.</p>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="text-body-sm font-medium text-neutral-700">대표 제품/서비스(최대 3개)</span>
            <button
              type="button"
              onClick={addOffering}
              disabled={form.representative_offerings.length >= 3}
              className="text-body-sm text-primary-600 hover:underline disabled:cursor-not-allowed disabled:text-neutral-300"
            >
              + 추가
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {form.representative_offerings.map((o, i) => (
              <div key={i} className="flex gap-2 rounded-input border border-neutral-200 p-2">
                <input className={`${inputClass} w-1/3`} placeholder="명칭" value={o.name} onChange={(e) => updateOffering(i, { name: e.target.value })} />
                <input className={`${inputClass} flex-1`} placeholder="설명" value={o.description} onChange={(e) => updateOffering(i, { description: e.target.value })} />
                <button type="button" onClick={() => removeOffering(i)} className="text-body-sm text-error">
                  삭제
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <span className="text-body-sm font-medium text-neutral-700">보유 인증</span>
          <div className="mt-1 flex gap-2">
            <input className={`${inputClass} flex-1`} placeholder="인증명 입력 후 추가" value={certInput} onChange={(e) => setCertInput(e.target.value)} />
            <button type="button" onClick={addCert} className="text-body-sm text-primary-600 hover:underline">
              추가
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {form.certifications.map((c, i) => (
              <span key={`${c}-${i}`} className="inline-flex items-center gap-1 rounded-sm bg-neutral-100 px-2 py-0.5 text-label-caption text-neutral-600">
                {c}
                <button type="button" onClick={() => removeCert(i)}>
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </section>

      <div>
        <p className="text-label-caption text-neutral-400">자동저장되지 않습니다. 탭을 벗어나기 전에 저장해주세요.</p>
        <div className="mt-2 flex items-center gap-3" aria-live="polite">
          <button type="button" onClick={handleSave} disabled={saveState === 'saving'} className={primaryButtonClass}>
            {saveState === 'error' ? '다시 시도' : saveState === 'saving' ? '저장 중...' : '저장'}
          </button>
          {saveState === 'dirty' && <span className="text-label-caption text-accent-700">저장되지 않은 변경사항이 있습니다</span>}
          {saveState === 'saved' && <span className="text-label-caption text-success">방금 저장되었습니다</span>}
          {saveState === 'error' && <span className={errorTextClass}>저장 실패 — 다시 시도해주세요</span>}
        </div>
      </div>
    </div>
  )
}
