// Design Ref: §5.4 Request Form — SubmitStatus (loading/success/error)
'use client'

import type { Dictionary } from '@/lib/i18n/types'
import type { SubmitState } from '@/types/request-form'
import { primaryButtonClass } from './styles'

interface SubmitStatusProps {
  dict: Dictionary['requestForm']
  status: Exclude<SubmitState, 'idle'>
  onRetry: () => void
}

export function SubmitStatus({ dict, status, onRetry }: SubmitStatusProps) {
  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-600"
          role="status"
          aria-hidden="true"
        />
        <p className="text-body text-neutral-600">{dict.buttons.submitting}</p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-h3 text-success">{dict.status.success}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <p className="text-body text-error">{dict.status.error}</p>
      <button type="button" onClick={onRetry} className={primaryButtonClass}>
        {dict.buttons.retry}
      </button>
    </div>
  )
}
