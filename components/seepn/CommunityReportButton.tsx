'use client'

// 게시글/댓글 신고. 같은 회원의 같은 대상 중복 신고는 서버에서 무시된다(unique).
import { useState } from 'react'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'
import { REPORT_REASONS, communityErrorMessage } from '@/lib/seepn/community'

export function CommunityReportButton({ targetType, targetId }: { targetType: 'post' | 'comment'; targetId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string>(REPORT_REASONS[0].code)
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit() {
    setBusy(true)
    setMessage(null)
    const { error } = await getBuyerBrowserClient().rpc('community_report', { p_target_type: targetType, p_target_id: targetId, p_reason: reason, p_detail: detail.trim() || null })
    setBusy(false)
    if (error) {
      setMessage({ ok: false, text: communityErrorMessage(error.message) })
      return
    }
    setMessage({ ok: true, text: '신고가 접수되었습니다. 운영자가 검토합니다.' })
    setOpen(false)
  }

  if (message?.ok) return <span className="text-label-caption text-neutral-500">{message.text}</span>
  return (
    <span className="inline-block">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-label-caption text-neutral-400 hover:text-error hover:underline">
        신고
      </button>
      {open && (
        <span className="mt-2 block space-y-2 rounded-input border border-neutral-200 bg-white p-3 text-body-sm">
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-input border border-neutral-200 px-2 py-1.5 text-body-sm">
            {REPORT_REASONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
          <input value={detail} maxLength={300} onChange={(e) => setDetail(e.target.value)} placeholder="상세 사유 (선택)" className="w-full rounded-input border border-neutral-200 px-2 py-1.5 text-body-sm" />
          <span className="flex gap-3">
            <button type="button" disabled={busy} onClick={submit} className="text-body-sm font-medium text-error hover:underline">
              {busy ? '접수 중...' : '신고 접수'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-body-sm text-neutral-500 hover:underline">
              취소
            </button>
          </span>
          {message && !message.ok && <span role="alert" className="block text-label-caption text-error">{message.text}</span>}
        </span>
      )}
    </span>
  )
}
