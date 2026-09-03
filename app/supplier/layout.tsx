// Design Ref: app/admin/layout.tsx (the pattern this mirrors — see that file's comment for why
// multiple disjoint top-level root layouts are valid in this app) + screen-spec §1.4 (D-S1:
// independent top-level route, not nested under app/[locale]/) + privacy review UI-R1 ("/supplier
// 라우트에 GTM/GA4를 절대 로드하지 말 것 ... 현재는 상속하지 않는다(확인됨) ... 가드레일을
// 문서로 못박는다"). This file IS that guardrail: as long as no Script/gtag call is added here,
// /supplier structurally cannot inherit app/[locale]/layout.tsx's GTM/GA4 (disjoint root layout,
// same reasoning as admin's).
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'SEEPN Partner',
  robots: { index: false, follow: false },
}

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
