'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { hideLeadAction } from './[id]/actions'

// Design Ref: 대표 요청(2026-08-29) — 종료(closed) 처리된 리드에 한해 화면에서만 삭제(숨김).
// DB에는 남고 hidden_at만 채워지므로(hide_closed_lead RPC), 직접 링크(/admin/leads/[id])로는
// 계속 열람 가능하다 — 목록에서만 사라진다.
export function DeleteClosedLeadButton({ requestId, redirectAfter }: { requestId: string; redirectAfter?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (!window.confirm('이 요청을 목록에서 삭제할까요? (DB에는 남고, 목록에서만 숨겨집니다)')) return
    setLoading(true)
    setError(null)
    const result = await hideLeadAction(requestId)
    setLoading(false)
    if (!result.success) {
      setError('삭제에 실패했습니다.')
      return
    }
    if (redirectAfter) {
      router.push(redirectAfter)
    } else {
      router.refresh()
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        className="admin-body-sm text-error underline decoration-error/40 hover:decoration-error disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? '삭제 중...' : '삭제'}
      </button>
      {error && <span className="admin-label-sm text-error">{error}</span>}
    </span>
  )
}
