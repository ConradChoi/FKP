// Design Ref: app/api/partner/signup/route.ts (the pattern this route replicates, per
// docs/03-security/seepn-buyer-web-p5a-privacy-review.md §5.2 BP-3 — "바이어 가입을 열기 위해
// 'Allow new users to sign up'을 켜지 말 것... 대신 POST /api/seepn/signup 라우트가
// supabase.auth.admin.createUser()(service_role) -> finalize_buyer_signup(...) 순으로 호출하는
// 파트너와 동일한 구조를 쓴다") + §8.3 BP-9 (동의 로케일 = 문서가 실재하는 로케일 — enforced here
// via SEEPN_BUYER_SIGNUP_ENABLED, see lib/legal/buyerConsentVersions.ts's own comment).
import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/adminClient'
import { isRateLimited } from '@/lib/forms/rateLimit'
import { SEEPN_BUYER_SIGNUP_ENABLED } from '@/lib/legal/buyerConsentVersions'

const MIN_PASSWORD_LENGTH = 12
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Same timing-normalization precedent as app/api/partner/signup/route.ts §3.6.1 — pad every
// response to at least this long so the createUser-fails-fast path and the full
// finalize_buyer_signup path are not distinguishable purely by response latency.
const MIN_RESPONSE_MS = 400

interface ConsentInput {
  consent_type: 'terms' | 'privacy' | 'marketing'
  granted: boolean
  document_version?: string
  consent_locale?: string
}

interface SignupBody {
  display_name?: unknown
  email?: unknown
  password?: unknown
  consents?: unknown
  honeypot?: unknown
}

function neutralSuccess(startedAt: number): Promise<NextResponse> {
  const elapsed = Date.now() - startedAt
  const wait = Math.max(MIN_RESPONSE_MS - elapsed, 0)
  return new Promise((resolve) => {
    setTimeout(() => resolve(NextResponse.json({ success: true })), wait)
  })
}

export async function POST(request: Request) {
  const startedAt = Date.now()

  // BP-9 (치명적): the sign-up SCREEN must not be reachable by real users until the ko legal
  // docs exist and this flag is flipped — enforced here, not just by the frontend not linking
  // to /seepn/signup, because this route is the only other door (Supabase Auth public sign-up
  // stays OFF regardless, BP-3).
  if (!SEEPN_BUYER_SIGNUP_ENABLED) {
    return NextResponse.json({ error: 'legal_documents_not_ready' }, { status: 503 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(`seepn-buyer-signup:${ip}`)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: SignupBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  // Honeypot (same precedent as partner signup).
  if (typeof body.honeypot === 'string' && body.honeypot.trim().length > 0) {
    return neutralSuccess(startedAt)
  }

  const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const consentsInput = Array.isArray(body.consents) ? (body.consents as ConsentInput[]) : []

  if (displayName.length < 1 || displayName.length > 100) {
    return NextResponse.json({ error: 'invalid_display_name' }, { status: 400 })
  }
  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: 'invalid_password' }, { status: 400 })
  }

  const hasTerms = consentsInput.some((c) => c?.consent_type === 'terms' && c.granted === true)
  const hasPrivacy = consentsInput.some((c) => c?.consent_type === 'privacy' && c.granted === true)
  if (!hasTerms || !hasPrivacy) {
    return NextResponse.json({ error: 'consent_required' }, { status: 400 })
  }

  // D-14②/BP-7: third_party_share must never be settable at signup — reject at the API layer
  // too (defense in depth; finalize_buyer_signup also rejects it server-side in SQL).
  if (consentsInput.some((c) => c?.consent_type === ('third_party_share' as ConsentInput['consent_type']))) {
    return NextResponse.json({ error: 'third_party_share_not_allowed_at_signup' }, { status: 400 })
  }

  const adminClient = getSupabaseAdminClient()
  if (!adminClient) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })

  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  })

  if (!createError && createdUser?.user) {
    const { error: resendError } = await adminClient.auth.resend({ type: 'signup', email })
    if (resendError) {
      console.error(`seepn.buyer.signup: confirmation email send failed for new user ${createdUser.user.id}: ${resendError.message}`)
    }
  }

  if (createError || !createdUser.user) {
    // EDGE-B1: "email already registered" (including an existing admin/partner-principal
    // collision surfacing the same way) must look identical to success on the wire.
    console.warn(`seepn.buyer.signup: createUser failed for a submitted email (neutral response returned): ${createError?.message}`)
    return neutralSuccess(startedAt)
  }

  const consentsForRpc = consentsInput
    .filter((c) => c && typeof c.consent_type === 'string' && typeof c.granted === 'boolean')
    .map((c) => ({
      consent_type: c.consent_type,
      granted: c.granted,
      document_version: typeof c.document_version === 'string' ? c.document_version : null,
      consent_locale: typeof c.consent_locale === 'string' ? c.consent_locale : 'ko',
    }))

  const { error: finalizeError } = await adminClient.rpc('finalize_buyer_signup', {
    p_auth_user_id: createdUser.user.id,
    p_display_name: displayName,
    p_consents: consentsForRpc,
    p_consent_locale: 'ko',
  })

  if (finalizeError) {
    // EDGE-B2: a genuine server-side failure, not an enumeration risk — clean up the orphan.
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(createdUser.user.id)
    if (cleanupError) {
      console.error(
        `seepn.buyer.signup: finalize_buyer_signup failed (${finalizeError.message}) AND orphan cleanup ` +
          `also failed for auth_user=${createdUser.user.id} — manual Supabase console cleanup needed: ${cleanupError.message}`,
      )
    } else {
      console.error(`seepn.buyer.signup: finalize_buyer_signup failed, orphan auth user cleaned up: ${finalizeError.message}`)
    }
    const elapsed = Date.now() - startedAt
    await new Promise((resolve) => setTimeout(resolve, Math.max(MIN_RESPONSE_MS - elapsed, 0)))
    return NextResponse.json({ error: 'signup_failed' }, { status: 500 })
  }

  return neutralSuccess(startedAt)
}
