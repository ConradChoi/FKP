// Design Ref: fkp-v0.2-phase2-request-ui.spec.md §9 — hand-written inline SVG, not an
// external icon package (PRD OQ-7: no external UI libraries in the User-facing screens).
// Used by MobileLanguageSwitcher as the mobile header's language-switch trigger.
interface GlobeIconProps {
  className?: string
  strokeWidth?: number
}

export function GlobeIcon({ className, strokeWidth = 1.8 }: GlobeIconProps) {
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
      <line x1="3" y1="12" x2="21" y2="12" />
      <path d="M12 3c2.5 2.5 3.75 5.5 3.75 9s-1.25 6.5-3.75 9c-2.5-2.5-3.75-5.5-3.75-9s1.25-6.5 3.75-9z" />
    </svg>
  )
}
