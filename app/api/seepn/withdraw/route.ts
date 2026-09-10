// Design Ref: app/api/partner/withdraw/route.ts (the pattern this mirrors, simplified) +
// supabase/migrations/20260910100000_seepn_buyer_web_p5a.sql's comment on public.buyer_withdraw:
// "The calling server route MUST additionally call supabase.auth.admin.signOut(auth_user_id,
// 'global') right after this returns successfully". Simpler than the partner route: buyer_withdraw
// only sets status='withdrawn' (+ hard-deletes bookmarks / force-closes inquiries) — it does NOT
// detach auth_principal or hard-delete auth.users (buyer_account.auth_user_id has ON DELETE
// RESTRICT, and D-14④'s 12-month-dormant path re-touches this same row later), so there is no
// step-3/4/5 auth-principal-detach/compensating-ban dance here.
import { NextResponse } from 'next/server'
import { getBuyerAuthServerClient, getBuyerUser } from '@/lib/supabase/buyerServerAuthClient'
import { getSupabaseAdminClient } from '@/lib/supabase/adminClient'

export async function POST() {
  const authResult = await getBuyerAuthServerClient()
  if (!authResult) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
  const { supabase: authClient, accessToken } = authResult

  const user = await getBuyerUser(authClient, accessToken)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Step 1: user-scoped RPC — buyer_withdraw()'s own is_active_buyer() check is the real
  // authorization boundary, this route never passes a client-supplied account id.
  const { error: withdrawError } = await authClient.rpc('buyer_withdraw')
  if (withdrawError) {
    return NextResponse.json({ error: withdrawError.message ?? 'withdraw_failed' }, { status: 400 })
  }

  // Step 2: invalidate every existing session immediately — the DB-side status flip alone does
  // not revoke an already-issued access/refresh token pair.
  const adminClient = getSupabaseAdminClient()
  if (!adminClient) {
    console.error(`seepn.buyer.withdraw: step1 committed for auth_user=${user.id} but service_role client is unavailable — signOut never ran`)
    return NextResponse.json({ success: true, authCleanup: 'pending' })
  }

  const { error: signOutError } = await adminClient.auth.admin.signOut(user.id, 'global')
  if (signOutError) {
    console.error(`seepn.buyer.withdraw: auth.admin.signOut failed for auth_user=${user.id}: ${signOutError.message}`)
    return NextResponse.json({ success: true, authCleanup: 'failed' })
  }

  return NextResponse.json({ success: true })
}
