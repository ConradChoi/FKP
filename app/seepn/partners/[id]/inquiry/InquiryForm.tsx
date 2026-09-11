'use client'

// Design Ref: screen-spec(P5a) §7.2 (BY-11) + §7.4 (create_seepn_inquiry contract, revised
// 2026-09-10 GAP-C1: {p_partner_ids: uuid[1..5], p_body} — the single-partner inquiry page
// (app/seepn/partners/[id]/inquiry/page.tsx) passes a 1-element array, reproducing the original
// P5a behaviour) + privacy review §5.3(c)/(g) — the exact warning caption from CapabilityForm.tsx
// L316 is reused verbatim ("같은 위험에 다른 문구를 쓰지 않는다"), the rate_limited error message
// never reveals the numeric threshold or remaining wait time.
//
// docs/02-design/features/seepn-buyer-web-p5b.screen-spec.md §6 (BY-15, "BY-11 일반화"):
// generalized `partnerId: string` -> `partnerIds: string[]` so BY-14(비교표)의 "선택한 N곳에
// 대해 운영자에게 문의하기"가 이 컴포넌트를 그대로 재사용할 수 있게 했다(신규 컴포넌트 아님).
// EDGE-C9(정정판, 2026-09-10 실제 구현 기준): create_seepn_inquiry는 부분 접수를 하지 않는다 —
// 참조 파트너 중 하나라도 게이트를 통과 못 하면 partner_not_found로 전건 거절한다. 이 폼은 그
// 실패를 받아도 절대 body를 리셋하지 않는다(아래 handleSubmit에 setBody('') 호출이 없는 것이
// 그 자체로 요건 충족 — 재제출 시 다시 타이핑하지 않아도 됨).
import { useState } from 'react'
import Link from 'next/link'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'
import { primaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'
import { CheckCircleIcon } from '@/components/icons/SeepnIcons'

const MIN_LENGTH = 20
const MAX_LENGTH = 2000

// create_seepn_inquiry (20260910180000, GAP-C1) can raise these codes in addition to the
// P5a-era ones below. invalid_partner_count/duplicate_partner_ids are unreachable from the
// single-partner BY-11 page (it always submits a 1-element array with no duplicates) but ARE
// reachable from BY-15's multi-partner path if the referenced set is ever malformed upstream.
function errorMessage(code: string | undefined, partnerCount: number): string {
  switch (code) {
    case 'invalid_body_length':
      return `문의 내용은 ${MIN_LENGTH}자 이상 ${MAX_LENGTH}자 이하로 입력해주세요.`
    case 'invalid_partner_count':
      return '참조 파트너는 1곳 이상 5곳 이하만 가능합니다.'
    case 'duplicate_partner_ids':
      return '참조 파트너 목록에 중복된 항목이 있습니다. 비교표로 돌아가 다시 선택해주세요.'
    case 'partner_not_found':
      // EDGE-C9 (정정판): 부분 접수 없음 — 참조 파트너 중 하나라도 무효면 전건 거절. 어느 id가
      // 무효인지는 알리지 않는다(기존 non-leaking 원칙 유지, §6.4).
      return partnerCount > 1
        ? '참조하신 파트너 중 일부가 더 이상 공개되어 있지 않습니다. 비교표로 돌아가 다시 선택해주세요.'
        : '더 이상 존재하지 않는 파트너입니다.'
    case 'rate_limited':
      return '문의를 너무 많이 보내셨습니다. 잠시 후 다시 시도해주세요.'
    case 'access_denied':
      return '로그인이 필요합니다. 다시 로그인해주세요.'
    default:
      return '문의 접수 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
  }
}

export function InquiryForm({
  partnerIds,
  replyEmail,
  compareHref,
}: {
  partnerIds: string[]
  replyEmail: string
  // BY-15 only: 참조 파트너가 여러 건일 때 partner_not_found 에러 안내에서 비교표로 돌아갈 수
  // 있는 링크를 함께 보여주기 위함. BY-11(단건)에서는 넘기지 않는다.
  compareHref?: string
}) {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setErrorCode(undefined)

    const trimmed = body.trim()
    if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) {
      setError(errorMessage('invalid_body_length', partnerIds.length))
      return
    }

    setSubmitting(true)
    const supabase = getBuyerBrowserClient()
    const { error: rpcError } = await supabase.rpc('create_seepn_inquiry', {
      p_partner_ids: partnerIds,
      p_body: trimmed,
    })
    setSubmitting(false)

    if (rpcError) {
      // NOTE(EDGE-C9): body is intentionally left untouched here — no setBody('') on failure —
      // so the buyer never has to retype after a partner_not_found rejection.
      setErrorCode(rpcError.message)
      setError(errorMessage(rpcError.message, partnerIds.length))
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-card border border-neutral-200 bg-neutral-0 p-8 text-center">
        <CheckCircleIcon className="h-10 w-10 text-success" />
        <h2 className="text-h4 text-neutral-900">문의가 접수되었습니다</h2>
        {partnerIds.length > 1 && <p className="text-body-sm text-neutral-500">참조 파트너 {partnerIds.length}곳</p>}
        <p className="text-body-sm text-neutral-600">담당자가 확인 후 {replyEmail}로 회신드립니다.</p>
        <Link href="/seepn/my/inquiries" className="text-body-sm text-primary-600 hover:underline">
          내 문의 내역 보기
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-card border border-neutral-200 bg-neutral-0 p-6">
      <div>
        <label htmlFor="inquiry_body" className="mb-1 block text-body-sm text-neutral-700">
          문의 내용
        </label>
        <textarea
          id="inquiry_body"
          rows={8}
          maxLength={MAX_LENGTH}
          className="w-full rounded-input border border-neutral-300 bg-neutral-0 px-4 py-2.5 text-body text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="문의하시는 내용을 자유롭게 작성해주세요."
        />
        <p className="mt-1 text-label-caption text-neutral-400">
          {body.trim().length}/{MAX_LENGTH}자 (최소 {MIN_LENGTH}자) · 타인의 개인정보나 비밀유지 대상 정보를 입력하지 마세요.
        </p>
      </div>

      <p className="text-label-caption text-neutral-500">회신은 {replyEmail}로 드립니다.</p>

      {error && (
        <div>
          <p className={errorTextClass}>{error}</p>
          {errorCode === 'partner_not_found' && partnerIds.length > 1 && compareHref && (
            <Link href={compareHref} className="mt-1 inline-block text-label-caption text-primary-600 hover:underline">
              비교표로 돌아가기
            </Link>
          )}
        </div>
      )}

      <button type="submit" disabled={submitting} className={`${primaryButtonClass} w-full`}>
        {submitting ? '전송 중...' : '문의 보내기'}
      </button>
    </form>
  )
}
