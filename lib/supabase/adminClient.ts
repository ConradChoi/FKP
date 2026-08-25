// Design Ref: fkp-v0.2-privacy-review-phase3-rbac.md — service_role client for the one
// operation that genuinely requires it: provisioning a new Supabase Auth user when a
// super_admin approves an access request (auth.admin.* is not reachable any other way).
//
// SECURITY: SUPABASE_SERVICE_ROLE_KEY bypasses RLS entirely. This module must only be
// imported from server-only code that has already independently verified the caller is an
// authenticated, active super_admin (see app/api/admin/access-requests/[id]/approve/route.ts)
// — this client itself performs no authorization. Never import from a Client Component,
// never log the key, never add a NEXT_PUBLIC_ prefix to the env var.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null = null

export function getSupabaseAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

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
