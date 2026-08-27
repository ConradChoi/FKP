// Design Ref: E1-R1 (server-mediated writes only, never browser -> Supabase directly),
// privacy review R-3 (insert-only RPC via anon-scoped client, no service_role key needed).
//
// IMPORTANT: this module must be imported only from server-side code (Route Handlers,
// Server Actions, RSC). `SUPABASE_ANON_KEY` intentionally has no `NEXT_PUBLIC_` prefix
// (privacy review S-9 confirms this is correct) and must never be bundled to the client.
//
// The client is created lazily, inside getSupabaseServerClient(), NOT at module load
// time. This is deliberate: Next.js evaluates route modules during `next build`, and if
// env vars were read at import time, a build without SUPABASE_ANON_KEY configured (e.g.
// CI, or an Amplify build stage that only injects secrets at runtime) would fail. Calling
// this function only inside a request handler defers the env var check to request time.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null = null

export function getSupabaseServerClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // TEMPORARY (2026-08-27): AWS Amplify's SSR compute runtime was not delivering
  // non-NEXT_PUBLIC_ env vars to running Lambdas even though the Amplify console showed
  // them correctly configured (confirmed via a boolean-only diagnostic endpoint) — a
  // platform-level issue, not a code or console-config mistake. NEXT_PUBLIC_SUPABASE_ANON_KEY
  // is read first as a workaround (Next.js inlines NEXT_PUBLIC_ vars at build time, so they
  // work regardless of the runtime propagation bug); SUPABASE_ANON_KEY is kept as a fallback
  // for local dev (.env.local) and until the Amplify-side issue is root-caused. The anon key
  // is safe to expose to the browser by Supabase's own design — this only reverses this
  // project's own defense-in-depth choice (privacy review S-9), not a real secret leak.
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

  if (!url || !key) {
    return null
  }

  if (!cachedClient) {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }

  return cachedClient
}
