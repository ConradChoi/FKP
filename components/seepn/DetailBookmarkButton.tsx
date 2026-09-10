'use client'

// Design Ref: screen-spec §6.3 (헤더 상시 노출 토글, 낙관적 업데이트 + 실패 시 롤백) + §9
// EDGE-B7 (로그인 게이트 통과 후 자동 실행되는 찜 액션이 실패하면 토스트를 띄우고 아이콘은
// 재시도 가능한 상태로 유지). This page is already behind requireBuyerSession() (BY-09 §6.1),
// so no login check is needed here — every mount of this component has a real buyer session.
import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'
import { HeartIcon } from '@/components/icons/SeepnIcons'

export function DetailBookmarkButton({ partnerId, initialBookmarked }: { partnerId: string; initialBookmarked: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [bookmarked, setBookmarked] = useState(initialBookmarked)
  const [pending, setPending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('action') !== 'bookmark' || initialBookmarked) return
    void toggle()
    const params = new URLSearchParams(searchParams.toString())
    params.delete('action')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggle() {
    const supabase = getBuyerBrowserClient()
    const wasBookmarked = bookmarked
    setPending(true)
    setBookmarked(!wasBookmarked)

    const { error } = wasBookmarked
      ? await supabase.from('buyer_bookmark').delete().eq('partner_id', partnerId)
      : await supabase.from('buyer_bookmark').insert({ partner_id: partnerId })

    setPending(false)
    if (error) {
      setBookmarked(wasBookmarked)
      setToast('관심등록에 실패했습니다. 다시 시도해주세요.')
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={pending}
        aria-pressed={bookmarked}
        className="flex items-center gap-1.5 rounded-input border border-neutral-200 px-3 py-1.5 text-body-sm text-neutral-700 hover:border-primary-300 disabled:cursor-not-allowed"
      >
        <HeartIcon className={`h-4 w-4 ${bookmarked ? 'text-primary-600' : 'text-neutral-400'}`} filled={bookmarked} />
        {bookmarked ? '관심등록됨' : '관심등록'}
      </button>
      {toast && <p className="text-label-caption text-error">{toast}</p>}
    </div>
  )
}
