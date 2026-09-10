// Design Ref: screen-spec §1.2 (/seepn/my/*) + middleware.ts guardBuyer (session-PRESENCE gate
// only) — this layout adds the deeper business-rule gate (requireBuyerSession: withdrawn/
// suspended/no-row -> redirect) exactly like app/supplier/profile/layout.tsx does for /supplier.
import Link from 'next/link'
import { requireBuyerSession } from '@/lib/seepn/session'
import { AccountMenu } from '@/components/seepn/AccountMenu'
import { SeepnFooter } from '@/components/seepn/SeepnFooter'

export const dynamic = 'force-dynamic'

export default async function SeepnMyLayout({ children }: { children: React.ReactNode }) {
  const session = await requireBuyerSession()

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-neutral-0">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/seepn/partners" className="text-label-button text-primary-700">
            SEEPN
          </Link>
          <nav className="flex items-center gap-4 text-body-sm">
            <Link href="/seepn/my/bookmarks" className="text-neutral-600 hover:underline">
              관심목록
            </Link>
            <Link href="/seepn/my/inquiries" className="text-neutral-600 hover:underline">
              내 문의
            </Link>
            <AccountMenu displayName={session.account.display_name} />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      <SeepnFooter />
    </div>
  )
}
