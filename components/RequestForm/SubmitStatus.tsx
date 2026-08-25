// Design Ref: §5.4 Request Form — SubmitStatus (loading/success/error). Phase 2: success
// now stays on screen until the user clicks "Start a New Request"
// (fkp-v0.2-phase2-request-flow.spec.md §2.2 step 6, §10 OQ-1).
'use client'

import { useState } from 'react'
import type { Dictionary } from '@/lib/i18n/types'
import type { SubmitState } from '@/types/request-form'
import { primaryButtonClass, secondaryButtonClass } from './styles'
import { CheckIcon } from '../icons/CheckIcon'

interface SubmitStatusProps {
  dict: Dictionary['requestForm']
  status: Exclude<SubmitState, 'idle'>
  onRetry: () => void
  onReset: () => void
}

export function SubmitStatus({ dict, status, onRetry, onReset }: SubmitStatusProps) {
  const [resetting, setResetting] = useState(false)

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
    function handleResetClick() {
      if (resetting) return
      setResetting(true)
      onReset()
    }

    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <CheckIcon className="h-12 w-12 text-success" strokeWidth={1.5} />
        <p className="text-h3 text-success">{dict.status.success}</p>
        <button
          type="button"
          onClick={handleResetClick}
          disabled={resetting}
          className={`${secondaryButtonClass} mt-2`}
        >
          {dict.buttons.startNew}
        </button>
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
