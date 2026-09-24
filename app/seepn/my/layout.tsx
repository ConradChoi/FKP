// Design Ref: screen-spec §1.2 (/seepn/my/*) + middleware.ts guardBuyer (session-PRESENCE gate
// only) — this layout adds the deeper business-rule gate (requireBuyerSession: withdrawn/
// suspended/no-row -> redirect) exactly like app/supplier/profile/layout.tsx does for /supplier.
// Page frame follows Figma U-11 마이페이지 (node 42:2): title + subtitle, then side menu | content.
import { requireBuyerSession } from '@/lib/seepn/session'
import { AccountMenu } from '@/components/seepn/AccountMenu'
import { SeepnFooter } from '@/components/seepn/SeepnFooter'
import { SeepnMainHeader } from '@/components/seepn/SeepnMainChrome'
import { MyPageSidebar } from '@/components/seepn/MyPageSidebar'

export const dynamic = 'force-dynamic'

export default async function SeepnMyLayout({ children }: { children: React.ReactNode }) {
  const session = await requireBuyerSession()

  return (
    <div className="flex min-h-screen flex-col bg-[#f9fafb]">
      <SeepnMainHeader
        account={<AccountMenu displayName={session.account.display_name} triggerClassName="rounded-full bg-primary-600 px-4 py-2 text-body-sm font-semibold text-white hover:bg-primary-700" />}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <h1 className="text-[24px] font-bold text-neutral-900">마이페이지</h1>
        <p className="mt-1 text-body-sm text-neutral-500">내 계정을 관리하고 관심 공급사와 문의 내역을 확인하세요</p>
        <div className="mt-5 border-t border-neutral-200" />
        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
          <MyPageSidebar displayName={session.account.display_name} />
          <div className="min-w-0">{children}</div>
        </div>
      </main>
      <SeepnFooter />
    </div>
  )
}
