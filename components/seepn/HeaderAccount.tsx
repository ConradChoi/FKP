'use client'

// The shared header is rendered on statically cached pages (home, partner list) that must not
// read cookies server-side (privacy review BP-15 — same reason PartnerListClient checks the session
// in the browser), so the logged-in state is resolved here on the client. While the check runs, an
// invisible placeholder of the button's size is rendered so the header does not flash "로그인".
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'
import { AccountMenu } from '@/components/seepn/AccountMenu'

type State = { kind: 'loading' } | { kind: 'anon' } | { kind: 'user'; displayName: string }

export function HeaderAccount() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    async function run() {
      const supabase = getBuyerBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setState({ kind: 'anon' })
        return
      }
      const { data: account } = await supabase.from('buyer_account').select('display_name, status').maybeSingle<{ display_name: string; status: string }>()
      if (cancelled) return
      // A session without a buyer_account row (e.g. an admin/partner login on this browser) is
      // not a buyer login — keep showing 로그인.
      setState(account && account.status === 'active' ? { kind: 'user', displayName: account.display_name } : { kind: 'anon' })
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  if (state.kind === 'loading') return <span aria-hidden="true" className="inline-block h-9 w-[76px]" />
  if (state.kind === 'anon') {
    return (
      <Link href="/seepn/login" className="rounded-full bg-primary-600 px-4 py-2 text-body-sm font-semibold text-white hover:bg-primary-700">
        로그인
      </Link>
    )
  }
  return (
    <AccountMenu
      displayName={state.displayName}
      triggerClassName="rounded-full bg-primary-600 px-4 py-2 text-body-sm font-semibold text-white hover:bg-primary-700"
    />
  )
}
