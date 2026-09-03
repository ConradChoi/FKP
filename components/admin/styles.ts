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
