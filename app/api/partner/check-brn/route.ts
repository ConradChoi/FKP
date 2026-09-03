// Design Ref: docs/03-security/partner-supplier-app-ui-privacy-review.md §6.1
// (UI-B10) + docs/03-security/partner-supplier-app-ceo-decisions.md §2 — "Must,
// not Should" route: this is the ONLY caller check_business_registration_duplicate
// has left after the migration that revoked its `authenticated` GRANT, so this
// route IS the rate limit, not merely a convenience wrapper around one.
import { NextResponse } from 'next/server'
// NOTE (frontend-developer, 2026-09-04): switched from the /admin server client to the
// /supplier-scoped one — see the identical note in app/api/partner/documents/route.ts for why.
import { getSupplierAuthServerClient } from '@/lib/supabase/supplierServerAuthClient'
import { getSupabaseAdminClient } from '@/lib/supabase/adminClient'
import { isRateLimitedWindow } from '@/lib/forms/rateLimit'

const BRN_PATTERN = /^[0-9-]{10,20}$/ // matches public.partner's own CHECK
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000
const MAX_CHECKS_PER_DAY = 10 // privacy review §6.1 point 3: "1일 10회"

export async function POST(request: Request) {
  const authClient = await getSupplierAuthServerClient()
  if (!authClient) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })

  const {
    data: { user },
  } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // SS-5/PR-12: must run after login + email verification. get_own_partner_id
  // itself already gates on private.is_active_partner (email-confirmed +
  // status='active'), so an empty result here already covers that requirement.
  const { data: ids, error: idsError } = await authClient.rpc('get_own_partner_id').single()
  if (idsError || !ids) return NextResponse.json({ error: 'access_denied' }, { status: 403 })
  const accountId = (ids as { partner_account_id: string | null }).partner_account_id
  if (!accountId) return NextResponse.json({ error: 'access_denied' }, { status: 403 })

  let body: { businessRegistrationNumber?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const brn = typeof body.businessRegistrationNumber === 'string' ? body.businessRegistrationNumber.trim() : ''
  if (!BRN_PATTERN.test(brn)) {
    return NextResponse.json({ error: 'invalid_brn' }, { status: 400 })
  }

  // §6.1 point 3: account-scoped (not IP-scoped — a shared office IP must not
  // throttle a legitimate partner), 1일 10회. Best-effort in-memory limiter —
  // see lib/forms/rateLimit.ts's header comment for the accepted per-instance/
  // cold-start limitation at this project's scale.
  if (isRateLimitedWindow(`brn:${accountId}`, DAILY_WINDOW_MS, MAX_CHECKS_PER_DAY)) {
    // §6.1 point 4: log the excess, but NOT into audit_log — that table's
    // action list is a curated, CHECK-constrained enum of meaningful business
    // events (baseline review §2.4-(4): "log_auth_event의 고정 액션 목록에 파트너
    // 액션을 추가하지 말 것"); a rate-limit trip is app-layer noise, not a new
    // business action. Server log only, per that same section's explicit
    // "별도 감사 RPC 또는 서버 로그" instruction.
    console.warn(`partner.check_brn rate_limited partner_account=${accountId}`)
    return NextResponse.json(
      {
        error: 'rate_limited',
        message: '오늘 확인 가능한 횟수를 초과했습니다. 내일 다시 시도해주세요.',
      },
      { status: 429 },
    )
  }

  const adminClient = getSupabaseAdminClient()
  if (!adminClient) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })

  const { data: duplicate, error } = await adminClient.rpc('check_business_registration_duplicate', {
    p_business_registration_number: brn,
  })
  if (error) return NextResponse.json({ error: 'check_failed' }, { status: 500 })

  // §6.1 point 1: neutral response — boolean only, never which company or
  // what state. The confirming/neutral message copy itself belongs to
  // ux-writer (§6.1 point 1); the frontend renders it from this boolean.
  return NextResponse.json({ duplicate: Boolean(duplicate) })
}
