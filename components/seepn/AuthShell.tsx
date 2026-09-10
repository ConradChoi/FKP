import Link from 'next/link'
import { SeepnFooter } from './SeepnFooter'

// Design Ref: components/supplier/AuthShell.tsx — same layout convention (centered 420px card),
// independent copy per the task's "완전히 새로운 경로/컴포넌트로 만들 것(공유 금지)" instruction.
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
          <Link href="/seepn/partners" className="text-label-button text-primary-700">
            SEEPN
          </Link>
          {progress && <div className="mt-4">{progress}</div>}
          <h1 className="mt-4 text-h3 text-neutral-900">{title}</h1>
          {subtitle && <p className="mt-1 text-body-sm text-neutral-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
      <SeepnFooter />
    </div>
  )
}
