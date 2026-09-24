'use client'

// Design Ref: Figma U-05-02 공급사 상세 (node 9:2) "Tab Menu" — four equal-width tabs with a blue
// underline on the active one. Panels are server-rendered by the page and passed in as nodes.
import { useState } from 'react'

export interface PartnerDetailTab {
  key: string
  label: string
  content: React.ReactNode
}

export function PartnerDetailTabs({ tabs }: { tabs: PartnerDetailTab[] }) {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key)
  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0]
  return (
    <>
      <div role="tablist" className="mt-6 border-y border-neutral-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-4">
          {tabs.map((t) => {
            const selected = t.key === active?.key
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveKey(t.key)}
                className={`border-b-2 py-3.5 text-body-sm ${selected ? 'border-primary-600 font-semibold text-primary-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>
      <div role="tabpanel" className="mx-auto w-full max-w-6xl px-6 py-8 pb-28">
        {active?.content}
      </div>
    </>
  )
}
