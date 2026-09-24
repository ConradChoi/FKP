'use client'

// 마이페이지 > 회원 탈퇴: 사유 선택/입력(모두 선택 사항) -> 탈퇴 동의 체크 -> 처리. 사유는 탈퇴의
// 조건이 아니다(개인정보보호법 제38조).
// What actually happens on withdrawal is defined by public.buyer_withdraw() (bookmarks hard-deleted,
// open inquiries force-closed and their body purged) — the notice below must stay in sync with it.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'
import { WITHDRAW_REASONS, WITHDRAW_REASON_TEXT_MAX, type WithdrawReasonCode } from '@/lib/seepn/withdrawReasons'

export function WithdrawForm() {
  const router = useRouter()
  const [reasonCode, setReasonCode] = useState<WithdrawReasonCode | ''>('')
  const [reasonText, setReasonText] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = agreed && !busy

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    let res: Response
    try {
      res = await fetch('/api/seepn/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasonCode: reasonCode || undefined, reasonText: reasonText.trim() }),
      })
    } catch {
      setBusy(false)
      setError('네트워크 오류로 탈퇴 요청에 실패했습니다. 다시 시도해주세요.')
      return
    }
    if (res.ok) {
      await getBuyerBrowserClient().auth.signOut()
      router.push('/seepn/home')
      router.refresh()
      return
    }
    setBusy(false)
    setError(
      res.status === 401
        ? '로그인이 만료되었습니다. 다시 로그인한 뒤 시도해주세요.'
        : '탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-card border border-neutral-200 bg-white p-5 text-body-sm text-neutral-600">
        <p className="font-semibold text-neutral-900">탈퇴 전 확인해주세요</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>관심등록(찜) 목록이 즉시 삭제됩니다.</li>
          <li>진행 중인 문의는 종료 처리되고, 문의 내용은 파기됩니다.</li>
          <li>탈퇴 후에는 같은 계정으로 로그인할 수 없습니다.</li>
        </ul>
      </div>

      <fieldset className="rounded-card border border-neutral-200 bg-white p-5">
        <legend className="px-1 text-body-sm font-semibold text-neutral-900">
          탈퇴 사유 <span className="font-normal text-neutral-400">(선택)</span>
        </legend>
        <div className="mt-2 space-y-2">
          {WITHDRAW_REASONS.map((r) => (
            <label key={r.code} className="flex cursor-pointer items-center gap-2 text-body-sm text-neutral-700">
              <input type="radio" name="reason" value={r.code} checked={reasonCode === r.code} onChange={() => setReasonCode(r.code)} />
              {r.label}
            </label>
          ))}
        </div>
        <label className="mt-4 block text-body-sm text-neutral-700">
          남기실 말씀 (선택)
          <textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value.slice(0, WITHDRAW_REASON_TEXT_MAX))}
            rows={4}
            className="mt-1.5 w-full rounded-input border border-neutral-200 px-3 py-2 text-body-sm focus:border-primary-500 focus:outline-none"
            placeholder="서비스 개선에 참고하겠습니다."
          />
        </label>
        <p className="mt-1 flex justify-between text-label-caption text-neutral-400">
          <span>이름·연락처 등 개인정보는 입력하지 마세요.</span>
          <span>
            {reasonText.length}/{WITHDRAW_REASON_TEXT_MAX}
          </span>
        </p>
      </fieldset>

      <p className="-mt-3 text-label-caption text-neutral-500">
        수집 안내: 탈퇴 사유(선택 항목과 직접 입력 내용)는 서비스 개선 통계 목적으로만 수집하며, 계정 정보와 분리해 보관합니다. 직접 입력한 내용은 12개월 후
        파기되고, 선택 항목은 통계로만 남습니다. 사유를 입력하지 않으셔도 탈퇴에는 아무런 영향이 없습니다.
      </p>

      <label className="flex cursor-pointer items-start gap-2 rounded-card border border-neutral-200 bg-white p-5 text-body-sm text-neutral-800">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
        위 내용을 모두 확인했으며, SEEPN 회원 탈퇴에 동의합니다.
      </label>

      {error && <p className="text-body-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-input bg-error px-6 py-2.5 text-body-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? '처리 중...' : '회원 탈퇴'}
      </button>
    </form>
  )
}
