// Design Ref: seepn-admin-ui-design-system.spec.md §3.3/§4.3 — referenced by AdminTopbar (admin
// user) and the /admin/leads company-name cell (company), neither of which has a photo field
// today, so this renders initials only. Sizing follows the Figma avatar spec (sm/md/lg).
const SIZE_CLASS = {
  sm: 'h-6 w-6 admin-label-sm',
  md: 'h-9 w-9 admin-label',
  lg: 'h-12 w-12 admin-heading-3',
} as const

function initialsOf(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  // Korean names: first character (성) is the conventional avatar initial.
  // Latin names: first letters of up to two words (e.g. "Jane Kim" → "JK").
  if (/^[가-힣]/.test(trimmed)) return trimmed[0]
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

export function Avatar({
  name,
  size = 'md',
  online,
}: {
  name: string
  size?: keyof typeof SIZE_CLASS
  online?: boolean
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={`inline-flex items-center justify-center rounded-full bg-primary-100 font-medium text-primary-700 ${SIZE_CLASS[size]}`}
        aria-hidden="true"
      >
        {initialsOf(name)}
      </span>
      <span className="sr-only">{name}</span>
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 h-2 w-2 rounded-full ring-2 ring-neutral-0 ${
            online ? 'bg-success' : 'bg-neutral-300'
          }`}
          aria-hidden="true"
        />
      )}
    </span>
  )
}
