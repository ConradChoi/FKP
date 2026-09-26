'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'
import { CommunityReportButton } from '@/components/seepn/CommunityReportButton'
import { communityErrorMessage } from '@/lib/seepn/community'

export function CommunityPostActions({ postId, likeCount, liked, isMine }: { postId: string; likeCount: number; liked: boolean; isMine: boolean }) {
  const router = useRouter()
  const [count, setCount] = useState(likeCount)
  const [isLiked, setIsLiked] = useState(liked)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggleLike() {
    setBusy(true)
    setError(null)
    const { data, error: rpcError } = await getBuyerBrowserClient().rpc('community_toggle_like', { p_post_id: postId })
    setBusy(false)
    if (rpcError) {
      setError(communityErrorMessage(rpcError.message))
      return
    }
    setIsLiked(Boolean(data))
    setCount((c) => c + (data ? 1 : -1))
  }

  async function remove() {
    setBusy(true)
    const { error: rpcError } = await getBuyerBrowserClient().rpc('community_delete_post', { p_post_id: postId })
    setBusy(false)
    if (rpcError) {
      setError('삭제하지 못했습니다. 잠시 후 다시 시도해주세요.')
      return
    }
    router.push('/seepn/community')
    router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <button
        type="button"
        onClick={toggleLike}
        disabled={busy}
        aria-pressed={isLiked}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium ${isLiked ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'}`}
      >
        <span aria-hidden="true">👍</span> {count}
      </button>
      {isMine ? (
        confirmDelete ? (
          <>
            <span className="text-label-caption text-neutral-500">이 글에 달린 다른 회원의 댓글도 함께 삭제됩니다.</span>
            <button type="button" disabled={busy} onClick={remove} className="text-body-sm text-error hover:underline">
              삭제 확인
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="text-body-sm text-neutral-500 hover:underline">
              취소
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="text-body-sm text-neutral-500 hover:text-error hover:underline">
            삭제
          </button>
        )
      ) : (
        <CommunityReportButton targetType="post" targetId={postId} />
      )}
      {error && <span role="alert" className="text-label-caption text-error">{error}</span>}
    </div>
  )
}
