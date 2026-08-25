'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { STATUS_LABELS, STATUS_ORDER } from '@/lib/admin/labels'
import { updateLeadStatusAction, updateLeadAssigneeAction } from './actions'
import { inputClass, errorTextClass } from '@/components/RequestForm/styles'

interface AdminOption {
  id: string
  display_name: string
}

export function StatusAssigneeForm({
  requestId,
  currentStatus,
  currentAssigneeId,
  admins,
}: {
  requestId: string
  currentStatus: string
  currentAssigneeId: string | null
  admins: AdminOption[]
}) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [assigneeId, setAssigneeId] = useState(currentAssigneeId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [savingField, setSavingField] = useState<'status' | 'assignee' | null>(null)

  async function handleStatusChange(next: string) {
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
          <label className="mb-1 block text-label-caption text-neutral-500">상태</label>
          <select
            className={inputClass}
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
          <label className="mb-1 block text-label-caption text-neutral-500">담당자</label>
          <select
            className={inputClass}
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
      {error && <p className={`mt-3 ${errorTextClass}`}>{error}</p>}
    </section>
  )
}
