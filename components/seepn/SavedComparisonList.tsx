'use client'

// 마이페이지 > 비교 공급사: 저장한 비교 조합 목록(다시 비교 / 삭제). Deletes go straight through
// the self-delete RLS policy on buyer_saved_comparison.
import Link from 'next/link'
import { useState } from 'react'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'

export interface SavedComparisonItem {
  id: string
  createdAt: string
  partners: { id: string; name: string; listed: boolean }[]
}

export function SavedComparisonList({ initialItems }: { initialItems: SavedComparisonItem[] }) {
  const [items, setItems] = useState(initialItems)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function remove(id: string) {
    setBusyId(id)
    setError(null)
    const { data, error: delError } = await getBuyerBrowserClient().from('buyer_saved_comparison').delete().eq('id', id).select('id')
    setBusyId(null)
    if (delError || !data || data.length === 0) {
      setError('삭제하지 못했습니다. 잠시 후 다시 시도해주세요.')
      return
    }
    setConfirmId(null)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  if (items.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-neutral-200 bg-white p-10 text-center">
        <p className="text-body text-neutral-500">저장한 비교가 없습니다.</p>
        <p className="mt-1 text-body-sm text-neutral-400">공급사를 2곳 이상 비교한 화면에서 "이 비교 저장"을 눌러보세요.</p>
        <Link href="/seepn/partners" className="mt-3 inline-block text-body-sm text-primary-600 hover:underline">
          공급사 둘러보기
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-body-sm text-error">{error}</p>}
      {items.map((item) => {
        const listed = item.partners.filter((p) => p.listed)
        const canCompare = listed.length >= 2
        return (
          <div key={item.id} className="rounded-card border border-neutral-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-label-caption text-neutral-400">{new Date(item.createdAt).toISOString().slice(0, 10)} 저장 · {item.partners.length}곳</p>
              <div className="flex items-center gap-3 text-body-sm">
                {canCompare ? (
                  <Link href={`/seepn/compare?ids=${listed.map((p) => p.id).join(',')}`} className="text-primary-600 hover:underline">
                    다시 비교하기
                  </Link>
                ) : (
                  <span className="text-neutral-400" title="공개 중인 공급사가 2곳 미만입니다">다시 비교할 수 없음</span>
                )}
                {confirmId === item.id ? (
                  <>
                    <button type="button" disabled={busyId === item.id} onClick={() => remove(item.id)} className="text-error hover:underline">
                      {busyId === item.id ? '삭제 중...' : '삭제 확인'}
                    </button>
                    <button type="button" onClick={() => setConfirmId(null)} className="text-neutral-500 hover:underline">
                      취소
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setConfirmId(item.id)} className="text-neutral-500 hover:text-error hover:underline">
                    삭제
                  </button>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.partners.map((p) =>
                p.listed ? (
                  <Link key={p.id} href={`/seepn/partners/${p.id}`} className="rounded-full bg-primary-50 px-3 py-1 text-label-caption text-primary-700 hover:bg-primary-100">
                    {p.name}
                  </Link>
                ) : (
                  <span key={p.id} className="rounded-full bg-neutral-100 px-3 py-1 text-label-caption text-neutral-400">
                    {p.name}
                  </span>
                ),
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
