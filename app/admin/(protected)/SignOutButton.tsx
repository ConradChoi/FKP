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
      className="shrink-0 rounded-input border border-neutral-200 px-3 py-1.5 admin-label-sm text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
    >
      로그아웃
    </button>
  )
}
