'use client'

// SEEPN 인사이트/FAQ 게시판 (2026-09-25): 한국어 단일 언어, 작성 -> 초안/게시, 노출(is_active), 정렬(큰 값이
// 먼저; FAQ는 작은 값이 먼저), 삭제. 게시(published)이고 노출 중인 항목만 seepn.me에 반영된다(최대 1분 ISR).
import { useState } from 'react'
import { adminInputClass, adminButtonPrimaryClass } from '@/components/admin/styles'
import { SEEPN_INSIGHT_CATEGORIES } from '@/lib/content/getPublishedSeepnContent'
import { createSeepnContentAction, saveSeepnContentAction, deleteSeepnContentAction, type SeepnContentFields, type SeepnContentKind, type SeepnContentStatus } from './seepnContentActions'
import type { SeepnAdminItem } from './loadSeepnContent'

const EMPTY_FIELDS: Record<string, string> = { title: '', excerpt: '', category: SEEPN_INSIGHT_CATEGORIES[0], bodyMarkdown: '', question: '', answer: '' }

function FieldsEditor({ kind, fields, onChange }: { kind: SeepnContentKind; fields: Record<string, string>; onChange: (next: Record<string, string>) => void }) {
  const set = (key: string, value: string) => onChange({ ...fields, [key]: value })
  if (kind === 'faq') {
    return (
      <div className="space-y-3">
        <label className="block admin-body-sm text-neutral-700">
          질문
          <input className={`${adminInputClass} mt-1 w-full`} maxLength={300} value={fields.question} onChange={(e) => set('question', e.target.value)} />
        </label>
        <label className="block admin-body-sm text-neutral-700">
          답변
          <textarea className={`${adminInputClass} mt-1 w-full`} rows={5} maxLength={5000} value={fields.answer} onChange={(e) => set('answer', e.target.value)} />
        </label>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <label className="block admin-body-sm text-neutral-700">
        카테고리
        <select className={`${adminInputClass} mt-1 w-full sm:w-60`} value={fields.category} onChange={(e) => set('category', e.target.value)}>
          {SEEPN_INSIGHT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="block admin-body-sm text-neutral-700">
        제목
        <input className={`${adminInputClass} mt-1 w-full`} maxLength={200} value={fields.title} onChange={(e) => set('title', e.target.value)} />
      </label>
      <label className="block admin-body-sm text-neutral-700">
        요약 (목록·관련 인사이트용, 선택)
        <input className={`${adminInputClass} mt-1 w-full`} maxLength={300} value={fields.excerpt} onChange={(e) => set('excerpt', e.target.value)} />
      </label>
      <label className="block admin-body-sm text-neutral-700">
        본문 (Markdown)
        <textarea className={`${adminInputClass} mt-1 w-full font-mono`} rows={12} maxLength={20000} value={fields.bodyMarkdown} onChange={(e) => set('bodyMarkdown', e.target.value)} />
      </label>
    </div>
  )
}

const toFields = (f: Record<string, string>): SeepnContentFields => ({
  title: f.title,
  excerpt: f.excerpt,
  category: f.category,
  bodyMarkdown: f.bodyMarkdown,
  question: f.question,
  answer: f.answer,
})

function NewForm({ kind, nextSortOrder, onDone }: { kind: SeepnContentKind; nextSortOrder: number; onDone: () => void }) {
  const [slug, setSlug] = useState('')
  const [fields, setFields] = useState(EMPTY_FIELDS)
  const [publish, setPublish] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await createSeepnContentAction({ kind, slug: slug.trim(), sortOrder: nextSortOrder, fields: toFields(fields), status: publish ? 'published' : 'draft' })
    setBusy(false)
    if (!result.success) {
      setError(result.error === 'invalid_slug' ? '슬러그는 영문 소문자로 시작하고 영문 소문자·숫자·하이픈만 쓸 수 있습니다(2~65자).' : result.error === 'invalid_fields' ? '필수 항목을 확인해주세요.' : '등록하지 못했습니다. 슬러그 중복 또는 권한을 확인해주세요.')
      return
    }
    setSlug('')
    setFields(EMPTY_FIELDS)
    setPublish(false)
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-card border border-neutral-200 bg-neutral-0 p-5">
      <h2 className="admin-heading-3 text-neutral-900">새 {kind === 'insight' ? '인사이트' : 'FAQ'} 등록</h2>
      <label className="block admin-body-sm text-neutral-700">
        슬러그 (URL 식별자, 등록 후 변경 불가)
        <input className={`${adminInputClass} mt-1 w-full sm:w-72`} placeholder="예: 2026-procurement-trend" value={slug} onChange={(e) => setSlug(e.target.value)} />
      </label>
      <FieldsEditor kind={kind} fields={fields} onChange={setFields} />
      <label className="flex items-center gap-2 admin-body-sm text-neutral-700">
        <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} /> 바로 게시
      </label>
      {error && <p className="admin-body-sm text-error">{error}</p>}
      <button type="submit" disabled={busy} className={adminButtonPrimaryClass}>
        {busy ? '등록 중...' : '등록'}
      </button>
    </form>
  )
}

function ItemRow({ kind, item, onChanged }: { kind: SeepnContentKind; item: SeepnAdminItem; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [fields, setFields] = useState<Record<string, string>>({ ...EMPTY_FIELDS, ...item.fields, category: item.fields.category || SEEPN_INSIGHT_CATEGORIES[0] })
  const [status, setStatus] = useState<SeepnContentStatus>(item.status)
  const [isActive, setIsActive] = useState(item.isActive)
  const [sortOrder, setSortOrder] = useState(item.sortOrder)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function save() {
    setBusy(true)
    setMessage(null)
    const result = await saveSeepnContentAction({ kind, contentItemId: item.contentItemId, sortOrder, isActive, fields: toFields(fields), status })
    setBusy(false)
    setMessage(result.success ? { ok: true, text: '저장되었습니다.' } : { ok: false, text: '저장하지 못했습니다. 필수 항목과 권한을 확인해주세요.' })
    if (result.success) onChanged()
  }

  async function remove() {
    setBusy(true)
    const result = await deleteSeepnContentAction(kind, item.contentItemId)
    setBusy(false)
    if (!result.success) {
      setMessage({ ok: false, text: '삭제하지 못했습니다.' })
      return
    }
    onChanged()
  }

  const title = kind === 'insight' ? item.fields.title : item.fields.question
  return (
    <li className="rounded-card border border-neutral-200 bg-neutral-0 p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="block truncate admin-body-sm font-medium text-neutral-900">{title || '(제목 없음)'}</span>
          <span className="admin-label-sm font-normal text-neutral-400">
            {item.slug}
            {kind === 'insight' && item.fields.category ? ` · ${item.fields.category}` : ''}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className={`rounded-sm px-2 py-0.5 admin-label-sm ${item.status === 'published' ? 'bg-secondary-50 text-secondary-700' : 'bg-neutral-100 text-neutral-500'}`}>{item.status === 'published' ? '게시' : '초안'}</span>
          {!item.isActive && <span className="rounded-sm bg-neutral-200 px-2 py-0.5 admin-label-sm text-neutral-600">비노출</span>}
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-neutral-100 pt-4">
          <FieldsEditor kind={kind} fields={fields} onChange={setFields} />
          <div className="flex flex-wrap items-center gap-4 admin-body-sm text-neutral-700">
            <label className="flex items-center gap-2">
              상태
              <select className={adminInputClass} value={status} onChange={(e) => setStatus(e.target.value as SeepnContentStatus)}>
                <option value="draft">초안</option>
                <option value="published">게시</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> 노출
            </label>
            <label className="flex items-center gap-2">
              정렬
              <input type="number" className={`${adminInputClass} w-24`} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" disabled={busy} onClick={save} className={adminButtonPrimaryClass}>
              {busy ? '저장 중...' : '저장'}
            </button>
            {confirmDelete ? (
              <>
                <button type="button" disabled={busy} onClick={remove} className="admin-body-sm text-error hover:underline">
                  삭제 확인
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="admin-body-sm text-neutral-500 hover:underline">
                  취소
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="admin-body-sm text-neutral-500 hover:text-error hover:underline">
                삭제
              </button>
            )}
            {message && <span className={`admin-body-sm ${message.ok ? 'text-success' : 'text-error'}`}>{message.text}</span>}
          </div>
        </div>
      )}
    </li>
  )
}

export function SeepnContentBoard({ kind, items, nextSortOrder, onChangedPath }: { kind: SeepnContentKind; items: SeepnAdminItem[]; nextSortOrder: number; onChangedPath?: string }) {
  // Server actions revalidate the page path; a router refresh re-reads the list.
  const refresh = () => {
    window.location.assign(onChangedPath ?? window.location.pathname)
  }
  return (
    <div className="space-y-4">
      <NewForm kind={kind} nextSortOrder={nextSortOrder} onDone={refresh} />
      <ul className="space-y-3">
        {items.map((item) => (
          <ItemRow key={item.contentItemId} kind={kind} item={item} onChanged={refresh} />
        ))}
        {items.length === 0 && <p className="admin-body-sm text-neutral-400">등록된 항목이 없습니다.</p>}
      </ul>
    </div>
  )
}
