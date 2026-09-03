// Design Ref: seepn-admin-ui-design-system.spec.md §5.3 — the Figma "공급사 승인 관리" screen's
// underline-tab filter, visually adapted from content/ContentTabs.tsx. That component swaps
// pre-rendered children by client state; here each tab instead navigates to a server-filtered
// URL (status is a DB-level filter, not something already loaded into the page), so this is a
// plain Link list rather than a stateful client component.
import Link from 'next/link'
import { STATUS_LABELS, STATUS_ORDER } from '@/lib/admin/labels'

function hrefFor(status: string | undefined, q: string | undefined) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (q) params.set('q', q)
  const qs = params.toString()
  return qs ? `/admin/leads?${qs}` : '/admin/leads'
}

export function LeadStatusTabs({ currentStatus, currentQuery }: { currentStatus?: string; currentQuery?: string }) {
  const tabs: { status?: (typeof STATUS_ORDER)[number]; label: string }[] = [
    { label: '전체' },
    ...STATUS_ORDER.map((s) => ({ status: s, label: STATUS_LABELS[s] })),
  ]

  return (
    <div className="flex flex-wrap gap-1 border-b border-neutral-200">
      {tabs.map((tab) => {
        const isActive = tab.status === currentStatus || (!tab.status && !currentStatus)
        return (
          <Link
            key={tab.status ?? 'all'}
            href={hrefFor(tab.status, currentQuery)}
            className={`border-b-2 px-4 py-2 admin-body-sm font-medium transition-colors ${
              isActive ? 'border-primary-600 text-primary-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
