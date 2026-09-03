'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createFaqAction } from './actions'
import { adminInputClass, adminButtonPrimaryClass } from '@/components/admin/styles'

export function NewFaqForm({ nextSortOrder }: { nextSortOrder: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [slug, setSlug] = useState('')
  const [sortOrder, setSortOrder] = useState(nextSortOrder)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const result = await createFaqAction({ slug, sortOrder, question, answer })
    setSaving(false)
    if (!result.success) {
      setError(result.errorCode === 'VALIDATION_ERROR' ? '슬러그는 소문자/숫자/하이픈만 가능합니다.' : '생성 실패 (슬러그 중복 등)')
      return
    }
    setSlug('')
    setQuestion('')
    setAnswer('')
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={adminButtonPrimaryClass}>
        + 새 질문 추가
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card border border-neutral-200 bg-neutral-0 p-4">
      <div className="grid grid-cols-2 gap-3">
        <input
          className={adminInputClass}
          placeholder="슬러그 (내부 식별용, 예: pricing-1)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
        />
        <input
          type="number"
          className={adminInputClass}
          placeholder="정렬순서"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
        />
      </div>
      <input
        className={`${adminInputClass} mt-3 w-full`}
        placeholder="영문 질문"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        required
      />
      <textarea
        className={`${adminInputClass} mt-3 min-h-[100px] w-full`}
        placeholder="영문 답변"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
      />
      {error && <p className={`mt-2 admin-label-sm text-error`}>{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={saving} className={adminButtonPrimaryClass}>
          추가
        </button>
        <button type="button" onClick={() => setOpen(false)} className="admin-body-sm text-neutral-500 hover:underline">
          취소
        </button>
      </div>
    </form>
  )
}
