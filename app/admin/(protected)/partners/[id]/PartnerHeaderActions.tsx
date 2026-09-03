'use client'

// Design Ref: screen-spec §2.3(검증 큐 액션) + §2.5.3(제출 상태 전이 버튼). 목록 화면의 검증대기
// 탭에서만 노출되던 승인/반려를 상세 화면 헤더에서도 그대로 재사용한다(운영자가 상세를 열어본
// 김에 바로 처리할 수 있어야 하므로) — VerificationRowActions.tsx를 그대로 import.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { VerificationRowActions } from '../VerificationRowActions'
import { adminButtonSecondaryClass } from '@/components/admin/styles'
import { adminSubmitForReviewAction } from './actions'

export function PartnerHeaderActions({
  partnerId,
  verificationState,
  intakeSource,
}: {
  partnerId: string
  verificationState: string
  intakeSource: string
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const isPendingReview = verificationState === 'submitted' || verificationState === 'under_review'
  const canAdminSubmit = (verificationState === 'draft' || verificationState === 'rejected') && intakeSource === 'admin_entry'
  const isSelfServiceUnsubmitted = (verificationState === 'draft' || verificationState === 'rejected') && intakeSource === 'self_service'

  async function handleSubmit() {
    setSubmitting(true)
    setMessage(null)
    const result = await adminSubmitForReviewAction(partnerId)
    setSubmitting(false)
    if (!result.success) {
      setMessage(
        result.errorCode === 'PROFILE_INCOMPLETE'
          ? '입력이 완료되지 않았습니다 — 아래 "기본정보" 탭의 제출 체크리스트를 확인하세요.'
          : '검증 제출에 실패했습니다.',
      )
      return
    }
    router.refresh()
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {isPendingReview && <VerificationRowActions partnerId={partnerId} />}
      {canAdminSubmit && (
        <button type="button" onClick={handleSubmit} disabled={submitting} className={adminButtonSecondaryClass}>
          {submitting ? '제출 중...' : '검증 제출'}
        </button>
      )}
      {isSelfServiceUnsubmitted && (
        <span className="admin-body-sm text-neutral-400">제출은 파트너 본인의 액션입니다 — 관리자는 읽기전용으로 지원합니다.</span>
      )}
      {message && <span className="admin-body-sm text-accent-700">{message}</span>}
    </div>
  )
}
