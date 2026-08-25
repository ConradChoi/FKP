// Design Ref: fkp-v0.2-phase2-request-ui.spec.md §9 — hand-written inline SVG, not an
// external icon package (PRD OQ-7: no external UI libraries in the User-facing screens).
// Used at h-12 w-12 (SubmitStatus success).
interface CheckIconProps {
  className?: string
  strokeWidth?: number
}

export function CheckIcon({ className, strokeWidth = 2 }: CheckIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
  )
}
