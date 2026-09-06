'use client'

// Design Ref: human-matching.screen-spec.md §6.4 / ui-spec §6 — (d) Outcome 타임라인.
// Also HM-B5 / ceo-decision.md §4 item 2 — "파트너 동의 기록" 버튼 + 소형 모달, Outcome
// 전이를 차단하지 않고 동의 기록이 없을 때 meeting으로 전이 시 경고만 노출.
import { useMemo, useState } from 'react'
import { OutcomeTracker } from '@/components/admin/OutcomeTracker'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { adminInputClass, adminButtonPrimaryClass, adminButtonSecondaryClass } from '@/components/admin/styles'
import { OUTCOME_STATE_LABELS, type OutcomeState } from '@/lib/admin/matchTags'
import { OUTCOME_STATE_TONE, THIRD_PARTY_CONSENT_METHOD_LABELS, THIRD_PARTY_EVIDENCE_KIND_LABELS, CONSENT_SCOPE_LABELS } from '@/lib/admin/matchLabels'
import type { MatchRow, OutcomeEventRow } from './types'
import { recordOutcomeTransitionAction, recordThirdPartyConsentAction } from './actions'

export function OutcomeTimelineSection({
  requirementId,
  confirmedMatches,
  outcomeEventsByMatchId,
  adminNameById,
  canUpdate,
  onChanged,
}: {
  requirementId: string
  confirmedMatches: MatchRow[]
  outcomeEventsByMatchId: Map<string, OutcomeEventRow[]>
  adminNameById: Map<string, string>
  canUpdate: boolean
  onChanged: () => void
}) {
  if (confirmedMatches.length === 0) {
    return (
      <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
        <h2 className="admin-heading-3 text-neutral-900">Outcome 타임라인</h2>
        <p className="mt-2 admin-body-sm text-neutral-400">Top3 확정 후 이용 가능합니다.</p>
      </section>
    )
  }

  return (
    <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
      <h2 className="admin-heading-3 text-neutral-900">Outcome 타임라인</h2>
      <div className="mt-4 space-y-6">
        {confirmedMatches.map((m) => (
          <PartnerOutcomeCard
            key={m.id}
            requirementId={requirementId}
            match={m}
            events={outcomeEventsByMatchId.get(m.id) ?? []}
            adminNameById={adminNameById}
            canUpdate={canUpdate}
            onChanged={onChanged}
          />
        ))}
      </div>
    </section>
  )
}

function PartnerOutcomeCard({
  requirementId,
  match,
  events,
  adminNameById,
  canUpdate,
  onChanged,
}: {
  requirementId: string
  match: MatchRow
  events: OutcomeEventRow[]
  adminNameById: Map<string, string>
  canUpdate: boolean
  onChanged: () => void
}) {
  const [activeNode, setActiveNode] = useState<OutcomeState | null>(null)
  const [consentModalOpen, setConsentModalOpen] = useState(false)

  const reachedStates = useMemo(() => new Set(events.map((e) => e.outcome_state)), [events])
  const hasConsent = !!match.third_party_share_consent_at

  return (
    <div className="rounded-card border border-neutral-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="admin-body font-medium text-neutral-900">{match.partner?.company_name_ko ?? '(파트너)'}</h3>
        <div className="flex items-center gap-2">
          {hasConsent ? (
            <span className="admin-label-sm text-success">2단계 연락처 전달 동의 기록됨</span>
          ) : (
            <span className="admin-label-sm text-neutral-400">2단계 연락처 전달 동의 미기록</span>
          )}
          {canUpdate && (
            <button type="button" onClick={() => setConsentModalOpen(true)} className="admin-body-sm text-primary-600 hover:underline">
              파트너 동의 기록
            </button>
          )}
        </div>
      </div>

      <div className="mt-3">
        <OutcomeTracker
          currentState={match.current_outcome_state}
          reachedStates={reachedStates}
          onNodeClick={(state) => canUpdate && setActiveNode(state)}
        />
      </div>

      {activeNode && (
        <OutcomeInlineForm
          requirementId={requirementId}
          matchId={match.id}
          outcomeState={activeNode}
          hasConsent={hasConsent}
          onClose={() => setActiveNode(null)}
          onSaved={() => {
            setActiveNode(null)
            onChanged()
          }}
        />
      )}

      <div className="mt-4">
        <h4 className="admin-label-sm text-neutral-500">이력</h4>
        {events.length === 0 ? (
          <p className="mt-1 admin-body-sm text-neutral-400">아직 기록된 진행 상황이 없습니다.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 admin-body-sm text-neutral-600">
                <StatusBadge tone={OUTCOME_STATE_TONE[e.outcome_state]} label={OUTCOME_STATE_LABELS[e.outcome_state]} />
                <span>{new Date(e.transitioned_at).toLocaleString('ko-KR')}</span>
                <span className="text-neutral-400">· {adminNameById.get(e.recorded_by_admin_id) ?? '(알수없음)'}</span>
                {e.note && <span className="text-neutral-500">· {e.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {consentModalOpen && (
        <ThirdPartyConsentModal
          requirementId={requirementId}
          matchId={match.id}
          onClose={() => setConsentModalOpen(false)}
          onSaved={() => {
            setConsentModalOpen(false)
            onChanged()
          }}
        />
      )}
    </div>
  )
}

function OutcomeInlineForm({
  requirementId,
  matchId,
  outcomeState,
  hasConsent,
  onClose,
  onSaved,
}: {
  requirementId: string
  matchId: string
  outcomeState: OutcomeState
  hasConsent: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [transitionedAt, setTransitionedAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [note, setNote] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [meetingNote, setMeetingNote] = useState('')
  const [quoteAmount, setQuoteAmount] = useState('')
  const [quoteCurrency, setQuoteCurrency] = useState('')
  const [dealFlag, setDealFlag] = useState(false)
  const [dealAmount, setDealAmount] = useState('')
  const [dealCurrency, setDealCurrency] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const result = await recordOutcomeTransitionAction(requirementId, {
      matchId,
      outcomeState,
      transitionedAt: new Date(transitionedAt).toISOString(),
      note: note || null,
      meetingDate: outcomeState === 'meeting' ? meetingDate || null : null,
      meetingNote: outcomeState === 'meeting' ? meetingNote || null : null,
      quoteAmount: outcomeState === 'quote' && quoteAmount ? Number(quoteAmount) : null,
      quoteCurrency: outcomeState === 'quote' && quoteCurrency ? quoteCurrency : null,
      dealFlag: outcomeState === 'deal' ? dealFlag : null,
      dealAmount: outcomeState === 'deal' && dealAmount ? Number(dealAmount) : null,
      dealCurrency: outcomeState === 'deal' && dealCurrency ? dealCurrency : null,
    })
    setSaving(false)
    if (!result.success) {
      setError('저장에 실패했습니다. 다시 시도해주세요.')
      return
    }
    onSaved()
  }

  return (
    <div className="mt-3 rounded-card bg-neutral-50 p-4">
      <div className="flex items-center justify-between">
        <p className="admin-body-sm font-medium text-neutral-900">기록할 상태: {OUTCOME_STATE_LABELS[outcomeState]}</p>
        <button type="button" onClick={onClose} aria-label="닫기" className="text-neutral-500 hover:text-neutral-700">
          ×
        </button>
      </div>

      {outcomeState === 'meeting' && !hasConsent && (
        <p className="mt-2 admin-body-sm text-accent-700">⚠ 이 파트너는 2단계(담당자 연락처 전달) 동의 기록이 없습니다. 동의 없이 연락처를 전달하지 마세요.</p>
      )}

      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="admin-label-sm text-neutral-500">일시</label>
          <input type="datetime-local" className={`${adminInputClass} mt-1 w-full`} value={transitionedAt} onChange={(e) => setTransitionedAt(e.target.value)} />
        </div>
        <div>
          <label className="admin-label-sm text-neutral-500">메모</label>
          <input className={`${adminInputClass} mt-1 w-full`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </div>

        {outcomeState === 'meeting' && (
          <>
            <div>
              <label className="admin-label-sm text-neutral-500">미팅일자</label>
              <input type="date" className={`${adminInputClass} mt-1 w-full`} value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
            </div>
            <div>
              <label className="admin-label-sm text-neutral-500">미팅메모</label>
              <input className={`${adminInputClass} mt-1 w-full`} value={meetingNote} onChange={(e) => setMeetingNote(e.target.value)} maxLength={500} />
            </div>
          </>
        )}

        {outcomeState === 'quote' && (
          <>
            <div>
              <label className="admin-label-sm text-neutral-500">견적금액(선택)</label>
              <input type="number" className={`${adminInputClass} mt-1 w-full`} value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} />
            </div>
            <div>
              <label className="admin-label-sm text-neutral-500">통화(선택, 3자리)</label>
              <input className={`${adminInputClass} mt-1 w-full`} value={quoteCurrency} onChange={(e) => setQuoteCurrency(e.target.value.toUpperCase())} maxLength={3} />
            </div>
          </>
        )}

        {outcomeState === 'deal' && (
          <>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input type="checkbox" checked={dealFlag} onChange={(e) => setDealFlag(e.target.checked)} id="deal-flag" />
              <label htmlFor="deal-flag" className="admin-body-sm text-neutral-700">
                딜 성사 여부
              </label>
            </div>
            <div>
              <label className="admin-label-sm text-neutral-500">금액(선택)</label>
              <input type="number" className={`${adminInputClass} mt-1 w-full`} value={dealAmount} onChange={(e) => setDealAmount(e.target.value)} />
            </div>
            <div>
              <label className="admin-label-sm text-neutral-500">통화(선택, 3자리)</label>
              <input className={`${adminInputClass} mt-1 w-full`} value={dealCurrency} onChange={(e) => setDealCurrency(e.target.value.toUpperCase())} maxLength={3} />
            </div>
          </>
        )}
      </div>

      {error && <p className="mt-2 admin-body-sm text-error">{error}</p>}

      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={adminButtonSecondaryClass}>
          취소
        </button>
        <button type="button" disabled={saving} onClick={handleSave} className={adminButtonPrimaryClass}>
          {saving ? '저장 중...' : '기록 저장'}
        </button>
      </div>
    </div>
  )
}

const CONSENT_METHODS = ['online_self', 'phone', 'in_person', 'email'] as const
const CONSENT_SCOPES = ['name', 'title', 'email', 'phone'] as const
const EVIDENCE_KINDS = ['email_thread', 'verbal_only', 'other'] as const

function ThirdPartyConsentModal({
  requirementId,
  matchId,
  onClose,
  onSaved,
}: {
  requirementId: string
  matchId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [consentMethod, setConsentMethod] = useState<(typeof CONSENT_METHODS)[number]>('phone')
  // ceo-decision.md §2 "범위 최소화 기본값": 1차 동의는 성명/직함/업무용 이메일까지만 기본,
  // 휴대폰은 파트너가 먼저 원할 때만 추가.
  const [scope, setScope] = useState<string[]>(['name', 'title', 'email'])
  const [evidenceKind, setEvidenceKind] = useState<(typeof EVIDENCE_KINDS)[number]>('email_thread')
  const [consentAt, setConsentAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleScope(v: string) {
    setScope((prev) => (prev.includes(v) ? prev.filter((s) => s !== v) : [...prev, v]))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const result = await recordThirdPartyConsentAction(requirementId, {
      matchId,
      consentMethod,
      consentScope: scope,
      evidenceKind,
      consentAt: new Date(consentAt).toISOString(),
    })
    setSaving(false)
    if (!result.success) {
      setError('저장에 실패했습니다. 다시 시도해주세요.')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-card bg-neutral-0 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="admin-heading-3 text-neutral-900">파트너 동의 기록</h3>
        <p className="mt-1 admin-body-sm text-neutral-500">
          2단계(담당자 연락처 전달) 전 파트너에게 오프라인(전화/이메일/대면)으로 개별 동의를 받은 사실을 기록합니다.
        </p>

        <div className="mt-3 space-y-3">
          <div>
            <label className="admin-label-sm text-neutral-500">동의 방법</label>
            <select className={`${adminInputClass} mt-1 w-full`} value={consentMethod} onChange={(e) => setConsentMethod(e.target.value as typeof consentMethod)}>
              {CONSENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {THIRD_PARTY_CONSENT_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="admin-label-sm text-neutral-500">동의 항목</label>
            <div className="mt-1 flex flex-wrap gap-3">
              {CONSENT_SCOPES.map((s) => (
                <label key={s} className="flex items-center gap-1.5 admin-body-sm text-neutral-700">
                  <input type="checkbox" checked={scope.includes(s)} onChange={() => toggleScope(s)} />
                  {CONSENT_SCOPE_LABELS[s]}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="admin-label-sm text-neutral-500">증적 유형</label>
            <select className={`${adminInputClass} mt-1 w-full`} value={evidenceKind} onChange={(e) => setEvidenceKind(e.target.value as typeof evidenceKind)}>
              {EVIDENCE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {THIRD_PARTY_EVIDENCE_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="admin-label-sm text-neutral-500">동의 일시</label>
            <input type="datetime-local" className={`${adminInputClass} mt-1 w-full`} value={consentAt} onChange={(e) => setConsentAt(e.target.value)} />
          </div>
        </div>

        {error && <p className="mt-2 admin-body-sm text-error">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={adminButtonSecondaryClass}>
            취소
          </button>
          <button type="button" disabled={saving || scope.length === 0} onClick={handleSave} className={adminButtonPrimaryClass}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
