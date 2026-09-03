'use client'

// Design Ref: screen-spec §3.7 (SUP-07). The recovery-link click already establishes a
// short-lived session (Supabase Auth's standard recovery flow) — this screen just calls
// updateUser({password}), then explicitly signs the user out and sends them back to login
// (screen-spec: "성공 시 SUP-01로 안내(재로그인 요구, 자동 로그인시키지 않음)").
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthShell } from '@/components/supplier/AuthShell'
import { inputClass, primaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'
import { getSupplierBrowserClient } from '@/lib/supabase/supplierBrowserClient'

const MIN_PASSWORD_LENGTH = 12

export default function SupplierResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`)
      return
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    setLoading(true)
    setError(null)
    const supabase = getSupplierBrowserClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setLoading(false)
      setError(
        updateError.message.toLowerCase().includes('leaked') || updateError.message.toLowerCase().includes('breach')
          ? '이 비밀번호는 이미 유출된 적이 있어 사용할 수 없습니다.'
          : '비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해주세요.',
      )
      return
    }
    await supabase.auth.signOut()
    setLoading(false)
    setDone(true)
    setTimeout(() => router.push('/supplier/login'), 1500)
  }

  if (done) {
    return (
      <AuthShell title="비밀번호가 변경되었습니다">
        <p className="text-center text-body-sm text-neutral-600">새 비밀번호로 다시 로그인해주세요.</p>
        <Link href="/supplier/login" className="mt-4 block text-center text-body-sm text-primary-600 hover:underline">
          로그인하기
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="비밀번호 재설정">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="new_password" className="mb-1 block text-body-sm text-neutral-700">
            새 비밀번호
          </label>
          <input
            id="new_password"
            type="password"
            autoComplete="new-password"
            className={`${inputClass} w-full`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="mt-1 text-label-caption text-neutral-400">최소 {MIN_PASSWORD_LENGTH}자 이상 입력해주세요.</p>
        </div>
        <div>
          <label htmlFor="new_password_confirm" className="mb-1 block text-body-sm text-neutral-700">
            새 비밀번호 확인
          </label>
          <input
            id="new_password_confirm"
            type="password"
            autoComplete="new-password"
            className={`${inputClass} w-full`}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
          />
        </div>
        {error && <p className={errorTextClass}>{error}</p>}
        <button type="submit" disabled={loading} className={`${primaryButtonClass} w-full`}>
          {loading ? '변경 중...' : '비밀번호 변경'}
        </button>
      </form>
    </AuthShell>
  )
}
