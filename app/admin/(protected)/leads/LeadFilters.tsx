'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { adminInputClass, adminButtonPrimaryClass } from '@/components/admin/styles'

// Design Ref: status filtering moved to LeadStatusTabs.tsx (seepn-admin-ui-design-system.spec.md
// §5.3 tab pattern) — this now only handles the free-text search, preserving whatever status
// tab is currently selected.
export function LeadFilters({ currentStatus, currentQuery }: { currentStatus?: string; currentQuery?: string }) {
  const router = useRouter()
  const [q, setQ] = useState(currentQuery ?? '')

  function apply(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (currentStatus) params.set('status', currentStatus)
    if (q.trim()) params.set('q', q.trim())
    router.push(`/admin/leads?${params.toString()}`)
  }

  return (
    <form onSubmit={apply} className="mt-4 flex flex-wrap items-center gap-3">
      <input
        type="text"
        className={`${adminInputClass} w-72`}
        placeholder="회사명 또는 요청 내용 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <button type="submit" className={adminButtonPrimaryClass}>
        검색
      </button>
    </form>
  )
}
