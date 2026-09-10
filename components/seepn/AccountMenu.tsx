'use client'

// Design Ref: not in the screen-spec's BY-01~12 list explicitly, but a reachable logout/withdraw
// control is required to actually exercise buyer_withdraw() (backend already implemented, PRD
// background note) — kept minimal (dropdown with 로그아웃/탈퇴), no separate settings screen.
// Flagged in the completion report as a deliberate small addition beyond the screen-spec's
// enumerated list, for the same reason app/supplier/profile/settings exists for partners.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'
import { destructiveButtonClass, secondaryButtonClass } from '@/components/RequestForm/styles'

export function AccountMenu({ displayName }: { displayName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)

  async function handleLogout() {
    const supabase = getBuyerBrowserClient()
    await supabase.auth.signOut()
    router.push('/seepn/login')
    router.refresh()
  }

  async function handleWithdraw() {
    setBusy(true)
    setWithdrawError(null)
    let res: Response
    try {
      res = await fetch('/api/seepn/withdraw', { method: 'POST' })
    } catch {
      setBusy(false)
      setWithdrawError('네트워크 오류로 탈퇴 요청에 실패했습니다. 다시 시도해주세요.')
      return
    }
    setBusy(false)
    if (res.ok) {
      const supabase = getBuyerBrowserClient()
      await supabase.auth.signOut()
      router.push('/seepn/login')
      router.refresh()
      return
    }
    setWithdrawError(
      res.status === 401
        ? '로그인이 만료되었습니다. 다시 로그인한 뒤 시도해주세요.'
        : '탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    )
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-neutral-600 hover:underline">
        {displayName}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-40 rounded-card border border-neutral-200 bg-neutral-0 p-2 shadow-lg">
          <button type="button" onClick={handleLogout} className="block w-full rounded-input px-2 py-1.5 text-left text-body-sm text-neutral-700 hover:bg-neutral-50">
            로그아웃
          </button>
          <button
            type="button"
            onClick={() => setConfirmWithdraw(true)}
            className="block w-full rounded-input px-2 py-1.5 text-left text-body-sm text-error hover:bg-error-100"
          >
            탈퇴
          </button>
        </div>
      )}

      {confirmWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4" onClick={() => setConfirmWithdraw(false)}>
          <div className="w-full max-w-sm rounded-card bg-neutral-0 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-h4 text-neutral-900">SEEPN 탈퇴</h3>
            <p className="mt-2 text-body-sm text-neutral-600">
              탈퇴하면 관심등록 목록이 즉시 삭제되고, 진행 중인 문의는 종료 처리됩니다. 계속하시겠습니까?
            </p>
            {withdrawError && <p className="mt-2 text-body-sm text-error">{withdrawError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmWithdraw(false)} className={secondaryButtonClass}>
                취소
              </button>
              <button type="button" disabled={busy} onClick={handleWithdraw} className={destructiveButtonClass}>
                {busy ? '처리 중...' : '탈퇴'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
