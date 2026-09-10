// Design Ref: lib/supabase/supplierServerAuthClient.ts (the pattern this file replicates
// verbatim, per docs/03-security/seepn-buyer-web-p5a-privacy-review.md §7 BP-14 / GAP-6 —
// "처음부터 이 우회 패턴을 그대로 복제할 것... '일단 @supabase/ssr 기본 쿠키 어댑터로 짜고
// 문제 생기면 고친다'는 접근을 금지한다"). Uses the anon key (never service_role) — the
// logged-in buyer's own JWT plus RLS/private.* functions decide what they can see.
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { SupabaseClient, User } from '@supabase/supabase-js'
// NOT from './buyerBrowserClient' — that file has a top-level 'use client' directive, so
// server-side code importing it gets a client-reference stub instead of the real string
// (identical failure mode already diagnosed once for /supplier — see buyerAuthCookieName.ts).
import { BUYER_AUTH_COOKIE_NAME } from './buyerAuthCookieName'

const BASE64_COOKIE_PREFIX = 'base64-'

// WORKAROUND, replicated from supplierServerAuthClient.ts (do not "simplify" this back to
// @supabase/ssr's createServerClient() — that is the exact regression BP-14 exists to prevent):
//   1. Decode the session cookie ourselves (same base64url+JSON logic the library uses).
//   2. Build the client with the access token baked into `global.headers.Authorization`
//      directly at construction — every REST/RPC call this client makes carries that bearer
//      token unconditionally, independent of GoTrueClient's internal session state.
//   3. Validate the token via the explicit-JWT overload `getUser(accessToken)` only. Never call
//      `setSession()` (the observed read-after-write gap: `setSession()` reports success, then
//      an immediate `getUser()`/`getSession()` on the same client can still report "Auth
//      session missing!" — reproduced on /supplier, not reproducible locally, so assume it can
//      recur here) and never call the no-argument `getUser()`/`getSession()` overloads.
function decodeBuyerSessionCookie(raw: string | undefined): { access_token: string; refresh_token: string } | null {
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

export interface BuyerAuthClient {
  supabase: SupabaseClient
  accessToken: string | null
}

export async function getBuyerAuthServerClient(): Promise<BuyerAuthClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Same Amplify SSR runtime env var propagation workaround as
  // lib/supabase/supplierServerAuthClient.ts / lib/supabase/serverClient.ts.
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

  if (!url || !key) {
    return null
  }

  const cookieStore = await cookies()
  const tokens = decodeBuyerSessionCookie(cookieStore.get(BUYER_AUTH_COOKIE_NAME)?.value)

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: tokens ? { headers: { Authorization: `Bearer ${tokens.access_token}` } } : undefined,
  })

  return { supabase, accessToken: tokens?.access_token ?? null }
}

// Stateless validation — see the WORKAROUND note above for why this must be `getUser(jwt)` and
// not `supabase.auth.getUser()`.
export async function getBuyerUser(supabase: SupabaseClient, accessToken: string | null): Promise<User | null> {
  if (!accessToken) return null
  const { data, error } = await supabase.auth.getUser(accessToken)
  if (error) return null
  return data.user
}
