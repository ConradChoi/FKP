// Design Ref: fkp-v0.2-phase5d-blog-case-faq.spec.md §4.4 — 여러 항목 동시 펼침 허용
// (single-open 아코디언 아님, MVP 단순화).
'use client'

import { useState } from 'react'
import type { PublishedFaqItem } from '@/lib/content/getPublishedContent'

export function FaqAccordion({ items }: { items: PublishedFaqItem[] }) {
  const [openSlugs, setOpenSlugs] = useState<Set<string>>(new Set())

  function toggle(slug: string) {
    setOpenSlugs((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  return (
    <div className="mt-8 space-y-3">
      {items.map((item) => {
        const isOpen = openSlugs.has(item.slug)
        return (
          <div key={item.slug} id={`faq-${item.slug}`} className="rounded-card border border-neutral-200 bg-neutral-0">
            <button
              type="button"
              onClick={() => toggle(item.slug)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between px-6 py-4 text-left text-body font-medium text-neutral-900"
            >
              <span>{item.question}</span>
              <span className="ml-4 text-neutral-400">{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && <p className="px-6 pb-4 text-body-sm text-neutral-600">{item.answer}</p>}
          </div>
        )
      })}
    </div>
  )
}
