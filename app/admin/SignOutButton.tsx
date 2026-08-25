'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { signOutAction } from '@/lib/supabase/adminAuthActions'
import { secondaryButtonClass } from '@/components/RequestForm/styles'

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
    <button type="button" onClick={handleSignOut} disabled={loading} className={secondaryButtonClass}>
      로그아웃
    </button>
  )
}
