'use client'

// 휴면 해제 절차: 현재 비밀번호 재입력 + 이용약관·개인정보 처리방침 재동의 + 새 비밀번호 설정.
// 서버 라우트(/api/seepn/dormant/release)가 모두 검증한 뒤에만 휴면을 해제한다.
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { inputClass, primaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'

const MIN_PASSWORD_LENGTH = 12

const ERRORS: Record<string, string> = {
  invalid_current_password: '현재 비밀번호가 올바르지 않습니다.',
  rate_limited: '시도 횟수가 많습니다. 잠시 후 다시 시도해주세요.',
  password_leaked: '이 비밀번호는 이미 유출된 적이 있어 사용할 수 없습니다.',
  password_same: '현재 비밀번호와 다른 비밀번호를 입력해주세요.',
  not_dormant: '휴면 상태의 계정이 아닙니다.',
}

export function DormantReleaseForm() {
  const router = useRouter()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [terms, setTerms] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!current) return setError('현재 비밀번호를 입력해주세요.')
    if (next.length < MIN_PASSWORD_LENGTH) return setError(`새 비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`)
    if (next === current) return setError('현재 비밀번호와 다른 비밀번호를 입력해주세요.')
    if (next !== confirm) return setError('새 비밀번호가 일치하지 않습니다.')
    if (!terms || !privacy) return setError('이용약관과 개인정보 처리방침에 모두 동의해주세요.')

    setLoading(true)
    setError(null)
    const res = await fetch('/api/seepn/dormant/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next, acceptTerms: terms, acceptPrivacy: privacy }),
    }).catch(() => null)
    const data = res ? ((await res.json().catch(() => null)) as { error?: string } | null) : null
    if (!res || !res.ok) {
      setLoading(false)
      if (res?.status === 401) return router.push('/seepn/login')
      setError((data?.error && ERRORS[data.error]) || '휴면 해제에 실패했습니다. 잠시 후 다시 시도해주세요.')
      return
    }
    // The password changed server-side: refresh this browser's session so it stays signed in.
    const supabase = getBuyerBrowserClient()
    await supabase.auth.refreshSession().catch(() => null)
    router.push('/seepn/home')
    router.refresh()
  }

  async function handleLogout() {
    await getBuyerBrowserClient().auth.signOut()
    router.push('/seepn/home')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="dormant_current" className="mb-1 block text-body-sm text-neutral-700">현재 비밀번호</label>
        <input id="dormant_current" type="password" autoComplete="current-password" className={`${inputClass} w-full`} value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div>
        <label htmlFor="dormant_new" className="mb-1 block text-body-sm text-neutral-700">새 비밀번호</label>
        <input id="dormant_new" type="password" autoComplete="new-password" className={`${inputClass} w-full`} value={next} onChange={(e) => setNext(e.target.value)} />
        <p className="mt-1 text-label-caption text-neutral-400">최소 {MIN_PASSWORD_LENGTH}자 이상, 현재 비밀번호와 달라야 합니다.</p>
      </div>
      <div>
        <label htmlFor="dormant_confirm" className="mb-1 block text-body-sm text-neutral-700">새 비밀번호 확인</label>
        <input id="dormant_confirm" type="password" autoComplete="new-password" className={`${inputClass} w-full`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>

      <div className="space-y-2 rounded-input border border-neutral-200 p-3">
        <label className="flex items-center gap-2 text-body-sm text-neutral-700">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span>(필수) 이용약관에 동의합니다</span>
          <Link href="/seepn/legal/terms" target="_blank" className="ml-auto text-label-caption text-primary-600 hover:underline">보기</Link>
        </label>
        <label className="flex items-center gap-2 text-body-sm text-neutral-700">
          <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
          <span>(필수) 개인정보 처리방침에 동의합니다</span>
          <Link href="/seepn/legal/privacy" target="_blank" className="ml-auto text-label-caption text-primary-600 hover:underline">보기</Link>
        </label>
      </div>

      {error && <p role="alert" className={errorTextClass}>{error}</p>}

      <button type="submit" disabled={loading} className={`${primaryButtonClass} w-full disabled:opacity-60`}>
        {loading ? '처리 중...' : '휴면 해제하고 이용하기'}
      </button>
      <button type="button" onClick={handleLogout} className="text-body-sm text-neutral-500 hover:underline">
        지금은 해제하지 않고 로그아웃
      </button>
      <p className="text-label-caption text-neutral-400">휴면 전환 후 1년 동안 해제하지 않으면 계정과 작성한 정보가 삭제됩니다.</p>
    </form>
  )
}
