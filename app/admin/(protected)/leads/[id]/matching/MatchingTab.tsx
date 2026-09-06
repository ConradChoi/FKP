'use client'

// Design Ref: human-matching.screen-spec.md §4.2/§6 / ui-spec §2 — 매칭 탭 전체 레이아웃
// (세로 4영역: (a) 검색/필터, (b) 담은 후보 목록, (c) Top3 확정, (d) Outcome 타임라인).
// No optimistic UI (screen-spec §9 edge case 7) — every mutation calls router.refresh()
// after the server action's revalidatePath, matching the rest of this codebase's convention
// (StatusAssigneeForm.tsx et al).
import { useRouter } from 'next/navigation'
import type { CategoryOption } from '@/app/admin/(protected)/partners/categoryOptions'
import { CandidateSearchPanel } from './CandidateSearchPanel'
import { CandidateListTable } from './CandidateListTable'
import { Top3ConfirmSection } from './Top3ConfirmSection'
import { OutcomeTimelineSection } from './OutcomeTimelineSection'
import type { MatchRow, OutcomeEventRow, RequirementSummary, ShortlistConfirmationSummary } from './types'

export function MatchingTab({
  requirement,
  matches,
  confirmation,
  outcomeEventsByMatchId,
  adminNameById,
  categoryOptions,
  canReadPartners,
  canCreateMatch,
  canUpdateMatch,
  canAccessPii,
}: {
  requirement: RequirementSummary
  matches: MatchRow[]
  confirmation: ShortlistConfirmationSummary
  outcomeEventsByMatchId: Map<string, OutcomeEventRow[]>
  adminNameById: Map<string, string>
  categoryOptions: CategoryOption[]
  canReadPartners: boolean
  canCreateMatch: boolean
  canUpdateMatch: boolean
  canAccessPii: boolean
}) {
  const router = useRouter()
  const refresh = () => router.refresh()

  const existingPartnerIds = new Set(matches.map((m) => m.partner_id))
  const confirmedMatches = matches.filter((m) => m.is_confirmed_top3).sort((a, b) => (a.confirmed_rank ?? 99) - (b.confirmed_rank ?? 99))
  const isClosed = requirement.status === 'closed'

  return (
    <div className="space-y-6">
      {isClosed && (
        <div className="rounded-input border border-neutral-200 bg-neutral-50 px-4 py-2 admin-body-sm text-neutral-500">
          이 요청은 종료(closed) 상태입니다. 신규 후보 추가/판정 변경/Top3 재확정은 비활성화됩니다. 이미 확정된 Top3의
          Outcome 전이 기록은 계속 가능합니다.
        </div>
      )}

      <CandidateSearchPanel
        requirementId={requirement.id}
        candidateCount={matches.length}
        existingPartnerIds={existingPartnerIds}
        categoryOptions={categoryOptions}
        localePrefill={requirement.locale}
        disabled={!canReadPartners || !canCreateMatch || isClosed}
        disabledReason={
          !canReadPartners
            ? '파트너 조회 권한이 없어 후보를 검색할 수 없습니다. 관리자에게 공급사(파트너) 관리 읽기 권한을 요청하세요.'
            : isClosed
              ? '이 요청은 종료(closed) 상태라 신규 후보를 담을 수 없습니다.'
              : '후보를 담을 권한이 없습니다.'
        }
        onAdded={refresh}
      />

      <CandidateListTable
        requirementId={requirement.id}
        matches={matches}
        adminNameById={adminNameById}
        canReadPartners={canReadPartners}
        canAccessPii={canAccessPii}
        canUpdate={canUpdateMatch && !isClosed}
        onChanged={refresh}
      />

      <Top3ConfirmSection
        requirementId={requirement.id}
        requirementStatus={requirement.status}
        matches={matches}
        confirmation={confirmation}
        canUpdate={canUpdateMatch && !isClosed}
        onChanged={refresh}
      />

      <OutcomeTimelineSection
        requirementId={requirement.id}
        confirmedMatches={confirmedMatches}
        outcomeEventsByMatchId={outcomeEventsByMatchId}
        adminNameById={adminNameById}
        canUpdate={canUpdateMatch}
        onChanged={refresh}
      />
    </div>
  )
}
