'use client'

// Design Ref: screen-spec §7.2 (BY-11) + §7.4 (create_seepn_inquiry contract: exactly
// {p_partner_id, p_body}) + privacy review §5.3(c)/(g) — the exact warning caption from
// CapabilityForm.tsx L316 is reused verbatim ("같은 위험에 다른 문구를 쓰지 않는다"), the
// rate_limited error message never reveals the numeric threshold or remaining wait time.
import { useState } from 'react'
import Link from 'next/link'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'
import { primaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'
import { CheckCircleIcon } from '@/components/icons/SeepnIcons'

const MIN_LENGTH = 20
const MAX_LENGTH = 2000

function errorMessage(code: string | undefined): string {
  switch (code) {
    case 'invalid_body_length':
      return `문의 내용은 ${MIN_LENGTH}자 이상 ${MAX_LENGTH}자 이하로 입력해주세요.`
    case 'partner_not_found':
      return '더 이상 존재하지 않는 파트너입니다.'
    case 'rate_limited':
      return '문의를 너무 많이 보내셨습니다. 잠시 후 다시 시도해주세요.'
    case 'access_denied':
      return '로그인이 필요합니다. 다시 로그인해주세요.'
    default:
      return '문의 접수 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
  }
}

export function InquiryForm({ partnerId, replyEmail }: { partnerId: string; replyEmail: string }) {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmed = body.trim()
    if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) {
      setError(errorMessage('invalid_body_length'))
      return
    }

    setSubmitting(true)
    const supabase = getBuyerBrowserClient()
    const { error: rpcError } = await supabase.rpc('create_seepn_inquiry', {
      p_partner_id: partnerId,
      p_body: trimmed,
    })
    setSubmitting(false)

    if (rpcError) {
      setError(errorMessage(rpcError.message))
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-card border border-neutral-200 bg-neutral-0 p-8 text-center">
        <CheckCircleIcon className="h-10 w-10 text-success" />
        <h2 className="text-h4 text-neutral-900">문의가 접수되었습니다</h2>
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

      {error && <p className={errorTextClass}>{error}</p>}

      <button type="submit" disabled={submitting} className={`${primaryButtonClass} w-full`}>
        {submitting ? '전송 중...' : '문의 보내기'}
      </button>
    </form>
  )
}
