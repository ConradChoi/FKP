// Design Ref: Figma U-07-01 자유토론방 목록 (node 294:2) — 제목 행 + 글쓰기, 카테고리 탭, 글 목록.
// 열람·작성은 로그인한 SEEPN 회원만(뷰가 is_active_buyer로 게이트). 작성자는 닉네임만 보인다.
import Link from 'next/link'
import { redirectToLoginIfNoBuyerSession } from '@/lib/seepn/loginGate'
import { requireBuyerSession } from '@/lib/seepn/session'
import { COMMUNITY_CATEGORIES, COMMUNITY_PAGE_SIZE } from '@/lib/seepn/community'
import { formatDotDate } from '@/lib/seepn/formatDate'
import { SeepnMainHeader } from '@/components/seepn/SeepnMainChrome'
import { SeepnFooter } from '@/components/seepn/SeepnFooter'

export const dynamic = 'force-dynamic'

interface PostRow {
  id: string
  category: string
  title: string
  nickname: string
  created_at: string
  view_count: number
  comment_count: number
  like_count: number
}

export default async function SeepnCommunityPage({ searchParams }: { searchParams: Promise<{ category?: string; page?: string }> }) {
  const { category, page: pageParam } = await searchParams
  const activeCategory = (COMMUNITY_CATEGORIES as readonly string[]).includes(category ?? '') ? category : undefined
  const page = Math.max(1, Number(pageParam) || 1)
  await redirectToLoginIfNoBuyerSession(`/seepn/community${activeCategory ? `?category=${encodeURIComponent(activeCategory)}` : ''}`)
  const session = await requireBuyerSession()

  let query = session.supabase
    .from('community_post_public')
    .select('id, category, title, nickname, created_at, view_count, comment_count, like_count', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * COMMUNITY_PAGE_SIZE, page * COMMUNITY_PAGE_SIZE - 1)
  if (activeCategory) query = query.eq('category', activeCategory)
  const { data, count, error } = await query
  const posts = (data ?? []) as PostRow[]
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / COMMUNITY_PAGE_SIZE))

  const tabClass = (on: boolean) => `rounded-full px-3 py-1.5 text-label-caption font-medium ${on ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`
  const href = (p: number) => `/seepn/community?${new URLSearchParams({ ...(activeCategory ? { category: activeCategory } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString()}`

  return (
    <div className="flex min-h-screen flex-col bg-[#f9fafb]">
      <SeepnMainHeader active="community" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="flex items-center gap-3">
          <h1 className="flex-1 text-[22px] font-bold text-neutral-900">자유토론방</h1>
          <Link href="/seepn/community/new" className="rounded-input bg-primary-600 px-3.5 py-2 text-label-caption font-medium text-white hover:bg-primary-700">
            글쓰기
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/seepn/community" className={tabClass(!activeCategory)}>
            전체
          </Link>
          {COMMUNITY_CATEGORIES.map((c) => (
            <Link key={c} href={`/seepn/community?category=${encodeURIComponent(c)}`} className={tabClass(activeCategory === c)}>
              {c}
            </Link>
          ))}
        </div>

        {error ? (
          <p className="mt-6 text-body-sm text-error">목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>
        ) : posts.length === 0 ? (
          <p className="mt-6 rounded-input border border-dashed border-neutral-200 bg-white p-10 text-center text-body-sm text-neutral-500">아직 등록된 글이 없습니다. 첫 글을 남겨보세요.</p>
        ) : (
          <ul className="mt-5 divide-y divide-neutral-200 overflow-hidden rounded-input border border-neutral-200 bg-white">
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={`/seepn/community/${p.id}`} className="flex items-center gap-2.5 px-4 py-3 hover:bg-neutral-50">
                  <span className="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-medium text-primary-600">{p.category}</span>
                  <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-neutral-900">{p.title}</span>
                  <span className="hidden shrink-0 text-[11px] text-neutral-500 sm:inline">
                    {p.nickname} · {formatDotDate(p.created_at)} · 조회 {p.view_count} · 댓글 {p.comment_count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <nav aria-label="페이지" className="mt-6 flex items-center justify-center gap-4 text-body-sm">
            {page > 1 ? <Link href={href(page - 1)} className="text-primary-600 hover:underline">← 이전</Link> : <span className="text-neutral-300">← 이전</span>}
            <span className="text-neutral-500">{page} / {totalPages}</span>
            {page < totalPages ? <Link href={href(page + 1)} className="text-primary-600 hover:underline">다음 →</Link> : <span className="text-neutral-300">다음 →</span>}
          </nav>
        )}
      </main>
      <SeepnFooter />
    </div>
  )
}
