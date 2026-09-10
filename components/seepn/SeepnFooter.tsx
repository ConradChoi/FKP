import Link from 'next/link'

// Design Ref: components/supplier/SupplierFooter.tsx — same "2클릭 내 이용약관/개인정보처리방침
// 도달" requirement (privacy review §8), independent copy per the task's "공유 금지" instruction.
export function SeepnFooter() {
  return (
    <footer className="border-t border-neutral-200 py-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-6 text-label-caption text-neutral-500">
        <Link href="/seepn/legal/terms" className="hover:text-neutral-700 hover:underline">
          이용약관
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/seepn/legal/privacy" className="hover:text-neutral-700 hover:underline">
          개인정보처리방침
        </Link>
      </div>
    </footer>
  )
}
