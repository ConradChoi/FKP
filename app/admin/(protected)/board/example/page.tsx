// Design Ref: 대표 피드백(2026-08-27) — 메뉴관리에서 구성한 게시판관리 > 사례 메뉴 경로
// (메뉴 코드/경로는 'example'이지만 실제 데이터는 content_type='case_study').
import { redirect } from 'next/navigation'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { ArticleRow } from '../ArticleRow'
import { NewArticleForm } from '../NewArticleForm'
import { loadArticleRecords } from '../loadContent'
import { CONTENT_TYPE_URL_SEGMENT } from '@/lib/content/contentTypes'

export default async function CaseStudyBoardPage() {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  const { records, error } = await loadArticleRecords(supabase, 'case_study')
  const nextSortOrder = records.length > 0 ? Math.max(...records.map((r) => r.sortOrder)) + 10 : 10

  return (
    <div>
      <p className="mt-1 admin-body-sm text-neutral-600">
        게시(published) 상태인 사례는 최대 1분(ISR) 이내 공개 사이트(/case-studies)에 반영됩니다.
      </p>

      {error && <p className="mt-4 admin-body-sm text-error">불러오지 못했습니다: {error.message}</p>}

      <div className="mt-6 space-y-4">
        <NewArticleForm contentType="case_study" nextSortOrder={nextSortOrder} />
        <div className="space-y-3">
          {records.map((record) => (
            <ArticleRow key={record.contentItemId} article={record} urlSegment={CONTENT_TYPE_URL_SEGMENT.case_study} />
          ))}
        </div>
      </div>
    </div>
  )
}
