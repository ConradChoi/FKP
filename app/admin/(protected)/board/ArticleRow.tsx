'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateArticleItemAction, deleteContentItemAction, upsertArticleTranslationAction, aiFillArticleTranslationAction } from './actions'
import { computeTranslationBadge, computeSourceBadge, TONE_CLASS, type TranslationRow } from '@/lib/admin/translationStatus'
import { adminInputClass } from '@/components/admin/styles'
import { AiFillButton } from '@/components/admin/AiFillButton'
import {
  getAiFillDisabledReason,
  getAiFillConfirmMessage,
  getAiFillErrorMessage,
  AI_REVIEW_SAVE_CONFIRM_MESSAGE,
  AI_DRAFT_PUBLISH_GUARD_CAPTION,
  AI_DRAFT_PUBLISH_SAVE_REJECTED_MESSAGE,
  AI_FILL_STALE_SOURCE_CAPTION,
} from '@/lib/admin/aiFillClient'

export interface ArticleTranslationRow extends TranslationRow {
  title: string
  excerpt: string
  bodyMarkdown: string
}

export interface ArticleRecord {
  contentItemId: string
  slug: string
  sortOrder: number
  isActive: boolean
  translations: Record<string, ArticleTranslationRow | null>
}

const LOCALES: { key: 'en' | 'ja'; label: string; isSource: boolean }[] = [
  { key: 'en', label: 'English (원본)', isSource: true },
  { key: 'ja', label: '日本語', isSource: false },
]

const STATUS_OPTIONS: { value: 'draft' | 'translated' | 'published'; label: string }[] = [
  { value: 'draft', label: '초안' },
  { value: 'translated', label: '작성완료' },
  { value: 'published', label: '게시됨' },
]

// screen-spec §3.5 대상 필드 매핑 (copy.md §4.1)
const FIELD_LABELS: Record<string, string> = { title: '제목이', excerpt: '요약이', bodyMarkdown: '본문이' }

function Badge({ label, tone }: { label: string; tone: keyof typeof TONE_CLASS }) {
  return <span className={`rounded-full px-2 py-1 admin-label-sm ${TONE_CLASS[tone]}`}>{label}</span>
}

function ArticleTranslationEditor({
  contentItemId,
  locale,
  label,
  isSource,
  row,
  sourceUpdatedAt,
  sourceTitle,
  sourceExcerpt,
  sourceBodyMarkdown,
  showAiFill,
}: {
  contentItemId: string
  locale: 'en' | 'ja'
  label: string
  isSource: boolean
  row: ArticleTranslationRow | null
  sourceUpdatedAt: string | null
  sourceTitle: string
  sourceExcerpt: string
  sourceBodyMarkdown: string
  // Gap G-2 (screen-spec §3.5) — case_study never renders the AI-fill button/tree at all (not
  // just disabled). Computed by the caller from `contentType` so this editor doesn't need to
  // know about content types itself.
  showAiFill: boolean
}) {
  const router = useRouter()
  const [title, setTitle] = useState(row?.title ?? '')
  const [excerpt, setExcerpt] = useState(row?.excerpt ?? '')
  const [bodyMarkdown, setBodyMarkdown] = useState(row?.bodyMarkdown ?? '')
  const [status, setStatus] = useState<'draft' | 'translated' | 'published'>(
    (row?.status as 'draft' | 'translated' | 'published') ?? 'draft',
  )
  // Gap G-3 / §6.4 — local state so the AI-fill response can update this already-mounted card
  // directly, instead of relying on router.refresh().
  const [translationSource, setTranslationSource] = useState<'human' | 'ai' | 'ai_reviewed'>(
    row?.translation_source ?? 'human',
  )
  const [hasTranslation, setHasTranslation] = useState(row !== null)
  const [sourceSyncedAt, setSourceSyncedAt] = useState<string | null>(row?.source_synced_at ?? null)
  const [saving, setSaving] = useState(false)
  const [aiFilling, setAiFilling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const localRow: TranslationRow | null = hasTranslation
    ? { status, source_synced_at: sourceSyncedAt, updated_at: row?.updated_at ?? sourceUpdatedAt ?? '', translation_source: translationSource }
    : null
  const badge = computeTranslationBadge({ isSource, row: localRow, sourceUpdatedAt })
  const sourceBadge = computeSourceBadge(localRow)

  async function save() {
    if (translationSource === 'ai' && !window.confirm(AI_REVIEW_SAVE_CONFIRM_MESSAGE)) return

    setSaving(true)
    setError(null)
    const result = await upsertArticleTranslationAction({ contentItemId, locale, title, excerpt, bodyMarkdown, status })
    setSaving(false)
    if (!result.success) {
      setError(translationSource === 'ai' && status === 'published' ? AI_DRAFT_PUBLISH_SAVE_REJECTED_MESSAGE : '저장 실패')
      return
    }
    if (translationSource === 'ai') setTranslationSource('ai_reviewed')
    setHasTranslation(true)
    setSourceSyncedAt(sourceUpdatedAt)
    router.refresh()
  }

  async function aiFill() {
    const confirmMessage = getAiFillConfirmMessage({ hasTranslation, status, translationSource, localeLabel: label })
    if (confirmMessage !== null && !window.confirm(confirmMessage)) return

    setAiFilling(true)
    setError(null)
    const result = await aiFillArticleTranslationAction({ contentItemId, targetLocale: locale })
    setAiFilling(false)
    if (!result.success) {
      setError(getAiFillErrorMessage(result, FIELD_LABELS))
      return
    }
    setTitle(result.body.title)
    setExcerpt(result.body.excerpt)
    setBodyMarkdown(result.body.bodyMarkdown)
    setStatus(result.status)
    setTranslationSource(result.translationSource)
    setHasTranslation(true)
    setSourceSyncedAt(sourceUpdatedAt)
    router.refresh()
  }

  const aiFillDisabledReason = getAiFillDisabledReason([
    { label: '제목이', value: sourceTitle },
    { label: '요약이', value: sourceExcerpt },
    { label: '본문이', value: sourceBodyMarkdown },
  ])

  return (
    <div className="rounded-card border border-neutral-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="admin-body-sm font-medium text-neutral-900">{label}</p>
        <div className="flex flex-wrap items-center gap-2">
          {!isSource && showAiFill && (
            <AiFillButton loading={aiFilling} disabledReason={aiFillDisabledReason} disabled={saving} onClick={aiFill} />
          )}
          <Badge label={badge.label} tone={badge.tone} />
          {sourceBadge && <Badge label={sourceBadge.label} tone={sourceBadge.tone} />}
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <input
          className={adminInputClass}
          placeholder="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={aiFilling}
        />
        <textarea
          className={`${adminInputClass} min-h-[56px]`}
          placeholder="요약 (150자 내외 권장)"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          disabled={aiFilling}
        />
        <textarea
          className={`${adminInputClass} min-h-[200px] font-mono admin-body-sm`}
          placeholder="본문 (마크다운: #/## 제목, **굵게**, - 목록, 1. 번호목록, |표|, [링크](url))"
          value={bodyMarkdown}
          onChange={(e) => setBodyMarkdown(e.target.value)}
          disabled={aiFilling}
        />
        <select
          className={adminInputClass}
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          disabled={aiFilling}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              disabled={opt.value === 'published' && translationSource === 'ai'}
              title={opt.value === 'published' && translationSource === 'ai' ? AI_DRAFT_PUBLISH_GUARD_CAPTION : undefined}
            >
              {opt.label}
            </option>
          ))}
        </select>
        {translationSource === 'ai' && <p className="admin-label-sm text-neutral-500">{AI_DRAFT_PUBLISH_GUARD_CAPTION}</p>}
      </div>
      {error && <p className={`mt-2 admin-label-sm text-error`}>{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={saving || aiFilling || !title}
        className="mt-3 rounded-input bg-primary-600 px-4 py-2 admin-label-sm text-neutral-0 hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
      >
        저장
      </button>
      {!isSource && showAiFill && <p className="mt-2 admin-label-sm text-neutral-400">{AI_FILL_STALE_SOURCE_CAPTION}</p>}
    </div>
  )
}

export function ArticleRow({
  article,
  urlSegment,
  contentType,
}: {
  article: ArticleRecord
  urlSegment: string
  // Gap G-2 (screen-spec §3.5) — neither blog/page.tsx nor example/page.tsx used to pass this;
  // both callers now pass a literal 'blog' | 'case_study' since each page only ever renders one
  // content type. Server-side defense (aiFillArticleTranslationAction re-checking
  // content_item.content_type) stays the real boundary regardless of this prop.
  contentType: 'blog' | 'case_study'
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [sortOrder, setSortOrder] = useState(article.sortOrder)
  const [isActive, setIsActive] = useState(article.isActive)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = sortOrder !== article.sortOrder || isActive !== article.isActive
  const sourceUpdatedAt = article.translations.en?.updated_at ?? null
  const sourceTitle = article.translations.en?.title ?? ''
  const sourceExcerpt = article.translations.en?.excerpt ?? ''
  const sourceBodyMarkdown = article.translations.en?.bodyMarkdown ?? ''
  const showAiFill = contentType !== 'case_study'

  async function saveSummary() {
    setSaving(true)
    setError(null)
    const result = await updateArticleItemAction({ contentItemId: article.contentItemId, sortOrder, isActive })
    setSaving(false)
    if (!result.success) {
      setError('저장 실패')
      return
    }
    router.refresh()
  }

  async function remove() {
    if (
      !window.confirm(
        '삭제하면 모든 언어 번역이 함께 삭제되고 되돌릴 수 없습니다. 외부 링크/검색엔진 색인이 끊기지 않도록 삭제 대신 비활성화를 사용하는 것을 권장합니다. 그래도 삭제할까요?',
      )
    )
      return
    const result = await deleteContentItemAction(article.contentItemId)
    if (!result.success) {
      window.alert('삭제 실패')
      return
    }
    router.refresh()
  }

  return (
    <div className="rounded-card border border-neutral-200 bg-neutral-0">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="admin-body-sm text-primary-600 hover:underline">
          {expanded ? '접기' : '편집'}
        </button>
        <span className="font-mono admin-label-sm text-neutral-500">
          /{urlSegment}/{article.slug}
        </span>
        <input
          type="number"
          className={`${adminInputClass} w-16 py-1 text-center`}
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
        />
        <label className="flex items-center gap-1 admin-body-sm text-neutral-600">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          활성
        </label>
        <div className="flex gap-2">
          {LOCALES.map(({ key, isSource }) => {
            const badge = computeTranslationBadge({ isSource, row: article.translations[key] ?? null, sourceUpdatedAt })
            return <Badge key={key} label={`${key.toUpperCase()} ${badge.label}`} tone={badge.tone} />
          })}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {dirty && (
            <button type="button" onClick={saveSummary} disabled={saving} className="admin-body-sm text-primary-600 hover:underline">
              저장
            </button>
          )}
          <button type="button" onClick={remove} className="admin-body-sm text-error hover:underline">
            삭제
          </button>
        </div>
      </div>
      {error && <p className={`px-4 pb-2 admin-label-sm text-error`}>{error}</p>}
      {expanded && (
        <div className="grid gap-3 border-t border-neutral-100 p-4 sm:grid-cols-2">
          {LOCALES.map(({ key, label, isSource }) => (
            <ArticleTranslationEditor
              key={key}
              contentItemId={article.contentItemId}
              locale={key}
              label={label}
              isSource={isSource}
              row={article.translations[key] ?? null}
              sourceUpdatedAt={sourceUpdatedAt}
              sourceTitle={sourceTitle}
              sourceExcerpt={sourceExcerpt}
              sourceBodyMarkdown={sourceBodyMarkdown}
              showAiFill={showAiFill}
            />
          ))}
        </div>
      )}
    </div>
  )
}
