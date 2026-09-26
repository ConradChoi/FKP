import Link from 'next/link'

// Design Ref: components/supplier/SupplierFooter.tsx — same "2클릭 내 이용약관/개인정보처리방침
// 도달" requirement (privacy review §8), independent copy per the task's "공유 금지" instruction.
// Single footer for every /seepn page, matching the seepn.me home footer (copyright row above the
// legal links) — pages must not render their own variants.
export function SeepnFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-3 text-label-caption text-neutral-400">© 2026 SEEPN Inc. All rights reserved.</div>
      <div className="border-t border-neutral-100 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-6 text-label-caption text-neutral-500">
          <Link href="/seepn/notices" className="hover:text-neutral-700 hover:underline">
            공지사항
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/seepn/legal/terms" className="hover:text-neutral-700 hover:underline">
            이용약관
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/seepn/legal/privacy" className="hover:text-neutral-700 hover:underline">
            개인정보처리방침
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/seepn/legal/takedown" className="hover:text-neutral-700 hover:underline">
            게시중단 요청
          </Link>
        </div>
      </div>
    </footer>
  )
}
