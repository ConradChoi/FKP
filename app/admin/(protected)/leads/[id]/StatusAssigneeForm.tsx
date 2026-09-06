'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { STATUS_LABELS, STATUS_ORDER } from '@/lib/admin/labels'
import { updateLeadStatusAction, updateLeadAssigneeAction } from './actions'
import { adminInputClass, adminButtonPrimaryClass, adminButtonSecondaryClass } from '@/components/admin/styles'

interface AdminOption {
  id: string
  display_name: string
}

export function StatusAssigneeForm({
  requestId,
  currentStatus,
  currentAssigneeId,
  admins,
  matchCount = 0,
}: {
  requestId: string
  currentStatus: string
  currentAssigneeId: string | null
  admins: AdminOption[]
  // human-matching-privacy-review.md §2-(4): closing a lead that already has matching
  // candidates is never blocked, but the operator must see an explicit warning first —
  // the 30-day hard-delete clock nulls the requirement (and its match rows' free text)
  // regardless of how much matching progress had been made.
  matchCount?: number
}) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [assigneeId, setAssigneeId] = useState(currentAssigneeId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [savingField, setSavingField] = useState<'status' | 'assignee' | null>(null)
  const [pendingCloseConfirm, setPendingCloseConfirm] = useState(false)

  async function applyStatusChange(next: string) {
    setStatus(next)
    setSavingField('status')
    setError(null)
    const result = await updateLeadStatusAction(requestId, next)
    setSavingField(null)
    if (!result.success) {
      setError('상태 변경에 실패했습니다.')
      setStatus(currentStatus)
      return
    }
    router.refresh()
  }

  function handleStatusChange(next: string) {
    if (next === 'closed' && matchCount > 0) {
      setPendingCloseConfirm(true)
      return
    }
    void applyStatusChange(next)
  }

  async function handleAssigneeChange(next: string) {
    setAssigneeId(next)
    setSavingField('assignee')
    setError(null)
    const result = await updateLeadAssigneeAction(requestId, next || null)
    setSavingField(null)
    if (!result.success) {
      setError('담당자 변경에 실패했습니다.')
      setAssigneeId(currentAssigneeId ?? '')
      return
    }
    router.refresh()
  }

  return (
    <section className="rounded-card border border-neutral-200 bg-neutral-0 p-6">
      <div className="flex flex-wrap gap-6">
        <div>
          <label className="mb-1 block admin-label-sm text-neutral-500">상태</label>
          <select
            className={adminInputClass}
            value={status}
            disabled={savingField === 'status'}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block admin-label-sm text-neutral-500">담당자</label>
          <select
            className={adminInputClass}
            value={assigneeId}
            disabled={savingField === 'assignee'}
            onChange={(e) => handleAssigneeChange(e.target.value)}
          >
            <option value="">미지정</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.display_name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="mt-3 admin-label-sm text-error">{error}</p>}

      {pendingCloseConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4"
          onClick={() => setPendingCloseConfirm(false)}
        >
          <div className="w-full max-w-sm rounded-card bg-neutral-0 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="admin-heading-3 text-neutral-900">요청 종료 확인</h3>
            <p className="mt-2 admin-body-sm text-neutral-600">
              이 요청에는 매칭 후보 {matchCount}건이 있습니다. 종료하면 30일 뒤 요청 원문이 삭제되고, 매칭 이력은
              식별정보가 제거된 스냅샷으로만 남습니다. 계속하시겠습니까?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingCloseConfirm(false)} className={adminButtonSecondaryClass}>
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingCloseConfirm(false)
                  void applyStatusChange('closed')
                }}
                className={adminButtonPrimaryClass}
              >
                종료
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
