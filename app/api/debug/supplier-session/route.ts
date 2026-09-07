// TEMPORARY diagnostic route (2026-09-06/07) — verifying the stateless-validation fix
// (lib/supabase/supplierServerAuthClient.ts). Remove once confirmed fixed in production.
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupplierAuthServerClient, getSupplierUser } from '@/lib/supabase/supplierServerAuthClient'
import { SUPPLIER_AUTH_COOKIE_NAME } from '@/lib/supabase/supplierAuthCookieName'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const rawAll = cookieStore.getAll()
  const allCookies = rawAll.map((c) => ({ name: c.name, length: c.value.length }))
  const directGet = cookieStore.get(SUPPLIER_AUTH_COOKIE_NAME)
  const directGetInfo = { found: !!directGet, valuePrefix: directGet?.value?.slice(0, 20) ?? null }
  const nameCharCodes = rawAll.map((c) => ({ name: c.name, codes: Array.from(c.name).map((ch) => ch.charCodeAt(0)) }))
  const constantCharCodes = Array.from(SUPPLIER_AUTH_COOKIE_NAME).map((ch) => ch.charCodeAt(0))
  console.log('SUPPLIER_DEBUG constantCharCodes', JSON.stringify(constantCharCodes))
  console.log('SUPPLIER_DEBUG nameCharCodes', JSON.stringify(nameCharCodes))
  console.log('SUPPLIER_DEBUG directGetInfo', JSON.stringify(directGetInfo))
  console.log('SUPPLIER_DEBUG allCookies', JSON.stringify(allCookies))

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
    directGetInfo,
    nameCharCodes,
    constantCharCodes,
    hasAccessToken: !!accessToken,
    accessTokenPrefix: accessToken?.slice(0, 15) ?? null,
    userId: user?.id ?? null,
    accountResult,
    accountError,
  })
}
