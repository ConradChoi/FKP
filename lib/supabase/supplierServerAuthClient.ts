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

export async function getSupplierAuthServerClient(): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // TEMPORARY (2026-08-27) — see lib/supabase/serverClient.ts for why this reads
  // NEXT_PUBLIC_SUPABASE_ANON_KEY first (AWS Amplify SSR runtime env var propagation bug).
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

  if (!url || !key) {
    return null
  }

  const cookieStore = await cookies()

  return createServerClient(url, key, {
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
}
