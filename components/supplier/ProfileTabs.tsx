'use client'

// Design Ref: ui-spec §2.2/§6.1/§8 — tab nav with role=tablist/tab, unmet-field dot indicator
// per tab, arrow-key navigation (WAI-ARIA Tabs pattern), and the dirty-guard interception on
// tab-switch clicks (§6.3/§9 item 5 — "탭 링크를 <Link>가 아니라 onClick에서 dirty 체크 후
// router.push 호출").
import { useRouter, usePathname } from 'next/navigation'
import { useRef } from 'react'
import type { SupplierTabId } from '@/lib/supplier/tabGaps'
import { useDirtyGuard } from './DirtyGuard'

const TABS: { id: SupplierTabId; label: string; href: string }[] = [
  { id: 'basic', label: '기본정보', href: '/supplier/profile/basic' },
  { id: 'capability', label: '역량정보', href: '/supplier/profile/capability' },
  { id: 'documents', label: '문서', href: '/supplier/profile/documents' },
  { id: 'contact', label: '연락처', href: '/supplier/profile/contact' },
  { id: 'settings', label: '설정', href: '/supplier/profile/settings' },
]

export function ProfileTabs({ unmetTabs }: { unmetTabs: SupplierTabId[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const { confirmNavigateAway, setDirty } = useDirtyGuard()

  function navigate(href: string) {
    if (pathname === href) return
    if (!confirmNavigateAway()) return
    setDirty(false)
    router.push(href)
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const next = (index + 1) % TABS.length
      buttonRefs.current[next]?.focus()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prev = (index - 1 + TABS.length) % TABS.length
      buttonRefs.current[prev]?.focus()
    }
  }

  return (
    <div role="tablist" aria-label="파트너 프로필 탭" className="flex gap-1 overflow-x-auto border-b border-neutral-200">
      {TABS.map((tab, index) => {
        const active = pathname === tab.href
        const hasGap = unmetTabs.includes(tab.id)
        return (
          <button
            key={tab.id}
            ref={(el) => {
              buttonRefs.current[index] = el
            }}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={hasGap ? `${tab.label}, 필수 항목 미입력` : tab.label}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onClick={() => navigate(tab.href)}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-body-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
              active ? 'border-primary-600 text-primary-700' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {tab.label}
            {hasGap && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-500" />}
          </button>
        )
      })}
    </div>
  )
}
