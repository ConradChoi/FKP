'use client'

// Design Ref: screen-spec §2.4 레이아웃(그룹1: 회사 기본정보, 그룹2: 동의 확보 근거)과
// §2.4.1(중복 후보 경고 — 저장을 막지 않고 "그래도 계속 등록" 체크 후 활성화).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminInputClass, adminButtonPrimaryClass } from '@/components/admin/styles'
import { VERIFICATION_STATE_LABELS, INTAKE_SOURCE_LABELS, EVIDENCE_KIND_LABELS } from '@/lib/admin/partnerLabels'
import { checkDuplicateCandidatesAction, createPartnerEntryAction, type DuplicateCandidate } from '../actions'

function nowLocalDatetimeValue() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function NewPartnerEntryForm() {
  const router = useRouter()

  const [businessEntityType, setBusinessEntityType] = useState('corporation')
  const [companyNameKo, setCompanyNameKo] = useState('')
  const [vertical, setVertical] = useState('product')
  const [brn, setBrn] = useState('')
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([])
  const [checkingDup, setCheckingDup] = useState(false)
  const [acknowledgeDup, setAcknowledgeDup] = useState(false)

  const [method, setMethod] = useState('phone')
  const [collectedAt, setCollectedAt] = useState(nowLocalDatetimeValue())
  const [consenterName, setConsenterName] = useState('')
  const [consenterTitle, setConsenterTitle] = useState('')
  const [collectionSourceDetail, setCollectionSourceDetail] = useState('')
  const [evidenceKind, setEvidenceKind] = useState('call_log')
  const [publicListingConsent, setPublicListingConsent] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleBrnBlur() {
    if (!brn.trim()) {
      setCandidates([])
      return
    }
    setCheckingDup(true)
    const result = await checkDuplicateCandidatesAction(brn)
    setCheckingDup(false)
    if (result.success && result.data) {
      setCandidates(result.data.candidates)
      setAcknowledgeDup(false)
    }
  }

  const requiresAck = candidates.length > 0
  const canSubmit =
    businessEntityType &&
    companyNameKo.trim() &&
    vertical &&
    brn.trim() &&
    method &&
    collectedAt &&
    consenterName.trim() &&
    consenterTitle.trim() &&
    collectionSourceDetail.trim() &&
    (!requiresAck || acknowledgeDup)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const result = await createPartnerEntryAction({
      businessEntityType,
      companyNameKo: companyNameKo.trim(),
      vertical,
      businessRegistrationNumber: brn.trim(),
      method,
      collectedAt: new Date(collectedAt).toISOString(),
      consenterName: consenterName.trim(),
      consenterTitle: consenterTitle.trim(),
      collectionSourceDetail: collectionSourceDetail.trim(),
      evidenceKind,
      publicListingConsent,
    })
    setSaving(false)
    if (!result.success || !result.data) {
      setError(result.error ?? '등록에 실패했습니다.')
      return
    }
    router.push(`/admin/partners/${result.data.id}?created=1`)
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
        <h2 className="admin-heading-3 text-neutral-900">회사 기본정보</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="admin-label-sm text-neutral-500">법인/개인사업자 *</label>
            <div className="mt-1 flex gap-4">
              <label className="flex items-center gap-1.5 admin-body">
                <input type="radio" checked={businessEntityType === 'corporation'} onChange={() => setBusinessEntityType('corporation')} /> 법인
              </label>
              <label className="flex items-center gap-1.5 admin-body">
                <input type="radio" checked={businessEntityType === 'sole_proprietor'} onChange={() => setBusinessEntityType('sole_proprietor')} /> 개인사업자
              </label>
            </div>
          </div>

          <div>
            <label className="admin-label-sm text-neutral-500">회사명(한글) *</label>
            <input className={`${adminInputClass} mt-1 w-full`} value={companyNameKo} onChange={(e) => setCompanyNameKo(e.target.value)} required />
          </div>

          <div>
            <label className="admin-label-sm text-neutral-500">버티컬 *</label>
            <div className="mt-1 flex gap-4">
              <label className="flex items-center gap-1.5 admin-body">
                <input type="radio" checked={vertical === 'product'} onChange={() => setVertical('product')} /> 제품
              </label>
              <label className="flex items-center gap-1.5 admin-body">
                <input type="radio" checked={vertical === 'service'} onChange={() => setVertical('service')} /> 서비스
              </label>
            </div>
          </div>

          <div>
            <label className="admin-label-sm text-neutral-500">사업자등록번호 *</label>
            <input
              className={`${adminInputClass} mt-1 w-full`}
              value={brn}
              onChange={(e) => setBrn(e.target.value)}
              onBlur={handleBrnBlur}
              placeholder="000-00-00000"
              required
            />
            {checkingDup && <p className="mt-1 admin-label-sm text-neutral-400">중복 확인 중...</p>}
            {candidates.length > 0 && (
              <div className="mt-2 rounded-input border border-accent-200 bg-accent-50 p-3">
                <p className="admin-body-sm font-medium text-accent-700">이미 등록된 사업자번호입니다.</p>
                <ul className="mt-1 space-y-1 admin-body-sm text-accent-700">
                  {candidates.map((c) => (
                    <li key={c.id}>
                      {c.company_name_ko ?? '(회사명 미입력)'} ({VERIFICATION_STATE_LABELS[c.verification_state] ?? c.verification_state},{' '}
                      {INTAKE_SOURCE_LABELS[c.intake_source] ?? c.intake_source}){' '}
                      <a href={`/admin/partners/${c.id}`} target="_blank" rel="noreferrer" className="underline">
                        상세보기
                      </a>
                    </li>
                  ))}
                </ul>
                <label className="mt-2 flex items-center gap-1.5 admin-body-sm text-accent-700">
                  <input type="checkbox" checked={acknowledgeDup} onChange={(e) => setAcknowledgeDup(e.target.checked)} />
                  중복 여부를 확인했으며, 그래도 계속 등록합니다.
                </label>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
        <h2 className="admin-heading-3 text-neutral-900">동의 확보 근거</h2>
        <p className="mt-1 admin-label-sm text-neutral-400">전부 필수 — 전화/대면으로 직접 확인한 내용만 입력하세요.</p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="admin-label-sm text-neutral-500">확인 방법 *</label>
            <div className="mt-1 flex gap-4">
              <label className="flex items-center gap-1.5 admin-body">
                <input type="radio" checked={method === 'phone'} onChange={() => setMethod('phone')} /> 전화
              </label>
              <label className="flex items-center gap-1.5 admin-body">
                <input type="radio" checked={method === 'in_person'} onChange={() => setMethod('in_person')} /> 대면
              </label>
            </div>
          </div>

          <div>
            <label className="admin-label-sm text-neutral-500">확인 일시 *</label>
            <input
              type="datetime-local"
              className={`${adminInputClass} mt-1 w-full`}
              value={collectedAt}
              onChange={(e) => setCollectedAt(e.target.value)}
              required
            />
            <p className="mt-1 admin-label-sm text-neutral-400">최근 30일 이내만 가능합니다.</p>
          </div>

          <div>
            <label className="admin-label-sm text-neutral-500">동의자 성명 *</label>
            <input className={`${adminInputClass} mt-1 w-full`} value={consenterName} onChange={(e) => setConsenterName(e.target.value)} required />
          </div>

          <div>
            <label className="admin-label-sm text-neutral-500">동의자 직함 *</label>
            <input className={`${adminInputClass} mt-1 w-full`} value={consenterTitle} onChange={(e) => setConsenterTitle(e.target.value)} required />
            <p className="mt-1 admin-label-sm text-neutral-400">대표자/담당임원 등 권한 있는 담당자인지 확인하세요.</p>
          </div>

          <div>
            <label className="admin-label-sm text-neutral-500">수집 경로 상세 *</label>
            <input
              className={`${adminInputClass} mt-1 w-full`}
              value={collectionSourceDetail}
              onChange={(e) => setCollectionSourceDetail(e.target.value)}
              placeholder="예: 전시회 명함교환, 지인 소개 등"
              required
            />
          </div>

          <div>
            <label className="admin-label-sm text-neutral-500">증빙 유형</label>
            <select className={`${adminInputClass} mt-1 w-full`} value={evidenceKind} onChange={(e) => setEvidenceKind(e.target.value)}>
              {Object.entries(EVIDENCE_KIND_LABELS)
                // Fix (qa pass, 2026-09-03): admin_create_partner_entry rejects
                // evidence_kind='none' whenever publicListingConsent is checked (그 동의는
                // 증빙이 필수 — privacy review §3.4). '없음' stays selectable for a plain
                // registration that doesn't also confirm public listing.
                .filter(([value]) => publicListingConsent === false || value !== 'none')
                .map(([value, l]) => (
                  <option key={value} value={value}>
                    {l}
                  </option>
                ))}
            </select>
          </div>

          <label className="flex items-center gap-1.5 admin-body-sm text-neutral-700">
            <input
              type="checkbox"
              checked={publicListingConsent}
              onChange={(e) => {
                setPublicListingConsent(e.target.checked)
                if (e.target.checked && evidenceKind === 'none') setEvidenceKind('call_log')
              }}
            />
            같은 통화/대면에서 공개노출 동의도 함께 확보했습니다.
          </label>
        </div>
      </section>

      {error && <p className="admin-body-sm text-error">{error}</p>}

      <button type="submit" disabled={!canSubmit || saving} className={adminButtonPrimaryClass}>
        {saving ? '등록 중...' : '등록'}
      </button>
    </form>
  )
}
