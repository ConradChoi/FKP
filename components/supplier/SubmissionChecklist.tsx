'use client'

// Design Ref: ui-spec §2.2 ("제출 준비 카드", sticky on lg+) + §6.1 (shares the same gap→tab
// mapping table as ProfileTabs' dot indicators, lib/supplier/tabGaps.ts).
import { useRouter } from 'next/navigation'
import type { SubmissionGapItem } from '@/lib/admin/partnerSubmissionGaps'
import { GAP_KEY_TO_TAB } from '@/lib/supplier/tabGaps'
import { ProgressBar } from '@/components/admin/ProgressBar'
import { primaryButtonClass } from '@/components/RequestForm/styles'
import { useDirtyGuard } from './DirtyGuard'

export function SubmissionChecklist({
  gaps,
  canSubmit,
  onSubmitClick,
}: {
  gaps: SubmissionGapItem[]
  canSubmit: boolean
  onSubmitClick: () => void
}) {
  const router = useRouter()
  const { confirmNavigateAway } = useDirtyGuard()
  const satisfiedCount = gaps.filter((g) => g.satisfied).length

  function goToTab(key: string) {
    const tab = GAP_KEY_TO_TAB[key]
    if (!tab) return
    if (!confirmNavigateAway()) return
    router.push(`/supplier/profile/${tab}`)
  }

  return (
    <aside className="w-full shrink-0 rounded-card border border-neutral-200 bg-neutral-0 p-5 lg:sticky lg:top-6 lg:w-[300px]">
      <div className="flex items-center justify-between">
        <h2 className="text-body-sm font-medium text-neutral-900">제출 준비</h2>
        <span className="text-label-caption text-neutral-500">
          {satisfiedCount}/{gaps.length}
        </span>
      </div>
      <div className="mt-2">
        <ProgressBar value={satisfiedCount} total={gaps.length} tone={satisfiedCount === gaps.length ? 'complete' : 'in-progress'} />
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {gaps.map((g) => (
          <li key={g.key}>
            <button
              type="button"
              onClick={() => goToTab(g.key)}
              className="flex w-full items-center gap-2 text-left text-body-sm text-neutral-700 hover:text-primary-700"
            >
              <input type="checkbox" checked={g.satisfied} readOnly className="h-4 w-4" />
              <span className={g.satisfied ? '' : 'text-neutral-500'}>{g.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={!canSubmit}
        onClick={onSubmitClick}
        className={`${primaryButtonClass} mt-4 w-full`}
      >
        제출하기
      </button>
    </aside>
  )
}
