// Design Ref: privacy review §6 S-4 — GA4/GTM must default to denied consent
// (see app/[locale]/layout.tsx "consent-default" script) until the visitor
// makes a choice here. This banner is the only thing that can move consent
// to 'granted'.
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Dictionary, Locale } from '@/lib/i18n/types'

const STORAGE_KEY = 'fkp-cookie-consent'

type ConsentChoice = 'granted' | 'denied'

function applyConsent(choice: ConsentChoice) {
  const value = choice === 'granted' ? 'granted' : 'denied'
  window.gtag?.('consent', 'update', {
    ad_storage: value,
    analytics_storage: value,
    ad_user_data: value,
    ad_personalization: value,
  })
}

export function CookieConsentBanner({ dict, locale }: { dict: Dictionary['cookieConsent']; locale: Locale }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === 'granted' || stored === 'denied') {
        applyConsent(stored)
      } else {
        setVisible(true)
      }
    } catch {
      // localStorage unavailable (private mode etc.) — default stays denied, no banner nag loop.
    }
  }, [])

  function choose(choice: ConsentChoice) {
    applyConsent(choice)
    try {
      window.localStorage.setItem(STORAGE_KEY, choice)
    } catch {
      // best-effort only
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-white px-section-x-mobile py-4 shadow-lg lg:px-section-x">
      <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body-sm text-neutral-700">
          {dict.before}
          <Link href={`/${locale}/privacy`} className="underline hover:text-primary-600">
            {dict.linkText}
          </Link>
          {dict.after}
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose('denied')}
            className="rounded-input border border-neutral-300 px-4 py-2 text-label-button text-neutral-700 hover:bg-neutral-50"
          >
            {dict.decline}
          </button>
          <button
            type="button"
            onClick={() => choose('granted')}
            className="rounded-input bg-primary-600 px-4 py-2 text-label-button text-white hover:bg-primary-700"
          >
            {dict.accept}
          </button>
        </div>
      </div>
    </div>
  )
}
