import Link from 'next/link'
import { SupplierFooter } from './SupplierFooter'

// Design Ref: docs/02-design/features/partner-supplier-app.ui-spec.md §2.1 — unauthenticated
// screen shell (SUP-01/02/03/04/05/06/07). Centered 420px card on a neutral-50 background,
// wordmark linking out (not to /supplier/profile — there is no session yet on any of these
// screens), optional step-progress slot for SUP-02/03.
export function AuthShell({
  title,
  subtitle,
  progress,
  children,
}: {
  title: string
  subtitle?: string
  progress?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[420px] rounded-card border border-neutral-200 bg-neutral-0 p-8 shadow-sm">
          <Link href="/supplier/login" className="text-label-button text-primary-700">
            SEEPN Partner
          </Link>
          {progress && <div className="mt-4">{progress}</div>}
          <h1 className="mt-4 text-h3 text-neutral-900">{title}</h1>
          {subtitle && <p className="mt-1 text-body-sm text-neutral-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
      <SupplierFooter />
    </div>
  )
}
