// Design Ref: Figma "Seepn 2.0 — UI Design" User App frames U-01 Main / U-CQ-Full — both share
// the same dark-navy header. Extracted from app/seepn/home/page.tsx so the home and the
// 전체 카테고리 page render one header instead of two drifting copies.
import Link from 'next/link'
import { HeaderAccount } from '@/components/seepn/HeaderAccount'

export function SeepnMainHeader({ account }: { account?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 bg-[#0f1732]">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/seepn/home" className="text-body-lg font-semibold text-white">
            SEEPN
          </Link>
          <nav className="hidden items-center gap-6 text-body-sm text-[#b2bfd9] md:flex">
            <Link href="/seepn/partners" className="hover:text-white">
              공급사 찾기
            </Link>
            <span className="cursor-default text-[#6b7699]">TOP100</span>
            <span className="cursor-default text-[#6b7699]">커뮤니티</span>
            <span className="cursor-default text-[#6b7699]">인사이트</span>
            <span className="cursor-default text-[#6b7699]">FAQ</span>
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
            className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-label-caption text-white hover:bg-white/20"
          >
            공급사 등록
          </Link>
          {account ?? <HeaderAccount />}
          <Link href="/seepn/my" className="rounded-full bg-white/10 px-4 py-2 text-label-caption text-[#99a6bf] hover:bg-white/20">
            마이페이지
          </Link>
        </div>
      </div>
    </header>
  )
}
