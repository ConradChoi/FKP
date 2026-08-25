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
      className="rounded-input border border-neutral-300 px-3 py-1.5 text-label-caption text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      로그아웃
    </button>
  )
}
