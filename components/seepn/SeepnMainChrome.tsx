// Design Ref: Figma "Seepn 2.0 — UI Design" User App frames U-01 Main / U-CQ-Full — both share
// the same dark-navy header. Extracted from app/seepn/home/page.tsx so the home and the
// 전체 카테고리 page render one header instead of two drifting copies.
import Link from 'next/link'
import { HeaderAccount } from '@/components/seepn/HeaderAccount'

export function SeepnMainHeader({ account, active }: { account?: React.ReactNode; active?: 'partners' | 'top100' | 'community' | 'insights' | 'faq' }) {
  return (
    <header className="sticky top-0 z-40 bg-[#0f1732]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 md:h-[72px]">
        <div className="flex items-center gap-8">
          <Link href="/seepn/home" className="text-body-lg font-semibold text-white">
            SEEPN
          </Link>
          <nav className="hidden items-center gap-6 text-body-sm text-[#b2bfd9] md:flex">
            <NavLink href="/seepn/partners" current={active === 'partners'}>
              공급사 찾기
            </NavLink>
            <NavLink href="/seepn/top100" current={active === 'top100'}>
              TOP100
            </NavLink>
            <NavLink href="/seepn/community" current={active === 'community'}>
              커뮤니티
            </NavLink>
            <NavLink href="/seepn/insights" current={active === 'insights'}>
              인사이트
            </NavLink>
            <NavLink href="/seepn/faq" current={active === 'faq'}>
              FAQ
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <form action="/seepn/partners" method="get" className="hidden lg:block">
            <input
              type="text"
              name="q"
              placeholder="공급사, 품목명으로 검색"
              className="w-[300px] rounded-input bg-[#254182] px-4 py-2 text-body-sm text-white placeholder:text-[#808cb2] focus:outline-none"
            />
          </form>
          <Link
            href="/supplier/signup"
            className="hidden rounded-full border border-white/30 bg-white/10 px-4 py-2 text-label-caption text-white hover:bg-white/20 sm:inline-block"
          >
            공급사 등록
          </Link>
          {account ?? <HeaderAccount />}
          <Link href="/seepn/my" className="hidden rounded-full bg-white/10 px-4 py-2 text-label-caption text-[#99a6bf] hover:bg-white/20 sm:inline-block">
            마이페이지
          </Link>
        </div>
      </div>
      {/* 모바일: 데스크톱 메뉴가 숨겨지므로 가로 스크롤 메뉴를 둔다(마이페이지도 여기서 접근). */}
      <nav aria-label="주요 메뉴" className="flex gap-5 overflow-x-auto border-t border-white/10 px-4 py-2.5 text-body-sm text-[#b2bfd9] sm:px-6 md:hidden">
        {[
          ['/seepn/partners', '공급사 찾기'],
          ['/seepn/top100', 'TOP100'],
          ['/seepn/community', '커뮤니티'],
          ['/seepn/insights', '인사이트'],
          ['/seepn/faq', 'FAQ'],
          ['/seepn/my', '마이페이지'],
          ['/supplier/signup', '공급사 등록'],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="shrink-0 hover:text-white">
            {label}
          </Link>
        ))}
      </nav>
    </header>
  )
}

function NavLink({ href, current, children }: { href: string; current: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={current ? 'relative font-semibold text-white after:absolute after:inset-x-0 after:-bottom-[25px] after:h-[3px] after:bg-[#60a5fa]' : 'hover:text-white'}
    >
      {children}
    </Link>
  )
}
