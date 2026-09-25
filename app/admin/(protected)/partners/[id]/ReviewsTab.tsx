'use client'

// 공급사 리뷰 관리 (2026-09-25): 리뷰는 작성 즉시 노출되고, 운영자가 여기서 부적절한 리뷰를 숨긴다.
// 작성자는 마스킹된 표시명으로만 보인다(admin_list_partner_reviews). 숨김/해제는 RPC가 행과
// partner_review_moderation_log(append-only)에 남긴다. 데이터: RPC admin_list_partner_reviews.
import { useState } from 'react'
import { adminInputClass } from '@/components/admin/styles'
import { setPartnerReviewHiddenAction } from './actions'

export interface AdminReviewRecord {
  id: string
  reviewer_masked: string | null
  rating_quality: number
  rating_price: number
  rating_lead_time: number
  rating_service: number
  body: string | null
  status: 'published' | 'hidden'
  hidden_at: string | null
  hidden_reason: string | null
  created_at: string
}

export function ReviewsTab({ partnerId, reviews: initialReviews, canUpdate }: { partnerId: string; reviews: AdminReviewRecord[]; canUpdate: boolean }) {
  const [reviews, setReviews] = useState(initialReviews)
  const [hidingId, setHidingId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function setHidden(id: string, hidden: boolean) {
    setBusyId(id)
    setError(null)
    const result = await setPartnerReviewHiddenAction(id, hidden, hidden ? reason : '', partnerId)
    setBusyId(null)
    if (!result.success) {
      setError('처리하지 못했습니다. 권한을 확인하거나 잠시 후 다시 시도해주세요.')
      return
    }
    setReviews((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status: hidden ? 'hidden' : 'published', hidden_at: hidden ? new Date().toISOString() : null, hidden_reason: hidden ? reason.trim() || null : null }
          : r,
      ),
    )
    setHidingId(null)
    setReason('')
  }

  return (
    <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
      <h2 className="admin-heading-3 text-neutral-900">리뷰 관리</h2>
      <p className="mt-1 admin-label-sm text-neutral-400">
        리뷰는 작성 즉시 회원에게 노출됩니다. 명예훼손·개인정보 노출 등 부적절한 리뷰는 숨김 처리하세요. 작성자는 마스킹된 이름으로만 표시되며, 공급사에는 작성자가 공개되지 않습니다(평균 점수와 건수는 목록에 공개됩니다). 숨김 처리한 (공급사, 작성자) 조합은 작성자가 삭제 후 다시 써도 숨김이 유지됩니다.
      </p>
      {error && <p className="mt-2 admin-body-sm text-error">{error}</p>}

      <ul className="mt-4 space-y-3">
        {reviews.map((r) => (
          <li key={r.id} className={`rounded-input border p-4 ${r.status === 'hidden' ? 'border-neutral-200 bg-neutral-50' : 'border-neutral-200'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="admin-body-sm font-medium text-neutral-800">
                {r.reviewer_masked ?? '회원'}{' '}
                <span className="admin-label-sm font-normal text-neutral-400">{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
              </span>
              <span className={`rounded-sm px-2 py-0.5 admin-label-sm ${r.status === 'hidden' ? 'bg-neutral-200 text-neutral-600' : 'bg-secondary-50 text-secondary-700'}`}>
                {r.status === 'hidden' ? '숨김' : '노출 중'}
              </span>
            </div>
            <p className="mt-2 admin-body-sm text-neutral-600">
              품질 {r.rating_quality} · 가격 {r.rating_price} · 납기 {r.rating_lead_time} · 서비스 {r.rating_service}
            </p>
            {r.body && <p className="mt-2 whitespace-pre-wrap admin-body-sm text-neutral-800">{r.body}</p>}
            {r.status === 'hidden' && r.hidden_reason && <p className="mt-2 admin-label-sm text-neutral-500">숨김 사유: {r.hidden_reason}</p>}

            {canUpdate && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {r.status === 'hidden' ? (
                  <button type="button" disabled={busyId === r.id} onClick={() => setHidden(r.id, false)} className="admin-body-sm text-primary-600 hover:underline">
                    숨김 해제
                  </button>
                ) : hidingId === r.id ? (
                  <>
                    <input
                      className={`${adminInputClass} w-72`}
                      placeholder="숨김 사유 (선택, 200자 이내)"
                      maxLength={200}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <button type="button" disabled={busyId === r.id} onClick={() => setHidden(r.id, true)} className="admin-body-sm text-error hover:underline">
                      {busyId === r.id ? '처리 중...' : '숨김 확인'}
                    </button>
                    <button type="button" onClick={() => setHidingId(null)} className="admin-body-sm text-neutral-500 hover:underline">
                      취소
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => { setHidingId(r.id); setReason('') }} className="admin-body-sm text-error hover:underline">
                    숨기기
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
        {reviews.length === 0 && <p className="admin-body-sm text-neutral-400">등록된 리뷰가 없습니다.</p>}
      </ul>
    </section>
  )
}
