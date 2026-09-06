'use client'

// Design Ref: human-matching.screen-spec.md §6.3/§7 / ui-spec §5 — (c) Top3 확정 +
// M-R9(요청 상태 전이 제안) + HM-B5(ceo-decision.md §1/§4 item 3 — 2단계 소개 프로세스 경고
// 문구, privacy officer 원안이 아니라 ceo-decision이 교체한 최종 문구를 그대로 쓴다).
import { useState } from 'react'
import { adminButtonPrimaryClass, adminButtonSecondaryClass } from '@/components/admin/styles'
import type { MatchRow, ShortlistConfirmationSummary } from './types'
import { confirmTop3Action } from './actions'
import { updateLeadStatusAction } from '../actions'

const MAX_TOP3 = 3

function formatElapsed(fromIso: string, toIso: string): string {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime()
  if (ms < 0) return '0분'
  const days = Math.floor(ms / (24 * 60 * 60 * 1000))
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  if (days > 0) return `${days}일 ${hours}시간`
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
  return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`
}

export function Top3ConfirmSection({
  requirementId,
  requirementStatus,
  matches,
  confirmation,
  canUpdate,
  onChanged,
}: {
  requirementId: string
  requirementStatus: string
  matches: MatchRow[]
  confirmation: ShortlistConfirmationSummary
  canUpdate: boolean
  onChanged: () => void
}) {
  const shortlisted = matches.filter((m) => m.judge_status === 'shortlisted')
  const isConfirmed = matches.some((m) => m.is_confirmed_top3)
  const [modalOpen, setModalOpen] = useState(false)
  const [transitionModal, setTransitionModal] = useState(false)
  // screen-spec §7 item 3: when status isn't 'matching', no modal — an inline banner
  // substitutes for it, shown only right after a confirm (not permanently).
  const [statusBannerOpen, setStatusBannerOpen] = useState(false)

  function handleConfirmed() {
    onChanged()
    if (requirementStatus === 'matching') setTransitionModal(true)
    else setStatusBannerOpen(true)
  }

  return (
    <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
      <h2 className="admin-heading-3 text-neutral-900">Top 3 확정</h2>

      {statusBannerOpen && (
        <div className="mt-3 flex items-center justify-between rounded-input border border-primary-100 bg-primary-50 px-3 py-2 admin-body-sm text-primary-700">
          <span>현재 요청 상태가 &apos;파트너매칭중&apos;이 아닙니다. 필요하면 &apos;개요&apos; 탭에서 상태를 확인하세요.</span>
          <button type="button" onClick={() => setStatusBannerOpen(false)} aria-label="닫기" className="ml-3 text-primary-700 hover:underline">
            ×
          </button>
        </div>
      )}

      <div
        className={`mt-3 flex flex-wrap items-center justify-between gap-3 rounded-input border px-4 py-3 ${
          isConfirmed ? 'border-success/30 bg-success-100 text-success' : 'border-neutral-200 bg-neutral-50 text-neutral-600'
        }`}
      >
        <div className="admin-body-sm">
          {isConfirmed ? (
            <>
              <p>
                ✓ 확정됨 · {confirmation.latestConfirmedAt ? new Date(confirmation.latestConfirmedAt).toLocaleString('ko-KR') : ''} ·{' '}
                {confirmation.latestConfirmedByName ?? '(알수없음)'}
                {confirmation.initialConfirmedAt && confirmation.requirementCreatedAt && (
                  <> · Time to Shortlist: {formatElapsed(confirmation.requirementCreatedAt, confirmation.initialConfirmedAt)}</>
                )}
              </p>
              {confirmation.confirmationCount > 1 && (
                <p className="mt-0.5 admin-label-sm text-success/80">최초 확정 이후 {confirmation.confirmationCount - 1}회 수정됨</p>
              )}
            </>
          ) : (
            <p>ⓘ 아직 Top3가 확정되지 않았습니다</p>
          )}
        </div>
        <div>
          <button
            type="button"
            disabled={!canUpdate || shortlisted.length === 0}
            onClick={() => setModalOpen(true)}
            className={adminButtonPrimaryClass}
          >
            {isConfirmed ? 'Top3 수정' : 'Top3 확정'}
          </button>
          {shortlisted.length === 0 && <p className="mt-1 admin-label-sm text-neutral-400">추천으로 판정된 후보가 없습니다</p>}
        </div>
      </div>

      {modalOpen && (
        <Top3ConfirmModal
          requirementId={requirementId}
          shortlisted={shortlisted}
          onClose={() => setModalOpen(false)}
          onConfirmed={() => {
            setModalOpen(false)
            handleConfirmed()
          }}
        />
      )}

      {transitionModal && (
        <RequirementStatusTransitionModal requirementId={requirementId} onClose={() => setTransitionModal(false)} />
      )}
    </section>
  )
}

function Top3ConfirmModal({
  requirementId,
  shortlisted,
  onClose,
  onConfirmed,
}: {
  requirementId: string
  shortlisted: MatchRow[]
  onClose: () => void
  onConfirmed: () => void
}) {
  const [selected, setSelected] = useState<string[]>(shortlisted.filter((m) => m.is_confirmed_top3).map((m) => m.id))
  const [maxWarning, setMaxWarning] = useState(false)
  const [preVerifiedAck, setPreVerifiedAck] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasPreVerified = selected.some((id) => {
    const m = shortlisted.find((s) => s.id === id)
    return m?.partner ? m.partner.verification_state !== 'verified' : false
  })

  function toggle(id: string) {
    setMaxWarning(false)
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= MAX_TOP3) {
        setMaxWarning(true)
        return prev
      }
      return [...prev, id]
    })
  }

  const canConfirm = selected.length >= 1 && selected.length <= MAX_TOP3 && (!hasPreVerified || preVerifiedAck)

  async function handleConfirm() {
    setSaving(true)
    setError(null)
    const result = await confirmTop3Action(requirementId, selected)
    setSaving(false)
    if (!result.success) {
      setError('확정에 실패했습니다. 다시 시도해주세요.')
      return
    }
    onConfirmed()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-card bg-neutral-0 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="admin-heading-3 text-neutral-900">Top3 확정</h3>
          <span className="admin-body-sm text-neutral-500">선택됨: {selected.length}/{MAX_TOP3}</span>
        </div>
        <p className="mt-1 admin-body-sm text-neutral-500">shortlisted 후보 중 최대 3개를 선택하세요.</p>

        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {shortlisted.map((m) => (
            <label key={m.id} className="flex items-center gap-2 admin-body-sm text-neutral-700">
              <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} />
              {m.partner?.company_name_ko ?? '(회사명 미입력)'}
              {m.partner && m.partner.verification_state !== 'verified' && <span className="text-accent-600">⚠ {m.partner.verification_state}</span>}
            </label>
          ))}
        </div>
        {maxWarning && <p className="mt-1 admin-body-sm text-error">최대 3개까지 확정할 수 있습니다</p>}

        {hasPreVerified && (
          <div className="mt-3 rounded-input border border-accent-200 bg-accent-100 p-3">
            <p className="admin-body-sm text-accent-700">⚠ 검증 전 파트너가 포함되어 있습니다.</p>
            <label className="mt-1 flex items-center gap-2 admin-body-sm text-accent-700">
              <input type="checkbox" checked={preVerifiedAck} onChange={(e) => setPreVerifiedAck(e.target.checked)} />
              검증 전 파트너가 포함되어 있음을 확인했습니다.
            </label>
          </div>
        )}

        <div className="mt-4 rounded-input border border-primary-100 bg-primary-50 p-3 admin-body-sm text-primary-700">
          1단계: 바이어에게는 회사 정보만 보냅니다(담당자 성명·연락처 제외). 2단계: 바이어가 미팅을 요청하면 그때
          파트너에게 개별 동의를 받고 연락처를 전달합니다. 동의 기록 없이 담당자 연락처를 전달하지 마세요.
        </div>

        {error && <p className="mt-2 admin-body-sm text-error">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={adminButtonSecondaryClass}>
            취소
          </button>
          <button type="button" disabled={!canConfirm || saving} onClick={handleConfirm} className={adminButtonPrimaryClass}>
            {saving ? '확정 중...' : '확정하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

// M-R9 (screen-spec §7): Top3 최초/수정 확정 직후, requirement.status === 'matching'인
// 경우에만 확인 모달. [지금 변경]은 StatusAssigneeForm이 쓰는 것과 동일한
// updateLeadStatusAction을 그대로 재사용한다(신규 RPC 불필요).
function RequirementStatusTransitionModal({ requirementId, onClose }: { requirementId: string; onClose: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleApply() {
    setSaving(true)
    setError(null)
    const result = await updateLeadStatusAction(requirementId, 'matched')
    setSaving(false)
    if (!result.success) {
      setError('상태 변경에 실패했습니다.')
      return
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-card bg-neutral-0 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="admin-heading-3 text-neutral-900">요청 상태 변경</h3>
        <p className="mt-2 admin-body-sm text-neutral-600">
          Top 3가 확정되었습니다. 이 요청 상태를 &apos;파트너매칭중&apos; → &apos;매칭완료&apos;로 변경할까요?
        </p>
        {error && <p className="mt-2 admin-body-sm text-error">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={adminButtonSecondaryClass}>
            나중에
          </button>
          <button type="button" disabled={saving} onClick={handleApply} className={adminButtonPrimaryClass}>
            {saving ? '변경 중...' : '지금 변경'}
          </button>
        </div>
      </div>
    </div>
  )
}
