// Design Ref: lib/supabase/serverAuthClient.ts (the /admin counterpart this mirrors) +
// screen-spec §1.4 — same cookie-backed session shape, but with the `cookieOptions.name`
// override (matching lib/supabase/supplierBrowserClient.ts exactly) so /supplier's session
// cookie never collides with /admin's default-named one. Uses the anon key (never
// service_role) — the logged-in partner's own JWT plus RLS/private.* functions decide what
// they can see, exactly like the admin server client.
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPPLIER_AUTH_COOKIE_NAME } from './supplierBrowserClient'

const BASE64_COOKIE_PREFIX = 'base64-'

// WORKAROUND (2026-09-06/07) — root-caused via production stack traces: @supabase/ssr
// 0.12.5's cookie storage adapter (createServerClient's `isServer: true` storage object,
// dist/main/cookies.js) has a `setItem` that unconditionally calls `key.endsWith(...)`
// without checking `key` is a string first. On this Amplify deployment's bundled build that
// throws `TypeError: b.endsWith is not a function` — confirmed via a temporary diagnostic
// route's captured stack trace pointing directly at that file/function — and GoTrueClient's
// internal error handling swallows it into a generic "Auth session missing!" once the
// surrounding save/load machinery touches that storage adapter at all (reads included, not
// just writes — reproduced with getSession()/getUser() alone, before any explicit setSession
// call). The exact same cookie value decodes and validates perfectly both by hand and via a
// LOCAL reproduction using the identical library version, so this is a bug specific to how
// this bundle executes on this platform, not a mistake in this app's config.
//
// Fix: stop routing through @supabase/ssr's cookie storage adapter for this client entirely.
// Decode the session cookie ourselves (same base64url+JSON logic the library uses) and hand
// the tokens to a *plain* `createClient()` instance (no custom `cookies`/`storage` option, so
// GoTrueClient falls back to its own default in-memory storage — a completely different code
// path from @supabase/ssr's buggy one). Verified locally that this combination works
// end-to-end. This client is request-scoped and never persists anything back to cookies —
// token refresh/persistence remains middleware.ts's job, unchanged.
function decodeSupplierSessionCookie(raw: string | undefined): { access_token: string; refresh_token: string } | null {
  if (!raw || !raw.startsWith(BASE64_COOKIE_PREFIX)) return null
  try {
    const decoded = Buffer.from(raw.slice(BASE64_COOKIE_PREFIX.length), 'base64url').toString('utf-8')
    const parsed = JSON.parse(decoded)
    if (typeof parsed?.access_token === 'string' && typeof parsed?.refresh_token === 'string') {
      return { access_token: parsed.access_token, refresh_token: parsed.refresh_token }
    }
    return null
  } catch {
    return null
  }
}

export async function getSupplierAuthServerClient(): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // TEMPORARY (2026-08-27) — see lib/supabase/serverClient.ts for why this reads
  // NEXT_PUBLIC_SUPABASE_ANON_KEY first (AWS Amplify SSR runtime env var propagation bug).
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

  if (!url || !key) {
    return null
  }

  const cookieStore = await cookies()
  const tokens = decodeSupplierSessionCookie(cookieStore.get(SUPPLIER_AUTH_COOKIE_NAME)?.value)

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  if (tokens) {
    // Best-effort, with one retry: production testing showed the very first setSession() call
    // on a freshly-constructed client occasionally fails (observed as a swallowed error) while
    // an identical immediate retry on the same client instance succeeds — consistent with a
    // cold-start-style race in the client's internal setup rather than a real auth problem
    // (the exact same tokens validate fine moments later). One retry is enough to observe this
    // settle in every case seen so far; if a genuine failure occurs (e.g. actually
    // expired/revoked), it will fail both times and the caller's own getUser()/getSession()
    // calls will correctly report unauthenticated.
    const first = await supabase.auth.setSession(tokens).catch((e) => ({ error: e }))
    if (first?.error) {
      await supabase.auth.setSession(tokens).catch(() => {})
    }
  }

  return supabase
}
