// Design Ref: docs/03-security/partner-supplier-app-ui-privacy-review.md §1.1
// (UI-B1) "구현 절차" — the numbered steps below are that section's steps 1-5,
// implemented in that exact order (order IS the safety mechanism per that
// section's own framing: "순서가 곧 안전장치").
//
// Step 1 runs with the CALLER'S OWN session (authClient) so partner_withdraw's
// ownership check (private.owns_partner) is the real authorization boundary.
// Steps 2-5 run with the service_role client because they need the Auth Admin
// API (auth.admin.*), which is not reachable from SQL/RLS at all.
import { NextResponse } from 'next/server'
// NOTE (frontend-developer, 2026-09-04): switched from the /admin server client to the
// /supplier-scoped one — see the identical note in app/api/partner/documents/route.ts for why
// (screen-spec §1.4 cookie-namespace separation; the admin client would never see a partner's
// session cookie).
import { getSupplierAuthServerClient } from '@/lib/supabase/supplierServerAuthClient'
import { getSupabaseAdminClient } from '@/lib/supabase/adminClient'

// Effectively-permanent ban (~100 years) used only as the step-5 compensating
// control when steps 3/4 fail after step 1 already committed — see below.
const COMPENSATING_BAN_DURATION = '876000h'

export async function POST() {
  const authClient = await getSupplierAuthServerClient()
  if (!authClient) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })

  const {
    data: { user },
  } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Resolve the caller's own ids server-side — never trust a client-supplied
  // partnerId/accountId for this (same principle as UI-B4's route).
  const { data: ids, error: idsError } = await authClient.rpc('get_own_partner_id').single()
  if (idsError || !ids) {
    return NextResponse.json({ error: 'access_denied' }, { status: 403 })
  }
  const { partner_account_id: accountId, partner_id: partnerId } = ids as {
    partner_account_id: string | null
    partner_id: string | null
  }
  if (!accountId || !partnerId) {
    return NextResponse.json({ error: 'access_denied' }, { status: 403 })
  }

  // Step 1: rpc('partner_withdraw', { p_partner_id }) — user-scoped client, no
  // change from the RPC's existing contract.
  const { error: withdrawError } = await authClient.rpc('partner_withdraw', { p_partner_id: partnerId })
  if (withdrawError) {
    return NextResponse.json({ error: withdrawError.message ?? 'withdraw_failed' }, { status: 400 })
  }

  // From here on, step 1 has already committed: the account is withdrawn in
  // the DB regardless of what happens below. Everything past this point is
  // auth-layer cleanup — failures here must never be reported back to the
  // user as "탈퇴 실패" (that would be false; the withdrawal itself succeeded),
  // but they also must not be silently swallowed (§1.1 step 5: "실패했지만
  // 사용자에겐 탈퇴 완료로 보이는 상태를 방치하지 말 것" — logged for manual follow-up
  // instead, since this repo has no dedicated retry-queue table yet).
  const adminClient = getSupabaseAdminClient()
  if (!adminClient) {
    console.error(
      `partner.withdraw: step1 committed for partner_account=${accountId} but the service_role ` +
        'client is unavailable — auth cleanup (signOut/detach/deleteUser) never ran, manual retry needed',
    )
    return NextResponse.json({ success: true, authCleanup: 'pending' })
  }

  // Step 2: invalidate every existing session immediately (PR-9 step 3).
  const { error: signOutError } = await adminClient.auth.admin.signOut(user.id, 'global')
  if (signOutError) {
    console.error(`partner.withdraw: auth.admin.signOut failed for auth_user=${user.id}: ${signOutError.message}`)
    // Not fatal on its own — steps 3/4 below still make the account
    // unusable even if a stale session lingers briefly; continue.
  }

  // Steps 3+4: detach the auth_principal link, then hard-delete the auth.users
  // row. Both must succeed, or fall through to the step-5 compensating control.
  let authCleanupFailed = false

  const { error: detachError } = await adminClient.rpc('partner_detach_auth_principal', {
    p_account_id: accountId,
  })
  if (detachError) {
    authCleanupFailed = true
    console.error(
      `partner.withdraw: partner_detach_auth_principal failed for partner_account=${accountId} ` +
        `auth_user=${user.id}: ${detachError.message}`,
    )
  } else {
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
    if (deleteError) {
      authCleanupFailed = true
      console.error(
        `partner.withdraw: auth.admin.deleteUser failed for auth_user=${user.id} ` +
          `(already detached from partner_account=${accountId}): ${deleteError.message}`,
      )
    }
  }

  if (authCleanupFailed) {
    // Step 5 compensating control: ban the account so it is unusable even
    // though detach/delete did not fully complete.
    const { error: banError } = await adminClient.auth.admin.updateUserById(user.id, {
      ban_duration: COMPENSATING_BAN_DURATION,
    })
    if (banError) {
      console.error(
        `partner.withdraw: compensating ban ALSO failed for auth_user=${user.id}: ${banError.message} ` +
          '— manual Supabase console intervention required',
      )
    }
    return NextResponse.json({ success: true, authCleanup: 'failed_compensated' })
  }

  return NextResponse.json({ success: true })
}
