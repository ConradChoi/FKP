// Design Ref: fkp-v0.2-platform-foundation.prd.md Phase 3 DoD — dashboard widgets (E3-R3)
// ship in a later round once OQ-12's metric definitions are settled. Auth/menu-tree/sign-out
// chrome now lives in the shared (protected)/layout.tsx sidebar shell — this page is just
// the "대시보드" content area.
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'

export default async function AdminHomePage() {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  return (
    <div className="mx-auto max-w-[960px]">
      <h1 className="text-h3 text-primary-900">대시보드</h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <h2 className="text-h4">지표 위젯 (준비 중)</h2>
          <p className="mt-2 text-body-sm">다음 라운드에서 제공됩니다.</p>
        </div>
      </div>
    </div>
  )
}
