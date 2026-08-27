import type { Metadata } from 'next'
import { getDictionary, locales } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/types'
import { getPublishedContentList } from '@/lib/content/getPublishedContent'
import { ArticleListPage } from '@/components/ArticleListPage'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const dict = getDictionary(locale as Locale)
  return {
    title: dict.caseStudies.pageTitle,
    alternates: { canonical: `/${locale}/case-studies` },
  }
}

export default async function CaseStudiesListPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const dict = getDictionary(locale as Locale)
  const items = await getPublishedContentList('case_study', locale as Locale)

  return (
    <ArticleListPage
      locale={locale as Locale}
      headerDict={dict.header}
      footerDict={dict.footer}
      urlSegment="case-studies"
      pageTitle={dict.caseStudies.pageTitle}
      emptyState={dict.caseStudies.emptyState}
      items={items}
    />
  )
}
