// Design Ref: notice-board.screen-spec.md §4.1 — a lightweight shell (topbar + body +
// SupplierFooter), deliberately NOT reusing SupplierProfileShell (its submission
// checklist/status banner/tabs are unrelated to a notice list and would be confusing here).
// Modeled after app/supplier/support/page.tsx's "shell-less, hand-assembled header + footer"
// precedent, but factored into its own component since /supplier/notices has two routes
// (list + detail) that both need the same header/footer.
import Link from 'next/link'
import { AccountMenu } from './AccountMenu'
import { SupplierFooter } from './SupplierFooter'

export function SupplierNoticesShell({ displayName, children }: { displayName: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-neutral-0 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/supplier/profile" className="text-label-button text-primary-700">
            SEEPN Partner
          </Link>
          <AccountMenu displayName={displayName} />
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-6 pt-4">
        <Link href="/supplier/profile" className="text-body-sm text-primary-600 hover:underline">
          ← 프로필로 돌아가기
        </Link>
      </div>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
      <SupplierFooter />
    </div>
  )
}
