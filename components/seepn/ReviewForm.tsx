'use client'

// 공급사 상세 > 리뷰 탭의 작성/수정 폼. 서버(RPC buyer_save_review)가 자격(문의가 운영자 처리
// 단계로 진행된 공급사), 별점 범위, 본문 길이를 검증한다. 수집·공개 범위 고지는 이 폼이 유일한
// 고지 지점이므로 문구를 빼지 말 것.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'
import { RATING_DIMENSIONS, REVIEW_BODY_MAX, type RatingDimensionKey } from '@/lib/seepn/reviews'

export interface MyReview {
  ratings: Record<RatingDimensionKey, number>
  body: string | null
  status: 'published' | 'hidden'
}

const EMPTY: Record<RatingDimensionKey, number> = { quality: 0, price: 0, leadTime: 0, service: 0 }

export function ReviewForm({ partnerId, eligible, initial }: { partnerId: string; eligible: boolean; initial: MyReview | null }) {
  const router = useRouter()
  const [ratings, setRatings] = useState<Record<RatingDimensionKey, number>>(initial?.ratings ?? EMPTY)
  const [body, setBody] = useState(initial?.body ?? '')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  if (!eligible && !initial) {
    return (
      <p className="rounded-card border border-dashed border-neutral-200 bg-white p-4 text-body-sm text-neutral-500">
        문의가 운영자 검토 단계(처리중·완료)로 진행된 공급사에 대해서만 리뷰를 작성할 수 있습니다.
      </p>
    )
  }

  const complete = RATING_DIMENSIONS.every((d) => ratings[d.key] >= 1)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!complete) return
    setBusy(true)
    setError(null)
    setDone(null)
    const { error: rpcError } = await getBuyerBrowserClient().rpc('buyer_save_review', {
      p_partner_id: partnerId,
      p_rating_quality: ratings.quality,
      p_rating_price: ratings.price,
      p_rating_lead_time: ratings.leadTime,
      p_rating_service: ratings.service,
      p_body: body.trim() || null,
    })
    setBusy(false)
    if (rpcError) {
      const m = rpcError.message
      setError(
        m.includes('not_eligible')
          ? '문의가 운영자 검토 단계로 진행된 공급사에 대해서만 작성할 수 있습니다.'
          : m.includes('body_too_long')
            ? `리뷰 내용은 ${REVIEW_BODY_MAX}자 이하로 입력해주세요.`
            : m.includes('partner_not_available')
              ? '현재 공개되지 않은 공급사입니다.'
              : '저장하지 못했습니다. 잠시 후 다시 시도해주세요.',
      )
      return
    }
    setDone(initial ? '리뷰가 수정되었습니다.' : '리뷰가 등록되었습니다.')
    router.refresh()
  }

  async function remove() {
    setBusy(true)
    setError(null)
    const { error: rpcError } = await getBuyerBrowserClient().rpc('buyer_delete_review', { p_partner_id: partnerId })
    setBusy(false)
    if (rpcError) {
      setError('삭제하지 못했습니다. 잠시 후 다시 시도해주세요.')
      return
    }
    setRatings(EMPTY)
    setBody('')
    setConfirmDelete(false)
    setDone('리뷰가 삭제되었습니다.')
    router.refresh()
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-card border border-neutral-200 bg-white p-5">
      <p className="text-body-sm font-semibold text-neutral-900">{initial ? '내 리뷰 수정' : '리뷰 작성'}</p>
      {initial?.status === 'hidden' && (
        <p className="rounded-input bg-accent-100 px-3 py-2 text-label-caption text-accent-700">운영자에 의해 숨김 처리된 리뷰입니다. 수정하거나 삭제 후 다시 작성해도 다른 회원에게는 노출되지 않습니다.</p>
      )}
      <div className="space-y-2">
        {RATING_DIMENSIONS.map((d) => (
          <div key={d.key} className="flex items-center gap-3">
            <span className="w-14 text-body-sm text-neutral-700">{d.label}</span>
            <div className="flex gap-1" role="radiogroup" aria-label={`${d.label} 별점`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={ratings[d.key] === n}
                  aria-label={`${n}점`}
                  onClick={() => setRatings((prev) => ({ ...prev, [d.key]: n }))}
                  className={`text-[22px] leading-none ${n <= ratings[d.key] ? 'text-accent-600' : 'text-neutral-300 hover:text-accent-500'}`}
                >
                  ★
                </button>
              ))}
            </div>
            <span className="text-label-caption text-neutral-400">{ratings[d.key] ? `${ratings[d.key]}점` : '선택'}</span>
          </div>
        ))}
      </div>
      <label className="block text-body-sm text-neutral-700">
        리뷰 내용 (선택)
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, REVIEW_BODY_MAX))}
          rows={4}
          className="mt-1.5 w-full rounded-input border border-neutral-200 px-3 py-2 text-body-sm focus:border-primary-500 focus:outline-none"
          placeholder="공급사와 진행한 경험을 남겨주세요."
        />
      </label>
      <p className="text-label-caption text-neutral-400">
        작성한 리뷰는 작성자 표시 없이 다른 회원에게 공개되며, 공급사에는 작성자가 공개되지 않습니다. 이름·연락처 등 개인정보나 타인의 비밀정보는
        입력하지 마세요. 부적절한 내용은 운영자가 숨길 수 있고, 리뷰는 언제든 수정·삭제할 수 있으며 직접 탈퇴하시면 삭제됩니다.
        <span className="float-right">
          {body.length}/{REVIEW_BODY_MAX}
        </span>
      </p>
      {error && (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-body-sm text-success">
          {done}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy || !complete} className="rounded-input bg-primary-600 px-5 py-2 text-body-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
          {busy ? '저장 중...' : initial ? '수정' : '등록'}
        </button>
        {initial &&
          (confirmDelete ? (
            <>
              <button type="button" disabled={busy} onClick={remove} className="text-body-sm text-error hover:underline">
                삭제 확인
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="text-body-sm text-neutral-500 hover:underline">
                취소
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="text-body-sm text-neutral-500 hover:text-error hover:underline">
              삭제
            </button>
          ))}
      </div>
    </form>
  )
}
