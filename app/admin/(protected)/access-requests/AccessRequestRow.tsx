'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminButtonPrimaryClass, adminButtonSecondaryClass, adminInputClass } from '@/components/admin/styles'

interface Request {
  id: string
  name: string
  email: string
  reason: string
  status: string
  created_at: string
}

export function AccessRequestRow({ request }: { request: Request }) {
  const router = useRouter()
  const [role, setRole] = useState<'operator' | 'viewer'>('viewer')
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function approve() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/admin/access-requests/${request.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleCode: role }),
    })
    setBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? '승인 처리에 실패했습니다.')
      return
    }
    router.refresh()
  }

  async function reject() {
    if (!rejectReason.trim()) {
      setError('거부 사유를 입력해주세요.')
      return
    }
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/admin/access-requests/${request.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason }),
    })
    setBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? '거부 처리에 실패했습니다.')
      return
    }
    router.refresh()
  }

  return (
    <div className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-neutral-900">
            {request.name} <span className="font-normal text-neutral-500">({request.email})</span>
          </p>
          <p className="mt-1 admin-body-sm text-neutral-600">{request.reason}</p>
          <p className="mt-1 admin-label-sm text-neutral-400">
            {new Date(request.created_at).toLocaleString('ko-KR')}
          </p>
        </div>
      </div>

      {error && <p className="mt-3 admin-label-sm text-error">{error}</p>}

      {!rejecting ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            className={adminInputClass}
            value={role}
            onChange={(e) => setRole(e.target.value as 'operator' | 'viewer')}
          >
            <option value="viewer">조회전용(viewer)</option>
            <option value="operator">운영자(operator)</option>
          </select>
          <button type="button" onClick={approve} disabled={busy} className={adminButtonPrimaryClass}>
            승인
          </button>
          <button type="button" onClick={() => setRejecting(true)} disabled={busy} className={adminButtonSecondaryClass}>
            거부
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <textarea
            className={adminInputClass}
            rows={2}
            placeholder="거부 사유"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="flex gap-3">
            <button type="button" onClick={reject} disabled={busy} className={adminButtonPrimaryClass}>
              거부 확정
            </button>
            <button type="button" onClick={() => setRejecting(false)} disabled={busy} className={adminButtonSecondaryClass}>
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
