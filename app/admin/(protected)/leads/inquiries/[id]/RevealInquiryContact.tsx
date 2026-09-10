'use client'

// Design Ref: app/admin/(protected)/leads/[id]/RevealContact.tsx — same reveal-on-click pattern,
// mirrored for get_seepn_inquiry_contact (privacy review §5.3(e): raw email/display_name only
// reachable through this audited RPC, never a direct buyer_account SELECT).
import { useState } from 'react'
import { revealSeepnInquiryContactAction } from './actions'

export function RevealInquiryContact({ inquiryId, maskedName }: { inquiryId: string; maskedName: string }) {
  const [revealed, setRevealed] = useState<{ display_name: string; email: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReveal() {
    setLoading(true)
    setError(null)
    const result = await revealSeepnInquiryContactAction(inquiryId)
    setLoading(false)
    if (!result.success || !result.data) {
      setError('열람 권한이 없거나 실패했습니다.')
      return
    }
    setRevealed(result.data)
  }

  if (revealed) {
    return (
      <span>
        {revealed.display_name} · {revealed.email}
      </span>
    )
  }

  return (
    <span className="flex items-center gap-2">
      {maskedName}
      <button type="button" onClick={handleReveal} disabled={loading} className="admin-body-sm text-primary-600 underline hover:text-primary-700">
        {loading ? '확인 중...' : '연락처 보기'}
      </button>
      {error && <span className="admin-label-sm text-error">{error}</span>}
    </span>
  )
}
