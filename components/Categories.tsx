// Design Ref: §5.4 Categories — 5개 카테고리 카드, 각 카드: 이름 + 예시 키워드 3~4개.
// Phase 2: cards are clickable — prefills the request's category and scrolls per current
// flow state (fkp-v0.2-phase2-request-flow.spec.md §4.4, §13.4 supersedes §5.1). All of the
// branching lives in useHomeFlowEngine's prefillCategory — this component just calls it. Only
// rendered on Home, where HomeFlowProvider is always an ancestor.
'use client'

import type { Dictionary } from '@/lib/i18n/types'
import { useHomeFlow } from './RequestFlow/HomeFlowContext'

export function Categories({ dict }: { dict: Dictionary['categories'] }) {
  const flow = useHomeFlow()
  const entries = Object.entries(dict.items) as [keyof Dictionary['categories']['items'], Dictionary['categories']['items'][keyof Dictionary['categories']['items']]][]

  return (
    <section className="px-section-x-mobile py-section-y lg:px-section-x">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="text-h2 text-neutral-900">{dict.title}</h2>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {entries.map(([key, item]) => (
            <button
              key={item.name}
              type="button"
              onClick={() => flow.prefillCategory(key)}
              aria-label={`${item.name} — ${dict.selectHint}`}
              className="rounded-card border border-neutral-200 bg-neutral-0 p-6 text-left transition-colors hover:border-primary-300 hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            >
              <h3 className="text-h3 text-neutral-900">{item.name}</h3>
              <ul className="mt-3 space-y-1 text-body-sm text-neutral-600">
                {item.keywords.map((keyword) => (
                  <li key={keyword}>{keyword}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
