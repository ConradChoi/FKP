'use client'

// Design Ref: human-matching.ui-spec.md §6.2/§6.3/§8 item 4 — 9노드 Outcome 트래커.
// Pure presentational component (match_id, events[], onNodeClick only) so it can be
// repeated once per confirmed Top3 partner card (§6.1).
//
// Reachability/current-state rule (screen-spec §2.4/§6.4, "단조 진행 강제 금지"): ALL nodes
// are always clickable, not just the next one. "현재 상태" = the most recently RECORDED
// event (insertion order, matches match.current_outcome_state's own trigger semantics —
// see match_outcome_event_sync_current_state's comment in the schema migration), not the
// chronologically-latest transitioned_at (events can be backdated).
import { useEffect, useRef } from 'react'
import { OUTCOME_STATE_LABELS, OUTCOME_STATE_ORDER, type OutcomeState } from '@/lib/admin/matchTags'

// ui-spec §6.3: deal/repeat get a distinct secondary(Emerald) treatment instead of the
// success(green) used by the other 7 states, both when reached-in-the-past and when current.
const EMERALD_STATES = new Set<OutcomeState>(['deal', 'repeat'])

export function OutcomeTracker({
  currentState,
  reachedStates,
  onNodeClick,
}: {
  currentState: OutcomeState | null
  reachedStates: Set<OutcomeState>
  onNodeClick: (state: OutcomeState) => void
}) {
  const currentRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    currentRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
    // Only run once on mount (ui-spec §6.2: "마운트 시 트래커도 현재 노드가 보이도록").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <p className="admin-body font-medium text-neutral-900">
        현재 상태: {currentState ? OUTCOME_STATE_LABELS[currentState] : '아직 없음'}
      </p>
      <div className="mt-3 overflow-x-auto">
        <div className="flex items-center">
          {OUTCOME_STATE_ORDER.map((state, idx) => {
            const isCurrent = state === currentState
            const isReached = reachedStates.has(state)
            const isEmerald = EMERALD_STATES.has(state)

            let nodeClass = 'bg-neutral-100 border border-neutral-200 text-neutral-400'
            if (isCurrent) {
              nodeClass = isEmerald ? 'bg-secondary-500 border-secondary-500 text-neutral-0' : 'bg-success border-success text-neutral-0'
            } else if (isReached) {
              nodeClass = isEmerald
                ? 'border-2 border-secondary-500 text-secondary-600 bg-neutral-0'
                : 'border-2 border-success text-success bg-neutral-0'
            }

            const lineFilled = idx > 0 && (reachedStates.has(OUTCOME_STATE_ORDER[idx - 1]) || isReached || isCurrent)
            const lineEmerald = isEmerald && lineFilled

            return (
              <div key={state} className="flex shrink-0 items-center">
                {idx > 0 && <div className={`h-0.5 w-6 ${lineFilled ? (lineEmerald ? 'bg-secondary-500' : 'bg-success') : 'bg-neutral-200'}`} />}
                <button
                  ref={isCurrent ? currentRef : undefined}
                  type="button"
                  onClick={() => onNodeClick(state)}
                  className="flex min-w-[92px] shrink-0 flex-col items-center gap-1.5 px-1 hover:ring-2 hover:ring-primary-300"
                  title={OUTCOME_STATE_LABELS[state]}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full admin-label-sm ${nodeClass}`}>{idx + 1}</span>
                  <span className="text-center admin-label-sm leading-tight text-neutral-600">{OUTCOME_STATE_LABELS[state]}</span>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
