'use client'

// Design Ref: screen-spec §3.6 (SUP-05). Mirrors app/admin/set-password's pattern of handling
// a Supabase Auth email-link callback client-side. Supports both the token_hash/type=signup
// flow and the PKCE `code` param flow (screen-spec: "가입 확인 링크는 token_hash/type=signup
// (또는 Supabase 최신 플로우의 PKCE code 파라미터)을 받는다").
import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AuthShell } from '@/components/supplier/AuthShell'
import { CheckCircleIcon, WarningTriangleIcon } from '@/components/icons/SupplierIcons'
import { primaryButtonClass } from '@/components/RequestForm/styles'
import { getSupplierBrowserClient } from '@/lib/supabase/supplierBrowserClient'

type ConfirmState = 'checking' | 'success' | 'already_confirmed' | 'invalid' | 'expired'

function AuthConfirmContent() {
  const searchParams = useSearchParams()
  const [state, setState] = useState<ConfirmState>('checking')

  useEffect(() => {
    async function run() {
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')
      const code = searchParams.get('code')
      const supabase = getSupplierBrowserClient()

      if (tokenHash && type === 'signup') {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'signup' })
        if (!error) {
          setState('success')
          return
        }
        setState(error.message.toLowerCase().includes('expired') ? 'expired' : 'invalid')
        return
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          setState('success')
          return
        }
        setState(error.message.toLowerCase().includes('expired') ? 'expired' : 'invalid')
        return
      }

      // No token at all — could also be a user re-clicking a link whose session already
      // exists and is already confirmed (screen-spec §3.6 "이미 인증된 계정으로 재클릭").
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const confirmedAt = (user as unknown as { email_confirmed_at?: string | null } | null)?.email_confirmed_at
      setState(confirmedAt ? 'already_confirmed' : 'invalid')
    }
    void run()
  }, [searchParams])

  if (state === 'checking') {
    return (
      <AuthShell title="확인 중...">
        <p className="text-center text-body-sm text-neutral-500">잠시만 기다려주세요.</p>
      </AuthShell>
    )
  }

  if (state === 'success') {
    return (
      <AuthShell title="이메일 인증이 완료되었습니다">
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircleIcon className="h-10 w-10 text-success" />
          <Link href="/supplier/login" className={primaryButtonClass}>
            로그인하기
          </Link>
        </div>
      </AuthShell>
    )
  }

  if (state === 'already_confirmed') {
    return (
      <AuthShell title="이미 인증이 완료된 계정입니다">
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircleIcon className="h-10 w-10 text-success" />
          <Link href="/supplier/login" className={primaryButtonClass}>
            로그인하기
          </Link>
        </div>
      </AuthShell>
    )
  }

  if (state === 'expired') {
    return (
      <AuthShell title="인증 링크가 만료되었습니다">
        <div className="flex flex-col items-center gap-4 text-center">
          <WarningTriangleIcon className="h-10 w-10 text-accent-600" />
          <p className="text-body-sm text-neutral-600">24시간이 경과했습니다. 인증 메일을 다시 받아주세요.</p>
          <Link href="/supplier/signup/complete" className={primaryButtonClass}>
            재발송
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="유효하지 않은 인증 링크입니다">
      <div className="flex flex-col items-center gap-4 text-center">
        <WarningTriangleIcon className="h-10 w-10 text-error" />
        <Link href="/supplier/signup/complete" className={primaryButtonClass}>
          인증 메일 다시 받기
        </Link>
      </div>
    </AuthShell>
  )
}

export default function SupplierAuthConfirmPage() {
  return (
    <Suspense fallback={null}>
      <AuthConfirmContent />
    </Suspense>
  )
}
