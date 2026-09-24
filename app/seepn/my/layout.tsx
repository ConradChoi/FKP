// Design Ref: screen-spec §1.2 (/seepn/my/*) + middleware.ts guardBuyer (session-PRESENCE gate
// only) — this layout adds the deeper business-rule gate (requireBuyerSession: withdrawn/
// suspended/no-row -> redirect) exactly like app/supplier/profile/layout.tsx does for /supplier.
import Link from 'next/link'
import { requireBuyerSession } from '@/lib/seepn/session'
import { AccountMenu } from '@/components/seepn/AccountMenu'
import { SeepnFooter } from '@/components/seepn/SeepnFooter'
import { SeepnMainHeader } from '@/components/seepn/SeepnMainChrome'

export const dynamic = 'force-dynamic'

export default async function SeepnMyLayout({ children }: { children: React.ReactNode }) {
  const session = await requireBuyerSession()

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <SeepnMainHeader
        account={<AccountMenu displayName={session.account.display_name} triggerClassName="rounded-full bg-primary-600 px-4 py-2 text-body-sm font-semibold text-white hover:bg-primary-700" />}
      />
      <nav className="border-b border-neutral-200 bg-neutral-0">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 text-body-sm">
          <Link href="/seepn/my/bookmarks" className="text-neutral-600 hover:underline">
            관심목록
          </Link>
          <Link href="/seepn/my/inquiries" className="text-neutral-600 hover:underline">
            내 문의
          </Link>
        </div>
      </nav>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      <SeepnFooter />
    </div>
  )
}
