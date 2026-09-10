'use client'

// Design Ref: app/supplier/login/page.tsx (SUP-01, mirrored per screen-spec §3.1 BY-01 — "SUP-01과
// 동일 구조") + screen-spec §3.1 branch table (target table buyer_account instead of
// partner_account) + PRD "record_buyer_login() RPC를 반드시 호출해야 합니다" — this is the ONLY
// place that call happens. §3.1 SP-14: `?redirect=` (and optionally `&action=bookmark`) carries
// the caller's original destination through the login/signup round trip.
import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'
import { AuthShell } from '@/components/seepn/AuthShell'
import { EyeIcon, EyeOffIcon } from '@/components/icons/SeepnIcons'
import { inputClass, primaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'

const NEUTRAL_LOGIN_ERROR = '이메일 또는 비밀번호가 올바르지 않습니다.'
const BLOCKED_ACCOUNT_MESSAGE = '이 계정으로는 로그인할 수 없습니다. 도움이 필요하시면 고객센터로 문의해주세요.'
const SUSPENDED_MESSAGE = '이용이 제한된 계정입니다. 고객센터로 문의해주세요.'
const GENERIC_ERROR = '로그인에 실패했습니다. 잠시 후 다시 시도해주세요.'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해주세요.')
      return
    }
    setLoading(true)
    setError(null)

    const supabase = getBuyerBrowserClient()
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError || !signInData.user) {
      setLoading(false)
      if (signInError?.message?.toLowerCase().includes('confirm')) {
        setError('이메일 인증이 필요합니다. 가입 시 발송된 메일을 확인해주세요.')
        return
      }
      setError(NEUTRAL_LOGIN_ERROR)
      return
    }

    const { data: account } = await supabase
      .from('buyer_account')
      .select('status')
      .maybeSingle<{ status: string }>()

    if (!account) {
      setLoading(false)
      setError(GENERIC_ERROR)
      return
    }
    if (account.status === 'withdrawn') {
      await supabase.auth.signOut()
      setLoading(false)
      setError(BLOCKED_ACCOUNT_MESSAGE)
      return
    }
    if (account.status === 'suspended') {
      await supabase.auth.signOut()
      setLoading(false)
      setError(SUSPENDED_MESSAGE)
      return
    }

    const emailConfirmedAt = (signInData.user as unknown as { email_confirmed_at?: string | null })
      .email_confirmed_at
    if (!emailConfirmedAt) {
      setLoading(false)
      router.push('/seepn/signup/complete')
      return
    }

    // PRD: "성공 시 반드시 record_buyer_login() RPC를 호출해야 합니다(이게 last_login_at을
    // 실제로 갱신하는 유일한 지점입니다)". Best-effort — a failure here must not block login.
    const { error: recordLoginError } = await supabase.rpc('record_buyer_login')
    if (recordLoginError) {
      console.error(`seepn.buyer.login: record_buyer_login failed: ${recordLoginError.message}`)
    }

    setLoading(false)
    const redirectTo = searchParams.get('redirect')
    router.push(redirectTo && redirectTo.startsWith('/seepn') ? redirectTo : '/seepn/partners')
    router.refresh()
  }

  return (
    <AuthShell title="로그인">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-body-sm text-neutral-700">
            이메일
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            className={`${inputClass} w-full`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-body-sm text-neutral-700">
            비밀번호
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              className={`${inputClass} w-full pr-10`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {error && <p className={errorTextClass}>{error}</p>}

        <button type="submit" disabled={loading} className={`${primaryButtonClass} w-full`}>
          {loading ? '로그인 중...' : '로그인'}
        </button>

        <div className="flex flex-col items-center gap-2 pt-2 text-body-sm">
          <Link
            href={`/seepn/signup${searchParams.get('redirect') ? `?redirect=${encodeURIComponent(searchParams.get('redirect')!)}` : ''}`}
            className="text-primary-600 hover:underline"
          >
            계정이 없으신가요? 가입하기
          </Link>
          <Link href="/seepn/forgot-password" className="text-neutral-500 hover:underline">
            비밀번호를 잊으셨나요?
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}

export default function SeepnLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}
