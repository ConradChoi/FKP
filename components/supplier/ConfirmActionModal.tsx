'use client'

// Design Ref: docs/02-design/features/partner-supplier-app.ui-spec.md §1(재사용 자산)/§3.12 —
// "ConfirmSubmitModal.tsx의 확인 모달 패턴(요약 섹션 + 확인/취소, Esc/backdrop 처리)" 재사용
// 지시를 따른다. 그러나 components/RequestForm/ConfirmSubmitModal.tsx는 그 컴포넌트 하나가
// RequestFormState(step1/step2/step3 dict) 모양에 강하게 결합돼 있어(§ props 자체가
// `formData: RequestFormState`, `dict: Dictionary['requestForm']`) SUP-08 제출 확인과 SUP-14
// 탈퇴 확인처럼 전혀 다른 데이터 모양에는 그대로 import할 수 없다 — 원본 컴포넌트를 범용으로
//리팩터링하는 것은 버튼 클래스 하나를 prop화하는 것보다 훨씬 큰 변경이라 이번 범위에서는
// 하지 않기로 판단했다(그 결정은 ConfirmSubmitModal.tsx의 confirmButtonClassName prop 추가로
// 최소 반영만 해 둠). 대신 이 파일이 그 "패턴"(role=dialog, 포커스 이동, Esc/backdrop 닫기,
// 로딩 스피너, 에러 문구, 취소/확인 버튼 배치)을 동일하게 복제한 범용 버전이다 — SUP-08의
// 제출 확인, SUP-14의 탈퇴 확인 둘 다 이 컴포넌트로 구현한다.
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { errorTextClass, primaryButtonClass, secondaryButtonClass } from '@/components/RequestForm/styles'

export function ConfirmActionModal({
  open,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = '취소',
  loading = false,
  loadingLabel = '처리 중...',
  error,
  confirmButtonClassName = primaryButtonClass,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description?: string
  children?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  loading?: boolean
  loadingLabel?: string
  error?: string | null
  confirmButtonClassName?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (open) titleRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, loading, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-neutral-900/50"
        onClick={() => !loading && onCancel()}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-action-modal-title"
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-card bg-neutral-0 shadow-xl"
      >
        <div className="overflow-y-auto p-6 sm:p-8">
          <h2
            id="confirm-action-modal-title"
            ref={titleRef}
            tabIndex={-1}
            className="text-h3 text-neutral-900 focus:outline-none"
          >
            {title}
          </h2>
          {description && <p className="mt-2 text-body-sm text-neutral-600">{description}</p>}
          {children && <div className="mt-4">{children}</div>}

          {loading && (
            <div className="mt-6 flex flex-col items-center gap-3 py-2 text-center">
              <div
                className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-600"
                role="status"
                aria-hidden="true"
              />
              <p className="text-body-sm text-neutral-600">{loadingLabel}</p>
            </div>
          )}

          {error && (
            <p className={`mt-6 ${errorTextClass}`} role="alert">
              {error}
            </p>
          )}
        </div>

        {!loading && (
          <div className="flex justify-end gap-3 border-t border-neutral-200 p-4 sm:p-6">
            <button type="button" onClick={onCancel} className={secondaryButtonClass}>
              {cancelLabel}
            </button>
            <button type="button" onClick={onConfirm} className={confirmButtonClassName}>
              {confirmLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
