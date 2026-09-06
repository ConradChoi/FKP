// Design Ref: lib/supabase/serverAuthClient.ts (the /admin counterpart this mirrors) +
// screen-spec §1.4 — same cookie-backed session client shape, but with the
// `cookieOptions.name` override (matching lib/supabase/supplierBrowserClient.ts exactly)
// so /supplier's session cookie never collides with /admin's default-named one. Uses the
// anon key (never service_role) — the logged-in partner's own JWT plus RLS/private.*
// functions decide what they can see, exactly like the admin server client.
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPPLIER_AUTH_COOKIE_NAME } from './supplierBrowserClient'

const BASE64_COOKIE_PREFIX = 'base64-'

// WORKAROUND (2026-09-06) — confirmed via production diagnostics that @supabase/ssr's own
// automatic "read session from the cookie via storage.getItem()" path
// (createServerClient -> GoTrueClient.getUser()/getSession() -> __loadSession() ->
// getItemAsync(this.storage, this.storageKey)) reliably returns "Auth session missing!" on
// this Amplify deployment even though the exact same cookie value, decoded by hand with the
// exact same base64url+JSON.parse logic the library itself uses, parses to a perfectly valid
// session (right access_token/refresh_token/user every time). Root cause not isolated further
// (matches this project's cookie value/library version 1:1 in a local reproduction that DOES
// succeed, so it is specific to this runtime, not a code/config mistake here) — rather than
// keep chasing it, this bypasses the automatic path entirely: decode the cookie ourselves and
// hand the tokens to `setSession()`, which performs its own real validation against Supabase
// instead of trusting the storage-adapter's internal load.
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

  const supabase = createServerClient(url, key, {
    cookieOptions: { name: SUPPLIER_AUTH_COOKIE_NAME },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component render (not a Route Handler/Server Action) —
          // cookies() is read-only there. Session refresh still happens in middleware.ts,
          // so this is safe to swallow (standard @supabase/ssr guidance, same as the admin
          // client this mirrors).
        }
      },
    },
  })

  const tokens = decodeSupplierSessionCookie(cookieStore.get(SUPPLIER_AUTH_COOKIE_NAME)?.value)
  if (tokens) {
    // Best-effort: if this fails (e.g. genuinely expired/revoked), fall through and let the
    // caller's own getUser()/getSession() calls report the real (now consistent) unauthenticated
    // state, rather than throwing here.
    await supabase.auth.setSession(tokens).catch(() => {})
  }

  return supabase
}
