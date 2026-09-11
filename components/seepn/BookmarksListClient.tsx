'use client'

// Design Ref: screen-spec §7.1 (BY-10) — "찜 해제: 카드의 찜 아이콘 재클릭 -> 즉시 목록에서
// 제거(낙관적 업데이트)" + EDGE-B5 (비공개 전환된 파트너는 이름 등 상세를 다시 노출하지 않고
// placeholder 카드로만 표시, 상세 진입 불가) + PartnerCard.tsx 재사용(BY-08과 동일 카드).
//
// docs/02-design/features/seepn-buyer-web-p5b.screen-spec.md §3 (BY-13, "관심목록 확장 — 신규
// 페이지 아님") 추가: "비교하기" 토글로 체크박스 선택 모드에 진입해 동일 vertical 내 2~5개를
// 고르고 하단 sticky 바로 /seepn/compare?ids=로 이동한다. D-C1(동일 버티컬만) + EDGE-C1(최대
// 5개)/EDGE-C2(버티컬 불일치)/EDGE-C3(2곳 미만이면 토글 자체 비활성) 화면 레벨 가드. 선택 상태는
// 컴포넌트 state로만 관리한다(휘발성, D-C2 — 페이지 이탈 시 유지하지 않음). 체크박스는 브라우저
// disabled 속성 대신 "시각적으로만 비활성 + onChange에서 차단·안내"로 구현했다 — 진짜
// disabled 엘리먼트는 클릭/키보드 이벤트 자체를 받지 않아 EDGE-C1의 "6번째 클릭 시 토스트 안내"를
// 만족할 수 없기 때문(상세는 각 조건 분기 주석 참고).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'
import { PartnerCard, PartnerCardBody, type PartnerCardData } from './PartnerCard'

export interface BookmarkListItem {
  partnerId: string
  partner: PartnerCardData | null // null = no longer publicly listed (EDGE-B5)
}

const MAX_COMPARE = 5
const MIN_COMPARE = 2
const MIN_BOOKMARKS_TO_COMPARE = 2

const MAX_TOAST = '비교는 최대 5곳까지 가능합니다.'
const VERTICAL_TOAST = '제품 파트너와 서비스 파트너는 함께 비교할 수 없습니다.'
const MIN_BOOKMARKS_HINT = '비교하려면 관심등록을 2곳 이상 해주세요.'

export function BookmarksListClient({ items }: { items: BookmarkListItem[] }) {
  const router = useRouter()
  const [list, setList] = useState(items)
  const [toast, setToast] = useState<string | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // EDGE-C3 gate for the "비교하기" toggle itself: count only candidates that could ever be
  // compared (a placeholder/private card can never be selected, so it must not count toward the
  // "2곳 이상" threshold — otherwise a buyer with 2 bookmarks, one of which is private, would enter
  // selection mode and immediately hit a dead end with only 1 selectable card).
  const comparableCount = list.filter((i) => i.partner !== null).length
  const canEnterCompareMode = comparableCount >= MIN_BOOKMARKS_TO_COMPARE

  const selectedVertical =
    selectedIds.size > 0 ? (list.find((i) => selectedIds.has(i.partnerId))?.partner?.vertical ?? null) : null

  async function handleRemove(partnerId: string) {
    const supabase = getBuyerBrowserClient()
    const previous = list
    setList((prev) => prev.filter((i) => i.partnerId !== partnerId))
    setSelectedIds((prev) => {
      if (!prev.has(partnerId)) return prev
      const next = new Set(prev)
      next.delete(partnerId)
      return next
    })

    const { error } = await supabase.from('buyer_bookmark').delete().eq('partner_id', partnerId)
    if (error) {
      setList(previous)
      setToast('관심등록 해제에 실패했습니다. 다시 시도해주세요.')
    }
  }

  function enterCompareMode() {
    if (!canEnterCompareMode) return
    setToast(null)
    setSelectedIds(new Set())
    setCompareMode(true)
  }

  // "선택 취소" — 선택 모드 종료, 체크박스 숨김. 선택 상태는 페이지 이탈 시 유지하지 않는다(D-C2).
  function exitCompareMode() {
    setCompareMode(false)
    setSelectedIds(new Set())
    setToast(null)
  }

  function handleToggleSelect(item: BookmarkListItem) {
    if (!item.partner) return // EDGE-B5: 비공개 전환된 카드는 애초에 선택 대상이 아님
    const id = item.partnerId
    const partner = item.partner

    setSelectedIds((prev) => {
      if (prev.has(id)) {
        const next = new Set(prev)
        next.delete(id)
        return next
      }
      // EDGE-C1: 이미 5개 선택된 상태에서 6번째를 고르려는 시도 -> 차단 + 토스트
      if (prev.size >= MAX_COMPARE) {
        setToast(MAX_TOAST)
        return prev
      }
      // EDGE-C2 / D-C1: 이미 선택된 항목과 vertical이 다르면 차단 + 토스트
      if (selectedVertical && partner.vertical !== selectedVertical) {
        setToast(VERTICAL_TOAST)
        return prev
      }
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  function goToCompare() {
    if (selectedIds.size < MIN_COMPARE) return
    router.push(`/seepn/compare?ids=${Array.from(selectedIds).join(',')}`)
  }

  if (list.length === 0) {
    return <p className="text-body-sm text-neutral-400">관심등록한 파트너가 모두 해제되었습니다.</p>
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

      <div className="mb-4 flex items-center justify-between">
        {compareMode ? (
          <button type="button" onClick={exitCompareMode} className="text-body-sm text-neutral-500 hover:underline">
            선택 취소
          </button>
        ) : (
          <div>
            <button
              type="button"
              onClick={enterCompareMode}
              disabled={!canEnterCompareMode}
              title={!canEnterCompareMode ? MIN_BOOKMARKS_HINT : undefined}
              aria-describedby={!canEnterCompareMode ? 'compare-toggle-hint' : undefined}
              className="rounded-input border border-neutral-300 px-4 py-2 text-label-button text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              비교하기
            </button>
            {!canEnterCompareMode && (
              <p id="compare-toggle-hint" className="mt-1 text-label-caption text-neutral-400">
                {MIN_BOOKMARKS_HINT}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {list.map((item) => {
          if (!item.partner) {
            return (
              <div key={item.partnerId} className="relative rounded-card border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-body-sm text-neutral-500">현재 비공개 상태인 파트너입니다.</p>
                <button
                  type="button"
                  onClick={() => handleRemove(item.partnerId)}
                  className="mt-2 text-label-caption text-neutral-500 hover:underline"
                >
                  관심목록에서 제거
                </button>
              </div>
            )
          }

          if (!compareMode) {
            return <PartnerCard key={item.partnerId} partner={item.partner} bookmarked onToggleBookmark={handleRemove} />
          }

          const partner = item.partner
          const selected = selectedIds.has(item.partnerId)
          const blockedByMax = !selected && selectedIds.size >= MAX_COMPARE
          const blockedByVertical = !selected && Boolean(selectedVertical) && partner.vertical !== selectedVertical
          const blocked = blockedByMax || blockedByVertical

          return (
            <label
              key={item.partnerId}
              className={`relative flex gap-3 rounded-card border p-4 transition-colors ${
                selected ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 bg-neutral-0'
              } ${blocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => handleToggleSelect(item)}
                aria-label={`${partner.company_name_ko ?? '파트너'} 비교 선택`}
                className="mt-1 h-4 w-4 shrink-0 accent-primary-600"
              />
              <div className="min-w-0 flex-1">
                <PartnerCardBody partner={partner} />
                {blockedByVertical && <p className="mt-2 text-label-caption text-error">{VERTICAL_TOAST}</p>}
                {blockedByMax && !blockedByVertical && <p className="mt-2 text-label-caption text-error">{MAX_TOAST}</p>}
              </div>
            </label>
          )
        })}
      </div>

      {compareMode && (
        <>
          {/* 하단 sticky 바에 콘텐츠가 가려지지 않도록 하는 여백 */}
          <div className="h-24" aria-hidden="true" />
          <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-neutral-0 px-4 py-3">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
              <p className="text-body-sm text-neutral-700">{selectedIds.size}곳 선택됨</p>
              <button
                type="button"
                onClick={goToCompare}
                disabled={selectedIds.size < MIN_COMPARE}
                className="rounded-input bg-primary-600 px-6 py-3 text-label-button text-neutral-0 hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                비교하기
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
