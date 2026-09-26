// SEEPN 커뮤니티 운영 (2026-09-26). 메뉴관리에서 경로 /admin/community 를 등록해 사용한다. 신고를 검토해
// 게시글·댓글을 숨기거나 해제한다. 이력은 community_moderation_log에 남는다.
import { redirect } from 'next/navigation'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { AdminCommunityBoard, type AdminCommunityPost, type AdminCommunityReport } from './AdminCommunityBoard'

export default async function AdminCommunityPage() {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  const [{ data: reports, error: reportsError }, { data: posts }] = await Promise.all([
    supabase.rpc('admin_list_community_reports', { p_status: 'open' }),
    supabase.rpc('admin_list_community_posts', { p_status: null }),
  ])

  return (
    <div>
      <h1 className="admin-heading-2 text-neutral-900">커뮤니티 운영</h1>
      <p className="mt-1 admin-body-sm text-neutral-600">
        회원 신고를 검토해 게시글·댓글을 숨기거나 해제합니다. 숨김 처리하면 회원에게 노출되지 않고 해당 대상의 열린 신고는 자동 종결됩니다. 작성자는 닉네임으로만 표시됩니다.
      </p>
      {reportsError && <p className="mt-4 admin-body-sm text-error">불러오지 못했습니다: {reportsError.message}</p>}
      <div className="mt-6">
        <AdminCommunityBoard reports={(reports ?? []) as AdminCommunityReport[]} posts={(posts ?? []) as AdminCommunityPost[]} />
      </div>
    </div>
  )
}
