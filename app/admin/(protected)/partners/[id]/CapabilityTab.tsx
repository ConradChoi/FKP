'use client'

// Design Ref: screen-spec §2.5.4 "Capability 탭 — Common Core + Vertical A/B". Common Core는
// BasicInfoTab.tsx로 옮겼으므로(그 파일 헤더 코멘트 참고 — 문서의 중복 "2.5.4" 번호로 인한
// 구현 판단), 이 탭은 vertical(제품/서비스)에 따라 갈리는 확장 필드와 표준 카테고리 다중선택만
// 다룬다. vertical이 아직 선택되지 않았으면(기본정보 탭에서 먼저 선택) 안내만 표시한다.
import { useState } from 'react'
import { adminInputClass, adminButtonPrimaryClass } from '@/components/admin/styles'
import { OEM_ODM_LABELS, PRICING_MODEL_LABELS, REMOTE_ONSITE_LABELS, SERVICE_TYPE_OPTIONS } from '@/lib/admin/partnerLabels'
import { updatePartnerCapabilityAction, updatePartnerCategoriesAction, type PartnerCapabilityPatch } from './actions'
import { CategoryPicker } from '../CategoryPicker'
import type { CategoryOption } from '../categoryOptions'
import type { PartnerDetail } from './page'

export function CapabilityTab({
  partner,
  categoryOptions,
  selectedCategoryIds,
  canUpdate,
}: {
  partner: PartnerDetail
  categoryOptions: CategoryOption[]
  selectedCategoryIds: string[]
  canUpdate: boolean
}) {
  const [categoryIds, setCategoryIds] = useState(selectedCategoryIds)
  const [categorySaving, setCategorySaving] = useState(false)
  const [categoryError, setCategoryError] = useState<string | null>(null)

  const [form, setForm] = useState({
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
  })
  const [customServiceType, setCustomServiceType] = useState('')
  const [updatedAt, setUpdatedAt] = useState(partner.updated_at)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
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
  function updateReferenceProject(idx: number, patch: Partial<{ client_industry: string; deliverable: string; anonymized: boolean }>) {
    set(
      'reference_projects',
      form.reference_projects.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    )
  }
  function removeReferenceProject(idx: number) {
    set('reference_projects', form.reference_projects.filter((_, i) => i !== idx))
  }

  async function handleSaveCategories(ids: string[]) {
    setCategoryIds(ids)
    setCategorySaving(true)
    setCategoryError(null)
    const result = await updatePartnerCategoriesAction(partner.id, ids)
    setCategorySaving(false)
    if (!result.success) setCategoryError('카테고리 저장 실패')
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const patch: PartnerCapabilityPatch =
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
    <fieldset disabled={!canUpdate} className="space-y-6 border-0 p-0">
      {!canUpdate && <p className="admin-label-sm text-accent-700">수정 권한이 없어 조회만 가능합니다.</p>}
      <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
        <h2 className="admin-heading-3 text-neutral-900">표준 카테고리</h2>
        <p className="mt-1 admin-label-sm text-neutral-400">선택은 즉시 저장됩니다.</p>
        <div className="mt-2 max-w-lg">
          <CategoryPicker options={categoryOptions} selectedIds={categoryIds} onChange={handleSaveCategories} />
        </div>
        {categorySaving && <p className="mt-1 admin-label-sm text-neutral-400">저장 중...</p>}
        {categoryError && <p className="mt-1 admin-label-sm text-error">{categoryError}</p>}
        {categoryIds.length === 0 && (
          <p className="mt-2 admin-body-sm text-accent-700">카테고리가 선택되지 않았습니다 — 매칭 정확도에 영향을 줍니다.</p>
        )}
      </section>

      {!partner.vertical && (
        <p className="admin-body-sm text-neutral-400">
          버티컬(제품/서비스)이 아직 선택되지 않았습니다 — 기본정보 탭에서 먼저 선택하세요.
        </p>
      )}

      {partner.vertical === 'product' && (
        <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
          <h2 className="admin-heading-3 text-neutral-900">Vertical A — 제품</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="admin-label-sm text-neutral-500">MOQ (최소주문수량)</label>
              <input className={`${adminInputClass} mt-1 w-full`} value={form.moq} onChange={(e) => set('moq', e.target.value)} />
            </div>
            <div>
              <label className="admin-label-sm text-neutral-500">가격대</label>
              <input className={`${adminInputClass} mt-1 w-full`} value={form.price_band} onChange={(e) => set('price_band', e.target.value)} />
            </div>
            <div>
              <label className="admin-label-sm text-neutral-500">리드타임(일)</label>
              <input
                type="number"
                className={`${adminInputClass} mt-1 w-full`}
                value={form.lead_time_days ?? ''}
                onChange={(e) => set('lead_time_days', e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div>
              <label className="admin-label-sm text-neutral-500">OEM/ODM/자사브랜드</label>
              <select className={`${adminInputClass} mt-1 w-full`} value={form.oem_odm_type} onChange={(e) => set('oem_odm_type', e.target.value)}>
                <option value="">(선택 안함)</option>
                {Object.entries(OEM_ODM_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 admin-label-sm text-neutral-500">
                <input type="checkbox" checked={!!form.sample_available} onChange={(e) => set('sample_available', e.target.checked)} /> 샘플 제공 가능
              </label>
              {form.sample_available && (
                <input
                  className={`${adminInputClass} mt-1 w-full`}
                  placeholder="샘플 조건"
                  value={form.sample_terms}
                  onChange={(e) => set('sample_terms', e.target.value)}
                />
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="admin-label-sm text-neutral-500">수출 이력</label>
              <input className={`${adminInputClass} mt-1 w-full`} value={form.export_record} onChange={(e) => set('export_record', e.target.value)} />
            </div>
          </div>
        </section>
      )}

      {partner.vertical === 'service' && (
        <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
          <h2 className="admin-heading-3 text-neutral-900">Vertical B — 서비스</h2>
          <div className="mt-4">
            <span className="admin-label-sm text-neutral-500">서비스 유형</span>
            <div className="mt-1 flex flex-wrap gap-3">
              {SERVICE_TYPE_OPTIONS.map((s) => (
                <label key={s.value} className="flex items-center gap-1.5 admin-body-sm text-neutral-700">
                  <input type="checkbox" checked={form.service_types.includes(s.value)} onChange={() => toggleServiceType(s.value)} />
                  {s.label}
                </label>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                className={`${adminInputClass} flex-1`}
                placeholder="직접입력"
                value={customServiceType}
                onChange={(e) => setCustomServiceType(e.target.value)}
              />
              <button type="button" onClick={addCustomServiceType} className="admin-body-sm text-primary-600 hover:underline">
                추가
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {form.service_types
                .filter((s) => !SERVICE_TYPE_OPTIONS.some((o) => o.value === s))
                .map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-sm bg-neutral-100 px-2 py-0.5 admin-label-sm text-neutral-600">
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
              <label className="admin-label-sm text-neutral-500">최소 프로젝트 규모</label>
              <input
                className={`${adminInputClass} mt-1 w-full`}
                value={form.project_min_size}
                onChange={(e) => set('project_min_size', e.target.value)}
              />
            </div>
            <div>
              <label className="admin-label-sm text-neutral-500">과금 모델</label>
              <select className={`${adminInputClass} mt-1 w-full`} value={form.pricing_model} onChange={(e) => set('pricing_model', e.target.value)}>
                <option value="">(선택 안함)</option>
                {Object.entries(PRICING_MODEL_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="admin-label-sm text-neutral-500">표준 소요기간</label>
              <input
                className={`${adminInputClass} mt-1 w-full`}
                value={form.standard_lead_time}
                onChange={(e) => set('standard_lead_time', e.target.value)}
              />
            </div>
            <div>
              <label className="admin-label-sm text-neutral-500">팀 규모</label>
              <input className={`${adminInputClass} mt-1 w-full`} value={form.team_size_band} onChange={(e) => set('team_size_band', e.target.value)} />
            </div>
            <div>
              <label className="admin-label-sm text-neutral-500">원격/온사이트</label>
              <select className={`${adminInputClass} mt-1 w-full`} value={form.remote_onsite} onChange={(e) => set('remote_onsite', e.target.value)}>
                <option value="">(선택 안함)</option>
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
              <span className="admin-label-sm text-neutral-500">레퍼런스 프로젝트 (권장 최대 5개)</span>
              <button type="button" onClick={addReferenceProject} className="admin-body-sm text-primary-600 hover:underline">
                + 추가
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {form.reference_projects.map((p, i) => (
                <div key={i} className="space-y-1 rounded-input border border-neutral-200 p-2">
                  <div className="flex gap-2">
                    <input
                      className={`${adminInputClass} flex-1`}
                      placeholder="클라이언트 산업"
                      value={p.client_industry}
                      onChange={(e) => updateReferenceProject(i, { client_industry: e.target.value })}
                    />
                    <input
                      className={`${adminInputClass} flex-1`}
                      placeholder="산출물"
                      value={p.deliverable}
                      onChange={(e) => updateReferenceProject(i, { deliverable: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 admin-label-sm text-neutral-500">
                      <input type="checkbox" checked={p.anonymized} onChange={(e) => updateReferenceProject(i, { anonymized: e.target.checked })} /> 익명화
                    </label>
                    <button type="button" onClick={() => removeReferenceProject(i)} className="admin-body-sm text-error">
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
          {error && <p className="admin-body-sm text-error">{error}</p>}
          <div className="mt-2 flex items-center gap-3">
            <button type="button" onClick={handleSave} disabled={saving} className={adminButtonPrimaryClass}>
              {saving ? '저장 중...' : '저장'}
            </button>
            {saved && <span className="admin-body-sm text-success">저장되었습니다.</span>}
          </div>
        </div>
      )}
    </fieldset>
  )
}
