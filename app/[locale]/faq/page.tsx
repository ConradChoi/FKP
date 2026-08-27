import type { Metadata } from 'next'
import { getDictionary, locales } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/types'
import { getPublishedFaqList } from '@/lib/content/getPublishedContent'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { FaqAccordion } from '@/components/FaqAccordion'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const dict = getDictionary(locale as Locale)
  return {
    title: dict.faq.pageTitle,
    alternates: { canonical: `/${locale}/faq` },
  }
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const dict = getDictionary(locale as Locale)
  const items = await getPublishedFaqList(locale as Locale)

  return (
    <main>
      <Header locale={locale as Locale} dict={dict.header} />
      <div className="px-section-x-mobile py-section-y lg:px-section-x">
        <div className="mx-auto max-w-[760px]">
          <h1 className="text-h2 text-neutral-900">{dict.faq.pageTitle}</h1>
          {items.length === 0 ? (
            <p className="mt-6 text-body text-neutral-500">{dict.faq.emptyState}</p>
          ) : (
            <FaqAccordion items={items} />
          )}
        </div>
      </div>
      <Footer dict={dict.footer} locale={locale as Locale} />
    </main>
  )
}
