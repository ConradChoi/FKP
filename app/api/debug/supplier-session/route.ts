// TEMPORARY diagnostic route (2026-09-06/07) — verifying the stateless-validation fix
// (lib/supabase/supplierServerAuthClient.ts). Remove once confirmed fixed in production.
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupplierAuthServerClient, getSupplierUser } from '@/lib/supabase/supplierServerAuthClient'
import { SUPPLIER_AUTH_COOKIE_NAME } from '@/lib/supabase/supplierBrowserClient'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll().map((c) => ({ name: c.name, length: c.value.length }))

  const authResult = await getSupplierAuthServerClient()
  if (!authResult) {
    return NextResponse.json({ clientCreated: false, cookies: allCookies })
  }
  const { supabase, accessToken } = authResult

  const user = await getSupplierUser(supabase, accessToken)

  let accountResult: unknown = null
  let accountError: unknown = null
  if (user) {
    const { data: account, error: accErr } = await supabase.from('partner_account').select('id, status').maybeSingle()
    accountResult = account
    accountError = accErr ? { message: accErr.message, code: accErr.code } : null
  }

  return NextResponse.json({
    renderedAt: new Date().toISOString(),
    cookies: allCookies,
    hasAccessToken: !!accessToken,
    userId: user?.id ?? null,
    accountResult,
    accountError,
  })
}
