'use client'

// Design Ref: docs/02-design/features/partner-supplier-app.screen-spec.md §4.0 (SUP-08) +
// ui-spec §2.2/§3.6 — the always-on shell (topbar + status banner + tab nav + submission
// checklist + submit-confirmation flow) every SUP-09~13 tab page renders inside.
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { SubmissionGapItem } from '@/lib/admin/partnerSubmissionGaps'
import type { SupplierTabId } from '@/lib/supplier/tabGaps'
import { getSupplierBrowserClient } from '@/lib/supabase/supplierBrowserClient'
import { VERIFICATION_STATE_LABELS } from '@/lib/admin/partnerLabels'
import { AccountMenu } from './AccountMenu'
import { ProfileTabs } from './ProfileTabs'
import { SubmissionChecklist } from './SubmissionChecklist'
import { StatusBanner, verificationStateTone } from './StatusBanner'
import { ConfirmActionModal } from './ConfirmActionModal'
import { DirtyGuardProvider } from './DirtyGuard'
import { SupplierFooter } from './SupplierFooter'

export function SupplierProfileShell({
  displayName,
  verificationState,
  rejectionReason,
  gaps,
  unmetTabs,
  children,
}: {
  displayName: string
  verificationState: string
  rejectionReason: string | null
  gaps: SubmissionGapItem[]
  unmetTabs: SupplierTabId[]
  children: React.ReactNode
}) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const tone = verificationStateTone(verificationState)
  const bannerMessage =
    verificationState === 'verified'
      ? '검증이 완료되었습니다.'
      : verificationState === 'submitted' || verificationState === 'under_review'
        ? '검증 대기 중입니다 — 운영자가 확인 후 결과를 알려드립니다.'
        : verificationState === 'rejected'
          ? `반려되었습니다: ${rejectionReason ?? ''}`
          : `${VERIFICATION_STATE_LABELS[verificationState] ?? '프로필을 작성 중입니다'}`

  const canSubmit = gaps.every((g) => g.satisfied) && (verificationState === 'draft' || verificationState === 'rejected')

  async function handleConfirmSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    const supabase = getSupplierBrowserClient()
    const { error } = await supabase.rpc('partner_submit_for_review')
    setSubmitting(false)
    if (error) {
      setSubmitError('제출에 실패했습니다. 필수 항목을 다시 확인해주세요.')
      return
    }
    setModalOpen(false)
    router.refresh()
  }

  return (
    <DirtyGuardProvider>
      <div className="flex min-h-screen flex-col bg-neutral-50">
        <header className="border-b border-neutral-200 bg-neutral-0 px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Link href="/supplier/profile" className="text-label-button text-primary-700">
              SEEPN Partner
            </Link>
            <AccountMenu displayName={displayName} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
          <StatusBanner tone={tone} message={bannerMessage}>
            {verificationState === 'verified' && (
              <Link href="/supplier/profile/settings" className="mt-1 inline-block text-label-caption underline">
                공개설정 바로가기
              </Link>
            )}
            {verificationState === 'rejected' && (
              <p className="mt-1 text-label-caption">수정 후 아래 체크리스트에서 다시 제출할 수 있습니다.</p>
            )}
          </StatusBanner>

          <div className="mt-6">
            <ProfileTabs unmetTabs={unmetTabs} />
          </div>

          <div className="mt-6 flex flex-col gap-8 lg:flex-row">
            <div className="min-w-0 flex-1">{children}</div>
            <SubmissionChecklist gaps={gaps} canSubmit={canSubmit} onSubmitClick={() => setModalOpen(true)} />
          </div>
        </main>

        <SupplierFooter />
      </div>

      <ConfirmActionModal
        open={modalOpen}
        title="제출 확인"
        description="입력하신 정보를 운영자가 검토합니다. 제출 후에도 정보 수정은 가능하지만, 재검증은 새로 요청해야 할 수 있습니다."
        confirmLabel="제출"
        loading={submitting}
        loadingLabel="제출 중..."
        error={submitError}
        onConfirm={handleConfirmSubmit}
        onCancel={() => {
          setModalOpen(false)
          setSubmitError(null)
        }}
      />
    </DirtyGuardProvider>
  )
}
