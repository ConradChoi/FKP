'use client'

// Design Ref: docs/03-security/seepn-buyer-web-p5a-privacy-review.md §7.4 BP-15 — "목록은 캐시
// 허용. 단 찜 상태(로그인 사용자별)를 서버 렌더에 섞지 말 것 ... 찜 상태는 클라이언트에서 별도
// 조회". This component receives ONLY public rows fetched server-side (app/seepn/partners/
// page.tsx never reads cookies/session for this page's own data), and does 100% of the
// login/bookmark work client-side: check session -> fetch which of the visible partner ids are
// already bookmarked -> render. Also implements screen-spec §3.1 SP-14's "게이트 통과 후 자동
// 실행" for the list-page bookmark icon (§9 EDGE-B7: toast on failure, icon stays retryable).
import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'
import { PartnerCard, type PartnerCardData } from './PartnerCard'

export function PartnerListClient({ partners, featured }: { partners: PartnerCardData[]; featured?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      const supabase = getBuyerBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setIsLoggedIn(false)
        return
      }
      setIsLoggedIn(true)

      const ids = partners.map((p) => p.id)
      if (ids.length > 0) {
        const { data } = await supabase.from('buyer_bookmark').select('partner_id').in('partner_id', ids)
        if (cancelled) return
        const set = new Set((data ?? []).map((r: { partner_id: string }) => r.partner_id))

        // EDGE-B7 / SP-14: a bookmark attempt that was gated by login just before this page
        // loaded is replayed here, once, on return.
        const action = searchParams.get('action')
        const partnerId = searchParams.get('partnerId')
        if (action === 'bookmark' && partnerId && !set.has(partnerId)) {
          const { error } = await supabase.from('buyer_bookmark').insert({ partner_id: partnerId })
          if (!error) set.add(partnerId)
          else setToast('관심등록에 실패했습니다. 다시 시도해주세요.')
        }
        if (action) {
          const params = new URLSearchParams(searchParams.toString())
          params.delete('action')
          params.delete('partnerId')
          const qs = params.toString()
          router.replace(qs ? `${pathname}?${qs}` : pathname)
        }
        setBookmarkedIds(set)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleToggle(id: string) {
    if (!isLoggedIn) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('action', 'bookmark')
      params.set('partnerId', id)
      const target = `${pathname}?${params.toString()}`
      router.push(`/seepn/login?redirect=${encodeURIComponent(target)}`)
      return
    }

    const supabase = getBuyerBrowserClient()
    const currentlyBookmarked = bookmarkedIds.has(id)
    setPendingId(id)
    setBookmarkedIds((prev) => {
      const next = new Set(prev)
      if (currentlyBookmarked) next.delete(id)
      else next.add(id)
      return next
    })

    const { error } = currentlyBookmarked
      ? await supabase.from('buyer_bookmark').delete().eq('partner_id', id)
      : await supabase.from('buyer_bookmark').insert({ partner_id: id })

    setPendingId(null)
    if (error) {
      setBookmarkedIds((prev) => {
        const next = new Set(prev)
        if (currentlyBookmarked) next.add(id)
        else next.delete(id)
        return next
      })
      setToast('관심등록 처리에 실패했습니다. 다시 시도해주세요.')
    }
  }

  return (
    <div>
      {toast && (
        <div className="mb-3 rounded-input bg-error-100 px-3 py-2 text-label-caption text-error" role="alert">
          {toast}
          <button type="button" onClick={() => setToast(null)} className="ml-2 underline">
            닫기
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {partners.map((p) => (
          <PartnerCard
            key={p.id}
            partner={p}
            bookmarked={bookmarkedIds.has(p.id)}
            onToggleBookmark={handleToggle}
            disabled={pendingId === p.id}
            featured={featured}
          />
        ))}
      </div>
    </div>
  )
}
