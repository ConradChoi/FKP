'use client'

// Design Ref: app/admin/(protected)/leads/[id]/StatusAssigneeForm.tsx — same controlled-select +
// server-action pattern, mirrored for SEEPN inquiries (status new/in_progress/closed + assignee).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminInputClass } from '@/components/admin/styles'
import { INQUIRY_STATUS_LABELS } from '@/lib/seepn/partnerLabels'
import { updateSeepnInquiryStatusAction, assignSeepnInquiryAction, setSeepnInquirySpamAction } from './actions'

interface AdminOption {
  id: string
  display_name: string
}

const STATUS_ORDER: Array<'new' | 'in_progress' | 'closed'> = ['new', 'in_progress', 'closed']

export function InquiryStatusAssignForm({
  inquiryId,
  currentStatus,
  currentAssignedAdminId,
  currentSpam,
  admins,
}: {
  inquiryId: string
  currentStatus: string
  currentAssignedAdminId: string | null
  currentSpam: boolean
  admins: AdminOption[]
}) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [assignedAdminId, setAssignedAdminId] = useState(currentAssignedAdminId ?? '')
  const [spam, setSpam] = useState(currentSpam)
  const [savingField, setSavingField] = useState<'status' | 'assignee' | 'spam' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleStatusChange(next: string) {
    setStatus(next)
    setSavingField('status')
    setError(null)
    const result = await updateSeepnInquiryStatusAction(inquiryId, next)
    setSavingField(null)
    if (!result.success) {
      setError('상태 변경에 실패했습니다.')
      setStatus(currentStatus)
      return
    }
    router.refresh()
  }

  async function handleSpamChange(next: boolean) {
    setSpam(next)
    setSavingField('spam')
    setError(null)
    const result = await setSeepnInquirySpamAction(inquiryId, next)
    setSavingField(null)
    if (!result.success) {
      setError('스팸 표시 변경에 실패했습니다.')
      setSpam(currentSpam)
      return
    }
    router.refresh()
  }

  async function handleAssigneeChange(next: string) {
    setAssignedAdminId(next)
    setSavingField('assignee')
    setError(null)
    const result = await assignSeepnInquiryAction(inquiryId, next || null)
    setSavingField(null)
    if (!result.success) {
      setError('담당자 변경에 실패했습니다.')
      setAssignedAdminId(currentAssignedAdminId ?? '')
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-wrap gap-6 rounded-card border border-neutral-200 bg-neutral-0 p-4">
      <div>
        <label className="mb-1 block admin-label-sm text-neutral-500">상태</label>
        <select className={adminInputClass} value={status} disabled={savingField === 'status'} onChange={(e) => handleStatusChange(e.target.value)}>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {INQUIRY_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block admin-label-sm text-neutral-500">담당자</label>
        <select className={adminInputClass} value={assignedAdminId} disabled={savingField === 'assignee'} onChange={(e) => handleAssigneeChange(e.target.value)}>
          <option value="">미지정</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.display_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block admin-label-sm text-neutral-500">스팸 문의</label>
        <label className="flex items-center gap-2 admin-body-sm text-neutral-700">
          <input type="checkbox" checked={spam} disabled={savingField === 'spam'} onChange={(e) => handleSpamChange(e.target.checked)} />
          스팸으로 표시 (리뷰 작성 자격·거래 공급사에서 제외)
        </label>
      </div>
      {error && <p className="admin-label-sm text-error">{error}</p>}
    </div>
  )
}
