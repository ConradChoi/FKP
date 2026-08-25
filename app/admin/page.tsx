// Design Ref: fkp-v0.2-platform-foundation.prd.md Phase 3 DoD — minimal authenticated shell
// for this round. Real dashboard widgets (E3-R3) ship in the next round once OQ-12's metric
// definitions are settled; this proves the auth+RBAC foundation end-to-end and surfaces the
// access-request queue the representative asked for.
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { SignOutButton } from './SignOutButton'

export default async function AdminHomePage() {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')

  if (!context?.is_active_admin) {
    redirect('/admin/login')
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-8">
      <div className="mx-auto max-w-[960px]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-h3 text-primary-900">Find Korean Partners Admin</h1>
            <p className="mt-1 text-body-sm text-neutral-600">
              {context.display_name}님, 안녕하세요. ({(context.role_codes as string[])?.join(', ')})
            </p>
          </div>
          <SignOutButton />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {context.is_super_admin && (
            <Link
              href="/admin/access-requests"
              className="rounded-card border border-neutral-200 bg-neutral-0 p-6 transition-colors hover:border-primary-300"
            >
              <h2 className="text-h4 text-neutral-900">가입 요청 검토</h2>
              <p className="mt-2 text-body-sm text-neutral-600">신규 운영자 가입 요청을 승인/거부합니다.</p>
            </Link>
          )}
          <div className="rounded-card border border-dashed border-neutral-300 p-6 text-neutral-400">
            <h2 className="text-h4">요청관리 (준비 중)</h2>
            <p className="mt-2 text-body-sm">다음 라운드에서 제공됩니다.</p>
          </div>
          <div className="rounded-card border border-dashed border-neutral-300 p-6 text-neutral-400">
            <h2 className="text-h4">대시보드 (준비 중)</h2>
            <p className="mt-2 text-body-sm">다음 라운드에서 제공됩니다.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
