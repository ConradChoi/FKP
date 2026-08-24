// Design Ref: §5.4 Footer — 소개 1문장 + 연락 이메일 + 개인정보처리방침/이용약관 링크(PIPA §30② 상시 공개)
import Link from 'next/link'
import type { Dictionary, Locale } from '@/lib/i18n/types'

export function Footer({ dict, locale }: { dict: Dictionary['footer']; locale: Locale }) {
  return (
    <footer className="border-t border-neutral-200 px-section-x-mobile py-section-y lg:px-section-x">
      <div className="mx-auto max-w-[1200px]">
        <p className="text-body text-neutral-600">{dict.intro}</p>
        <p className="mt-2 text-body-sm text-neutral-500">{dict.contactEmail}</p>
        <div className="mt-3 flex gap-4 text-body-sm text-neutral-500">
          <Link href={`/${locale}/privacy`} className="underline hover:text-primary-600">
            {dict.privacyLinkText}
          </Link>
          <Link href={`/${locale}/terms`} className="underline hover:text-primary-600">
            {dict.termsLinkText}
          </Link>
        </div>
      </div>
    </footer>
  )
}
