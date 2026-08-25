'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { completeInviteAction } from './actions'
import { inputClass, primaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'

export function SetPasswordForm({ tokenHash }: { tokenHash: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 12) {
      setError('비밀번호는 최소 12자 이상이어야 합니다.')
      return
    }
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    setLoading(true)
    const result = await completeInviteAction(tokenHash, password)
    setLoading(false)
    if (!result.success) {
      setError(result.error ?? '처리에 실패했습니다. 링크가 만료되었을 수 있습니다.')
      return
    }
    router.push('/admin/mfa-setup')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md rounded-card bg-neutral-0 p-8 shadow-lg">
        <h1 className="text-h3 text-primary-900">비밀번호 설정</h1>
        <p className="mt-2 text-body-sm text-neutral-600">계정에서 사용할 비밀번호를 설정해주세요. (최소 12자)</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder="새 비밀번호"
            className={`${inputClass} w-full`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder="비밀번호 확인"
            className={`${inputClass} w-full`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && <p className={errorTextClass}>{error}</p>}
          <button type="submit" disabled={loading} className={`${primaryButtonClass} w-full`}>
            {loading ? '설정 중...' : '비밀번호 설정하고 계속'}
          </button>
        </form>
      </div>
    </main>
  )
}
