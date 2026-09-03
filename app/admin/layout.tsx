// Design Ref: E3-R10/E3-R13 — Admin is Korean-only (no [locale] segment) and excluded from
// search indexing. This is an independent root layout (its own <html>/<body>) because
// `/admin` is a separate top-level tree from `app/[locale]/`, which is the only other root
// layout in this app — Next.js supports multiple root layouts this way without route groups
// as long as each top-level directory owns a disjoint URL subtree, which /admin and
// /[locale] do.
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'FKP Admin',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={inter.variable}>
      <body className="font-admin-sans">{children}</body>
    </html>
  )
}
