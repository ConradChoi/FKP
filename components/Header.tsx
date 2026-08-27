// Design Ref: fkp-v0.2-phase2-request-flow.spec.md §4.3, §13.2 (supersedes §5),
// fkp-v0.2-phase2-request-ui.spec.md §4 — logo + "Request" nav entry point + LanguageSwitcher,
// shared by Home/`/request`/Legal pages. Extracted out of app/[locale]/page.tsx (previously
// inline) so all four pages can render the same header (ui spec §4.4, §10-2).
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { Dictionary, Locale } from '@/lib/i18n/types'
import { LanguageSwitcher } from './LanguageSwitcher'
import { MobileLanguageSwitcher } from './MobileLanguageSwitcher'
import { useRequestFlowStatus } from './RequestFlow/RequestFlowStatusContext'
import { focusFirstFieldWithin, smoothScrollToId } from '@/lib/dom/scrollTo'

interface HeaderProps {
  locale: Locale
  dict: Dictionary['header']
}

export function Header({ locale, dict }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const flow = useRequestFlowStatus()

  const isRequestPage = pathname === `/${locale}/request`
  const isHome = pathname === `/${locale}`

  // Design Ref: flow spec §13.2 (supersedes §5) — the continuation panel is gone, so Home no
  // longer branches between two scroll targets: every click just scrolls to Hero, regardless
  // of which carousel panel (step 1/2/3) is currently active. Progress is never lost since
  // it's never left Hero's card in the first place. Only auto-focuses the first field when
  // truly idle (Panel 1, not yet started) — never steals focus into an already in-progress
  // panel (§7 principle 3).
  function handleRequestNavClick() {
    if (!isHome) {
      router.push(`/${locale}/request`)
      return
    }
    smoothScrollToId('hero')
    const atStep1 = !flow || flow.isAtStep1
    if (atStep1 && !flow?.formStarted) {
      focusFirstFieldWithin('hero-mini-form')
    }
  }

  return (
    <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-neutral-200 bg-neutral-0 px-section-x-mobile py-4 lg:px-section-x">
      <Link href={`/${locale}`} className="text-body font-semibold text-primary-900 sm:text-h3">
        <span className="sm:hidden">{dict.logoShort}</span>
        <span className="hidden sm:inline">{dict.logo}</span>
      </Link>
      <div className="flex items-center gap-3 sm:gap-6">
        {isRequestPage ? (
          <span aria-current="page" className="cursor-default px-4 py-2 text-body-sm font-medium text-primary-600">
            {dict.requestNav}
          </span>
        ) : (
          <button
            type="button"
            onClick={handleRequestNavClick}
            className="rounded-input border border-primary-600 px-4 py-2 text-body-sm font-medium text-primary-600 transition-colors hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          >
            {dict.requestNav}
          </button>
        )}
        <div className="hidden sm:block">
          <LanguageSwitcher currentLocale={locale} dict={dict.languageSwitcher} />
        </div>
        <div className="sm:hidden">
          <MobileLanguageSwitcher currentLocale={locale} dict={dict.languageSwitcher} />
        </div>
      </div>
    </header>
  )
}
