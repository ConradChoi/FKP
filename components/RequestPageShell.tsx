// Design Ref: fkp-v0.2-phase2-request-flow.spec.md §3, fkp-v0.2-phase2-request-ui.spec.md §5 —
// minimal /[locale]/request layout: Header (no marketing sections) + one-line context +
// the flat RequestForm. Owns a small piece of client state purely to relay the form's
// step/status up to Header/LanguageSwitcher (flow spec §5, §8 E-3) — the form itself still
// owns all of its own data.
'use client'

import { useState } from 'react'
import type { Dictionary, Locale } from '@/lib/i18n/types'
import { Header } from './Header'
import { RequestForm } from './RequestForm/RequestForm'
import { Footer } from './Footer'
import { RequestFlowStatusContext, type RequestFlowStatus } from './RequestFlow/RequestFlowStatusContext'

interface RequestPageShellProps {
  headerDict: Dictionary['header']
  introText: string
  requestFormDict: Dictionary['requestForm']
  categoriesDict: Dictionary['categories']
  footerDict: Dictionary['footer']
  locale: Locale
}

export function RequestPageShell({
  headerDict,
  introText,
  requestFormDict,
  categoriesDict,
  footerDict,
  locale,
}: RequestPageShellProps) {
  const [flowStatus, setFlowStatus] = useState<RequestFlowStatus>({
    step: 1,
    status: 'idle',
    formStarted: false,
    source: 'request_page',
    locale,
    hasUnsavedProgress: false,
    isAtStep1: true,
  })

  return (
    <RequestFlowStatusContext.Provider value={flowStatus}>
      <main>
        <Header locale={locale} dict={headerDict} />

        <section className="px-section-x-mobile pb-6 pt-12 lg:px-section-x">
          <div className="mx-auto max-w-[600px]">
            <p className="text-body-lg text-neutral-700">{introText}</p>
          </div>
        </section>

        <RequestForm
          dict={requestFormDict}
          categoriesDict={categoriesDict}
          locale={locale}
          source="request_page"
          onFlowStatusChange={setFlowStatus}
          sectionClassName="px-section-x-mobile pb-section-y pt-0 lg:px-section-x"
        />

        <Footer dict={footerDict} locale={locale} />
      </main>
    </RequestFlowStatusContext.Provider>
  )
}
