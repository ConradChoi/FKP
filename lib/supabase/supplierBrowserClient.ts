// Design Ref: docs/02-design/features/partner-supplier-app.screen-spec.md §1.4 —
// "/supplier와 /admin이 같은 Next.js 앱(같은 호스트) 안에 있으므로, Supabase 클라이언트의
// auth.storageKey(및 필요 시 쿠키 path)를 /admin과 다르게 지정해야 한다" (privacy review
// §2.7). Admin's session cookie uses @supabase/ssr's default name (no cookieOptions.name
// override anywhere in lib/supabase/serverAuthClient.ts) — this client uses a distinct
// `cookieOptions.name` so a partner login in one tab and an admin login in another (same
// browser, same host) never overwrite each other's session cookies (screen-spec EDGE-13).
//
// This is the ONLY browser-side Supabase client in this codebase (admin has none — every
// admin mutation goes through a server action). `/supplier`'s screen-spec calls for many
// direct `supabase.auth.*` / `supabase.rpc(...)` / `supabase.from(...)` calls from Client
// Components (§7 화면↔RPC 매핑표), so a browser client is genuinely required here, not a
// stylistic choice.
'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

export const SUPPLIER_AUTH_COOKIE_NAME = 'sb-supplier-auth'

let cachedClient: SupabaseClient | null = null

export function getSupplierBrowserClient(): SupabaseClient {
  if (cachedClient) return cachedClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    // Client Components cannot read non-NEXT_PUBLIC_ env vars at all (unlike the
    // server clients' Amplify-runtime-bug fallback in serverClient.ts) — if these
    // are missing the build/env config itself is broken, not something a caller
    // can recover from.
    throw new Error('Supabase browser client: NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are not configured.')
  }

  cachedClient = createBrowserClient(url, key, {
    cookieOptions: { name: SUPPLIER_AUTH_COOKIE_NAME },
  })

  return cachedClient
}
