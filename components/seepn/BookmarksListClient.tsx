'use client'

// Design Ref: screen-spec §7.1 (BY-10) — "찜 해제: 카드의 찜 아이콘 재클릭 -> 즉시 목록에서
// 제거(낙관적 업데이트)" + EDGE-B5 (비공개 전환된 파트너는 이름 등 상세를 다시 노출하지 않고
// placeholder 카드로만 표시, 상세 진입 불가) + PartnerCard.tsx 재사용(BY-08과 동일 카드).
import { useState } from 'react'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'
import { PartnerCard, type PartnerCardData } from './PartnerCard'

export interface BookmarkListItem {
  partnerId: string
  partner: PartnerCardData | null // null = no longer publicly listed (EDGE-B5)
}

export function BookmarksListClient({ items }: { items: BookmarkListItem[] }) {
  const [list, setList] = useState(items)
  const [toast, setToast] = useState<string | null>(null)

  async function handleRemove(partnerId: string) {
    const supabase = getBuyerBrowserClient()
    const previous = list
    setList((prev) => prev.filter((i) => i.partnerId !== partnerId))

    const { error } = await supabase.from('buyer_bookmark').delete().eq('partner_id', partnerId)
    if (error) {
      setList(previous)
      setToast('관심등록 해제에 실패했습니다. 다시 시도해주세요.')
    }
  }

  if (list.length === 0) {
    return <p className="text-body-sm text-neutral-400">관심등록한 파트너가 모두 해제되었습니다.</p>
  }

  return (
    <div>
      {toast && (
        <div className="mb-3 rounded-input bg-error-100 px-3 py-2 text-label-caption text-error" role="alert">
          {toast}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {list.map((item) =>
          item.partner ? (
            <PartnerCard key={item.partnerId} partner={item.partner} bookmarked onToggleBookmark={handleRemove} />
          ) : (
            <div key={item.partnerId} className="relative rounded-card border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-body-sm text-neutral-500">현재 비공개 상태인 파트너입니다.</p>
              <button type="button" onClick={() => handleRemove(item.partnerId)} className="mt-2 text-label-caption text-neutral-500 hover:underline">
                관심목록에서 제거
              </button>
            </div>
          ),
        )}
      </div>
    </div>
  )
}
