'use client'

// Design Ref: notice-board.screen-spec.md §3.3 (new notice form, target-audience-first flow) +
// notice-board.ui-spec.md §3.1/§3.3 (styles) + notice-board-privacy-review.md §1 (NS-1 caption).
//
// A dedicated component rather than an extension of ../NewArticleForm.tsx: the target-audience
// select (required, no default, PRD N-R2/§7.2) and its 3-way surface (blank/"submit disabled" ->
// partner -> seepn_user warning) are notice-only concerns that don't apply to case_study at all.
// Folding them into NewArticleForm.tsx would force every case_study render to carry dead branches
// for a field it never uses — the opposite of the "마크업/스타일 구조는 가능한 한 유지하고, 로직만
// 붙인다" principle when the underlying shape (target_audience) genuinely differs per content type.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createNoticeAction, type NoticeTargetAudience } from '../actions'
import { adminInputClass, adminButtonPrimaryClass } from '@/components/admin/styles'

const SEEPN_USER_NO_CONSUMER_SCREEN_WARNING =
  '이 대상은 아직 볼 수 있는 화면이 없습니다 — seepn.me 준비 중. 지금 게시해도 아무도 보지 못합니다.'

// notice-board-v1.0.prd.md §9 NS-1 / screen-spec §3.9 — identical wording to the one rendered
// inside ArticleRow.tsx's edit view (../ArticleRow.tsx); both must always say the same thing.
const NS1_CAPTION =
  '공지 내용은 로그인 여부와 무관하게 인터넷에서 누구나 볼 수 있는 공개 데이터입니다. 특정 파트너의 상호명·담당자·연락처·심사 결과 등 개별 식별정보를 적지 마세요.'

export function NewNoticeForm({ nextSortOrder }: { nextSortOrder: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [targetAudience, setTargetAudience] = useState<NoticeTargetAudience | ''>('')
  const [slug, setSlug] = useState('')
  const [sortOrder, setSortOrder] = useState(nextSortOrder)
  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [bodyMarkdown, setBodyMarkdown] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!targetAudience) return // screen-spec §3.3 — belt-and-suspenders; the submit button is
    // already disabled below, this just guards a direct form-submit (e.g. Enter key) too.
    setError(null)
    setSaving(true)
    const result = await createNoticeAction({ targetAudience, slug, sortOrder, title, excerpt, bodyMarkdown })
    setSaving(false)
    if (!result.success) {
      setError(
        result.errorCode === 'VALIDATION_ERROR'
          ? '슬러그 형식이 올바르지 않거나 대상이 선택되지 않았습니다.'
          : '생성 실패 (슬러그 중복 등)',
      )
      return
    }
    setTargetAudience('')
    setSlug('')
    setTitle('')
    setExcerpt('')
    setBodyMarkdown('')
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={adminButtonPrimaryClass}>
        + 새 공지 추가
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card border border-neutral-200 bg-neutral-0 p-4">
      <div className="grid grid-cols-2 gap-3">
        <input
          className={adminInputClass}
          placeholder="슬러그 (예: terms-update-2026-09, 대상 구분과 무관하게 전체 공지 중 고유해야 함)"
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
      <p className="mt-1 admin-label-sm text-neutral-500">정렬순서를 크게 하면 상단에 고정됩니다.</p>

      {/* screen-spec §3.3 — target audience select, blank by default (N-R2: no default, must be
          explicitly chosen), positioned above title/excerpt/body so the audience-driven warning
          below is seen before the rest of the form. */}
      <select
        className={`${adminInputClass} mt-3 w-full`}
        value={targetAudience}
        onChange={(e) => setTargetAudience(e.target.value as NoticeTargetAudience | '')}
        required
      >
        <option value="" disabled>
          선택하세요
        </option>
        <option value="partner">파트너용(ko 단일)</option>
        <option value="seepn_user">SEEPN 사용자용(ko/en/ja)</option>
      </select>
      {targetAudience === 'seepn_user' && (
        <div className="mt-2 flex items-start gap-2 rounded-input border border-accent-200 bg-accent-100 px-4 py-3">
          <span className="text-accent-600" aria-hidden="true">
            ⚠
          </span>
          <p className="admin-body-sm text-accent-700">{SEEPN_USER_NO_CONSUMER_SCREEN_WARNING}</p>
        </div>
      )}

      <input className={`${adminInputClass} mt-3 w-full`} placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <textarea
        className={`${adminInputClass} mt-3 min-h-[56px] w-full`}
        placeholder="요약"
        value={excerpt}
        onChange={(e) => setExcerpt(e.target.value)}
      />
      {/* notice-board-privacy-review.md §1.3 NB-B8 — bound to the body field wrapper, not to a
          future rich editor, so it survives WS-3's editor swap unchanged. */}
      <div className="mt-3">
        <textarea
          className={`${adminInputClass} min-h-[200px] w-full font-mono admin-body-sm`}
          placeholder="본문 (마크다운: #/## 제목, **굵게**, - 목록, 1. 번호목록, |표|, [링크](url))"
          value={bodyMarkdown}
          onChange={(e) => setBodyMarkdown(e.target.value)}
        />
        <p className="mt-1 admin-label-sm text-accent-700">⚠ {NS1_CAPTION}</p>
      </div>

      <p className="mt-2 admin-label-sm text-neutral-500">
        생성 후 상태는 초안(draft)으로 시작합니다. 목록에서 편집을 눌러 게시 상태와 번역을 관리하세요.
      </p>
      {error && <p className="mt-2 admin-label-sm text-error">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={saving || !targetAudience} className={adminButtonPrimaryClass}>
          추가
        </button>
        <button type="button" onClick={() => setOpen(false)} className="admin-body-sm text-neutral-500 hover:underline">
          취소
        </button>
      </div>
    </form>
  )
}
