// Design Ref: lib/supplier/session.ts (the pattern this file mirrors exactly) —
// docs/02-design/features/seepn-buyer-web-p5a.screen-spec.md §1.3 "자기 buyer_account 행
// 재조회(requireBuyerSession, 동일 구조) — 행 없음/withdrawn/suspended는 즉시 /seepn/login으로
// 리다이렉트". middleware.ts only checks "is there a session at all" (mirrors guardSupplier);
// this is the deeper business-rule gate, re-run on every request, independent of whatever the
// middleware already decided.
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getBuyerAuthServerClient, getBuyerUser } from '@/lib/supabase/buyerServerAuthClient'
import type { BuyerAccount } from './types'

export interface BuyerSession {
  supabase: SupabaseClient
  userId: string
  email: string | null
  emailConfirmedAt: string | null
  account: BuyerAccount
}

// Server Component-only: redirects (never returns null) when the session is missing or the
// account row isn't in a usable state.
export async function requireBuyerSession(): Promise<BuyerSession> {
  const authClient = await getBuyerAuthServerClient()
  if (!authClient) redirect('/seepn/login')
  const { supabase, accessToken } = authClient

  const user = await getBuyerUser(supabase, accessToken)
  if (!user) redirect('/seepn/login')

  const { data: account } = await supabase
    .from('buyer_account')
    .select('id, display_name, status')
    .maybeSingle<BuyerAccount>()

  // Theoretically unreachable (finalize_buyer_signup always creates this row in the same
  // transaction as the auth user) — but an admin/partner session that wandered into /seepn has
  // no buyer_account row at all, which is exactly how the natural cross-principal block
  // property (screen-spec §1.3) is supposed to work.
  if (!account) redirect('/seepn/login')

  if (account.status === 'withdrawn' || account.status === 'suspended') {
    redirect('/seepn/login')
  }

  return {
    supabase,
    userId: user.id,
    email: user.email ?? null,
    emailConfirmedAt: (user as unknown as { email_confirmed_at?: string | null }).email_confirmed_at ?? null,
    account,
  }
}
