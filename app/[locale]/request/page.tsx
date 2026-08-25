// Design Ref: fkp-v0.2-phase2-request-flow.spec.md §3 (E2-R7 — dedicated outreach link,
// no marketing sections), fkp-v0.2-phase2-request-ui.spec.md §5.
import { getDictionary, locales } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/types'
import { AnalyticsPageView } from '@/components/AnalyticsPageView'
import { RequestPageShell } from '@/components/RequestPageShell'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function RequestPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const dict = getDictionary(locale as Locale)

  return (
    <>
      <AnalyticsPageView path={`/${locale}/request`} />
      <RequestPageShell
        headerDict={dict.header}
        introText={dict.requestPage.intro}
        requestFormDict={dict.requestForm}
        categoriesDict={dict.categories}
        footerDict={dict.footer}
        locale={locale as Locale}
      />
    </>
  )
}
