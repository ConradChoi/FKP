'use client'

import { useState } from 'react'
import { revealContactAction } from './actions'

export function RevealContact({
  requestId,
  maskedContact,
  canAccessPii,
}: {
  requestId: string
  maskedContact: string
  canAccessPii: boolean
}) {
  const [revealed, setRevealed] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReveal() {
    setLoading(true)
    setError(null)
    const result = await revealContactAction(requestId)
    setLoading(false)
    if (!result.success || !result.data) {
      setError('열람 권한이 없거나 실패했습니다.')
      return
    }
    setRevealed(result.data.contact)
  }

  if (revealed) return <span>{revealed}</span>

  if (!canAccessPii) {
    return <span className="text-neutral-500">{maskedContact} (viewer 역할은 원문 열람 불가)</span>
  }

  return (
    <span className="flex items-center gap-2">
      {maskedContact}
      <button
        type="button"
        onClick={handleReveal}
        disabled={loading}
        className="admin-body-sm text-primary-600 underline hover:text-primary-700"
      >
        {loading ? '확인 중...' : '원문 보기'}
      </button>
      {error && <span className="admin-label-sm text-error">{error}</span>}
    </span>
  )
}
