'use client'

// Design Ref: Figma "Seepn 2.0 — UI Design" U-11 마이페이지 (node 42:2) side-menu — blue profile
// block + vertical menu with the active item highlighted. All 8 Figma menu items are kept; each
// destination is a live route; features not built yet render MyComingSoon until implemented.
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const MENU = [
  { href: '/seepn/my', label: '마이페이지 홈' },
  { href: '/seepn/my/profile', label: '회원정보 변경' },
  { href: '/seepn/my/password', label: '비밀번호 변경' },
  { href: '/seepn/my/bookmarks', label: '찜한 공급사' },
  { href: '/seepn/my/compared', label: '비교 공급사' },
  { href: '/seepn/my/deals', label: '거래 공급사' },
  { href: '/seepn/my/inquiries', label: '1:1 문의' },
  { href: '/seepn/my/withdraw', label: '회원 탈퇴' },
]

export function MyPageSidebar({ displayName }: { displayName: string }) {
  const pathname = usePathname()
  return (
    <aside className="self-start overflow-hidden rounded-input border border-neutral-200 bg-white">
      <div className="flex flex-col items-center gap-2 bg-primary-600 px-4 py-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-body-lg font-bold text-primary-600">
          {displayName.slice(0, 1)}
        </span>
        <span className="max-w-full truncate text-body-sm font-semibold text-white">{displayName}</span>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-4 lg:block">
        {MENU.map((item) => {
          const active = item.href === '/seepn/my' ? pathname === '/seepn/my' : pathname.startsWith(item.href)
          return (
            <li key={item.href} className="border-t border-neutral-100">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`block px-5 py-4 text-body-sm ${
                  active ? 'border-l-[3px] border-primary-600 bg-primary-50 font-semibold text-primary-600' : 'border-l-[3px] border-transparent text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
