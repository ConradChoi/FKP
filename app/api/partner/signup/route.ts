// Design Ref: docs/02-design/features/partner-supplier-app.screen-spec.md §3.4 (request/response
// contract) + §1.3 ("Allow new users to sign up" stays OFF, signup MUST go through this
// service_role route, never a client-side supabase.auth.signUp() call) + §6 EDGE-1/EDGE-2 +
// docs/03-security/partner-supplier-app-ui-privacy-review.md §3.2 (alert-email conditions —
// NOT implemented here, see the note above the createUser branch) and §2.2 point 4 (선택 동의
// 기본값 미체크를 서버도 정상 처리).
import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/adminClient'
import { isRateLimited } from '@/lib/forms/rateLimit'

const MIN_PASSWORD_LENGTH = 12
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// screen-spec §3.6.1 "이유는 그라운드 트루스가 명확하다" precedent — same shape as the
// review's timing-normalization requirement (§3.2 point 4): pad every response to at least
// this long so the createUser-fails-fast path and the full finalize_partner_signup path are
// not distinguishable purely by response latency.
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

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(`partner-signup:${ip}`)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: SignupBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  // Honeypot (screen-spec §3.3, admin login page's website_url precedent): pretend success,
  // create nothing.
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

  const adminClient = getSupabaseAdminClient()
  if (!adminClient) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })

  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  })

  if (createError || !createdUser.user) {
    // EDGE-1/EDGE-4: "email already registered" (or an admin-principal collision surfacing the
    // same way) must look identical to success on the wire — no account-existence oracle.
    // NOT implemented: the "notify the real owner" mail (privacy review §3.2) — that requires
    // four separate anti-abuse conditions (cooldown, admin-principal exclusion, no user-input
    // echo, timing normalization) that are a meaningfully separate piece of work from the
    // signup contract itself; flagged as a follow-up rather than guessed at here.
    console.warn(`partner.signup: createUser failed for a submitted email (neutral response returned): ${createError?.message}`)
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

  const { error: finalizeError } = await adminClient.rpc('finalize_partner_signup', {
    p_auth_user_id: createdUser.user.id,
    p_display_name: displayName,
    p_consents: consentsForRpc,
    p_consent_locale: 'ko',
  })

  if (finalizeError) {
    // EDGE-2: a genuine server-side failure, not an enumeration risk (the auth user only
    // exists because THIS request just created it) — clean up the orphan and report a real
    // error, unlike the neutral-success branch above.
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(createdUser.user.id)
    if (cleanupError) {
      console.error(
        `partner.signup: finalize_partner_signup failed (${finalizeError.message}) AND orphan cleanup ` +
          `also failed for auth_user=${createdUser.user.id} — manual Supabase console cleanup needed: ${cleanupError.message}`,
      )
    } else {
      console.error(`partner.signup: finalize_partner_signup failed, orphan auth user cleaned up: ${finalizeError.message}`)
    }
    const elapsed = Date.now() - startedAt
    await new Promise((resolve) => setTimeout(resolve, Math.max(MIN_RESPONSE_MS - elapsed, 0)))
    return NextResponse.json({ error: 'signup_failed' }, { status: 500 })
  }

  return neutralSuccess(startedAt)
}
