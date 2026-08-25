'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { STATUS_LABELS, STATUS_ORDER } from '@/lib/admin/labels'
import { inputClass, primaryButtonClass } from '@/components/RequestForm/styles'

export function LeadFilters({ currentStatus, currentQuery }: { currentStatus?: string; currentQuery?: string }) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus ?? '')
  const [q, setQ] = useState(currentQuery ?? '')

  function apply(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (q.trim()) params.set('q', q.trim())
    router.push(`/admin/leads?${params.toString()}`)
  }

  return (
    <form onSubmit={apply} className="mt-4 flex flex-wrap items-center gap-3">
      <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">전체 상태</option>
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <input
        type="text"
        className={inputClass}
        placeholder="회사명 또는 요청 내용 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <button type="submit" className={primaryButtonClass}>
        검색
      </button>
    </form>
  )
}
