// Design Ref: fkp-v0.2-phase2-request-flow.spec.md §13.3 — the confirm modal that appears when
// Step3's submit button is clicked, before the actual POST /api/requests call. Summarizes all of
// Step1-3's input; only "Confirm & Submit" actually submits. Rendered centered over the page by
// HomeFlowProvider (which also marks the rest of the page `inert` while this is open).
'use client'

import { useEffect, useRef } from 'react'
import type { Dictionary } from '@/lib/i18n/types'
import type { RequestFormState, SubmitState } from '@/types/request-form'
import { errorTextClass, primaryButtonClass, secondaryButtonClass } from './styles'

interface ConfirmSubmitModalProps {
  open: boolean
  status: SubmitState
  dict: Dictionary['requestForm']
  categoriesDict: Dictionary['categories']
  formData: RequestFormState
  onConfirm: () => void
  onCancel: () => void
  // Design Ref: partner-supplier-app.ui-spec.md §3.12/§9 — SUP-14's withdrawal modal reuses
  // this component's structure but needs the confirm button styled as a destructive action
  // (destructiveButtonClass) instead of the default primaryButtonClass. Optional so every
  // existing caller (the buyer request flow) is unaffected.
  confirmButtonClassName?: string
}

interface SummaryRow {
  label: string
  value: string
}

interface SummarySection {
  label: string
  rows: SummaryRow[]
}

export function ConfirmSubmitModal({
  open,
  status,
  dict,
  categoriesDict,
  formData,
  onConfirm,
  onCancel,
  confirmButtonClassName,
}: ConfirmSubmitModalProps) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const isLoading = status === 'loading'
  const isError = status === 'error'

  // Design Ref: §13.3 accessibility — focus moves into the modal (its title) when it opens.
  useEffect(() => {
    if (open) titleRef.current?.focus()
  }, [open])

  // Design Ref: §13.3 — Esc closes the modal exactly like Cancel. Disabled while a submit
  // request is in flight (mirrors the Cancel button/backdrop being disabled then too).
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isLoading) onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, isLoading, onCancel])

  if (!open) return null

  const { confirmModal, step1, step2, step3 } = dict
  const categoryLabel = formData.category
    ? categoriesDict.items[formData.category as keyof typeof categoriesDict.items]?.name ?? ''
    : ''

  const sections: SummarySection[] = [
    {
      label: confirmModal.sections.step1,
      rows: [
        { label: step1.whatLookingFor.label, value: formData.whatLookingFor },
        { label: step1.category.label, value: categoryLabel },
      ],
    },
    {
      label: confirmModal.sections.step2,
      rows: [
        {
          label: step2.partnerType.label,
          value: step2.partnerType.options[formData.partnerType as keyof typeof step2.partnerType.options] ?? '',
        },
        { label: step2.purpose.label, value: formData.purpose },
        { label: step2.description.label, value: formData.description },
        {
          label: step2.budget.label,
          value: step2.budget.options[formData.budget as keyof typeof step2.budget.options] ?? '',
        },
        {
          label: step2.timeline.label,
          value: step2.timeline.options[formData.timeline as keyof typeof step2.timeline.options] ?? '',
        },
        {
          label: step2.englishSpeaking.label,
          value:
            step2.englishSpeaking.options[formData.englishSpeaking as keyof typeof step2.englishSpeaking.options] ??
            '',
        },
      ],
    },
    {
      label: confirmModal.sections.step3,
      rows: [
        { label: step3.companyNameWebsite.label, value: formData.companyNameWebsite },
        { label: step3.contact.label, value: formData.contact },
      ],
    },
  ]

  function handleBackdropClick() {
    if (!isLoading) onCancel()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/50" onClick={handleBackdropClick} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-card bg-neutral-0 shadow-xl"
      >
        <div className="overflow-y-auto p-6 sm:p-8">
          <h2
            id="confirm-modal-title"
            ref={titleRef}
            tabIndex={-1}
            className="text-h3 text-neutral-900 focus:outline-none"
          >
            {confirmModal.title}
          </h2>
          <p className="mt-2 text-body-sm text-neutral-600">{confirmModal.description}</p>

          <div className="mt-6 flex flex-col gap-5">
            {sections.map((section) => (
              <div key={section.label} className="rounded-input border border-neutral-200 p-4">
                <p className="text-label-caption uppercase tracking-wide text-neutral-500">{section.label}</p>
                <dl className="mt-2 flex flex-col gap-2">
                  {section.rows.map((row) => (
                    <div key={row.label}>
                      <dt className="text-body-sm font-medium text-neutral-700">{row.label}</dt>
                      <dd className="text-body-sm text-neutral-900">{row.value || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>

          {isLoading && (
            <div className="mt-6 flex flex-col items-center gap-3 py-2 text-center">
              <div
                className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-600"
                role="status"
                aria-hidden="true"
              />
              <p className="text-body-sm text-neutral-600">{dict.buttons.submitting}</p>
            </div>
          )}

          {isError && (
            <p className={`mt-6 ${errorTextClass}`} role="alert">
              {dict.status.error}
            </p>
          )}
        </div>

        {!isLoading && (
          <div className="flex justify-end gap-3 border-t border-neutral-200 p-4 sm:p-6">
            <button type="button" onClick={onCancel} className={secondaryButtonClass}>
              {confirmModal.cancelButton}
            </button>
            <button type="button" onClick={onConfirm} className={primaryButtonClass}>
              {isError ? dict.buttons.retry : confirmModal.confirmButton}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
