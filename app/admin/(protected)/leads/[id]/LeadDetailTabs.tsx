'use client'

// Design Ref: human-matching.screen-spec.md §4.1 / ui-spec §1 — "PartnerDetailTabs.tsx와
// 완전히 동일한 마크업으로 LeadDetailTabs.tsx(신규)를 만든다." 딥링크 없음(로컬 useState),
// 기본 선택 탭은 "개요".
import { useState } from 'react'
import { OverviewTab, type OverviewTabRequest } from './OverviewTab'
import { MatchingTab } from './matching/MatchingTab'
import type { CategoryOption } from '@/app/admin/(protected)/partners/categoryOptions'
import type { MatchRow, OutcomeEventRow, RequirementSummary, ShortlistConfirmationSummary } from './matching/types'

type TabKey = 'overview' | 'matching'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '개요' },
  { key: 'matching', label: '매칭' },
]

export function LeadDetailTabs({
  req,
  admins,
  internalNote,
  canAccessPii,
  requirement,
  matches,
  confirmation,
  outcomeEventsByMatchId,
  adminNameById,
  categoryOptions,
  canReadPartners,
  canCreateMatch,
  canUpdateMatch,
}: {
  req: OverviewTabRequest
  admins: { id: string; display_name: string }[]
  internalNote: string
  canAccessPii: boolean
  requirement: RequirementSummary
  matches: MatchRow[]
  confirmation: ShortlistConfirmationSummary
  outcomeEventsByMatchId: Map<string, OutcomeEventRow[]>
  adminNameById: Map<string, string>
  categoryOptions: CategoryOption[]
  canReadPartners: boolean
  canCreateMatch: boolean
  canUpdateMatch: boolean
}) {
  const [tab, setTab] = useState<TabKey>('overview')

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-neutral-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2 admin-body-sm font-medium transition-colors ${
              tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'overview' && (
          <OverviewTab req={req} admins={admins} internalNote={internalNote} canAccessPii={canAccessPii} matchCount={matches.length} />
        )}
        {tab === 'matching' && (
          <MatchingTab
            requirement={requirement}
            matches={matches}
            confirmation={confirmation}
            outcomeEventsByMatchId={outcomeEventsByMatchId}
            adminNameById={adminNameById}
            categoryOptions={categoryOptions}
            canReadPartners={canReadPartners}
            canCreateMatch={canCreateMatch}
            canUpdateMatch={canUpdateMatch}
            canAccessPii={canAccessPii}
          />
        )}
      </div>
    </div>
  )
}
