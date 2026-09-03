// Design Ref: docs/02-design/features/partner-supplier-app.ui-spec.md §5 — status banner tone
// mapping. Deliberately does NOT reuse lib/admin/partnerLabels.ts's VERIFICATION_STATE_TONE
// as-is: that ui-spec §5 explicitly recommends unifying submitted/under_review to the same
// "info" tone here (they render the identical banner text — "검증 대기 중입니다" — so a color
// difference alone would wrongly imply something got worse), while leaving the Admin badge's
// existing info/warning split untouched (out of this app's scope per that section). A local
// SUPPLIER_VERIFICATION_STATE_TONE map keeps that distinction without touching the shared
// admin constant (ui-spec §10 OD-1: touching the shared constant needs a product-manager call
// this task doesn't have — scoping the divergence locally is the reversible choice).
import { CheckCircleIcon, ClockIcon, PencilIcon, WarningTriangleIcon } from '@/components/icons/SupplierIcons'

export type SupplierBannerTone = 'neutral' | 'info' | 'success' | 'error'

const TONE_CLASS: Record<SupplierBannerTone, string> = {
  neutral: 'border-neutral-300 bg-neutral-50 text-neutral-700',
  info: 'border-primary-500 bg-primary-50 text-primary-700',
  success: 'border-success bg-success-100 text-success',
  error: 'border-error bg-error-100 text-error',
}

const TONE_ICON: Record<SupplierBannerTone, React.ComponentType<{ className?: string }>> = {
  neutral: PencilIcon,
  info: ClockIcon,
  success: CheckCircleIcon,
  error: WarningTriangleIcon,
}

export function verificationStateTone(state: string | null): SupplierBannerTone {
  switch (state) {
    case 'submitted':
    case 'under_review':
      return 'info'
    case 'verified':
      return 'success'
    case 'rejected':
      return 'error'
    default:
      return 'neutral'
  }
}

export function StatusBanner({
  tone,
  message,
  children,
}: {
  tone: SupplierBannerTone
  message: string
  children?: React.ReactNode
}) {
  const Icon = TONE_ICON[tone]
  return (
    <div
      className={`flex items-start gap-3 rounded-card border-l-4 px-5 py-4 ${TONE_CLASS[tone]}`}
      aria-live="polite"
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="flex-1">
        <p className="text-body-sm">{message}</p>
        {children}
      </div>
    </div>
  )
}
