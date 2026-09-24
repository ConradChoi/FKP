'use client'

// 마이페이지 > 비밀번호 변경: 현재 비밀번호 확인 -> 새 비밀번호(+재입력) -> 변경.
// The current password is verified by a real sign-in (so a stolen, still-valid session alone cannot
// change the password); the 12-char minimum matches app/seepn/reset-password. After a successful
// change every OTHER session is signed out, the current one stays logged in.
import { useState } from 'react'
import { inputClass, primaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'

const MIN_PASSWORD_LENGTH = 12

export function PasswordChangeForm({ email }: { email: string | null }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setDone(false)
    if (!email) {
      setError('계정 정보를 확인할 수 없습니다. 다시 로그인해주세요.')
      return
    }
    if (!current) {
      setError('현재 비밀번호를 입력해주세요.')
      return
    }
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`새 비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`)
      return
    }
    if (next === current) {
      setError('현재 비밀번호와 다른 비밀번호를 입력해주세요.')
      return
    }
    if (next !== confirm) {
      setError('새 비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)
    setError(null)
    const supabase = getBuyerBrowserClient()

    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: current })
    if (verifyError) {
      setLoading(false)
      setError(
        verifyError.status === 429
          ? '시도 횟수가 많습니다. 잠시 후 다시 시도해주세요.'
          : '현재 비밀번호가 올바르지 않습니다.',
      )
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: next })
    if (updateError) {
      setLoading(false)
      const msg = updateError.message.toLowerCase()
      setError(
        msg.includes('leaked') || msg.includes('breach') || msg.includes('pwned')
          ? '이 비밀번호는 이미 유출된 적이 있어 사용할 수 없습니다.'
          : msg.includes('different')
            ? '현재 비밀번호와 다른 비밀번호를 입력해주세요.'
            : '비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해주세요.',
      )
      return
    }

    // Best effort: a failure here leaves other sessions alive but the password IS changed.
    await supabase.auth.signOut({ scope: 'others' })
    setLoading(false)
    setCurrent('')
    setNext('')
    setConfirm('')
    setDone(true)
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-5 rounded-card border border-neutral-200 bg-white p-6">
      <div>
        <label htmlFor="current_password" className="mb-1 block text-body-sm text-neutral-700">
          현재 비밀번호
        </label>
        <input
          id="current_password"
          type="password"
          autoComplete="current-password"
          className={`${inputClass} w-full`}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="new_password" className="mb-1 block text-body-sm text-neutral-700">
          새 비밀번호
        </label>
        <input
          id="new_password"
          type="password"
          autoComplete="new-password"
          className={`${inputClass} w-full`}
          value={next}
          onChange={(e) => setNext(e.target.value)}
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
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className={errorTextClass}>
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-body-sm text-success">
          비밀번호가 변경되었습니다. 다른 기기에서는 로그아웃 처리됩니다.
        </p>
      )}

      <button type="submit" disabled={loading} className={`${primaryButtonClass} w-full disabled:opacity-60`}>
        {loading ? '변경 중...' : '비밀번호 변경'}
      </button>
    </form>
  )
}
