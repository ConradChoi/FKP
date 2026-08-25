// Design Ref: E3-R4 (운영자관리 — invite), 대표 요청(2026-08-25, "가입요청 -> 최고관리자 승인").
// RLS (admin_access_request_select) already restricts this query to whoever holds
// has_menu_permission('operator_management','read') — seeded as super_admin-only today
// (INV-3: this page would render an empty list for anyone else, not an error, but the real
// boundary is the RLS policy + the approve/reject route's own permission re-check, INV-8).
import { redirect } from 'next/navigation'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { AccessRequestRow } from './AccessRequestRow'

export default async function AccessRequestsPage() {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  const { data: requests, error } = await supabase
    .from('admin_access_request')
    .select('id, name, email, reason, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-8">
      <div className="mx-auto max-w-[800px]">
        <h1 className="text-h3 text-primary-900">가입 요청 검토</h1>
        <p className="mt-1 text-body-sm text-neutral-600">대기 중인 요청 {requests?.length ?? 0}건</p>

        {error && <p className="mt-6 text-body-sm text-error">목록을 불러오지 못했습니다: {error.message}</p>}

        {!error && (requests?.length ?? 0) === 0 && (
          <p className="mt-6 text-body-sm text-neutral-500">대기 중인 요청이 없습니다.</p>
        )}

        <div className="mt-6 flex flex-col gap-4">
          {requests?.map((req) => <AccessRequestRow key={req.id} request={req} />)}
        </div>
      </div>
    </main>
  )
}
