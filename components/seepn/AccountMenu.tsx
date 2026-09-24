'use client'

// Header account dropdown (설정 / 로그아웃). 탈퇴 lives in 마이페이지 > 회원 탈퇴
// (app/seepn/my/withdraw) where the buyer picks a reason and confirms consent — it is
// deliberately not reachable from this quick menu any more.
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'

export function AccountMenu({ displayName, triggerClassName }: { displayName: string; triggerClassName?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    const supabase = getBuyerBrowserClient()
    await supabase.auth.signOut()
    router.push('/seepn/login')
    router.refresh()
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className={triggerClassName ?? 'text-neutral-600 hover:underline'}>
        {displayName}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-40 rounded-card border border-neutral-200 bg-neutral-0 p-2 shadow-lg">
          <Link
            href="/seepn/my/settings"
            onClick={() => setOpen(false)}
            className="block w-full rounded-input px-2 py-1.5 text-left text-body-sm text-neutral-700 hover:bg-neutral-50"
          >
            설정
          </Link>
          <button type="button" onClick={handleLogout} className="block w-full rounded-input px-2 py-1.5 text-left text-body-sm text-neutral-700 hover:bg-neutral-50">
            로그아웃
          </button>
        </div>
      )}
    </div>
  )
}
