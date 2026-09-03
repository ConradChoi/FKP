// Design Ref: docs/02-design/features/partner-supplier-app.screen-spec.md §1.4 — "/supplier
// 레이아웃은 /admin/(protected)/layout.tsx가 get_my_admin_context()로 재검증하는 것과 동일하게,
// 세션이 있어도 매 요청마다 partner_account 자기 행 조회로 재검증해야 한다". Used by
// app/supplier/profile/layout.tsx (the SUP-08 shell) — every render re-checks status,
// independent of whatever the middleware already decided (middleware only checks "is there a
// session at all", per its own comment).
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupplierAuthServerClient } from '@/lib/supabase/supplierServerAuthClient'
import type { PartnerAccount, PartnerProfile } from './types'

export interface SupplierSession {
  supabase: SupabaseClient
  userId: string
  email: string | null
  emailConfirmedAt: string | null
  account: PartnerAccount
  partner: PartnerProfile
}

// Server Component-only: redirects (never returns null) when the session is missing or the
// account/partner rows aren't in a usable state — mirrors admin's protected layout redirecting
// straight to /admin/login rather than rendering a partial page.
export async function requireSupplierSession(): Promise<SupplierSession> {
  const supabase = await getSupplierAuthServerClient()
  if (!supabase) redirect('/supplier/login')

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/supplier/login')

  const { data: account } = await supabase
    .from('partner_account')
    .select('id, display_name, status')
    .maybeSingle<PartnerAccount>()

  // Theoretically unreachable (finalize_partner_signup always creates this row in the same
  // transaction as the auth user, screen-spec §3.1) — but an admin session that wandered into
  // /supplier has no partner_account row at all, which is exactly how this natural-block
  // property (screen-spec §1.4) is supposed to work.
  if (!account) redirect('/supplier/login')

  if (account.status === 'withdrawn' || account.status === 'suspended') {
    redirect('/supplier/login')
  }

  const { data: partner } = await supabase.from('partner').select('*').maybeSingle<PartnerProfile>()
  if (!partner) redirect('/supplier/login')

  return {
    supabase,
    userId: user.id,
    email: user.email ?? null,
    emailConfirmedAt: (user as unknown as { email_confirmed_at?: string | null }).email_confirmed_at ?? null,
    account,
    partner,
  }
}
