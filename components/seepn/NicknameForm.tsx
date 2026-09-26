'use client'

// 커뮤니티에서 공개되는 닉네임 설정. 표시명과 별개이며, 글·댓글 작성자로 다른 회원에게 공개된다.
// 중복·예약어·형식 검증은 RPC(buyer_set_nickname)가 한다.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { inputClass, primaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'
import { NICKNAME_MAX, NICKNAME_MIN, communityErrorMessage } from '@/lib/seepn/community'

export function NicknameForm({ initial }: { initial: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(initial ?? '')
  const [saved, setSaved] = useState(initial ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setDone(false)
    const { error: rpcError } = await getBuyerBrowserClient().rpc('buyer_set_nickname', { p_nickname: value.trim() })
    setBusy(false)
    if (rpcError) {
      setError(communityErrorMessage(rpcError.message))
      return
    }
    setSaved(value.trim())
    setDone(true)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-3 rounded-card border border-neutral-200 bg-white p-6">
      <label htmlFor="nickname" className="block text-body-sm font-semibold text-neutral-900">
        커뮤니티 닉네임
      </label>
      <input id="nickname" className={`${inputClass} w-full`} value={value} maxLength={NICKNAME_MAX} onChange={(e) => { setValue(e.target.value); setDone(false) }} placeholder="예: 제조인A" />
      <p className="text-label-caption text-neutral-400">
        한글·영문·숫자·밑줄 {NICKNAME_MIN}~{NICKNAME_MAX}자, 30일에 한 번만 변경할 수 있습니다. 커뮤니티의 글·댓글 작성자로 <strong>다른 회원에게 공개</strong>됩니다. 실명·회사명 등 신원을 알 수 있는 이름은 피해주세요.
      </p>
      {error && <p role="alert" className={errorTextClass}>{error}</p>}
      {done && <p role="status" className="text-body-sm text-success">닉네임이 저장되었습니다.</p>}
      <button type="submit" disabled={busy || value.trim() === saved || value.trim().length < NICKNAME_MIN} className={`${primaryButtonClass} disabled:opacity-60`}>
        {busy ? '저장 중...' : '저장'}
      </button>
    </form>
  )
}
