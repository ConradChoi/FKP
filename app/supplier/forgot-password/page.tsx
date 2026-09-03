'use client'

// Design Ref: screen-spec §3.7 (SUP-06). Always shows the same "메일함을 확인해주세요" state
// regardless of whether the email actually has an account (§1.3 account-existence non-
// disclosure) — there is deliberately no success/failure branch in the UI here.
import Link from 'next/link'
import { useState } from 'react'
import { AuthShell } from '@/components/supplier/AuthShell'
import { EnvelopeIcon } from '@/components/icons/SupplierIcons'
import { inputClass, primaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'
import { getSupplierBrowserClient } from '@/lib/supabase/supplierBrowserClient'

export default function SupplierForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      setError('이메일을 입력해주세요.')
      return
    }
    setLoading(true)
    setError(null)
    const supabase = getSupplierBrowserClient()
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${siteUrl}/supplier/reset-password`,
    })
    setLoading(false)
    setSent(true)
  }

  if (sent) {
    return (
      <AuthShell title="메일함을 확인해주세요">
        <div className="flex flex-col items-center gap-4 text-center">
          <EnvelopeIcon className="h-10 w-10 text-primary-600" />
          <p className="text-body-sm text-neutral-600">
            입력하신 이메일로 비밀번호 재설정 링크를 보내드렸습니다. (유효시간: 1시간)
          </p>
          <Link href="/supplier/login" className="text-body-sm text-primary-600 hover:underline">
            로그인으로 돌아가기
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="비밀번호 찾기" subtitle="가입하신 이메일로 재설정 링크를 보내드립니다.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="fp_email" className="mb-1 block text-body-sm text-neutral-700">
            이메일
          </label>
          <input
            id="fp_email"
            type="email"
            autoComplete="username"
            className={`${inputClass} w-full`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {error && <p className={errorTextClass}>{error}</p>}
        <button type="submit" disabled={loading} className={`${primaryButtonClass} w-full`}>
          {loading ? '전송 중...' : '재설정 메일 보내기'}
        </button>
        <Link href="/supplier/login" className="text-center text-body-sm text-neutral-500 hover:underline">
          로그인으로 돌아가기
        </Link>
      </form>
    </AuthShell>
  )
}
