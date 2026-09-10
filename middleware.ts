// Root(`/`) redirect: Hotfix for the 404 that appeared after switching to SSR (`public/index.html`'s
// meta-refresh stopped being served at `/`). Phase 4's country-based locale detection replaces this.
//
// `/admin/**` guard: Design Ref fkp-v0.2-privacy-review-phase3-rbac.md §6 (session policy) — every
// admin route requires a signed-in, active admin_user AND a fully-verified MFA session (AAL2, §6.5:
// MFA is mandatory for every operator including the representative). Unverified/no session -> login;
// signed in but MFA not yet completed -> MFA challenge/setup. Runs on every request (no long-lived
// permission caching, per INV-7 — a suspended account must be locked out immediately, not "eventually").
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_PUBLIC_PATHS = new Set(['/admin/login', '/admin/mfa-setup', '/admin/mfa-challenge'])

// Design Ref: partner-supplier-app.screen-spec.md §1.4 — session cookie namespace kept
// separate from /admin (see lib/supabase/supplierBrowserClient.ts's SUPPLIER_AUTH_COOKIE_NAME).
// Only the "signed in at all" check happens here (matching guardAdmin's session-only scope);
// the deeper partner_account status / email-verification checks happen in
// app/supplier/profile/layout.tsx, the same division of labor admin uses (middleware = session,
// protected layout = business-rule gate via a DB round trip).
const SUPPLIER_AUTH_COOKIE_NAME = 'sb-supplier-auth'

async function guardSupplier(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  const pathname = request.nextUrl.pathname
  const isProtectedPath = pathname.startsWith('/supplier/profile')

  if (!url || !key) {
    if (isProtectedPath) {
      return NextResponse.redirect(new URL('/supplier/login', request.url))
    }
    return response
  }

  const supabase = createServerClient(url, key, {
    cookieOptions: { name: SUPPLIER_AUTH_COOKIE_NAME },
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    if (isProtectedPath) return NextResponse.redirect(new URL('/supplier/login', request.url))
    return response
  }

  // Signed in — bounce away from the auth-only screens (login/signup/etc.) back to the
  // profile shell. SUP-05/06/07 (auth.confirm / reset-password) are intentionally excluded
  // from this bounce even though they're in SUPPLIER_PUBLIC_PATHS, because a signed-in user
  // can legitimately land on reset-password mid-flow (screen-spec §3.7) — but they aren't
  // reachable without a fresh recovery-token session anyway, so no special-case is needed
  // here: only /supplier/login and /supplier/signup make sense to bounce away from.
  if (pathname === '/supplier/login' || pathname === '/supplier/signup') {
    return NextResponse.redirect(new URL('/supplier/profile', request.url))
  }

  return response
}

// Design Ref: seepn-buyer-web-p5a.screen-spec.md §1.2/§1.3 (D-S1/D-S2) + privacy review §7.3 —
// third session cookie namespace (`sb-buyer-auth`), same "middleware = session presence only,
// protected layout = business-rule DB round trip" division of labor as guardSupplier. Kept as
// its own local literal (not imported from lib/supabase/buyerAuthCookieName.ts) for the exact
// same reason SUPPLIER_AUTH_COOKIE_NAME above is a local literal, not an import — GAP-6's
// diagnosed root cause was specifically an import crossing a 'use client' boundary; this file
// has none of those imports at all today, and it should stay that way.
const BUYER_AUTH_COOKIE_NAME = 'sb-buyer-auth'

// screen-spec §7.4 BP-15: only /seepn/my/* and the inquiry-write page require a session at the
// middleware layer — /seepn/partners (the list) and /seepn/partners/[id] (the detail) are
// reachable without a session at THIS layer on purpose. The detail page's actual access control
// is the DB-level gate (private.is_active_buyer() on public.partner_detail_buyer, GAP-1/BP-1)
// plus its own requireBuyerSession() call (lib/seepn/session.ts) — redirecting it here too would
// just be a second, redundant UX-only gate, which is fine to add later at the frontend round but
// is not this migration's job to decide.
function isBuyerProtectedPath(pathname: string): boolean {
  return pathname.startsWith('/seepn/my')
}

async function guardBuyer(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  const pathname = request.nextUrl.pathname
  const isProtectedPath = isBuyerProtectedPath(pathname)

  if (!url || !key) {
    if (isProtectedPath) {
      return NextResponse.redirect(new URL('/seepn/login', request.url))
    }
    return response
  }

  const supabase = createServerClient(url, key, {
    cookieOptions: { name: BUYER_AUTH_COOKIE_NAME },
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    if (isProtectedPath) return NextResponse.redirect(new URL('/seepn/login', request.url))
    return response
  }

  if (pathname === '/seepn/login' || pathname === '/seepn/signup') {
    return NextResponse.redirect(new URL('/seepn/partners', request.url))
  }

  return response
}

// privacy review §7.4 BP-15. `null` means "do not force a Cache-Control header at all" (the
// public list page) — everything else gets an explicit value.
function seepnCacheControlFor(pathname: string): string | null {
  if (pathname === '/seepn/partners') return null
  if (/^\/seepn\/partners\/[^/]+$/.test(pathname)) return 'private, no-store'
  return 'no-store'
}

async function guardAdmin(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // TEMPORARY (2026-08-27) — see lib/supabase/serverClient.ts for why this reads
  // NEXT_PUBLIC_SUPABASE_ANON_KEY first (AWS Amplify SSR runtime env var propagation bug).
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  const pathname = request.nextUrl.pathname
  const isPublicAdminPath = ADMIN_PUBLIC_PATHS.has(pathname)

  if (!url || !key) {
    // Config missing: fail closed on protected paths, let /admin/login itself render (it will
    // show its own "service unavailable" state rather than a silent redirect loop).
    if (!isPublicAdminPath) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    return response
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    if (isPublicAdminPath) return response
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  const needsMfaSetup = aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal1' // no factor enrolled yet
  const needsMfaChallenge = aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2' // factor exists, unverified this session

  if (needsMfaSetup) {
    if (pathname === '/admin/mfa-setup') return response
    return NextResponse.redirect(new URL('/admin/mfa-setup', request.url))
  }

  if (needsMfaChallenge) {
    if (pathname === '/admin/mfa-challenge') return response
    return NextResponse.redirect(new URL('/admin/mfa-challenge', request.url))
  }

  // Fully authenticated at AAL2 — bounce away from the login/setup/challenge screens.
  if (isPublicAdminPath) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  return response
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/en', request.url))
  }

  if (request.nextUrl.pathname.startsWith('/admin')) {
    const response = await guardAdmin(request)
    // Privacy review §6.4 (P3-11): admin pages carry lead PII — never let browser/proxy
    // caches retain them.
    response.headers.set('Cache-Control', 'no-store')
    return response
  }

  if (request.nextUrl.pathname.startsWith('/supplier')) {
    const response = await guardSupplier(request)
    // Same reasoning as the admin branch above — partner profile pages carry PII too.
    response.headers.set('Cache-Control', 'no-store')
    return response
  }

  if (request.nextUrl.pathname.startsWith('/seepn')) {
    const response = await guardBuyer(request)
    // privacy review §7.4 BP-15 per-path table, now that the actual list/detail/my pages exist:
    //   - /seepn/partners (list): cache allowed — no header forced, so a shared/edge cache can
    //     serve it (the page itself never reads cookies for its own data — see app/seepn/
    //     partners/page.tsx's comment on why bookmark state is deliberately NOT server-rendered).
    //   - /seepn/partners/[id] (detail, login-gated data): `private, no-store`.
    //   - everything else under /seepn (auth screens, /seepn/my/*, the inquiry form): `no-store`,
    //     same as /admin and /supplier.
    const cacheControl = seepnCacheControlFor(request.nextUrl.pathname)
    if (cacheControl) response.headers.set('Cache-Control', cacheControl)
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/admin/:path*', '/supplier/:path*', '/seepn/:path*'],
}
