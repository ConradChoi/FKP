'use client'

// Design Ref: screen-spec §2.5.6 — 동의 현황 + "공개 전환 준비 체크리스트"(partner_set_public_listing
// 3층 게이트를 켜기 전에 미리 계산해 보여줌) + 버튼 노출 규칙 표. Gap G-3이 20260829180000의
// admin_record_partner_consent로 해소되었으므로 "준비 중" 안내 대신 실제 동작하는 폼으로 구현한다.
import { useState } from 'react'
import { adminInputClass, adminButtonPrimaryClass, adminButtonSecondaryClass, adminButtonDestructiveClass } from '@/components/admin/styles'
import { CONSENT_TYPE_LABELS, CONSENT_METHOD_LABELS, EVIDENCE_KIND_LABELS } from '@/lib/admin/partnerLabels'
import { setPublicListingAction, suspendListingAction, adminRecordPartnerConsentAction } from './actions'
import { useRouter } from 'next/navigation'
import type { PartnerConsentRecord } from './page'

function nowLocalDatetimeValue() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function ConsentTab({
  partnerId,
  intakeSource,
  verificationState,
  publicListingState,
  consents,
  hasBizCertDocument,
  canUpdate,
}: {
  partnerId: string
  intakeSource: string
  verificationState: string
  publicListingState: string
  consents: PartnerConsentRecord[]
  hasBizCertDocument: boolean
  canUpdate: boolean
}) {
  const router = useRouter()
  const [toggling, setToggling] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const [method, setMethod] = useState('phone')
  const [collectedAt, setCollectedAt] = useState(nowLocalDatetimeValue())
  const [consenterName, setConsenterName] = useState('')
  const [consenterTitle, setConsenterTitle] = useState('')
  const [evidenceKind, setEvidenceKind] = useState('call_log')
  const [recording, setRecording] = useState(false)
  const [recordError, setRecordError] = useState<string | null>(null)
  const [recordSaved, setRecordSaved] = useState(false)

  const latestByType = new Map<string, PartnerConsentRecord>()
  for (const c of consents) {
    if (!latestByType.has(c.consent_type)) latestByType.set(c.consent_type, c)
  }
  const latestPublicListing = latestByType.get('public_listing')

  const isVerified = verificationState === 'verified'
  const hasPublicListingConsent = !!latestPublicListing?.granted
  const hasEvidenceForAdmin = intakeSource !== 'admin_entry' || (latestPublicListing && ['phone', 'in_person'].includes(latestPublicListing.method))

  const checklist = [
    { label: '검증 완료(verification_state = verified)', met: isVerified },
    { label: '공개노출 동의 확보(public_listing 동의 granted=true, 최신 행 기준)', met: hasPublicListingConsent },
    { label: '사업자등록증 첨부', met: hasBizCertDocument },
    ...(intakeSource === 'admin_entry' ? [{ label: '동의 증빙이 전화/대면', met: hasEvidenceForAdmin }] : []),
  ]
  const allMet = checklist.every((c) => c.met)

  async function handleTurnOn() {
    setToggling(true)
    setToggleError(null)
    const result = await setPublicListingAction(partnerId, true)
    setToggling(false)
    if (!result.success) {
      setToggleError(result.error ?? '공개 전환 실패')
      return
    }
    router.refresh()
  }

  async function handleSuspend() {
    if (!window.confirm('공개 노출을 중단할까요?')) return
    setToggling(true)
    setToggleError(null)
    const result = await suspendListingAction(partnerId)
    setToggling(false)
    if (!result.success) {
      setToggleError('공개 중단 실패')
      return
    }
    router.refresh()
  }

  async function handleRecordConsent(e: React.FormEvent) {
    e.preventDefault()
    setRecording(true)
    setRecordError(null)
    const result = await adminRecordPartnerConsentAction({
      partnerId,
      method,
      collectedAt: new Date(collectedAt).toISOString(),
      consenterName,
      consenterTitle,
      evidenceKind,
    })
    setRecording(false)
    if (!result.success) {
      setRecordError('기록 실패')
      return
    }
    setRecordSaved(true)
    setConsenterName('')
    setConsenterTitle('')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
        <h2 className="admin-heading-3 text-neutral-900">동의 현황</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200 text-left">
                <th className="px-3 py-2 admin-body-sm font-medium text-neutral-500">유형</th>
                <th className="px-3 py-2 admin-body-sm font-medium text-neutral-500">동의여부</th>
                <th className="px-3 py-2 admin-body-sm font-medium text-neutral-500">방법</th>
                <th className="px-3 py-2 admin-body-sm font-medium text-neutral-500">확인일시</th>
              </tr>
            </thead>
            <tbody>
              {['terms', 'privacy', 'public_listing', 'marketing'].map((type) => {
                const c = latestByType.get(type)
                return (
                  <tr key={type} className="border-b border-neutral-100 last:border-0">
                    <td className="px-3 py-2 admin-body-sm text-neutral-700">{CONSENT_TYPE_LABELS[type]}</td>
                    <td className="px-3 py-2 admin-body-sm">
                      {c ? (c.granted ? <span className="text-success">동의</span> : <span className="text-neutral-400">미동의/철회</span>) : (
                        <span className="text-neutral-300">기록 없음</span>
                      )}
                    </td>
                    <td className="px-3 py-2 admin-body-sm text-neutral-500">{c ? CONSENT_METHOD_LABELS[c.method] ?? c.method : '-'}</td>
                    <td className="px-3 py-2 admin-body-sm text-neutral-500">{c ? new Date(c.collected_at).toLocaleString('ko-KR') : '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
        <h2 className="admin-heading-3 text-neutral-900">공개 노출 요건</h2>
        <div className="mt-3 space-y-1.5">
          {checklist.map((item) => (
            <label key={item.label} className="flex items-center gap-2 admin-body-sm text-neutral-700">
              <input type="checkbox" checked={item.met} readOnly />
              {item.label}
            </label>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {intakeSource === 'self_service' ? (
            <p className="admin-body-sm text-neutral-400">공개 전환은 파트너 본인만 가능합니다(자가등록 동의는 본인 전용 경로입니다).</p>
          ) : publicListingState !== 'on' ? (
            canUpdate && (
              <button type="button" onClick={handleTurnOn} disabled={!allMet || toggling} className={adminButtonPrimaryClass} title={!allMet ? '요건을 모두 충족해야 합니다' : undefined}>
                {toggling ? '처리 중...' : '공개 전환'}
              </button>
            )
          ) : null}
          {publicListingState === 'on' && canUpdate && (
            <button type="button" onClick={handleSuspend} disabled={toggling} className={adminButtonDestructiveClass}>
              공개 중단
            </button>
          )}
        </div>
        {toggleError && <p className="mt-2 admin-body-sm text-error">{toggleError}</p>}
      </section>

      {intakeSource === 'admin_entry' && (
        <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
          <h2 className="admin-heading-3 text-neutral-900">공개노출 동의 기록</h2>
          <p className="mt-1 admin-label-sm text-neutral-400">전화/대면으로 사후에 공개노출 동의를 확보했을 때 기록합니다.</p>
          {!canUpdate && <p className="mt-1 admin-label-sm text-accent-700">수정 권한이 없어 조회만 가능합니다.</p>}
          <form onSubmit={handleRecordConsent} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <fieldset disabled={!canUpdate} className="contents">
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
            </div>
            <div>
              <label className="admin-label-sm text-neutral-500">동의자 성명 *</label>
              <input className={`${adminInputClass} mt-1 w-full`} value={consenterName} onChange={(e) => setConsenterName(e.target.value)} required />
            </div>
            <div>
              <label className="admin-label-sm text-neutral-500">동의자 직함 *</label>
              <input className={`${adminInputClass} mt-1 w-full`} value={consenterTitle} onChange={(e) => setConsenterTitle(e.target.value)} required />
            </div>
            <div>
              <label className="admin-label-sm text-neutral-500">증빙 유형 *</label>
              <select className={`${adminInputClass} mt-1 w-full`} value={evidenceKind} onChange={(e) => setEvidenceKind(e.target.value)}>
                {Object.entries(EVIDENCE_KIND_LABELS)
                  .filter(([v]) => v !== 'none')
                  .map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
              </select>
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={recording || !consenterName.trim() || !consenterTitle.trim()}
                className={adminButtonSecondaryClass}
              >
                {recording ? '기록 중...' : '동의 기록'}
              </button>
              {recordSaved && <span className="admin-body-sm text-success">기록되었습니다.</span>}
            </div>
            {recordError && <p className="sm:col-span-2 admin-body-sm text-error">{recordError}</p>}
          </fieldset>
          </form>
        </section>
      )}
    </div>
  )
}
