'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createArticleAction } from './actions'
import type { ArticleContentType } from '@/lib/content/contentTypes'
import { inputClass, primaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'

export function NewArticleForm({ contentType, nextSortOrder }: { contentType: ArticleContentType; nextSortOrder: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [slug, setSlug] = useState('')
  const [sortOrder, setSortOrder] = useState(nextSortOrder)
  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [bodyMarkdown, setBodyMarkdown] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const result = await createArticleAction({ contentType, slug, sortOrder, title, excerpt, bodyMarkdown })
    setSaving(false)
    if (!result.success) {
      setError(result.errorCode === 'VALIDATION_ERROR' ? '슬러그는 소문자/숫자/하이픈만 가능합니다.' : '생성 실패 (슬러그 중복 등)')
      return
    }
    setSlug('')
    setTitle('')
    setExcerpt('')
    setBodyMarkdown('')
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={primaryButtonClass}>
        + 새 글 추가
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card border border-neutral-200 bg-neutral-0 p-4">
      <div className="grid grid-cols-2 gap-3">
        <input
          className={inputClass}
          placeholder="슬러그 (예: launching-in-japan, 생성 후 수정 불가)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
        />
        <input
          type="number"
          className={inputClass}
          placeholder="정렬순서"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
        />
      </div>
      <input className={`${inputClass} mt-3 w-full`} placeholder="영문 제목" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <textarea
        className={`${inputClass} mt-3 min-h-[56px] w-full`}
        placeholder="영문 요약 (150자 내외 권장)"
        value={excerpt}
        onChange={(e) => setExcerpt(e.target.value)}
      />
      <textarea
        className={`${inputClass} mt-3 min-h-[200px] w-full font-mono text-body-sm`}
        placeholder="영문 본문 (마크다운: #/## 제목, **굵게**, - 목록, 1. 번호목록, |표|, [링크](url))"
        value={bodyMarkdown}
        onChange={(e) => setBodyMarkdown(e.target.value)}
      />
      <p className="mt-2 text-label-caption text-neutral-500">
        생성 후 상태는 초안(draft)으로 시작합니다. 목록에서 편집을 눌러 게시 상태와 다른 언어 번역을 관리하세요.
      </p>
      {error && <p className={`mt-2 ${errorTextClass}`}>{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={saving} className={primaryButtonClass}>
          추가
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-body-sm text-neutral-500 hover:underline">
          취소
        </button>
      </div>
    </form>
  )
}
