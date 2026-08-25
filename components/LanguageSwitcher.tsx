// Design Ref: §5.3 Component List — 현재 locale 표시 + /en ↔ /ja 전환 링크. Phase 2:
// warns via native window.confirm() before switching if a request is in progress
// (fkp-v0.2-phase2-request-flow.spec.md §8 E-3, fkp-v0.2-phase2-request-ui.spec.md §8 —
// native confirm() chosen over a custom modal).
'use client'

import Link from 'next/link'
import type { MouseEvent } from 'react'
import type { Dictionary, Locale } from '@/lib/i18n/types'
import { useRequestFlowStatus } from './RequestFlow/RequestFlowStatusContext'

export function LanguageSwitcher({
  currentLocale,
  dict,
}: {
  currentLocale: Locale
  dict: Dictionary['header']['languageSwitcher']
}) {
  const flow = useRequestFlowStatus()

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (flow?.hasUnsavedProgress) {
      const proceed = window.confirm(dict.switchWarning)
      if (!proceed) {
        e.preventDefault()
      }
    }
  }

  return (
    <nav className="flex items-center gap-2 text-label-button" aria-label="Language">
      <Link
        href="/en"
        aria-current={currentLocale === 'en' ? 'page' : undefined}
        onClick={handleClick}
        className={currentLocale === 'en' ? 'text-primary-600' : 'text-neutral-500'}
      >
        {dict.en}
      </Link>
      <span className="text-neutral-300">|</span>
      <Link
        href="/ja"
        aria-current={currentLocale === 'ja' ? 'page' : undefined}
        onClick={handleClick}
        className={currentLocale === 'ja' ? 'text-primary-600' : 'text-neutral-500'}
      >
        {dict.ja}
      </Link>
    </nav>
  )
}
