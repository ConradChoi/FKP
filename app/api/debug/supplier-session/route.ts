// TEMPORARY diagnostic route (2026-09-06) — investigating why middleware's guardSupplier()
// correctly recognizes a session (redirects /supplier/login -> /supplier/profile) but
// app/supplier/profile/layout.tsx's requireSupplierSession() redirects the SAME session back
// to /supplier/login, producing a redirect loop / blank page. Reveals only cookie NAMES and
// lengths (never values) plus getUser()'s error message. Remove once diagnosed.
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupplierAuthServerClient } from '@/lib/supabase/supplierServerAuthClient'

export async function GET() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll().map((c) => ({ name: c.name, length: c.value.length }))

  const supabase = await getSupplierAuthServerClient()
  if (!supabase) {
    return NextResponse.json({ clientCreated: false, cookies: allCookies })
  }

  const { data, error } = await supabase.auth.getUser()

  let accountResult: unknown = null
  let accountError: unknown = null
  if (data.user) {
    const { data: account, error: accErr } = await supabase.from('partner_account').select('id, status').maybeSingle()
    accountResult = account
    accountError = accErr ? { message: accErr.message, code: accErr.code } : null
  }

  return NextResponse.json({
    clientCreated: true,
    cookies: allCookies,
    getUserError: error ? { message: error.message, status: error.status } : null,
    userId: data.user?.id ?? null,
    accountResult,
    accountError,
  })
}
