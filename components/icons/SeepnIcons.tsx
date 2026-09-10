// Design Ref: components/icons/SupplierIcons.tsx — same hand-drawn-SVG convention (no icon
// package, PRD OQ-7), kept as an independent copy per the task's "완전히 새로운 경로/컴포넌트로
// 만들 것(공유 금지)" instruction rather than importing from components/icons/SupplierIcons.tsx.
interface IconProps {
  className?: string
}

const commonProps = {
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
}

export function EyeIcon({ className }: IconProps) {
  return (
    <svg {...commonProps} className={className}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function EyeOffIcon({ className }: IconProps) {
  return (
    <svg {...commonProps} className={className}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.5 17.5 0 0 1-3.4 4.3M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.9-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  )
}

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <svg {...commonProps} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
  )
}

export function WarningTriangleIcon({ className }: IconProps) {
  return (
    <svg {...commonProps} className={className}>
      <path d="M12 3.5l9.5 16.5H2.5L12 3.5z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function EnvelopeIcon({ className }: IconProps) {
  return (
    <svg {...commonProps} className={className}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M3 6.5 12 13l9-6.5" />
    </svg>
  )
}

export function HeartIcon({ className, filled }: IconProps & { filled?: boolean }) {
  return (
    <svg {...commonProps} fill={filled ? 'currentColor' : 'none'} className={className}>
      <path d="M12 20.5s-7.5-4.6-9.8-9.1C.6 8 2.3 4.5 5.8 3.9c2-.4 3.9.5 5 2.1a5.6 5.6 0 0 1 1.2 0c1.1-1.6 3-2.5 5-2.1 3.5.6 5.2 4.1 3.6 7.5-2.3 4.5-9.8 9.1-9.8 9.1z" />
    </svg>
  )
}
