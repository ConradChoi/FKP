'use client'

// Design Ref: Figma U-CQ-L3 Modal (node 101:308) — "외 N개 →" on an L2 card opens the full L3 list
// with per-row counts. Each row links to the partner list filtered by that L3 category.
import Link from 'next/link'
import { useEffect, useState } from 'react'

export interface CategoryL3ModalItem {
  id: string
  name: string
  count: number
}

export function CategoryL3ModalTrigger({ title, items, label }: { title: string; items: CategoryL3ModalItem[]; label: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-1 text-label-caption text-primary-600 hover:underline">
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${title} — 전체 하위 카테고리`}
            className="flex max-h-[80vh] w-full max-w-[520px] flex-col overflow-hidden rounded-card bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <p className="text-body-sm font-semibold text-neutral-900">{title} — 전체 하위 카테고리</p>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-label-caption text-neutral-600 hover:bg-neutral-200"
              >
                ✕
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto overscroll-contain">
              {items.map((item) => (
                <li key={item.id} className="border-b border-neutral-200 last:border-b-0">
                  <Link
                    href={`/seepn/partners?category=${item.id}`}
                    className="flex items-center justify-between px-4 py-3.5 text-body-sm text-neutral-800 hover:bg-primary-50"
                  >
                    <span>{item.name}</span>
                    <span className="flex items-center gap-2 text-label-caption text-neutral-400">
                      {item.count}개<span aria-hidden="true">›</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setOpen(false)} className="border-t border-neutral-200 py-3.5 text-body-sm text-neutral-600 hover:bg-neutral-50">
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  )
}
