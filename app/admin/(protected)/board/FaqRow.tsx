'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateArticleItemAction, deleteContentItemAction, upsertFaqTranslationAction } from './actions'
import { computeTranslationBadge, TONE_CLASS, type TranslationRow } from '@/lib/admin/translationStatus'
import { errorTextClass, inputClass } from '@/components/RequestForm/styles'

export interface FaqTranslationRow extends TranslationRow {
  question: string
  answer: string
}

export interface FaqRecord {
  contentItemId: string
  slug: string
  sortOrder: number
  isActive: boolean
  translations: Record<string, FaqTranslationRow | null>
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

function Badge({ label, tone }: { label: string; tone: keyof typeof TONE_CLASS }) {
  return <span className={`rounded-full px-2 py-1 text-label-caption ${TONE_CLASS[tone]}`}>{label}</span>
}

function FaqTranslationEditor({
  contentItemId,
  locale,
  label,
  isSource,
  row,
  sourceUpdatedAt,
}: {
  contentItemId: string
  locale: 'en' | 'ja'
  label: string
  isSource: boolean
  row: FaqTranslationRow | null
  sourceUpdatedAt: string | null
}) {
  const router = useRouter()
  const [question, setQuestion] = useState(row?.question ?? '')
  const [answer, setAnswer] = useState(row?.answer ?? '')
  const [status, setStatus] = useState<'draft' | 'translated' | 'published'>(
    (row?.status as 'draft' | 'translated' | 'published') ?? 'draft',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const badge = computeTranslationBadge({ isSource, row, sourceUpdatedAt })

  async function save() {
    setSaving(true)
    setError(null)
    const result = await upsertFaqTranslationAction({ contentItemId, locale, question, answer, status })
    setSaving(false)
    if (!result.success) {
      setError('저장 실패')
      return
    }
    router.refresh()
  }

  return (
    <div className="rounded-card border border-neutral-200 p-4">
      <div className="flex items-center justify-between">
        <p className="text-body-sm font-medium text-neutral-900">{label}</p>
        <Badge label={badge.label} tone={badge.tone} />
      </div>
      <div className="mt-3 space-y-2">
        <input className={inputClass} placeholder="질문" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <textarea
          className={`${inputClass} min-h-[100px]`}
          placeholder="답변"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {error && <p className={`mt-2 ${errorTextClass}`}>{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={saving || !question}
        className="mt-3 rounded-input bg-primary-600 px-4 py-2 text-label-caption text-neutral-0 hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
      >
        저장
      </button>
    </div>
  )
}

export function FaqRow({ faq }: { faq: FaqRecord }) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [sortOrder, setSortOrder] = useState(faq.sortOrder)
  const [isActive, setIsActive] = useState(faq.isActive)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = sortOrder !== faq.sortOrder || isActive !== faq.isActive
  const sourceUpdatedAt = faq.translations.en?.updated_at ?? null

  async function saveSummary() {
    setSaving(true)
    setError(null)
    const result = await updateArticleItemAction({ contentItemId: faq.contentItemId, sortOrder, isActive })
    setSaving(false)
    if (!result.success) {
      setError('저장 실패')
      return
    }
    router.refresh()
  }

  async function remove() {
    if (!window.confirm('삭제하면 모든 언어 번역이 함께 삭제되고 되돌릴 수 없습니다. 삭제할까요?')) return
    const result = await deleteContentItemAction(faq.contentItemId)
    if (!result.success) {
      window.alert('삭제 실패')
      return
    }
    router.refresh()
  }

  return (
    <div className="rounded-card border border-neutral-200 bg-neutral-0">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="text-body-sm text-primary-600 hover:underline">
          {expanded ? '접기' : '편집'}
        </button>
        <span className="font-mono text-label-caption text-neutral-500">{faq.slug}</span>
        <input
          type="number"
          className={`${inputClass} w-16 py-1 text-center`}
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
        />
        <label className="flex items-center gap-1 text-body-sm text-neutral-600">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          활성
        </label>
        <div className="flex gap-2">
          {LOCALES.map(({ key, isSource }) => {
            const badge = computeTranslationBadge({ isSource, row: faq.translations[key] ?? null, sourceUpdatedAt })
            return <Badge key={key} label={`${key.toUpperCase()} ${badge.label}`} tone={badge.tone} />
          })}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {dirty && (
            <button type="button" onClick={saveSummary} disabled={saving} className="text-body-sm text-primary-600 hover:underline">
              저장
            </button>
          )}
          <button type="button" onClick={remove} className="text-body-sm text-error hover:underline">
            삭제
          </button>
        </div>
      </div>
      {error && <p className={`px-4 pb-2 ${errorTextClass}`}>{error}</p>}
      {expanded && (
        <div className="grid gap-3 border-t border-neutral-100 p-4 sm:grid-cols-2">
          {LOCALES.map(({ key, label, isSource }) => (
            <FaqTranslationEditor
              key={key}
              contentItemId={faq.contentItemId}
              locale={key}
              label={label}
              isSource={isSource}
              row={faq.translations[key] ?? null}
              sourceUpdatedAt={sourceUpdatedAt}
            />
          ))}
        </div>
      )}
    </div>
  )
}
