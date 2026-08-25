// Design Ref: fkp-v0.2-phase2-request-flow.spec.md §13 (v1.2) — Header / Hero (hosts the full
// Step1-3 carousel + confirm modal, no separate continuation panel) / HowItWorks / Categories /
// WhyUs / Footer.
import { getDictionary, locales } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/types'
import { AnalyticsPageView } from '@/components/AnalyticsPageView'
import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { HowItWorks } from '@/components/HowItWorks'
import { Categories } from '@/components/Categories'
import { WhyUs } from '@/components/WhyUs'
import { Footer } from '@/components/Footer'
import { HomeFlowProvider } from '@/components/RequestFlow/HomeFlowProvider'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const dict = getDictionary(locale as Locale)

  return (
    <main>
      <AnalyticsPageView path={`/${locale}`} />

      <HomeFlowProvider dict={dict.requestForm} categoriesDict={dict.categories} locale={locale as Locale}>
        <Header locale={locale as Locale} dict={dict.header} />

        <Hero
          dict={dict.hero}
          requestFormDict={dict.requestForm}
          categoriesDict={dict.categories}
          locale={locale as Locale}
        />

        <HowItWorks dict={dict.howItWorks} />
        <Categories dict={dict.categories} />
        <WhyUs dict={dict.whyUs} />

        <Footer dict={dict.footer} locale={locale as Locale} />
      </HomeFlowProvider>
    </main>
  )
}
