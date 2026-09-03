'use client'

import { useState, type ReactNode } from 'react'

interface Tab {
  key: string
  label: string
  content: ReactNode
}

export function ContentTabs({ tabs }: { tabs: Tab[] }) {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key ?? '')

  return (
    <div className="mt-6">
      <div className="flex gap-2 border-b border-neutral-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveKey(tab.key)}
            className={`px-4 py-2 admin-body-sm font-medium ${
              tab.key === activeKey ? 'border-b-2 border-primary-600 text-primary-600' : 'text-neutral-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-4">{tabs.find((t) => t.key === activeKey)?.content}</div>
    </div>
  )
}
