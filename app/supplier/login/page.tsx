'use client'

// Design Ref: docs/02-design/features/partner-supplier-app.screen-spec.md §3.1 (SUP-01) +
// docs/03-security/partner-supplier-app-ui-privacy-review.md §1.1 (UI-B1) — the withdrawn-
// account branch below uses the UI-B1-corrected neutral copy ("이 계정으로는 로그인할 수
// 없습니다"), not the original "탈퇴한 계정입니다" (that phrasing was itself an account-
// enumeration leak per that section, now moot in the normal flow since UI-B1 hard-deletes
// auth.users on withdrawal — kept only as defensive dead code for the documented residual-risk
// window described there).
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupplierBrowserClient } from '@/lib/supabase/supplierBrowserClient'
import { AuthShell } from '@/components/supplier/AuthShell'
import { EyeIcon, EyeOffIcon } from '@/components/icons/SupplierIcons'
import { inputClass, primaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'

const NEUTRAL_LOGIN_ERROR = '이메일 또는 비밀번호가 올바르지 않습니다.'
const BLOCKED_ACCOUNT_MESSAGE = '이 계정으로는 로그인할 수 없습니다. 도움이 필요하시면 고객센터로 문의해주세요.'
const SUSPENDED_MESSAGE = '이용이 제한된 계정입니다. 고객센터로 문의해주세요.'
const GENERIC_ERROR = '로그인에 실패했습니다. 잠시 후 다시 시도해주세요.'

export default function SupplierLoginPage() {
  const router = useRouter()
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

    const supabase = getSupplierBrowserClient()
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

    // screen-spec §3.1 branch table.
    const { data: account } = await supabase
      .from('partner_account')
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
    setLoading(false)
    if (!emailConfirmedAt) {
      router.push('/supplier/signup/complete')
      return
    }

    router.push('/supplier/profile')
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
          <Link href="/supplier/signup" className="text-primary-600 hover:underline">
            계정이 없으신가요? 파트너 등록
          </Link>
          <Link href="/supplier/forgot-password" className="text-neutral-500 hover:underline">
            비밀번호를 잊으셨나요?
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}
