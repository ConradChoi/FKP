'use client'

// Design Ref: ui-spec §2.2 — "우측: 계정 메뉴 — {display_name} ▾ 텍스트 버튼 클릭 시 드롭다운
// (설정 바로가기 / 로그아웃 2항목만). 아바타/이니셜 원형 아이콘은 넣지 않는다".
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupplierBrowserClient } from '@/lib/supabase/supplierBrowserClient'

export function AccountMenu({ displayName }: { displayName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleLogout() {
    const supabase = getSupplierBrowserClient()
    await supabase.auth.signOut()
    router.push('/supplier/login')
    router.refresh()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-body-sm text-neutral-700 hover:text-neutral-900"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {displayName} ▾
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-40 rounded-card border border-neutral-200 bg-neutral-0 py-1 shadow-lg"
        >
          <Link
            href="/supplier/profile/settings"
            role="menuitem"
            className="block px-4 py-2 text-body-sm text-neutral-700 hover:bg-neutral-50"
            onClick={() => setOpen(false)}
          >
            설정
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="block w-full px-4 py-2 text-left text-body-sm text-neutral-700 hover:bg-neutral-50"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  )
}
