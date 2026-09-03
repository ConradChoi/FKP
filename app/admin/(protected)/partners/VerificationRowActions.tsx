'use client'

// Design Ref: screen-spec §2.2.4/§2.3 — "검증대기" 탭에서만 노출되는 [승인]/[반려] 버튼.
// 승인은 확인 모달 없이 즉시 호출(되돌리기는 반려로 가능해 경미), 반려는 사유 필수 모달.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { verifyPartnerAction, rejectPartnerAction } from './actions'
import { adminButtonPrimaryClass, adminButtonSecondaryClass, adminInputClass } from '@/components/admin/styles'

const REASON_PRESETS: { label: string; template: string }[] = [
  { label: '중복 등록', template: '중복 등록 — 이미 등록된 사업자번호와 일치합니다.' },
  { label: '정보 부족', template: '정보 부족 — 제출된 정보만으로는 검증이 어렵습니다.' },
  { label: '자격 미달', template: '자격 미달 — 파트너 등록 기준을 충족하지 않습니다.' },
  { label: '증빙 서류 문제', template: '증빙 서류 문제 — 제출된 서류를 확인할 수 없습니다.' },
  { label: '기타', template: '' },
]

export function VerificationRowActions({ partnerId }: { partnerId: string }) {
  const router = useRouter()
  const [verifying, setVerifying] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleVerify() {
    setVerifying(true)
    setError(null)
    const result = await verifyPartnerAction(partnerId)
    setVerifying(false)
    if (!result.success) {
      setError(result.errorCode === 'STATE_CONFLICT' ? '이미 처리되었거나 상태가 바뀌었습니다. 새로고침 후 다시 시도하세요.' : '승인 실패')
      return
    }
    router.refresh()
  }

  async function handleReject() {
    setRejecting(true)
    setError(null)
    const result = await rejectPartnerAction(partnerId, reason)
    setRejecting(false)
    if (!result.success) {
      setError(result.errorCode === 'STATE_CONFLICT' ? '이미 처리되었거나 상태가 바뀌었습니다. 새로고침 후 다시 시도하세요.' : '반려 실패')
      return
    }
    setRejectOpen(false)
    setReason('')
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={handleVerify} disabled={verifying} className="admin-body-sm text-success hover:underline disabled:opacity-50">
        {verifying ? '처리 중...' : '승인'}
      </button>
      <button type="button" onClick={() => setRejectOpen(true)} className="admin-body-sm text-error hover:underline">
        반려
      </button>
      {error && <span className="admin-label-sm text-error">{error}</span>}

      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4" onClick={() => setRejectOpen(false)}>
          <div className="w-full max-w-md rounded-card bg-neutral-0 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="admin-heading-3 text-neutral-900">반려 사유</h3>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {REASON_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setReason(preset.template)}
                  className="rounded-sm bg-neutral-100 px-2 py-1 admin-label-sm text-neutral-600 hover:bg-neutral-200"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <textarea
              className={`${adminInputClass} mt-2 w-full`}
              rows={4}
              placeholder="상세 사유를 입력하세요 (필수)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setRejectOpen(false)} className={adminButtonSecondaryClass}>
                취소
              </button>
              <button type="button" onClick={handleReject} disabled={rejecting || !reason.trim()} className={adminButtonPrimaryClass}>
                {rejecting ? '처리 중...' : '반려 확정'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
