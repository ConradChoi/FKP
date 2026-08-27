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
    title: dict.blog.pageTitle,
    alternates: { canonical: `/${locale}/blog` },
  }
}

export default async function BlogListPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const dict = getDictionary(locale as Locale)
  const items = await getPublishedContentList('blog', locale as Locale)

  return (
    <ArticleListPage
      locale={locale as Locale}
      headerDict={dict.header}
      footerDict={dict.footer}
      urlSegment="blog"
      pageTitle={dict.blog.pageTitle}
      emptyState={dict.blog.emptyState}
      items={items}
    />
  )
}
