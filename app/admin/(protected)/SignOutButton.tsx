'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { signOutAction } from '@/lib/supabase/adminAuthActions'

export function SignOutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    await signOutAction()
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className="shrink-0 rounded-input border border-white/15 px-3 py-1.5 admin-label-sm text-sidebar-textInactive transition-colors hover:bg-white/5 hover:text-neutral-0 disabled:cursor-not-allowed disabled:opacity-50"
    >
      로그아웃
    </button>
  )
}
