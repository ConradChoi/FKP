'use client'

// Design Ref: screen-spec §3.3 (상세 패널 필드), §3.5 (삭제/비활성화 선제 차단). Editing surface
// for everything EXCEPT is_active/exposed_to_fkp — those two live in the tree row itself
// (CategoryTreeRow.tsx, see its header comment for why). This panel shows them read-only for
// context alongside the fields it does own: breadcrumb, source/code (read-only per screen-spec
// §3.3's "출처는 정책상 읽기전용"), ko/en/ja translations, sort order, and delete.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteCategoryAction, moveCategoryAction, upsertStandardCategoryTranslationAction } from './actions'
import { computeTranslationBadge, TONE_CLASS } from '@/lib/admin/translationStatus'
import { adminInputClass, adminButtonDestructiveClass } from '@/components/admin/styles'
import { StatusBadge } from '@/components/admin/StatusBadge'
import type { CategoryLocale, StandardCategoryRecord, TranslationStatus } from './page'
import { getBreadcrumb, displayName } from './categoryTreeUtils'

const LOCALES: { key: CategoryLocale; label: string; isSource: boolean }[] = [
  { key: 'ko', label: '한국어 (원본)', isSource: true },
  { key: 'en', label: 'English', isSource: false },
  { key: 'ja', label: '日本語', isSource: false },
]

const STATUS_OPTIONS: { value: TranslationStatus; label: string }[] = [
  { value: 'draft', label: '초안' },
  { value: 'translated', label: '작성완료' },
  { value: 'published', label: '게시됨' },
]

function TranslationEditor({
  categoryId,
  locale,
  label,
  isSource,
  row,
  sourceUpdatedAt,
}: {
  categoryId: string
  locale: CategoryLocale
  label: string
  isSource: boolean
  row: StandardCategoryRecord['translations'][CategoryLocale]
  sourceUpdatedAt: string | null
}) {
  const router = useRouter()
  const [name, setName] = useState(row?.name ?? '')
  const [status, setStatus] = useState<TranslationStatus>(row?.status ?? 'draft')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const badge = computeTranslationBadge({ isSource, row, sourceUpdatedAt })

  async function save() {
    setSaving(true)
    setError(null)
    const result = await upsertStandardCategoryTranslationAction({ categoryId, locale, name, status })
    setSaving(false)
    if (!result.success) {
      setError('저장 실패')
      return
    }
    router.refresh()
  }

  return (
    <div className="rounded-card border border-neutral-200 p-3">
      <div className="flex items-center justify-between">
        <p className="admin-body-sm font-medium text-neutral-900">{label}</p>
        <span className={`rounded-sm px-2 py-0.5 admin-label-sm ${TONE_CLASS[badge.tone]}`}>{badge.label}</span>
      </div>
      <input
        className={`${adminInputClass} mt-2 w-full`}
        placeholder="카테고리명"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <select className={`${adminInputClass} py-1`} value={status} onChange={(e) => setStatus(e.target.value as TranslationStatus)}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={saving || !name.trim()}
          className="admin-label-sm text-primary-600 hover:underline disabled:cursor-not-allowed disabled:text-neutral-300"
        >
          저장
        </button>
      </div>
      {error && <p className="mt-1 admin-label-sm text-error">{error}</p>}
    </div>
  )
}

export function CategoryDetailPanel({
  categories,
  selected,
  onDeleted,
}: {
  categories: StandardCategoryRecord[]
  selected: StandardCategoryRecord | null
  onDeleted: () => void
}) {
  if (!selected) {
    return (
      <div className="flex h-full items-center justify-center rounded-card border border-dashed border-neutral-300 p-8 text-center">
        <p className="admin-body-sm text-neutral-400">왼쪽 트리에서 카테고리를 선택하면 상세 정보가 여기에 표시됩니다.</p>
      </div>
    )
  }

  return <CategoryDetailPanelContent key={selected.id} categories={categories} selected={selected} onDeleted={onDeleted} />
}

// Design Ref: key={selected.id} on the wrapper above forces this inner component to remount
// (and re-initialize all its useState) whenever the selected node changes — avoids a separate
// useEffect-based reset dance for every field below.
function CategoryDetailPanelContent({
  categories,
  selected,
  onDeleted,
}: {
  categories: StandardCategoryRecord[]
  selected: StandardCategoryRecord
  onDeleted: () => void
}) {
  const router = useRouter()
  const [moving, setMoving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const byId = new Map(categories.map((c) => [c.id, c]))
  const breadcrumb = getBreadcrumb(selected.id, byId)
  const children = categories.filter((c) => c.parent_id === selected.id)
  const siblings = categories.filter((c) => c.parent_id === selected.parent_id).sort((a, b) => a.sort_order - b.sort_order)
  const siblingIndex = siblings.findIndex((s) => s.id === selected.id)
  const isFirst = siblingIndex <= 0
  const isLast = siblingIndex === -1 || siblingIndex === siblings.length - 1

  const canDelete = selected.partnerCount === 0 && children.length === 0
  const sourceUpdatedAt = selected.translations.ko?.updated_at ?? null

  async function move(direction: 'up' | 'down') {
    setMoving(true)
    setMoveError(null)
    const result = await moveCategoryAction(selected.id, direction)
    setMoving(false)
    if (!result.success) {
      setMoveError('순서 변경 실패')
      return
    }
    router.refresh()
  }

  async function handleDelete() {
    if (!window.confirm(`"${displayName(selected)}" 카테고리를 삭제할까요?`)) return
    setDeleting(true)
    setDeleteError(null)
    const result = await deleteCategoryAction(selected.id)
    setDeleting(false)
    if (!result.success) {
      if (result.errorCode === 'REFERENCED') {
        window.alert('참조 중이므로 삭제할 수 없습니다. 대신 트리에서 활성 체크를 해제해 비활성화하세요.')
      } else {
        setDeleteError('삭제 실패')
      }
      return
    }
    onDeleted()
    router.refresh()
  }

  return (
    <div className="flex h-full flex-col gap-4 rounded-card border border-neutral-200 bg-neutral-0 p-4">
      <div>
        <p className="admin-body-sm text-neutral-400">{breadcrumb.map((b) => displayName(b)).join(' > ')}</p>
        <h2 className="mt-1 admin-heading-3 text-neutral-900">{displayName(selected)}</h2>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={selected.source === 'narajangter_standard' ? 'neutral' : 'info'} label={selected.source === 'narajangter_standard' ? '나라장터 표준' : 'SEEPN 자체 신설'} />
        <StatusBadge tone={selected.is_active ? 'success' : 'neutral'} label={selected.is_active ? '활성' : '비활성'} />
        <StatusBadge tone={selected.exposed_to_fkp ? 'info' : 'neutral'} label={selected.exposed_to_fkp ? 'FKP 노출중' : 'FKP 비노출'} />
      </div>
      <p className="-mt-2 admin-label-sm text-neutral-400">
        활성/FKP 노출 상태는 왼쪽 트리 목록의 체크박스에서 변경합니다.
      </p>

      <div className="grid grid-cols-2 gap-3 admin-body-sm text-neutral-600">
        <div>
          <p className="text-neutral-400">코드</p>
          <p className="font-mono text-neutral-800">{selected.code ?? '(없음 — 신설 노드)'}</p>
        </div>
        <div>
          <p className="text-neutral-400">등록 파트너</p>
          <p className="text-neutral-800">{selected.partnerCount}곳</p>
        </div>
        <div>
          <p className="text-neutral-400">하위 노드</p>
          <p className="text-neutral-800">{children.length}개</p>
        </div>
        <div>
          <p className="text-neutral-400">정렬순서</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => move('up')}
              disabled={isFirst || moving}
              aria-label="위로 이동"
              className="rounded-input px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => move('down')}
              disabled={isLast || moving}
              aria-label="아래로 이동"
              className="rounded-input px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ▼
            </button>
          </div>
        </div>
      </div>
      {moveError && <p className="admin-label-sm text-error">{moveError}</p>}

      <div className="space-y-2">
        <p className="admin-label-sm uppercase tracking-wide text-neutral-500">명칭 (ko/en/ja)</p>
        {LOCALES.map(({ key, label, isSource }) => (
          <TranslationEditor
            key={key}
            categoryId={selected.id}
            locale={key}
            label={label}
            isSource={isSource}
            row={selected.translations[key]}
            sourceUpdatedAt={sourceUpdatedAt}
          />
        ))}
      </div>

      <div className="mt-auto border-t border-neutral-100 pt-3">
        <button
          type="button"
          onClick={handleDelete}
          disabled={!canDelete || deleting}
          className={adminButtonDestructiveClass}
        >
          삭제
        </button>
        {!canDelete && (
          <p className="mt-1 admin-label-sm text-neutral-500">
            {selected.partnerCount}개 파트너 또는 {children.length}개 하위 카테고리가 참조 중입니다. 대신 트리에서 &lsquo;활성&rsquo;
            체크를 해제하세요.
          </p>
        )}
        {deleteError && <p className="mt-1 admin-label-sm text-error">{deleteError}</p>}
      </div>
    </div>
  )
}
