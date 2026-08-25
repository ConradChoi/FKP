// Design Ref: fkp-v0.2-privacy-review-phase3-rbac.md §6.5 — MFA(TOTP) is mandatory for
// every operator including the representative. middleware.ts routes any AAL1 session with
// no enrolled factor here before it can reach any other /admin/** page.
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { startMfaEnrollAction, verifyMfaAction, type MfaEnrollData } from '@/lib/supabase/adminAuthActions'
import { inputClass, primaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'

export default function MfaSetupPage() {
  const router = useRouter()
  const [enroll, setEnroll] = useState<MfaEnrollData | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    startMfaEnrollAction().then((result) => {
      setLoading(false)
      if (result.success && result.data) {
        setEnroll(result.data)
      } else {
        setError('MFA 등록을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.')
      }
    })
  }, [])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!enroll) return
    setVerifying(true)
    setError(null)
    const result = await verifyMfaAction(enroll.factorId, code)
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
        <h1 className="text-h3 text-primary-900">2단계 인증 등록 (필수)</h1>
        <p className="mt-2 text-body-sm text-neutral-600">
          모든 운영자 계정은 2단계 인증(TOTP) 등록이 필수입니다. Google Authenticator, Authy 등
          OTP 앱으로 아래 QR코드를 스캔한 뒤, 생성된 6자리 코드를 입력해주세요.
        </p>

        {loading && <p className="mt-6 text-body-sm text-neutral-500">QR코드를 준비하는 중...</p>}

        {enroll && (
          <>
            {/* qr_code is a data: URI (SVG), not raw markup — must be used as an <img> src,
                per Supabase's own docs example (`<Image src={data.totp.qr_code} .../>`). */}
            <div className="mt-6 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, next/image can't optimize it */}
              <img src={enroll.qrCodeDataUri} alt="TOTP QR 코드" width={200} height={200} />
            </div>
            <p className="mt-3 break-all text-center text-label-caption text-neutral-500">
              QR을 스캔할 수 없다면 직접 입력: {enroll.secret}
            </p>
            <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-4">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6자리 인증번호"
                required
                className={`${inputClass} w-full text-center tracking-widest`}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              {error && <p className={errorTextClass}>{error}</p>}
              <button type="submit" disabled={verifying} className={`${primaryButtonClass} w-full`}>
                {verifying ? '확인 중...' : '등록 완료'}
              </button>
            </form>
          </>
        )}

        {!loading && !enroll && error && <p className={`mt-6 ${errorTextClass}`}>{error}</p>}
      </div>
    </main>
  )
}
