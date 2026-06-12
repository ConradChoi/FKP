// Design Ref: §5.3 Component List — 현재 locale 표시 + /en ↔ /ja 전환 링크
import Link from 'next/link'
import type { Dictionary, Locale } from '@/lib/i18n/types'

export function LanguageSwitcher({
  currentLocale,
  dict,
}: {
  currentLocale: Locale
  dict: Dictionary['header']['languageSwitcher']
}) {
  return (
    <nav className="flex items-center gap-2 text-label-button" aria-label="Language">
      <Link
        href="/en"
        aria-current={currentLocale === 'en' ? 'page' : undefined}
        className={currentLocale === 'en' ? 'text-primary-600' : 'text-neutral-500'}
      >
        {dict.en}
      </Link>
      <span className="text-neutral-300">|</span>
      <Link
        href="/ja"
        aria-current={currentLocale === 'ja' ? 'page' : undefined}
        className={currentLocale === 'ja' ? 'text-primary-600' : 'text-neutral-500'}
      >
        {dict.ja}
      </Link>
    </nav>
  )
}
