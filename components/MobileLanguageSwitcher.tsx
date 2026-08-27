// Design Ref: 대표 피드백(2026-08-27) — 모바일 Header는 EN|JA 텍스트 대신 지구본 아이콘 하나로
// 축약하고, 탭하면 언어 선택 드롭다운이 열린다. 진행 중인 요청이 있을 때 전환 전 경고하는 로직
// (LanguageSwitcher와 동일)은 그대로 유지한다.
'use client'

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import Link from 'next/link'
import type { Dictionary, Locale } from '@/lib/i18n/types'
import { useRequestFlowStatus } from './RequestFlow/RequestFlowStatusContext'
import { GlobeIcon } from './icons/GlobeIcon'

export function MobileLanguageSwitcher({
  currentLocale,
  dict,
}: {
  currentLocale: Locale
  dict: Dictionary['header']['languageSwitcher']
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const flow = useRequestFlowStatus()

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function handleSelect(e: ReactMouseEvent<HTMLAnchorElement>) {
    if (flow?.hasUnsavedProgress) {
      const proceed = window.confirm(dict.switchWarning)
      if (!proceed) {
        e.preventDefault()
        return
      }
    }
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Language"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-input text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
      >
        <GlobeIcon className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 min-w-[100px] rounded-card border border-neutral-200 bg-neutral-0 py-1 shadow-lg">
          <Link
            href="/en"
            aria-current={currentLocale === 'en' ? 'page' : undefined}
            onClick={handleSelect}
            className={`block px-4 py-2 text-body-sm ${currentLocale === 'en' ? 'font-medium text-primary-600' : 'text-neutral-600'}`}
          >
            {dict.en}
          </Link>
          <Link
            href="/ja"
            aria-current={currentLocale === 'ja' ? 'page' : undefined}
            onClick={handleSelect}
            className={`block px-4 py-2 text-body-sm ${currentLocale === 'ja' ? 'font-medium text-primary-600' : 'text-neutral-600'}`}
          >
            {dict.ja}
          </Link>
        </div>
      )}
    </div>
  )
}
