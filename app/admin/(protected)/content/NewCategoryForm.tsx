'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCategoryAction } from './actions'
import { adminInputClass, adminButtonPrimaryClass } from '@/components/admin/styles'

export function NewCategoryForm({ nextSortOrder }: { nextSortOrder: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [keywords, setKeywords] = useState('')
  const [sortOrder, setSortOrder] = useState(nextSortOrder)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const result = await createCategoryAction({
      code,
      sortOrder,
      name,
      keywords: keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    })
    setSaving(false)
    if (!result.success) {
      setError(result.errorCode === 'VALIDATION_ERROR' ? '코드는 영문 소문자/숫자/하이픈만 가능합니다.' : '생성 실패 (코드 중복 등)')
      return
    }
    setCode('')
    setName('')
    setKeywords('')
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={adminButtonPrimaryClass}>
        + 새 카테고리 추가
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card border border-neutral-200 bg-neutral-0 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <input
          className={adminInputClass}
          placeholder="코드 (예: manufacturing)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <input className={adminInputClass} placeholder="영문명" value={name} onChange={(e) => setName(e.target.value)} required />
        <input
          className={adminInputClass}
          placeholder="키워드 (쉼표로 구분)"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
        />
        <input
          type="number"
          className={adminInputClass}
          placeholder="정렬순서"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
        />
      </div>
      <p className="mt-2 admin-label-sm text-neutral-500">
        생성 후 상태는 초안(draft)으로 시작합니다. 목록에서 편집을 눌러 다른 언어 번역과 게시 상태를 관리하세요.
      </p>
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
