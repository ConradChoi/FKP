'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCategoryAction, deleteCategoryAction, upsertCategoryTranslationAction } from './actions'
import { computeTranslationBadge, TONE_CLASS, type TranslationRow } from '@/lib/admin/translationStatus'
import { adminInputClass } from '@/components/admin/styles'

export interface CategoryTranslationRow extends TranslationRow {
  name: string
  keywords: string[]
}

export interface CategoryRecord {
  code: string
  sort_order: number
  is_active: boolean
  translations: Record<string, CategoryTranslationRow | null>
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
  return <span className={`rounded-full px-2 py-1 admin-label-sm ${TONE_CLASS[tone]}`}>{label}</span>
}

function TranslationEditor({
  categoryCode,
  locale,
  label: localeLabel,
  isSource,
  row,
  sourceUpdatedAt,
}: {
  categoryCode: string
  locale: 'en' | 'ja'
  label: string
  isSource: boolean
  row: CategoryTranslationRow | null
  sourceUpdatedAt: string | null
}) {
  const router = useRouter()
  const [nameValue, setNameValue] = useState<string>(row?.name ?? '')
  const [keywords, setKeywords] = useState<string>((row?.keywords ?? []).join(', '))
  const [status, setStatus] = useState<'draft' | 'translated' | 'published'>(
    (row?.status as 'draft' | 'translated' | 'published') ?? 'draft',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const badge = computeTranslationBadge({ isSource, row, sourceUpdatedAt })

  async function save() {
    setSaving(true)
    setError(null)
    const result = await upsertCategoryTranslationAction({
      categoryCode,
      locale,
      name: nameValue,
      keywords: keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
      status,
    })
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
        <p className="admin-body-sm font-medium text-neutral-900">{localeLabel}</p>
        <Badge label={badge.label} tone={badge.tone} />
      </div>
      <div className="mt-3 space-y-2">
        <input
          className={adminInputClass}
          placeholder="카테고리명"
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
        />
        <textarea
          className={`${adminInputClass} min-h-[72px]`}
          placeholder="키워드 (쉼표로 구분)"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
        />
        <select className={adminInputClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {error && <p className={`mt-2 admin-label-sm text-error`}>{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={saving || !nameValue}
        className="mt-3 rounded-input bg-primary-600 px-4 py-2 admin-label-sm text-neutral-0 hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
      >
        저장
      </button>
    </div>
  )
}

export function CategoryRow({ category }: { category: CategoryRecord }) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [sortOrder, setSortOrder] = useState(category.sort_order)
  const [isActive, setIsActive] = useState(category.is_active)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = sortOrder !== category.sort_order || isActive !== category.is_active
  const sourceUpdatedAt = category.translations.en?.updated_at ?? null

  async function saveSummary() {
    setSaving(true)
    setError(null)
    const result = await updateCategoryAction({ code: category.code, sortOrder, isActive })
    setSaving(false)
    if (!result.success) {
      setError('저장 실패')
      return
    }
    router.refresh()
  }

  async function remove() {
    if (!window.confirm(`"${category.code}" 카테고리를 삭제할까요? 이 카테고리를 참조하는 요청이 있으면 삭제할 수 없습니다.`)) return
    const result = await deleteCategoryAction(category.code)
    if (!result.success) {
      window.alert('삭제 실패 — 이 카테고리를 참조하는 요청이 있으면 대신 비활성화를 사용하세요.')
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
        <span className="font-mono admin-label-sm text-neutral-500">{category.code}</span>
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
            const badge = computeTranslationBadge({ isSource, row: category.translations[key] ?? null, sourceUpdatedAt })
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
          {LOCALES.map(({ key, label: localeLabel, isSource }) => (
            <TranslationEditor
              key={key}
              categoryCode={category.code}
              locale={key}
              label={localeLabel}
              isSource={isSource}
              row={category.translations[key] ?? null}
              sourceUpdatedAt={sourceUpdatedAt}
            />
          ))}
        </div>
      )}
    </div>
  )
}
