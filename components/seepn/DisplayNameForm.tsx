'use client'

// 마이페이지 > 회원정보 변경: 표시명 수정. buyer_account grants `update (display_name)` to
// authenticated with a self-update RLS policy (20260910100000 §2), so this is a direct update — no
// RPC. The email is shown read-only (changing it needs its own verification flow).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { inputClass, primaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'

const MAX_DISPLAY_NAME_LENGTH = 100

export function DisplayNameForm({ accountId, initialDisplayName, email }: { accountId: string; initialDisplayName: string; email: string | null }) {
  const router = useRouter()
  const [savedName, setSavedName] = useState(initialDisplayName)
  const [name, setName] = useState(initialDisplayName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const trimmed = name.trim()
  const unchanged = trimmed === savedName

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setDone(false)
    if (trimmed.length === 0) {
      setError('표시명을 입력해주세요.')
      return
    }
    if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
      setError(`표시명은 ${MAX_DISPLAY_NAME_LENGTH}자 이하로 입력해주세요.`)
      return
    }
    setLoading(true)
    setError(null)
    const supabase = getBuyerBrowserClient()
    const { data, error: updateError } = await supabase.from('buyer_account').update({ display_name: trimmed }).eq('id', accountId).select('id')
    setLoading(false)
    // RLS filters a row that is not the caller's own to "0 rows updated" without an error.
    if (updateError || !data || data.length === 0) {
      setError('저장하지 못했습니다. 잠시 후 다시 시도해주세요.')
      return
    }
    setSavedName(trimmed)
    setName(trimmed)
    setDone(true)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-5 rounded-card border border-neutral-200 bg-white p-6">
      <div>
        <label htmlFor="profile_email" className="mb-1 block text-body-sm text-neutral-700">
          이메일
        </label>
        <input id="profile_email" type="email" readOnly value={email ?? ''} className={`${inputClass} w-full bg-neutral-50 text-neutral-500`} />
        <p className="mt-1 text-label-caption text-neutral-400">로그인 계정이자 운영자 문의 회신 주소입니다. 이메일은 변경할 수 없습니다.</p>
      </div>
      <div>
        <label htmlFor="profile_display_name" className="mb-1 block text-body-sm text-neutral-700">
          표시명
        </label>
        <input
          id="profile_display_name"
          type="text"
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          autoComplete="nickname"
          className={`${inputClass} w-full`}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setDone(false)
          }}
        />
        <p className="mt-1 text-label-caption text-neutral-400">이름 또는 회사명 중 편한 것을 입력해주세요. 실명이 아니어도 됩니다.</p>
      </div>

      {error && (
        <p role="alert" className={errorTextClass}>
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-body-sm text-success">
          회원정보가 저장되었습니다.
        </p>
      )}

      <button type="submit" disabled={loading || unchanged} className={`${primaryButtonClass} w-full disabled:opacity-60`}>
        {loading ? '저장 중...' : '저장'}
      </button>
    </form>
  )
}
