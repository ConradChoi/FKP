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
import { WITHDRAW_REASON_CODES, WITHDRAW_REASON_TEXT_MAX } from '@/lib/seepn/withdrawReasons'

export async function POST(request: Request) {
  const authResult = await getBuyerAuthServerClient()
  if (!authResult) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
  const { supabase: authClient, accessToken } = authResult

  const user = await getBuyerUser(authClient, accessToken)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // The withdrawal reason is OPTIONAL feedback and must never gate the withdrawal itself
  // (개인정보보호법 제38조 — exercising the right must not be harder than the collection). An
  // unknown/missing code or empty text simply means "no feedback row"; nothing is rejected here.
  const body = (await request.json().catch(() => null)) as { reasonCode?: unknown; reasonText?: unknown } | null
  const rawCode = typeof body?.reasonCode === 'string' ? body.reasonCode : ''
  const rawText = typeof body?.reasonText === 'string' ? body.reasonText.trim().slice(0, WITHDRAW_REASON_TEXT_MAX) : ''
  const feedback = WITHDRAW_REASON_CODES.includes(rawCode) ? { reason_code: rawCode, reason_text: rawText || null } : null

  // Step 1: user-scoped RPC — buyer_withdraw()'s own is_active_buyer() check is the real
  // authorization boundary, this route never passes a client-supplied account id.
  const { error: withdrawError } = await authClient.rpc('buyer_withdraw')
  if (withdrawError) {
    console.error(`seepn.buyer.withdraw: buyer_withdraw failed for auth_user=${user.id}: ${withdrawError.message}`)
    return NextResponse.json({ error: 'withdraw_failed' }, { status: 400 })
  }

  // Step 2: invalidate every existing session immediately — the DB-side status flip alone does
  // not revoke an already-issued access/refresh token pair.
  const adminClient = getSupabaseAdminClient()

  // Feedback row (no account link and only a month-level timestamp — see 20260924100000/110000). Best effort: the withdrawal
  // has already committed, so a failure here is logged but never surfaced as a withdraw failure.
  if (adminClient && feedback) {
    const { error: feedbackError } = await adminClient.from('seepn_withdrawal_feedback').insert(feedback)
    if (feedbackError) console.error(`seepn.buyer.withdraw: feedback insert failed: ${feedbackError.message}`)
  }

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
