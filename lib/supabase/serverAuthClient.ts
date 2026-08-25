// Design Ref: fkp-v0.2-privacy-review-phase3-rbac.md §6 — cookie-backed Supabase Auth
// session client for Server Components / Route Handlers under app/admin/**. Uses the anon
// key (never service_role) — the logged-in user's own JWT plus RLS/private.* functions
// decide what they can see, exactly like every other authenticated client. See
// lib/supabase/adminClient.ts for the separate, narrowly-scoped service_role client.
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function getSupabaseAuthServerClient(): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY

  if (!url || !key) {
    return null
  }

  const cookieStore = await cookies()

  return createServerClient(url, key, {
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
          // so this is safe to swallow (standard @supabase/ssr guidance).
        }
      },
    },
  })
}
