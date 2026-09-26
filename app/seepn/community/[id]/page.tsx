// Design Ref: Figma U-07-02 자유토론방 상세 (node 343:2) — 브레드크럼, 글 카드(카테고리 칩, 제목, 메타,
// 본문, 좋아요), 댓글(+1단계 답글). 조회수는 누가 봤는지 기록하지 않는 익명 카운터(RPC)다.
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { redirectToLoginIfNoBuyerSession } from '@/lib/seepn/loginGate'
import { requireBuyerSession } from '@/lib/seepn/session'
import { formatDotDate } from '@/lib/seepn/formatDate'
import { CommunityPostActions } from '@/components/seepn/CommunityPostActions'
import { CommunityComments, type CommunityCommentItem } from '@/components/seepn/CommunityComments'
import { NicknameForm } from '@/components/seepn/NicknameForm'
import { SeepnMainHeader } from '@/components/seepn/SeepnMainChrome'
import { SeepnFooter } from '@/components/seepn/SeepnFooter'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function SeepnCommunityPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()
  await redirectToLoginIfNoBuyerSession(`/seepn/community/${id}`)
  const session = await requireBuyerSession()

  const { data: post } = await session.supabase
    .from('community_post_public')
    .select('id, category, title, body, nickname, view_count, created_at, comment_count, like_count, is_mine')
    .eq('id', id)
    .maybeSingle<{ id: string; category: string; title: string; body: string; nickname: string; view_count: number; created_at: string; comment_count: number; like_count: number; is_mine: boolean }>()
  if (!post) notFound()

  const [{ data: commentRows }, { data: likeRow }, { data: account }] = await Promise.all([
    session.supabase.from('community_comment_public').select('id, parent_id, body, nickname, created_at, is_mine').eq('post_id', id).order('created_at', { ascending: true }),
    session.supabase.from('community_post_like').select('post_id').eq('post_id', id).maybeSingle(),
    session.supabase.from('buyer_account').select('nickname').maybeSingle<{ nickname: string | null }>(),
    session.supabase.rpc('community_view_post', { p_post_id: id }),
  ])

  const comments: CommunityCommentItem[] = ((commentRows ?? []) as { id: string; parent_id: string | null; body: string; nickname: string; created_at: string; is_mine: boolean }[]).map((c) => ({
    id: c.id,
    parentId: c.parent_id,
    body: c.body,
    nickname: c.nickname,
    createdAt: c.created_at,
    isMine: c.is_mine,
  }))

  return (
    <div className="flex min-h-screen flex-col bg-[#f9fafb]">
      <SeepnMainHeader active="community" />
      <main className="mx-auto w-full max-w-[800px] flex-1 px-6 py-10">
        <p className="text-label-caption text-neutral-500">
          <Link href="/seepn/community" className="hover:underline">자유토론방</Link> &gt; {post.category}
        </p>
        <article className="mt-3 space-y-3.5 rounded-card border border-neutral-200 bg-white px-8 py-7">
          <span className="inline-block rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-medium text-primary-600">{post.category}</span>
          <h1 className="text-[20px] font-bold text-neutral-900">{post.title}</h1>
          <p className="text-[11px] text-neutral-500">
            {post.nickname} · {formatDotDate(post.created_at)} · 조회 {post.view_count + 1} · 댓글 {post.comment_count}
          </p>
          <div className="border-t border-neutral-200" />
          <p className="whitespace-pre-wrap text-body-sm text-neutral-700">{post.body}</p>
          <CommunityPostActions postId={post.id} likeCount={post.like_count} liked={Boolean(likeRow)} isMine={post.is_mine} />
        </article>

        {account?.nickname ? (
          <CommunityComments postId={post.id} comments={comments} />
        ) : (
          <section className="mt-8 space-y-3">
            <h2 className="text-[15px] font-bold text-neutral-900">댓글 {comments.length}</h2>
            <p className="text-body-sm text-neutral-600">댓글을 쓰려면 먼저 커뮤니티 닉네임을 설정해주세요.</p>
            <NicknameForm initial={null} />
            {comments.length > 0 && <CommunityComments postId={post.id} comments={comments} />}
          </section>
        )}
      </main>
      <SeepnFooter />
    </div>
  )
}
