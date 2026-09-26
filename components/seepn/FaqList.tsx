'use client'

// Design Ref: Figma U-10 FAQ (node 347:32) — 검색창 + Q/A 아코디언. 검색은 질문·답변에 대한 클라이언트
// 필터(항목 수가 적은 정적 콘텐츠라 서버 검색은 두지 않는다).
import { useMemo, useState } from 'react'

export interface FaqListItem {
  slug: string
  question: string
  answer: string
}

export function FaqList({ items }: { items: FaqListItem[] }) {
  const [query, setQuery] = useState('')
  const [openSlug, setOpenSlug] = useState<string | null>(items[0]?.slug ?? null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => i.question.toLowerCase().includes(q) || i.answer.toLowerCase().includes(q))
  }, [items, query])

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="궁금한 점을 검색해보세요"
        aria-label="FAQ 검색"
        className="w-full rounded-input border border-neutral-200 bg-white px-3.5 py-3 text-body-sm text-neutral-900 placeholder:text-neutral-500 focus:border-primary-500 focus:outline-none"
      />
      {filtered.length === 0 ? (
        <p className="mt-6 rounded-input border border-dashed border-neutral-200 bg-white p-10 text-center text-body-sm text-neutral-500">
          {items.length === 0 ? '등록된 질문이 없습니다.' : '검색 결과가 없습니다.'}
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {filtered.map((item) => {
            const open = openSlug === item.slug
            return (
              <li key={item.slug} className="rounded-[10px] border border-neutral-200 bg-white px-5 py-4">
                <button type="button" aria-expanded={open} onClick={() => setOpenSlug(open ? null : item.slug)} className="flex w-full items-center gap-2.5 text-left">
                  <span className="text-body-sm font-bold text-primary-600">Q</span>
                  <span className="flex-1 text-body-sm font-medium text-neutral-900">{item.question}</span>
                  <span aria-hidden="true" className="text-label-caption text-neutral-500">
                    {open ? '▲' : '▼'}
                  </span>
                </button>
                {open && (
                  <div className="mt-3 flex gap-2.5 border-t border-neutral-200 pt-3">
                    <span className="text-body-sm font-bold text-neutral-500">A</span>
                    <p className="flex-1 whitespace-pre-wrap text-[13px] text-neutral-700">{item.answer}</p>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
