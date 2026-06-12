// Design Ref: §5.1 Screen Layout — Header / Hero / HowItWorks / Categories / WhyUs / RequestForm / Footer
import { getDictionary, locales } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/types'
import { AnalyticsPageView } from '@/components/AnalyticsPageView'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Hero } from '@/components/Hero'
import { HowItWorks } from '@/components/HowItWorks'
import { Categories } from '@/components/Categories'
import { WhyUs } from '@/components/WhyUs'
import { RequestForm } from '@/components/RequestForm/RequestForm'
import { Footer } from '@/components/Footer'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const dict = getDictionary(locale as Locale)

  return (
    <main>
      <AnalyticsPageView path={`/${locale}`} />

      <header className="flex items-center justify-between border-b border-neutral-200 px-section-x-mobile py-4 lg:px-section-x">
        <span className="text-h3 text-primary-900">{dict.header.logo}</span>
        <LanguageSwitcher currentLocale={locale as Locale} dict={dict.header.languageSwitcher} />
      </header>

      <Hero dict={dict.hero} />
      <HowItWorks dict={dict.howItWorks} />
      <Categories dict={dict.categories} />
      <WhyUs dict={dict.whyUs} />

      <RequestForm dict={dict.requestForm} categoriesDict={dict.categories} locale={locale as Locale} />

      <Footer dict={dict.footer} />
    </main>
  )
}
