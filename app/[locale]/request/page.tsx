// Design Ref: fkp-v0.2-phase2-request-flow.spec.md §3 (E2-R7 — dedicated outreach link,
// no marketing sections), fkp-v0.2-phase2-request-ui.spec.md §5.
import { getDictionary, locales } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/types'
import { getLandingCopyMap } from '@/lib/content/getLandingCopy'
import { AnalyticsPageView } from '@/components/AnalyticsPageView'
import { RequestPageShell } from '@/components/RequestPageShell'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

// Design Ref: Phase 5-C — /[locale]와 동일하게 ISR 60초 (footer 소개문구도 DB 기반).
export const revalidate = 60

export default async function RequestPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const dict = getDictionary(locale as Locale)
  const copy = await getLandingCopyMap(locale as Locale)

  const footerDict = {
    ...dict.footer,
    intro: copy['landing.footer.intro'] ?? dict.footer.intro,
  }

  return (
    <>
      <AnalyticsPageView path={`/${locale}/request`} />
      <RequestPageShell
        headerDict={dict.header}
        introText={dict.requestPage.intro}
        requestFormDict={dict.requestForm}
        categoriesDict={dict.categories}
        footerDict={footerDict}
        locale={locale as Locale}
      />
    </>
  )
}
