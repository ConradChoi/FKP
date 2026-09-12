'use client'

// Design Ref: docs/02-design/features/partner-standard-category-picker-redesign.screen-spec.md
// §1.2(컴포넌트 트리)/§3(모달·섹션 정의)/§4(주·서브 인터랙션 규칙)/§10(엣지케이스). 2026-09-12
// 대표 확정(OQ-1)으로 Admin 대행입력(CapabilityTab.tsx)도 이 컴포넌트를 그대로 재사용하게
// 됐으므로 — 원 스펙 §7이 전제했던 "Admin은 로컬 복제본"이 뒤집혔다 — 스타일 관련 값은 전부
// prop(`classNames`)으로 받는다. 색상/토큰 자체를 새로 만들지 않고, 호출자가 이미 쓰고 있는
// 기존 스타일 상수(components/RequestForm/styles.ts 또는 components/admin/styles.ts)를
// 그대로 주입하는 방식이다(components/supplier/CategoryPicker.tsx 헤더가 남긴 "제3의 소비자가
// 생기면 그때 prop 기반으로 리팩터링하라"는 원칙을 지금 이 파일에서 이행한 것).
//
// 검색·매칭 로직(useMemo 필터, path breadcrumb, 30건 슬라이스)은 CategoryPicker.tsx에서
// 그대로 이식했다(§1.1 D-1 "검색 로직은 갈아엎지 않는다") — 바뀌는 것은 컨테이너(절대위치
// 드롭다운 → 레이어 모달)와 선택 모델(무제한 다중선택 → 주1+서브2)뿐이다.
//
// 상태 저장 방식: "낙관적 업데이트 금지"(§3.2, EDGE-7) — useCategoryRoleSelection은 서버
// RPC(부모가 넘겨준 commit 콜백)가 성공 응답을 준 뒤에만 로컬 selection을 갱신한다. 실패 시
// 클릭 직전 상태로 자동 롤백된다(단순히 setSelection을 호출하지 않으면 됨).
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CategoryOption } from '@/app/admin/(protected)/partners/categoryOptions'
import { inputClass, primaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'

export interface CategoryRoleSelection {
  primaryId: string | null
  subIds: string[] // 최대 2개
}

export interface CategoryPickerClassNames {
  /** 모달/섹션 제목(h2 수준) */
  heading: string
  /** 보조 캡션 텍스트(가장 작은 라벨) */
  labelSm: string
  /** 본문 보조 텍스트(저장 중/n개 선택됨 등) */
  bodySm: string
  /** 검색 input */
  input: string
  /** 모달 "완료" 버튼 등 주요 액션 버튼 */
  buttonPrimary: string
  /** 에러 텍스트 */
  error: string
}

const DEFAULT_CLASS_NAMES: CategoryPickerClassNames = {
  heading: 'text-h3 text-neutral-900',
  labelSm: 'text-label-caption text-neutral-400',
  bodySm: 'text-body-sm text-neutral-600',
  input: inputClass,
  buttonPrimary: primaryButtonClass,
  error: errorTextClass,
}

function resolveLabel(id: string, byId: Map<string, CategoryOption>): { name: string; path: string; inactive: boolean } {
  const o = byId.get(id)
  if (o) return { name: o.name, path: o.path, inactive: false }
  return { name: '(비활성 카테고리)', path: '', inactive: true }
}

// =============================================================================
// 상태 머신 — §4 주/서브 선택 인터랙션 규칙. 섹션(§3.1)과 모달(§3.2) 양쪽에서 동일한 규칙을
// 써야 하므로(칩 ×버튼이 두 군데에 있다) 훅으로 뽑아 두 UI가 공유한다.
// =============================================================================
export function useCategoryRoleSelection(
  initial: CategoryRoleSelection,
  commit: (next: CategoryRoleSelection) => Promise<boolean>,
) {
  const [selection, setSelection] = useState<CategoryRoleSelection>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limitFlash, setLimitFlash] = useState(false)

  async function apply(next: CategoryRoleSelection) {
    setSaving(true)
    setError(null)
    const ok = await commit(next)
    setSaving(false)
    if (ok) {
      setSelection(next)
    } else {
      // EDGE-7: 낙관적 업데이트 금지 — 실패 시 selection을 갱신하지 않으므로 직전 성공 상태로
      // 자동 롤백된 것과 같은 효과.
      setError('저장에 실패했습니다. 다시 시도해주세요.')
    }
  }

  function removePrimary() {
    if (saving) return
    // §4 규칙 3: 주 해제 시 서브가 남아있으면 가장 먼저 선택된 서브를 자동 승격.
    if (selection.subIds.length > 0) {
      const [promoted, ...rest] = selection.subIds
      void apply({ primaryId: promoted, subIds: rest })
    } else {
      void apply({ primaryId: null, subIds: [] })
    }
  }

  function removeSub(id: string) {
    if (saving) return
    void apply({ primaryId: selection.primaryId, subIds: selection.subIds.filter((s) => s !== id) })
  }

  function promoteToPrimary(subId: string) {
    if (saving || !selection.primaryId) return
    // §4 규칙 2: 역할 스왑 — 기존 주는 서브로 강등, 선택 개수는 그대로.
    const demoted = selection.primaryId
    void apply({ primaryId: subId, subIds: selection.subIds.filter((s) => s !== subId).concat(demoted) })
  }

  function selectFromResults(id: string) {
    if (saving) return
    if (id === selection.primaryId) {
      removePrimary()
      return
    }
    if (selection.subIds.includes(id)) {
      removeSub(id)
      return
    }
    if (!selection.primaryId) {
      // §4 규칙 1: 0개 상태의 첫 클릭 = 자동 주 카테고리
      void apply({ primaryId: id, subIds: selection.subIds })
      return
    }
    if (selection.subIds.length < 2) {
      // §4 규칙 1: 이후 최대 2개는 자동 서브
      void apply({ primaryId: selection.primaryId, subIds: [...selection.subIds, id] })
      return
    }
    // EDGE-1: 3/3 상태에서 4번째 클릭 — 추가 거부, 상태줄만 강조(토스트 없음)
    setLimitFlash(true)
    setTimeout(() => setLimitFlash(false), 900)
  }

  const count = (selection.primaryId ? 1 : 0) + selection.subIds.length

  return { selection, saving, error, limitFlash, count, removePrimary, removeSub, promoteToPrimary, selectFromResults }
}

// =============================================================================
// §3.1 섹션 레벨 칩 요약 — 항상 노출되는 "표준 카테고리" 섹션의 칩 영역
// =============================================================================
export function CategoryRoleSummary({
  options,
  selection,
  onRemovePrimary,
  onRemoveSub,
  classNames,
}: {
  options: CategoryOption[]
  selection: CategoryRoleSelection
  onRemovePrimary: () => void
  onRemoveSub: (id: string) => void
  classNames?: Partial<CategoryPickerClassNames>
}) {
  const cn = { ...DEFAULT_CLASS_NAMES, ...classNames }
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options])
  const count = (selection.primaryId ? 1 : 0) + selection.subIds.length

  if (count === 0) {
    return <p className={cn.labelSm}>아직 선택된 카테고리가 없습니다.</p>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {selection.primaryId &&
        (() => {
          const { name, inactive } = resolveLabel(selection.primaryId, byId)
          return (
            <span className="inline-flex items-center gap-1 rounded-sm bg-primary-50 px-2 py-0.5 text-label-caption text-primary-700">
              <span className="rounded-sm bg-primary-600 px-1 text-[10px] font-medium text-neutral-0">주</span>
              {inactive ? `${name}` : name}
              <button type="button" onClick={onRemovePrimary} aria-label="주 카테고리 선택 해제" className="hover:text-primary-900">
                ×
              </button>
            </span>
          )
        })()}
      {selection.subIds.map((id) => {
        const { name } = resolveLabel(id, byId)
        return (
          <span key={id} className="inline-flex items-center gap-1 rounded-sm bg-neutral-100 px-2 py-0.5 text-label-caption text-neutral-600">
            <span className="rounded-sm bg-neutral-400 px-1 text-[10px] font-medium text-neutral-0">서브</span>
            {name}
            <button type="button" onClick={() => onRemoveSub(id)} aria-label={`${name} 선택 해제`} className="hover:text-neutral-900">
              ×
            </button>
          </span>
        )
      })}
    </div>
  )
}

// =============================================================================
// §3.2 카테고리 선택 모달
// =============================================================================
export function CategoryPickerModal({
  open,
  onClose,
  options,
  selection,
  saving,
  error,
  limitFlash,
  onSelectFromResults,
  onRemovePrimary,
  onRemoveSub,
  onPromoteToPrimary,
  classNames,
}: {
  open: boolean
  onClose: () => void
  options: CategoryOption[]
  selection: CategoryRoleSelection
  saving: boolean
  error: string | null
  limitFlash: boolean
  onSelectFromResults: (id: string) => void
  onRemovePrimary: () => void
  onRemoveSub: (id: string) => void
  onPromoteToPrimary: (id: string) => void
  classNames?: Partial<CategoryPickerClassNames>
}) {
  const cn = { ...DEFAULT_CLASS_NAMES, ...classNames }
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options])
  const count = (selection.primaryId ? 1 : 0) + selection.subIds.length
  const isFull = count >= 3

  // 모달 오픈 시 검색창 자동 포커스 + 검색어 초기화(§3.2)
  useEffect(() => {
    if (!open) return
    setQuery('')
    const t = setTimeout(() => searchRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])

  // Esc로 닫기(ConfirmActionModal.tsx와 동일한 접근성 패턴 복제, §1.1)
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase()
    const pool = term ? options.filter((o) => o.path.toLowerCase().includes(term)) : options
    return pool.slice(0, 30)
  }, [options, query])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-picker-modal-title"
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-card bg-neutral-0 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 p-4 sm:p-6">
          <div>
            <h2 id="category-picker-modal-title" className={cn.heading}>
              표준 카테고리 선택
            </h2>
            <p className={`mt-1 ${cn.labelSm}`}>주 카테고리 1개(필수) + 서브 카테고리 최대 2개</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className={`${cn.bodySm} ${isFull ? 'font-medium text-accent-700' : ''}`}>{count}/3 선택됨</span>
            <button type="button" onClick={onClose} aria-label="모달 닫기" className="text-neutral-400 hover:text-neutral-600">
              ×
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-3">
            <div>
              <span className={cn.labelSm}>주 카테고리</span>
              <div className="mt-1">
                {selection.primaryId ? (
                  (() => {
                    const { name, inactive } = resolveLabel(selection.primaryId, byId)
                    return (
                      <span className="inline-flex items-center gap-1.5 rounded-input bg-primary-50 px-3 py-1.5 text-body-sm text-primary-700">
                        <span className="rounded-sm bg-primary-600 px-1 text-[10px] font-medium text-neutral-0">주</span>
                        {name}
                        {inactive && <span className="text-neutral-400">(비활성)</span>}
                        <button
                          type="button"
                          onClick={onRemovePrimary}
                          disabled={saving}
                          aria-label="주 카테고리 선택 해제"
                          className="ml-1 hover:text-primary-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          ×
                        </button>
                      </span>
                    )
                  })()
                ) : (
                  <div className="rounded-input border border-dashed border-neutral-300 px-3 py-2 text-body-sm text-neutral-400">
                    주 카테고리를 선택하세요
                  </div>
                )}
              </div>
            </div>
            <div>
              <span className={cn.labelSm}>서브 카테고리(최대 2개)</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {selection.subIds.map((id) => {
                  const { name, inactive } = resolveLabel(id, byId)
                  return (
                    <span key={id} className="inline-flex items-center gap-1.5 rounded-input bg-neutral-100 px-3 py-1.5 text-body-sm text-neutral-700">
                      <span className="rounded-sm bg-neutral-400 px-1 text-[10px] font-medium text-neutral-0">서브</span>
                      {name}
                      {inactive && <span className="text-neutral-400">(비활성)</span>}
                      {!inactive && (
                        <button
                          type="button"
                          onClick={() => onPromoteToPrimary(id)}
                          disabled={saving}
                          className="text-label-caption text-primary-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          주로 지정
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRemoveSub(id)}
                        disabled={saving}
                        aria-label={`${name} 선택 해제`}
                        className="hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        ×
                      </button>
                    </span>
                  )
                })}
                {selection.subIds.length === 0 && (
                  <div className="rounded-input border border-dashed border-neutral-300 px-3 py-2 text-body-sm text-neutral-400">
                    서브 카테고리 선택 가능
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <p className={`mb-3 ${cn.error}`} role="alert">
              {error}
            </p>
          )}

          <input
            ref={searchRef}
            className={`${cn.input} w-full`}
            placeholder="검색: 카테고리명"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {(isFull || limitFlash) && (
            <p className="mt-2 rounded-input bg-accent-100 px-3 py-1.5 text-label-caption font-medium text-accent-700" aria-live="polite">
              3/3 — 하나를 해제하세요
            </p>
          )}

          <div className="mt-2 max-h-64 overflow-y-auto rounded-card border border-neutral-200">
            {matches.length === 0 && (
              <p className="px-3 py-2 text-body-sm text-neutral-400">
                일치하는 카테고리가 없습니다.
                <br />
                다른 검색어를 시도해보세요.
              </p>
            )}
            {matches.map((o) => {
              const isPrimary = o.id === selection.primaryId
              const isSub = selection.subIds.includes(o.id)
              const isSelected = isPrimary || isSub
              const blockedByLimit = !isSelected && isFull
              const disabled = saving || blockedByLimit
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectFromResults(o.id)}
                  className={`block w-full px-3 py-2 text-left text-body-sm hover:bg-neutral-50 ${
                    isSelected ? 'bg-primary-50 text-primary-700' : 'text-neutral-700'
                  } ${blockedByLimit ? 'cursor-not-allowed opacity-40 hover:bg-transparent' : ''} ${
                    saving && !isSelected ? 'cursor-wait' : ''
                  }`}
                >
                  {isPrimary ? '✓ [주] ' : isSub ? '✓ [서브] ' : ''}
                  {o.path}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end border-t border-neutral-200 p-4 sm:p-6">
          <button type="button" onClick={onClose} className={cn.buttonPrimary}>
            완료
          </button>
        </div>
      </div>
    </div>
  )
}
