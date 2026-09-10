'use client'

// Design Ref: app/supplier/signup/complete/page.tsx (SUP-04, mirrored per screen-spec §3.5 BY-04
// — "SUP-04와 완전히 동일한 구조"). No session exists yet — email is carried via query param.
import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AuthShell } from '@/components/seepn/AuthShell'
import { EnvelopeIcon } from '@/components/icons/SeepnIcons'
import { secondaryButtonClass } from '@/components/RequestForm/styles'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'

const RESEND_COOLDOWN_SECONDS = 60

function SignupCompleteContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''
  const [cooldown, setCooldown] = useState(0)
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function handleResend() {
    if (!email || cooldown > 0) return
    setStatus('sending')
    const supabase = getBuyerBrowserClient()
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setStatus(error ? 'error' : 'sent')
    setCooldown(RESEND_COOLDOWN_SECONDS)
    const timer = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(timer)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  return (
    <AuthShell title="가입 신청이 접수되었습니다">
      <div className="flex flex-col items-center gap-4 text-center">
        <EnvelopeIcon className="h-10 w-10 text-primary-600" />
        <p className="text-body-sm text-neutral-600">
          {email ? (
            <>
              <span className="font-medium text-neutral-900">{email}</span>로 발송된 인증 메일의 링크를 클릭해주세요.
            </>
          ) : (
            '가입 시 입력하신 이메일로 발송된 인증 메일의 링크를 클릭해주세요.'
          )}
          <br />
          (24시간 이내 인증하지 않으면 재발송이 필요합니다)
        </p>
        <button type="button" onClick={handleResend} disabled={cooldown > 0 || !email} className={secondaryButtonClass}>
          {cooldown > 0 ? `재발송 (${cooldown}초)` : status === 'sending' ? '발송 중...' : '인증 메일 재발송'}
        </button>
        {status === 'error' && <p className="text-label-caption text-error">재발송에 실패했습니다. 잠시 후 다시 시도해주세요.</p>}
        <Link href="/seepn/login" className="text-body-sm text-primary-600 hover:underline">
          이미 인증했다면 로그인
        </Link>
      </div>
    </AuthShell>
  )
}

export default function SeepnSignupCompletePage() {
  return (
    <Suspense fallback={null}>
      <SignupCompleteContent />
    </Suspense>
  )
}
