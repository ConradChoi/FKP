'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { upsertContentTranslationAction } from './actions'
import { computeTranslationBadge, TONE_CLASS, type TranslationRow } from '@/lib/admin/translationStatus'
import { errorTextClass, inputClass } from '@/components/RequestForm/styles'

export interface ContentTextTranslationRow extends TranslationRow {
  text: string
}

export interface LandingCopyItem {
  contentItemId: string
  contentKey: string
  label: string
  translations: Record<string, ContentTextTranslationRow | null>
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

function TextEditor({
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
  row: ContentTextTranslationRow | null
  sourceUpdatedAt: string | null
}) {
  const router = useRouter()
  const [text, setText] = useState(row?.text ?? '')
  const [status, setStatus] = useState<'draft' | 'translated' | 'published'>(
    (row?.status as 'draft' | 'translated' | 'published') ?? 'draft',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const badge = computeTranslationBadge({ isSource, row, sourceUpdatedAt })

  async function save() {
    setSaving(true)
    setError(null)
    const result = await upsertContentTranslationAction({ contentItemId, locale, text, status })
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
      <textarea className={`${inputClass} mt-3 min-h-[72px]`} value={text} onChange={(e) => setText(e.target.value)} />
      <select
        className={`${inputClass} mt-2`}
        value={status}
        onChange={(e) => setStatus(e.target.value as typeof status)}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className={`mt-2 ${errorTextClass}`}>{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={saving || !text}
        className="mt-3 rounded-input bg-primary-600 px-4 py-2 text-label-caption text-neutral-0 hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
      >
        저장
      </button>
    </div>
  )
}

export function LandingCopyRow({ item }: { item: LandingCopyItem }) {
  const [expanded, setExpanded] = useState(false)
  const sourceUpdatedAt = item.translations.en?.updated_at ?? null

  return (
    <div className="rounded-card border border-neutral-200 bg-neutral-0">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="text-body-sm text-primary-600 hover:underline">
          {expanded ? '접기' : '편집'}
        </button>
        <span className="text-body-sm text-neutral-900">{item.label}</span>
        <div className="ml-auto flex gap-2">
          {LOCALES.map(({ key, isSource }) => {
            const badge = computeTranslationBadge({ isSource, row: item.translations[key] ?? null, sourceUpdatedAt })
            return <Badge key={key} label={`${key.toUpperCase()} ${badge.label}`} tone={badge.tone} />
          })}
        </div>
      </div>
      {expanded && (
        <div className="grid gap-3 border-t border-neutral-100 p-4 sm:grid-cols-2">
          {LOCALES.map(({ key, label, isSource }) => (
            <TextEditor
              key={key}
              contentItemId={item.contentItemId}
              locale={key}
              label={label}
              isSource={isSource}
              row={item.translations[key] ?? null}
              sourceUpdatedAt={sourceUpdatedAt}
            />
          ))}
        </div>
      )}
    </div>
  )
}
