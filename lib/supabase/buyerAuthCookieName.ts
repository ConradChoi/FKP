// Design Ref: lib/supabase/supplierAuthCookieName.ts — extracted into its own plain module for
// EXACTLY the same reason (privacy review §7.2 / GAP-6): a top-level `'use client'` file's
// exports become React Server Components client-reference stubs when imported from server-side
// code, silently turning a plain string constant into an empty string. That bug cost this
// project ~2 days to diagnose once already (supplier login). This file must NEVER gain a
// `'use client'` directive, and both lib/supabase/buyerServerAuthClient.ts (server) and
// lib/supabase/buyerBrowserClient.ts (browser, 'use client') import the identifier from here —
// neither should ever define its own copy of this string except middleware.ts, which
// deliberately keeps its own local literal (see middleware.ts's guardBuyer for why).
export const BUYER_AUTH_COOKIE_NAME = 'sb-buyer-auth'
