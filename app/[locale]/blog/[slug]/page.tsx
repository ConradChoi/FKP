import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getDictionary, locales } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/types'
import { getPublishedContentBySlug } from '@/lib/content/getPublishedContent'
import { ArticleDetailPage } from '@/components/ArticleDetailPage'

export function generateStaticParams() {
  // Design Ref: fkp-v0.2-phase5d-blog-case-faq.spec.md §4.2 — locale에는 generateStaticParams를
  // 적용하되 slug에는 적용하지 않는다(빌드 타임에 DB 목록을 알 수 없음). 나머지 slug 요청은
  // 온디맨드로 렌더링된다.
  return locales.map((locale) => ({ locale }))
}

export const revalidate = 60

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const item = await getPublishedContentBySlug('blog', slug, locale as Locale)
  if (!item) return {}
  return {
    title: item.title,
    description: item.excerpt || undefined,
    alternates: { canonical: `/${locale}/blog/${slug}` },
  }
}

export default async function BlogDetailPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params
  const dict = getDictionary(locale as Locale)
  const item = await getPublishedContentBySlug('blog', slug, locale as Locale)
  if (!item) notFound()

  return (
    <ArticleDetailPage
      locale={locale as Locale}
      headerDict={dict.header}
      footerDict={dict.footer}
      urlSegment="blog"
      backToList={dict.blog.backToList}
      ctaTitle={dict.blog.ctaTitle}
      ctaButton={dict.blog.ctaButton}
      item={item}
    />
  )
}
