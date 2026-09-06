// TEMPORARY diagnostic route (2026-09-06) — investigating why middleware's guardSupplier()
// correctly recognizes a session (redirects /supplier/login -> /supplier/profile) but
// app/supplier/profile/layout.tsx's requireSupplierSession() redirects the SAME session back
// to /supplier/login, producing a redirect loop / blank page. Reveals only cookie NAMES and
// lengths (never values) plus getUser()'s error message. Remove once diagnosed.
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupplierAuthServerClient } from '@/lib/supabase/supplierServerAuthClient'

// TEST: forcing dynamic to rule out this Route Handler being statically cached at build time
// (which would explain identical "no session" results regardless of the request's cookie).
export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll().map((c) => ({ name: c.name, length: c.value.length }))

  const supabase = await getSupplierAuthServerClient()
  if (!supabase) {
    return NextResponse.json({ clientCreated: false, cookies: allCookies })
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const { data, error } = await supabase.auth.getUser()

  let accountResult: unknown = null
  let accountError: unknown = null
  if (data.user) {
    const { data: account, error: accErr } = await supabase.from('partner_account').select('id, status').maybeSingle()
    accountResult = account
    accountError = accErr ? { message: accErr.message, code: accErr.code } : null
  }

  const raw = cookieStore.get('sb-supplier-auth')?.value ?? ''

  // Manual decode, entirely bypassing GoTrueClient/the @supabase/ssr storage adapter, to
  // isolate whether the failure is in cookie decoding or in GoTrueClient's session recognition
  // after a successful decode.
  let manualDecode: { ok: boolean; error?: string; keys?: string[]; userId?: string } = { ok: false }
  try {
    if (raw.startsWith('base64-')) {
      const b64 = raw.slice('base64-'.length)
      const decoded = Buffer.from(b64, 'base64url').toString('utf-8')
      const parsed = JSON.parse(decoded)
      manualDecode = { ok: true, keys: Object.keys(parsed), userId: parsed?.user?.id }
    } else {
      manualDecode = { ok: false, error: 'no base64- prefix' }
    }
  } catch (e) {
    manualDecode = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  return NextResponse.json({
    renderedAt: new Date().toISOString(),
    clientCreated: true,
    cookies: allCookies,
    rawCookiePrefix: raw.slice(0, 30),
    rawCookieSuffix: raw.slice(-30),
    manualDecode,
    getSessionError: sessionError ? { message: sessionError.message, status: sessionError.status } : null,
    hasSession: !!sessionData.session,
    sessionUserId: sessionData.session?.user?.id ?? null,
    getUserError: error ? { message: error.message, status: error.status } : null,
    userId: data.user?.id ?? null,
    accountResult,
    accountError,
  })
}
