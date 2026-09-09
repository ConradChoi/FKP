// Design Ref: notice-board-v1.0.prd.md (v3.0 Final) §7.3 (blog -> notice physical conversion,
// A-2) + notice-board.screen-spec.md §3.1 (page path, top instructional copy) + §3.10 (page
// layout order). This file replaces the removed app/admin/(protected)/board/blog/page.tsx —
// 0 published blog posts confirmed before conversion (D-N0-7), so no data/URL asset is lost.
import { redirect } from 'next/navigation'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { loadArticleRecords } from '../loadContent'
import { NoticeBoardClient } from './NoticeBoardClient'

export default async function NoticeBoardPage() {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  const { records, error } = await loadArticleRecords(supabase, 'notice')
  const nextSortOrder = records.length > 0 ? Math.max(...records.map((r) => r.sortOrder)) + 10 : 10

  return (
    <div>
      {/* screen-spec §3.1 — replaces the blog board's ISR-based copy: notice has no ISR-based
          public route at all (D-N0-1), and this sentence doubles as part of N-R6's always-on
          "seepn_user has no consumer screen yet" warning surface. */}
      <p className="mt-1 admin-body-sm text-neutral-600">
        게시(published) 상태인 파트너 공지는 파트너 화면(/supplier/notices)에 즉시 반영됩니다. SEEPN 사용자 공지는
        seepn.me가 열리기 전까지 아무 화면에도 노출되지 않습니다.
      </p>

      {error && <p className="mt-4 admin-body-sm text-error">불러오지 못했습니다: {error.message}</p>}

      <NoticeBoardClient records={records} nextSortOrder={nextSortOrder} />
    </div>
  )
}
