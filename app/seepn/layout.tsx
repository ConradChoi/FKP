// Design Ref: app/supplier/layout.tsx (the pattern this mirrors — independent top-level root
// layout, same "structurally cannot inherit app/[locale]/layout.tsx's GTM/GA4" guarantee) +
// screen-spec §1.2 (D-S1: /seepn/* is an independent top-level route).
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'SEEPN',
  robots: { index: false, follow: false },
}

export default function SeepnLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
