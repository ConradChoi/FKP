// SEEPN 인사이트 게시판 (2026-09-25). 메뉴관리에서 게시판관리 아래에 이 경로를 등록해 사용한다.
import { redirect } from 'next/navigation'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { SeepnContentBoard } from '../SeepnContentBoard'
import { loadSeepnContent } from '../loadSeepnContent'

export default async function SeepnInsightBoardPage() {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  const { items, error } = await loadSeepnContent(supabase, 'insight')
  const nextSortOrder = items.length > 0 ? Math.max(...items.map((i) => i.sortOrder)) + 10 : 10

  return (
    <div>
      <p className="mt-1 admin-body-sm text-neutral-600">
        게시(published)이고 노출 중인 인사이트만 seepn.me/인사이트에 반영됩니다(최대 1분). 정렬 값이 큰 항목이 먼저 보입니다.
      </p>
      {error && <p className="mt-4 admin-body-sm text-error">불러오지 못했습니다: {error}</p>}
      <div className="mt-6">
        <SeepnContentBoard kind="insight" items={items} nextSortOrder={nextSortOrder} />
      </div>
    </div>
  )
}
