// Design Ref: privacy review §7 (footer link + consent link target). Renders
// docs/legal/*.md directly so the published page and the version-pinned
// source text (see lib/legal/consentVersions.ts) stay identical.
// Phase 2: adds the shared Header so the "Request" nav entry point is present on every page
// (fkp-v0.2-phase2-request-ui.spec.md §4.4 — these pages previously had no header at all).
import fs from 'node:fs'
import path from 'node:path'
import Link from 'next/link'
import type { Dictionary, Locale } from '@/lib/i18n/types'
import { renderLegalMarkdown } from '@/lib/legal/renderMarkdown'
import { Header } from './Header'

type LegalSlug = 'privacy' | 'terms'

const FILE_MAP: Record<Locale, Record<LegalSlug, string>> = {
  en: { privacy: 'privacy-v1.0-en.md', terms: 'terms-v1.0-en.md' },
  ja: { privacy: 'privacy-v1.0-ja.md', terms: 'terms-v1.0-ja.md' },
}

interface LegalPageProps {
  locale: Locale
  slug: LegalSlug
  headerDict: Dictionary['header']
  backToHomeLabel: string
}

export function LegalPage({ locale, slug, headerDict, backToHomeLabel }: LegalPageProps) {
  const filePath = path.join(process.cwd(), 'docs', 'legal', FILE_MAP[locale][slug])
  const markdown = fs.readFileSync(filePath, 'utf-8')
  const content = renderLegalMarkdown(markdown)

  return (
    <main>
      <Header locale={locale} dict={headerDict} />
      <div className="px-section-x-mobile py-section-y lg:px-section-x">
        <div className="mx-auto max-w-[760px]">
          <Link href={`/${locale}`} className="text-body-sm text-primary-600 underline">
            {backToHomeLabel}
          </Link>
          <article className="mt-6">{content}</article>
        </div>
      </div>
    </main>
  )
}
