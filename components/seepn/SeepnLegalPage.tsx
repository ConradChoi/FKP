// Design Ref: components/supplier/SupplierLegalPage.tsx — same "read docs/legal/*.md straight
// from disk, never a re-typed copy" binding to lib/legal/buyerConsentVersions.ts. One deliberate
// difference: as of this round docs/legal/seepn-buyer-{terms,privacy}-v1.0-2026-09-ko.md do NOT
// exist yet (SEEPN_BUYER_SIGNUP_ENABLED is false precisely because of this) — reading them with
// SupplierLegalPage's unguarded fs.readFileSync would 500 this route today. This component
// catches that ENOENT and renders a "준비 중" placeholder instead, so the route/link structure
// (and the DoD requirement that a signup screen link out to /seepn/legal/*) can exist NOW without
// crashing the build or the page, without ever inventing placeholder legal TEXT (privacy review
// §8.3 BP-9 explicitly forbids a "ko fallback + 정식 번역 준비 중" trick for REAL consent — this
// is not that: no consent is collected by this page, and SEEPN_BUYER_SIGNUP_ENABLED already keeps
// the signup API itself closed regardless of what this page renders).
import fs from 'node:fs'
import path from 'node:path'
import { renderLegalMarkdown } from '@/lib/legal/renderMarkdown'
import { SeepnFooter } from './SeepnFooter'

export function SeepnLegalPage({ documentVersion }: { documentVersion: string }) {
  const filePath = path.join(process.cwd(), 'docs', 'legal', `${documentVersion}-ko.md`)

  let content: React.ReactNode
  try {
    const markdown = fs.readFileSync(filePath, 'utf-8')
    content = renderLegalMarkdown(markdown)
  } catch {
    content = (
      <p className="text-body text-neutral-500">
        이 문서는 아직 준비 중입니다. SEEPN 회원가입이 열리기 전에 게시됩니다.
      </p>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <main className="mx-auto w-full max-w-[760px] flex-1 px-6 py-10">
        <article>{content}</article>
      </main>
      <SeepnFooter />
    </div>
  )
}
