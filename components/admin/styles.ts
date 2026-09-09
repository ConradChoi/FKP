// Design Ref: seepn-admin-ui-design-system.spec.md §4 — shared input/button classes for the
// Admin UI re-skin, mirroring components/RequestForm/styles.ts's string-export convention.
export const adminInputClass =
  'rounded-input border border-neutral-300 bg-neutral-0 px-3 py-2 admin-body text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400'

export const adminButtonPrimaryClass =
  'rounded-input bg-primary-600 px-4 py-2 admin-label text-neutral-0 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300'

export const adminButtonSecondaryClass =
  'rounded-input border border-neutral-300 bg-neutral-0 px-4 py-2 admin-label text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50'

export const adminButtonDestructiveClass =
  'rounded-input bg-error px-4 py-2 admin-label text-neutral-0 transition-colors hover:bg-error/90 disabled:cursor-not-allowed disabled:bg-neutral-300'

export const adminButtonGhostClass =
  'rounded-input px-4 py-2 admin-label text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50'

// Design Ref: docs/02-design/features/admin-ai-translation-draft.ui-spec.md §1.2 — "AI 초벌
// 채우기" card-header button. Same color values as adminButtonSecondaryClass (no new colors),
// but a compact size (px-3 py-1.5 vs px-4 py-2) to sit next to admin-label-sm badges, plus a
// "primary-tinted" hover so it reads as a distinct 3rd tone from 저장(primary fill)/삭제
// (destructive fill). Exported once (not copy-pasted into the 5 target files) per that doc's
// explicit recommendation, to avoid the tone drift it flags already happened with 저장 buttons.
export const adminButtonAiFillClass =
  'inline-flex items-center gap-1.5 rounded-input border border-neutral-300 bg-neutral-0 px-3 py-1.5 admin-label-sm text-neutral-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-400'

// Design Ref: ui-spec §1.4 — scaled-down version of components/RequestForm/SubmitStatus.tsx's
// spinner recipe, reused as-is (no new animation/colors).
export const adminSpinnerClass = 'h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-600'

// Design Ref: docs/02-design/features/notice-board.ui-spec.md §1.2 — compact icon-ish toolbar
// button for the notice body editor (WS-3). No new color values (same neutral/primary tones as
// the rest of Admin) — just a smaller footprint (h-8, px-2) than the px-4/py-2 form-action
// buttons above, sized for 5-7 buttons sitting in one row (§1.2 table).
export const adminEditorToolbarButtonClass =
  'inline-flex h-8 min-w-[32px] items-center justify-center gap-1 rounded-sm px-2 admin-body-sm text-neutral-600 transition-colors hover:bg-neutral-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:text-neutral-300'

export const adminEditorToolbarButtonActiveClass = 'bg-primary-50 text-primary-700 hover:bg-primary-100'
