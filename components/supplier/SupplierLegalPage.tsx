// Partner-side counterpart to components/LegalPage.tsx. Same approach, same renderer:
// read docs/legal/*.md from disk at render time and pass it through
// lib/legal/renderMarkdown (dependency-free, Tailwind-only — no new markdown library,
// per PRD OQ-7 and the buyer-side precedent).
//
// Reading straight from the .md file (rather than a re-typed copy in JSX) is what keeps the
// published page identical to the version-pinned source text that
// lib/legal/partnerConsentVersions.ts binds partner_consent.document_version to. If these two
// ever diverge, the consent records stop being provable against what the partner actually saw
// — which is the whole reason the buyer side does it this way too.
//
// The filename is derived from the version constant, not hardcoded, so bumping a version in
// partnerConsentVersions.ts (and adding the matching dated file) is the only edit needed.
import fs from 'node:fs'
import path from 'node:path'
import { renderLegalMarkdown } from '@/lib/legal/renderMarkdown'
import { SupplierFooter } from './SupplierFooter'

export function SupplierLegalPage({ documentVersion }: { documentVersion: string }) {
  const filePath = path.join(process.cwd(), 'docs', 'legal', `${documentVersion}-ko.md`)
  const markdown = fs.readFileSync(filePath, 'utf-8')
  const content = renderLegalMarkdown(markdown)

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <main className="mx-auto w-full max-w-[760px] flex-1 px-6 py-10">
        <article>{content}</article>
      </main>
      <SupplierFooter />
    </div>
  )
}
