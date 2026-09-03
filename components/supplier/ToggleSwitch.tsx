'use client'

// Design Ref: docs/02-design/features/partner-supplier-app.ui-spec.md §3.11/§4 — new toggle
// component (no toggle primitive existed in the codebase before this app). The ui-spec's
// original design called for a THIRD "unknown" visual state (`value: boolean | 'unknown'`)
// for the marketing-consent toggle, to avoid rendering a false "OFF" while G-S1 (no way to
// read one's own consent history) was open. UI-B2 (privacy review §1.2) closed that gap by
// shipping `get_own_partner_consents()`, and that same review's §0.4/§7.3 UI-R12 explicitly
// says to remove the 3-state design once UI-B2 ships — so this component is the
// ALREADY-SIMPLIFIED 2-value version (`value: boolean`) from day one; there is no
// 'unknown' state to strip later.
//
// Hit target: the visual track is 40x24px (Figma/ui-spec size), but the button's own padding
// (p-2.5 all around) brings the clickable area to roughly 44px+ per WCAG 2.5.5, without
// changing the visible track size — no negative-margin tricks needed.
export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`inline-flex items-center rounded-full p-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
        disabled ? 'cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${
          disabled ? 'bg-neutral-200' : checked ? 'bg-primary-600' : 'bg-neutral-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-neutral-0 shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}
