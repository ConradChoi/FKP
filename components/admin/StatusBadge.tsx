// Design Ref: seepn-admin-ui-design-system.spec.md §4.1 — status pill used across
// /admin/leads and the new /admin/partners screen. Uses `rounded-sm` (4px), distinct from
// the existing Admin badges elsewhere in the app which use `rounded-full`. Kept generic
// (tone + label) rather than hardcoding one domain's status vocabulary — /admin/leads and
// /admin/partners have different status sets (see lib/admin/labels.ts's STATUS_TONE for
// leads; a partner-status tone map follows the same pattern once that screen is built).
export type BadgeTone = 'neutral' | 'info' | 'warning' | 'success' | 'error'

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-100 text-neutral-600',
  info: 'bg-primary-50 text-primary-700',
  warning: 'bg-accent-100 text-accent-700',
  success: 'bg-success-100 text-success',
  error: 'bg-error-100 text-error',
}

export function StatusBadge({ tone, label }: { tone: BadgeTone; label: string }) {
  return <span className={`inline-block rounded-sm px-2 py-0.5 admin-label-sm ${TONE_CLASS[tone]}`}>{label}</span>
}
