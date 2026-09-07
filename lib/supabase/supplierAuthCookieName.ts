// Design Ref: extracted from supplierBrowserClient.ts (2026-09-07) — that file has a top-level
// `'use client'` directive, which means server-side code importing ANY of its exports gets
// React Server Components' client-reference stubs instead of the real runtime values, not just
// for the actual browser-only client-construction function but for this plain string constant
// too. That silently made `SUPPLIER_AUTH_COOKIE_NAME` evaluate to an empty string wherever it
// was imported from server-side code (lib/supabase/supplierServerAuthClient.ts, the debug
// route) — confirmed via a CloudWatch-logged char-code dump showing the constant as `[]`
// (empty) while the actual cookie's real name decoded correctly as "sb-supplier-auth".
// middleware.ts was never affected because it happens to define its own separate local copy of
// this exact string rather than importing it. This file exists so both server-only and
// client-only code can share the identifier without either accidentally crossing the
// 'use client' boundary — nothing in this file may ever gain a 'use client' directive.
export const SUPPLIER_AUTH_COOKIE_NAME = 'sb-supplier-auth'
