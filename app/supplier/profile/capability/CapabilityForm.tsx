'use client'

// Design Ref: screen-spec §4.3 (SUP-10) — 카테고리 선택은 즉시 저장(개별 insert/delete),
// Vertical A/B 필드는 독립 저장 버튼. ui-spec §3.8 (버티컬 미선택 시 안내카드로 대체, 흐림
// 처리 아님) + §9 UI-R7(레퍼런스 프로젝트 자유서술 필드 캡션).
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getSupplierBrowserClient } from '@/lib/supabase/supplierBrowserClient'
import { inputClass, primaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'
import { OEM_ODM_LABELS, PRICING_MODEL_LABELS, REMOTE_ONSITE_LABELS, SERVICE_TYPE_OPTIONS } from '@/lib/admin/partnerLabels'
import type { CategoryOption } from '@/app/admin/(protected)/partners/categoryOptions'
import type { PartnerProfile, ReferenceProject } from '@/lib/supplier/types'
import { CategoryPicker } from '@/components/supplier/CategoryPicker'
import { useDirtyGuard } from '@/components/supplier/DirtyGuard'

interface VertForm {
  moq: string
  price_band: string
  lead_time_days: number | null
  sample_available: boolean | null
  sample_terms: string
  oem_odm_type: string
  export_record: string
  service_types: string[]
  project_min_size: string
  pricing_model: string
  standard_lead_time: string
  reference_projects: ReferenceProject[]
  team_size_band: string
  remote_onsite: string
}

function toVertForm(partner: PartnerProfile): VertForm {
  return {
    moq: partner.moq ?? '',
    price_band: partner.price_band ?? '',
    lead_time_days: partner.lead_time_days,
    sample_available: partner.sample_available,
    sample_terms: partner.sample_terms ?? '',
    oem_odm_type: partner.oem_odm_type ?? '',
    export_record: partner.export_record ?? '',
    service_types: partner.service_types,
    project_min_size: partner.project_min_size ?? '',
    pricing_model: partner.pricing_model ?? '',
    standard_lead_time: partner.standard_lead_time ?? '',
    reference_projects: partner.reference_projects,
    team_size_band: partner.team_size_band ?? '',
    remote_onsite: partner.remote_onsite ?? '',
  }
}

export function CapabilityForm({
  partner,
  categoryOptions,
  selectedCategoryIds,
}: {
  partner: PartnerProfile
  categoryOptions: CategoryOption[]
  selectedCategoryIds: string[]
}) {
  const { setDirty } = useDirtyGuard()
  const [categoryIds, setCategoryIds] = useState(selectedCategoryIds)
  const [categorySaving, setCategorySaving] = useState(false)
  const [categoryError, setCategoryError] = useState<string | null>(null)

  const [form, setForm] = useState<VertForm>(() => toVertForm(partner))
  const [customServiceType, setCustomServiceType] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    setDirty(saveState === 'dirty')
  }, [saveState, setDirty])

  function set<K extends keyof VertForm>(key: K, value: VertForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaveState('dirty')
  }

  function toggleServiceType(value: string) {
    set('service_types', form.service_types.includes(value) ? form.service_types.filter((s) => s !== value) : [...form.service_types, value])
  }
  function addCustomServiceType() {
    if (!customServiceType.trim() || form.service_types.includes(customServiceType.trim())) return
    set('service_types', [...form.service_types, customServiceType.trim()])
    setCustomServiceType('')
  }
  function addReferenceProject() {
    set('reference_projects', [...form.reference_projects, { client_industry: '', deliverable: '', anonymized: false }])
  }
  function updateReferenceProject(idx: number, patch: Partial<ReferenceProject>) {
    set('reference_projects', form.reference_projects.map((p, i) => (i === idx ? { ...p, ...patch } : p)))
  }
  function removeReferenceProject(idx: number) {
    set('reference_projects', form.reference_projects.filter((_, i) => i !== idx))
  }

  async function handleCategoryChange(nextIds: string[]) {
    const toAdd = nextIds.filter((id) => !categoryIds.includes(id))
    const toRemove = categoryIds.filter((id) => !nextIds.includes(id))
    setCategoryIds(nextIds)
    setCategorySaving(true)
    setCategoryError(null)
    const supabase = getSupplierBrowserClient()
    try {
      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('partner_standard_category')
          .insert(toAdd.map((id) => ({ partner_id: partner.id, standard_category_id: id })))
        if (error) throw error
      }
      for (const id of toRemove) {
        const { error } = await supabase
          .from('partner_standard_category')
          .delete()
          .eq('partner_id', partner.id)
          .eq('standard_category_id', id)
        if (error) throw error
      }
    } catch {
      setCategoryError('카테고리 저장에 실패했습니다.')
    } finally {
      setCategorySaving(false)
    }
  }

  async function handleSave() {
    setSaveState('saving')
    const supabase = getSupplierBrowserClient()
    const patch =
      partner.vertical === 'product'
        ? {
            moq: form.moq || null,
            price_band: form.price_band || null,
            lead_time_days: form.lead_time_days,
            sample_available: form.sample_available,
            sample_terms: form.sample_terms || null,
            oem_odm_type: form.oem_odm_type || null,
            export_record: form.export_record || null,
          }
        : {
            service_types: form.service_types,
            project_min_size: form.project_min_size || null,
            pricing_model: form.pricing_model || null,
            standard_lead_time: form.standard_lead_time || null,
            reference_projects: form.reference_projects,
            team_size_band: form.team_size_band || null,
            remote_onsite: form.remote_onsite || null,
          }
    const { error } = await supabase.from('partner').update(patch).eq('id', partner.id)
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
        <h2 className="text-body font-medium text-neutral-900">표준 카테고리</h2>
        <p className="mt-1 text-label-caption text-neutral-400">선택은 즉시 저장됩니다.</p>
        <div className="mt-2 max-w-lg">
          <CategoryPicker options={categoryOptions} selectedIds={categoryIds} onChange={handleCategoryChange} />
        </div>
        {categorySaving && <p className="mt-1 text-label-caption text-neutral-400">저장 중...</p>}
        {categoryError && <p className={`mt-1 ${errorTextClass}`}>{categoryError}</p>}
        {categoryIds.length === 0 && (
          <p className="mt-2 text-label-caption text-accent-700">카테고리가 선택되지 않았습니다 — 매칭 정확도에 영향을 줍니다.</p>
        )}
      </section>

      {!partner.vertical && (
        <div className="rounded-card border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-body-sm text-neutral-500">
          기본정보 탭에서 먼저 제품/서비스를 선택하세요.
          <div>
            <Link href="/supplier/profile/basic" className="mt-2 inline-block text-primary-600 hover:underline">
              기본정보 탭으로 이동
            </Link>
          </div>
        </div>
      )}

      {partner.vertical === 'product' && (
        <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
          <h2 className="text-body font-medium text-neutral-900">Vertical A — 제품</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">MOQ(최소주문수량)</label>
              <input className={`${inputClass} w-full`} value={form.moq} onChange={(e) => set('moq', e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">가격대</label>
              <input className={`${inputClass} w-full`} value={form.price_band} onChange={(e) => set('price_band', e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">리드타임(일)</label>
              <input
                type="number"
                className={`${inputClass} w-full`}
                value={form.lead_time_days ?? ''}
                onChange={(e) => set('lead_time_days', e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">OEM/ODM/자사브랜드</label>
              <select className={`${inputClass} w-full`} value={form.oem_odm_type} onChange={(e) => set('oem_odm_type', e.target.value)}>
                <option value="">선택 안 함</option>
                {Object.entries(OEM_ODM_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 text-body-sm font-medium text-neutral-700">
                <input type="checkbox" checked={!!form.sample_available} onChange={(e) => set('sample_available', e.target.checked)} />
                샘플 제공 가능
              </label>
              {form.sample_available && (
                <input
                  className={`${inputClass} mt-1 w-full`}
                  placeholder="샘플 조건"
                  value={form.sample_terms}
                  onChange={(e) => set('sample_terms', e.target.value)}
                />
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">수출 이력</label>
              <input className={`${inputClass} w-full`} value={form.export_record} onChange={(e) => set('export_record', e.target.value)} />
            </div>
          </div>
        </section>
      )}

      {partner.vertical === 'service' && (
        <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
          <h2 className="text-body font-medium text-neutral-900">Vertical B — 서비스</h2>
          <div className="mt-4">
            <span className="mb-1.5 block text-body-sm font-medium text-neutral-700">서비스 유형</span>
            <div className="flex flex-wrap gap-3">
              {SERVICE_TYPE_OPTIONS.map((s) => (
                <label key={s.value} className="flex items-center gap-1.5 text-body-sm text-neutral-700">
                  <input type="checkbox" checked={form.service_types.includes(s.value)} onChange={() => toggleServiceType(s.value)} />
                  {s.label}
                </label>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input className={`${inputClass} flex-1`} placeholder="직접입력" value={customServiceType} onChange={(e) => setCustomServiceType(e.target.value)} />
              <button type="button" onClick={addCustomServiceType} className="text-body-sm text-primary-600 hover:underline">
                추가
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {form.service_types
                .filter((s) => !SERVICE_TYPE_OPTIONS.some((o) => o.value === s))
                .map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-sm bg-neutral-100 px-2 py-0.5 text-label-caption text-neutral-600">
                    {s}
                    <button type="button" onClick={() => toggleServiceType(s)}>
                      ×
                    </button>
                  </span>
                ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">최소 프로젝트 규모</label>
              <input className={`${inputClass} w-full`} value={form.project_min_size} onChange={(e) => set('project_min_size', e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">과금 모델</label>
              <select className={`${inputClass} w-full`} value={form.pricing_model} onChange={(e) => set('pricing_model', e.target.value)}>
                <option value="">선택 안 함</option>
                {Object.entries(PRICING_MODEL_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">표준 소요기간</label>
              <input className={`${inputClass} w-full`} value={form.standard_lead_time} onChange={(e) => set('standard_lead_time', e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">팀 규모</label>
              <input className={`${inputClass} w-full`} value={form.team_size_band} onChange={(e) => set('team_size_band', e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">원격/온사이트</label>
              <select className={`${inputClass} w-full`} value={form.remote_onsite} onChange={(e) => set('remote_onsite', e.target.value)}>
                <option value="">선택 안 함</option>
                {Object.entries(REMOTE_ONSITE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="text-body-sm font-medium text-neutral-700">레퍼런스 프로젝트(권장 최대 5개)</span>
              <button type="button" onClick={addReferenceProject} className="text-body-sm text-primary-600 hover:underline">
                + 추가
              </button>
            </div>
            {/* UI-R7 */}
            <p className="mt-1 text-label-caption text-neutral-400">타인의 개인정보나 비밀유지 대상 정보를 입력하지 마세요.</p>
            <div className="mt-2 space-y-2">
              {form.reference_projects.map((p, i) => (
                <div key={i} className="space-y-1 rounded-input border border-neutral-200 p-2">
                  <div className="flex gap-2">
                    <input
                      className={`${inputClass} flex-1`}
                      placeholder="클라이언트 산업"
                      value={p.client_industry}
                      onChange={(e) => updateReferenceProject(i, { client_industry: e.target.value })}
                    />
                    <input
                      className={`${inputClass} flex-1`}
                      placeholder="산출물"
                      value={p.deliverable}
                      onChange={(e) => updateReferenceProject(i, { deliverable: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-label-caption text-neutral-500">
                      <input type="checkbox" checked={p.anonymized} onChange={(e) => updateReferenceProject(i, { anonymized: e.target.checked })} />
                      익명화
                    </label>
                    <button type="button" onClick={() => removeReferenceProject(i)} className="text-body-sm text-error">
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {partner.vertical && (
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
      )}
    </div>
  )
}
