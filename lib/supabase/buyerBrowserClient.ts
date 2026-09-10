// Design Ref: lib/supabase/supplierBrowserClient.ts — same reasoning, third cookie namespace.
// docs/02-design/features/seepn-buyer-web-p5a.screen-spec.md §1.3 (D-S2): the buyer session
// cookie (`sb-buyer-auth`) must never collide with `/admin`'s default-named cookie or
// `/supplier`'s `sb-supplier-auth` cookie — same browser, same host, three principal_kinds.
'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { BUYER_AUTH_COOKIE_NAME } from './buyerAuthCookieName'

// Re-exported for existing client-side importers — safe here since this file is only ever
// imported from Client Components. Any SERVER-side code must import the constant from
// './buyerAuthCookieName' directly instead (see that file's comment).
export { BUYER_AUTH_COOKIE_NAME }

let cachedClient: SupabaseClient | null = null

export function getBuyerBrowserClient(): SupabaseClient {
  if (cachedClient) return cachedClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Supabase browser client: NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are not configured.')
  }

  cachedClient = createBrowserClient(url, key, {
    cookieOptions: { name: BUYER_AUTH_COOKIE_NAME },
  })

  return cachedClient
}
