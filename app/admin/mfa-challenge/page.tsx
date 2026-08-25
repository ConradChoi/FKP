// Design Ref: fkp-v0.2-privacy-review-phase3-rbac.md §6.5 — MFA is verified per session
// (AAL1 -> AAL2), not just once at enrollment. middleware.ts routes here whenever a
// returning session has a verified TOTP factor but this specific session hasn't cleared it.
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getPendingMfaFactorAction, verifyMfaAction } from '@/lib/supabase/adminAuthActions'
import { inputClass, primaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'

export default function MfaChallengePage() {
  const router = useRouter()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    getPendingMfaFactorAction().then((result) => {
      setLoading(false)
      if (result.success && result.data) {
        setFactorId(result.data.factorId)
      } else {
        // No verified factor found — this account was never fully enrolled; send back to setup.
        router.push('/admin/mfa-setup')
      }
    })
  }, [router])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId) return
    setVerifying(true)
    setError(null)
    const result = await verifyMfaAction(factorId, code)
    setVerifying(false)
    if (!result.success) {
      setError('인증번호가 올바르지 않습니다. 다시 시도해주세요.')
      return
    }
    router.push('/admin')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md rounded-card bg-neutral-0 p-8 shadow-lg">
        <h1 className="text-h3 text-primary-900">2단계 인증</h1>
        <p className="mt-2 text-body-sm text-neutral-600">OTP 앱에 표시된 6자리 인증번호를 입력해주세요.</p>

        {loading && <p className="mt-6 text-body-sm text-neutral-500">확인 중...</p>}

        {factorId && (
          <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-4">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6자리 인증번호"
              autoFocus
              required
              className={`${inputClass} w-full text-center tracking-widest`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {error && <p className={errorTextClass}>{error}</p>}
            <button type="submit" disabled={verifying} className={`${primaryButtonClass} w-full`}>
              {verifying ? '확인 중...' : '확인'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
