'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { inputClass, primaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'
import { COMMUNITY_CATEGORIES, POST_BODY_MAX, POST_TITLE_MAX, communityErrorMessage } from '@/lib/seepn/community'

export function CommunityPostForm() {
  const router = useRouter()
  const [category, setCategory] = useState<string>(COMMUNITY_CATEGORIES[0])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { data, error: rpcError } = await getBuyerBrowserClient().rpc('community_create_post', { p_category: category, p_title: title.trim(), p_body: body.trim() })
    setBusy(false)
    if (rpcError || !data) {
      setError(communityErrorMessage(rpcError?.message ?? ''))
      return
    }
    router.push(`/seepn/community/${data}`)
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-card border border-neutral-200 bg-white p-6">
      <label className="block text-body-sm text-neutral-700">
        카테고리
        <select className={`${inputClass} mt-1 w-full sm:w-60`} value={category} onChange={(e) => setCategory(e.target.value)}>
          {COMMUNITY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-body-sm text-neutral-700">
        제목
        <input className={`${inputClass} mt-1 w-full`} maxLength={POST_TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block text-body-sm text-neutral-700">
        내용
        <textarea className={`${inputClass} mt-1 w-full`} rows={10} maxLength={POST_BODY_MAX} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <p className="text-label-caption text-neutral-400">
        작성한 글은 닉네임과 함께 다른 회원에게 공개됩니다. 이름·연락처·이메일 등 개인정보나 타인의 비밀정보, 타인을 비방하는 내용은 쓰지 마세요. 부적절한 글은 신고·운영자 검토로 숨겨질 수 있으며,
        글은 직접 삭제할 수 있고 회원 탈퇴 시 삭제됩니다.
        <span className="float-right">{body.length}/{POST_BODY_MAX}</span>
      </p>
      {error && <p role="alert" className={errorTextClass}>{error}</p>}
      <button type="submit" disabled={busy || !title.trim() || !body.trim()} className={`${primaryButtonClass} disabled:opacity-60`}>
        {busy ? '등록 중...' : '등록'}
      </button>
    </form>
  )
}
