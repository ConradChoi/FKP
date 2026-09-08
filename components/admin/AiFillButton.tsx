'use client'

// Design Ref: docs/02-design/features/admin-ai-translation-draft.ui-spec.md §1 — the "AI 초벌
// 채우기" card-header button, identical across the 5 target editors (LandingCopyRow,
// CategoryRow, CategoryDetailPanel, FaqRow, ArticleRow). Factored into one component instead of
// copy-pasted 5 times, same rationale ui-spec §1.2 already gives for exporting
// adminButtonAiFillClass from one place: 저장 buttons in this codebase already drifted in tone
// from being hand-copied per file, and this button carries more state (loading label + spinner +
// aria-busy) than 저장 does, so the drift risk is higher, not lower.
import { adminButtonAiFillClass, adminSpinnerClass } from './styles'
import { AI_FILL_BUTTON_LABEL, AI_FILL_BUTTON_LOADING_LABEL } from '@/lib/admin/aiFillClient'

export function AiFillButton({
  loading,
  disabledReason,
  disabled,
  onClick,
}: {
  loading: boolean
  // null = enabled (for the source-field reason). Non-null = disabled, and doubles as the
  // native `title` tooltip text (ui-spec §1.5 — a disabled <button>'s `title` attribute works as
  // a hover tooltip in every major browser, unlike <option title> which Chromium ignores).
  disabledReason: string | null
  // Extra disable condition with no tooltip text of its own — e.g. "a regular save is in
  // progress on this same card" (E-11 부류: 다른 진행 중인 액션과의 충돌 방지, 별도 문구 불필요).
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabledReason !== null || disabled}
      title={disabledReason ?? undefined}
      aria-busy={loading}
      className={adminButtonAiFillClass}
    >
      {loading ? (
        <>
          <span aria-hidden="true" className={adminSpinnerClass} />
          {AI_FILL_BUTTON_LOADING_LABEL}
        </>
      ) : (
        <>
          <span aria-hidden="true">✨</span>
          {AI_FILL_BUTTON_LABEL}
        </>
      )}
    </button>
  )
}
