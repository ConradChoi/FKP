'use client'

// 댓글 + 1단계 답글. 작성/삭제는 RPC, 갱신은 router.refresh(). 삭제하면 그 댓글의 답글도 함께 삭제된다.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'
import { CommunityReportButton } from '@/components/seepn/CommunityReportButton'
import { COMMENT_MAX, communityErrorMessage } from '@/lib/seepn/community'
import { formatDotDate } from '@/lib/seepn/formatDate'

export interface CommunityCommentItem {
  id: string
  parentId: string | null
  body: string
  nickname: string
  createdAt: string
  isMine: boolean
}

function CommentForm({ postId, parentId, onDone, placeholder, autoFocus }: { postId: string; parentId: string | null; onDone: () => void; placeholder: string; autoFocus?: boolean }) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: rpcError } = await getBuyerBrowserClient().rpc('community_create_comment', { p_post_id: postId, p_parent_id: parentId, p_body: body.trim() })
    setBusy(false)
    if (rpcError) {
      setError(communityErrorMessage(rpcError.message))
      return
    }
    setBody('')
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-1.5">
      <div className="flex gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={COMMENT_MAX}
          rows={2}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-input border border-neutral-300 px-3 py-2 text-[13px] focus:border-primary-500 focus:outline-none"
        />
        <button type="submit" disabled={busy || !body.trim()} className="self-end rounded-input bg-primary-600 px-3.5 py-1.5 text-[11px] font-medium text-white hover:bg-primary-700 disabled:opacity-50">
          {busy ? '...' : '등록'}
        </button>
      </div>
      {error && <p role="alert" className="text-label-caption text-error">{error}</p>}
    </form>
  )
}

function CommentRow({ postId, comment, canReply, onChanged }: { postId: string; comment: CommunityCommentItem; canReply: boolean; onChanged: () => void }) {
  const [replying, setReplying] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    setBusy(true)
    const { error: rpcError } = await getBuyerBrowserClient().rpc('community_delete_comment', { p_comment_id: comment.id })
    setBusy(false)
    if (rpcError) {
      setError('삭제하지 못했습니다.')
      return
    }
    onChanged()
  }

  return (
    <div className="flex gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-label-caption font-bold text-neutral-600" aria-hidden="true">
        {comment.nickname.slice(0, 1)}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-neutral-900">{comment.nickname}</span>
          <span className="text-[11px] text-neutral-400">{formatDotDate(comment.createdAt)}</span>
        </div>
        <p className="whitespace-pre-wrap text-[13px] text-neutral-700">{comment.body}</p>
        <div className="flex flex-wrap items-center gap-3">
          {canReply && (
            <button type="button" onClick={() => setReplying((v) => !v)} className="text-[11px] font-medium text-neutral-500 hover:underline">
              답글달기
            </button>
          )}
          {comment.isMine ? (
            confirmDelete ? (
              <>
                <button type="button" disabled={busy} onClick={remove} className="text-[11px] text-error hover:underline">
                  삭제 확인
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="text-[11px] text-neutral-500 hover:underline">
                  취소
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="text-[11px] text-neutral-400 hover:text-error hover:underline">
                삭제
              </button>
            )
          ) : (
            <CommunityReportButton targetType="comment" targetId={comment.id} />
          )}
          {error && <span role="alert" className="text-[11px] text-error">{error}</span>}
        </div>
        {replying && (
          <div className="pt-1">
            <CommentForm postId={postId} parentId={comment.id} placeholder="답글을 입력하세요..." autoFocus onDone={() => { setReplying(false); onChanged() }} />
          </div>
        )}
      </div>
    </div>
  )
}

export function CommunityComments({ postId, comments }: { postId: string; comments: CommunityCommentItem[] }) {
  const router = useRouter()
  const refresh = () => router.refresh()
  const top = comments.filter((c) => c.parentId === null)
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id)

  return (
    <section className="mt-8">
      <h2 className="text-[15px] font-bold text-neutral-900">댓글 {comments.length}</h2>
      <div className="mt-3">
        <CommentForm postId={postId} parentId={null} placeholder="댓글을 입력하세요..." onDone={refresh} />
      </div>
      <p className="mt-1.5 text-label-caption text-neutral-400">댓글은 닉네임과 함께 다른 회원에게 공개됩니다. 이름·연락처 등 개인정보나 타인의 비밀정보는 쓰지 마세요.</p>
      <div className="mt-5 space-y-4">
        {top.map((c) => (
          <div key={c.id} className="space-y-3">
            <CommentRow postId={postId} comment={c} canReply onChanged={refresh} />
            {repliesOf(c.id).map((r) => (
              <div key={r.id} className="ml-10">
                <CommentRow postId={postId} comment={r} canReply={false} onChanged={refresh} />
              </div>
            ))}
          </div>
        ))}
        {top.length === 0 && <p className="text-body-sm text-neutral-400">첫 댓글을 남겨보세요.</p>}
      </div>
    </section>
  )
}
