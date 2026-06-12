// Design Ref: §5.3 Hero — CTA 클릭 시 #request-form 스크롤 + GA4 cta_click
'use client'

import type { Dictionary } from '@/lib/i18n/types'
import { trackEvent } from '@/lib/analytics'

export function Hero({ dict }: { dict: Dictionary['hero'] }) {
  return (
    <section className="px-section-x-mobile py-section-y lg:px-section-x">
      <div className="mx-auto max-w-[1200px]">
        <h1 className="text-display-hero text-neutral-900">{dict.headline}</h1>
        <p className="mt-4 max-w-2xl text-body-lg text-neutral-600">{dict.subheadline}</p>
        <a
          href="#request-form"
          onClick={() => trackEvent('cta_click', { location: 'hero' })}
          className="mt-8 inline-block rounded-input bg-primary-600 px-6 py-3 text-label-button text-neutral-0 transition-colors hover:bg-primary-700"
        >
          {dict.ctaText}
        </a>
      </div>
    </section>
  )
}
