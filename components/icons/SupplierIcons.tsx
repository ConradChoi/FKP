// Design Ref: docs/02-design/features/partner-supplier-app.ui-spec.md §9 프론트엔드 구현
// 메모 7 — "외부 아이콘 패키지 추가 금지(PRD OQ-7, GlobeIcon.tsx 컨벤션 계승)". Every icon
// this app needs (eye/eye-off password toggle, status-banner icons, upload dropzone icon)
// hand-drawn here with the same 24 viewBox / stroke=currentColor / strokeWidth 1.75 /
// aria-hidden convention as components/icons/GlobeIcon.tsx.
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

export function ClockIcon({ className }: IconProps) {
  return (
    <svg {...commonProps} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
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

export function PencilIcon({ className }: IconProps) {
  return (
    <svg {...commonProps} className={className}>
      <path d="M4 20l1-4L16 5l3 3L8 19l-4 1z" />
      <path d="M13 7l3 3" />
    </svg>
  )
}

export function UploadCloudIcon({ className }: IconProps) {
  return (
    <svg {...commonProps} className={className}>
      <path d="M7 18a4.5 4.5 0 0 1-1-8.9 5.5 5.5 0 0 1 10.6-2A4.5 4.5 0 0 1 17 18H7z" />
      <path d="M12 20v-7" />
      <path d="M9 15.5 12 12.5 15 15.5" />
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
