// Design Ref: lib/supabase/serverAuthClient.ts (the /admin counterpart this mirrors) +
// screen-spec §1.4 — same cookie-backed session shape, but with the `cookieOptions.name`
// override (matching lib/supabase/supplierBrowserClient.ts exactly) so /supplier's session
// cookie never collides with /admin's default-named one. Uses the anon key (never
// service_role) — the logged-in partner's own JWT plus RLS/private.* functions decide what
// they can see, exactly like the admin server client.
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { SupabaseClient, User } from '@supabase/supabase-js'
// NOT from './supplierBrowserClient' — that file has a top-level 'use client' directive, so
// server-side code importing it gets a client-reference stub instead of the real string (see
// supplierAuthCookieName.ts's own comment for how this was diagnosed). This was the actual
// root cause of every "session not found" symptom investigated in this file's other comments.
import { SUPPLIER_AUTH_COOKIE_NAME } from './supplierAuthCookieName'

const BASE64_COOKIE_PREFIX = 'base64-'

// WORKAROUND (2026-09-06/07) — root-caused via production stack traces, then narrowed further
// by direct experiment: @supabase/ssr 0.12.5's cookie storage adapter has a real bug
// (`setItem` calls `key.endsWith(...)` without checking `key` is a string; throws
// `TypeError: b.endsWith is not a function` on this deployment's bundle) — switching to a
// plain `createClient()` (no @supabase/ssr, no cookie storage adapter) avoided that specific
// crash, confirmed via a temporary diagnostic route. But GoTrueClient's own internal session
// state (`setSession()` -> `getSession()`/`getUser()` no-arg) turned out to have a SEPARATE,
// still-unexplained read-after-write gap on this deployment: `setSession()` reports success
// with no error, yet an immediate `getUser()`/`getSession()` call on the very same client
// object can still report "Auth session missing!" — reproduced repeatedly, including after
// looping setSession()+getUser() confirmation up to 3 times with no improvement. Not
// reproducible locally under the identical library versions and cookie value, so this is
// specific to how this bundle executes on this platform's compute, not a mistake in this
// app's config, and not simply "needs one retry."
//
// Fix: stop depending on GoTrueClient's internal session state entirely, for both validation
// and data access:
//   1. Decode the session cookie ourselves (same base64url+JSON logic the library uses).
//   2. Build the client with the access token baked into `global.headers.Authorization`
//      directly at construction — every REST/RPC call this client makes (`.from()`, `.rpc()`)
//      carries that bearer token unconditionally, independent of GoTrueClient's session state,
//      so RLS scoping works regardless of whether `setSession()`/`getSession()` are reliable.
//   3. Validate the token via the explicit-JWT overload `getUser(accessToken)` — per
//      @supabase/auth-js's own source, passing a JWT here takes a completely different code
//      path (`_getUser(jwt)`) that skips `initializePromise`/`_useSession`/storage entirely and
//      just makes a direct, stateless network call to `/auth/v1/user`. This is the one auth-js
//      entry point that never touches the flaky internal state machinery at all.
// This client never calls `setSession()`/persists anything back to cookies — token
// refresh/persistence remains middleware.ts's job, unchanged. A caller needing "is there a
// logged-in user" must use `getSupplierUser(supabase, accessToken)` below (or
// `requireSupplierSession()`), not `supabase.auth.getUser()` with no argument.
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

export interface SupplierAuthClient {
  supabase: SupabaseClient
  accessToken: string | null
}

export async function getSupplierAuthServerClient(): Promise<SupplierAuthClient | null> {
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
    global: tokens ? { headers: { Authorization: `Bearer ${tokens.access_token}` } } : undefined,
  })

  return { supabase, accessToken: tokens?.access_token ?? null }
}

// Stateless validation — see the WORKAROUND note above for why this must be `getUser(jwt)`
// and not `supabase.auth.getUser()`.
export async function getSupplierUser(supabase: SupabaseClient, accessToken: string | null): Promise<User | null> {
  if (!accessToken) return null
  const { data, error } = await supabase.auth.getUser(accessToken)
  if (error) return null
  return data.user
}
