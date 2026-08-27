// Design Ref: 대표 피드백(2026-08-27) — 메뉴관리에서 구성한 게시판관리 > FAQ 메뉴 경로.
import { redirect } from 'next/navigation'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { FaqRow } from '../FaqRow'
import { NewFaqForm } from '../NewFaqForm'
import { loadFaqRecords } from '../loadContent'

export default async function FaqBoardPage() {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  const { records, error } = await loadFaqRecords(supabase)
  const nextSortOrder = records.length > 0 ? Math.max(...records.map((r) => r.sortOrder)) + 10 : 10

  return (
    <div className="mx-auto max-w-[1000px]">
      <h1 className="text-h3 text-primary-900">FAQ</h1>
      <p className="mt-1 text-body-sm text-neutral-600">
        게시(published) 상태인 질문은 최대 1분(ISR) 이내 공개 사이트(/faq)에 반영됩니다.
      </p>

      {error && <p className="mt-4 text-body-sm text-error">불러오지 못했습니다: {error.message}</p>}

      <div className="mt-6 space-y-4">
        <NewFaqForm nextSortOrder={nextSortOrder} />
        <div className="space-y-3">
          {records.map((record) => (
            <FaqRow key={record.contentItemId} faq={record} />
          ))}
        </div>
      </div>
    </div>
  )
}
