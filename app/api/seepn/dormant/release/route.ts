// 휴면 해제: 비밀번호 재입력 + 약관·방침 재동의 + 비밀번호 변경을 모두 마친 뒤에만 계정을 active로
// 되돌린다(2026-09-26 대표 결정). buyer_release_dormant()는 이 라우트에서만 호출한다.
// 순서: 현재 비밀번호 검증 -> 새 비밀번호로 변경 -> 재동의 기록 + 휴면 해제 RPC -> 다른 세션 로그아웃.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getBuyerAuthServerClient, getBuyerUser } from '@/lib/supabase/buyerServerAuthClient'
import { getSupabaseAdminClient } from '@/lib/supabase/adminClient'
import { SEEPN_BUYER_PRIVACY_CONSENT_VERSION, SEEPN_BUYER_TERMS_CONSENT_VERSION } from '@/lib/legal/buyerConsentVersions'

const MIN_PASSWORD_LENGTH = 12

export async function POST(request: Request) {
  const authResult = await getBuyerAuthServerClient()
  if (!authResult) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
  const { supabase: authClient, accessToken } = authResult

  const user = await getBuyerUser(authClient, accessToken)
  if (!user || !user.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as {
    currentPassword?: unknown
    newPassword?: unknown
    acceptTerms?: unknown
    acceptPrivacy?: unknown
  } | null
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''
  if (!currentPassword) return NextResponse.json({ error: 'current_password_required' }, { status: 400 })
  if (body?.acceptTerms !== true || body?.acceptPrivacy !== true) return NextResponse.json({ error: 'consent_required' }, { status: 400 })
  if (newPassword.length < MIN_PASSWORD_LENGTH) return NextResponse.json({ error: 'password_too_short' }, { status: 400 })
  if (newPassword === currentPassword) return NextResponse.json({ error: 'password_same' }, { status: 400 })

  // The account must actually be dormant (the RPC re-checks, this just fails fast before touching the password).
  const { data: account } = await authClient.from('buyer_account').select('status').maybeSingle<{ status: string }>()
  if (account?.status !== 'dormant') return NextResponse.json({ error: 'not_dormant' }, { status: 409 })

  // Verify the current password with a throwaway anon client so this request's session is untouched.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!url || !anonKey) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
  const verifier = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const { error: verifyError } = await verifier.auth.signInWithPassword({ email: user.email, password: currentPassword })
  if (verifyError) {
    return NextResponse.json({ error: verifyError.status === 429 ? 'rate_limited' : 'invalid_current_password' }, { status: verifyError.status === 429 ? 429 : 400 })
  }

  const adminClient = getSupabaseAdminClient()
  if (!adminClient) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })

  const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, { password: newPassword })
  if (updateError) {
    const msg = updateError.message.toLowerCase()
    if (msg.includes('leaked') || msg.includes('breach') || msg.includes('pwned')) return NextResponse.json({ error: 'password_leaked' }, { status: 400 })
    if (msg.includes('different')) return NextResponse.json({ error: 'password_same' }, { status: 400 })
    console.error(`seepn.buyer.dormant_release: password update failed for auth_user=${user.id}: ${updateError.message}`)
    return NextResponse.json({ error: 'password_update_failed' }, { status: 500 })
  }

  // The user's own JWT decides who is released (buyer_release_dormant uses auth.uid()).
  const { error: releaseError } = await authClient.rpc('buyer_release_dormant', {
    p_terms_version: SEEPN_BUYER_TERMS_CONSENT_VERSION,
    p_privacy_version: SEEPN_BUYER_PRIVACY_CONSENT_VERSION,
  })
  if (releaseError) {
    console.error(`seepn.buyer.dormant_release: buyer_release_dormant failed for auth_user=${user.id}: ${releaseError.message}`)
    return NextResponse.json({ error: 'release_failed' }, { status: 500 })
  }

  // Best effort: the password is already changed and the account released.
  if (accessToken) {
    const { error: signOutError } = await adminClient.auth.admin.signOut(accessToken, 'others')
    if (signOutError) console.error(`seepn.buyer.dormant_release: signOut others failed: ${signOutError.message}`)
  }

  return NextResponse.json({ success: true })
}
