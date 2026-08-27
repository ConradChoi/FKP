import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getDictionary, locales } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/types'
import { getPublishedContentBySlug } from '@/lib/content/getPublishedContent'
import { ArticleDetailPage } from '@/components/ArticleDetailPage'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export const revalidate = 60

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const item = await getPublishedContentBySlug('case_study', slug, locale as Locale)
  if (!item) return {}
  return {
    title: item.title,
    description: item.excerpt || undefined,
    alternates: { canonical: `/${locale}/case-studies/${slug}` },
  }
}

export default async function CaseStudyDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const dict = getDictionary(locale as Locale)
  const item = await getPublishedContentBySlug('case_study', slug, locale as Locale)
  if (!item) notFound()

  return (
    <ArticleDetailPage
      locale={locale as Locale}
      headerDict={dict.header}
      footerDict={dict.footer}
      urlSegment="case-studies"
      backToList={dict.caseStudies.backToList}
      ctaTitle={dict.caseStudies.ctaTitle}
      ctaButton={dict.caseStudies.ctaButton}
      item={item}
    />
  )
}
