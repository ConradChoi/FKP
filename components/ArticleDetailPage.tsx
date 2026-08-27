// Design Ref: fkp-v0.2-phase5d-blog-case-faq.spec.md §4.2 — blog/case_study 공용 상세 템플릿.
import Link from 'next/link'
import type { Dictionary, Locale } from '@/lib/i18n/types'
import { Header } from './Header'
import { Footer } from './Footer'
import { renderContentMarkdown } from '@/lib/content/renderMarkdown'
import type { PublishedDetailItem } from '@/lib/content/getPublishedContent'

interface ArticleDetailPageProps {
  locale: Locale
  headerDict: Dictionary['header']
  footerDict: Dictionary['footer']
  urlSegment: string
  backToList: string
  ctaTitle: string
  ctaButton: string
  item: PublishedDetailItem
}

export function ArticleDetailPage({
  locale,
  headerDict,
  footerDict,
  urlSegment,
  backToList,
  ctaTitle,
  ctaButton,
  item,
}: ArticleDetailPageProps) {
  return (
    <main>
      <Header locale={locale} dict={headerDict} />
      <div className="px-section-x-mobile py-section-y lg:px-section-x">
        <div className="mx-auto max-w-[760px]">
          <Link href={`/${locale}/${urlSegment}`} className="text-body-sm text-primary-600 underline">
            {backToList}
          </Link>
          <article className="mt-6">
            <h1 className="text-h2 text-neutral-900">{item.title}</h1>
            {renderContentMarkdown(item.bodyMarkdown)}
          </article>
          <div className="mt-10 rounded-card bg-primary-50 p-6 text-center">
            <p className="text-h3 text-primary-900">{ctaTitle}</p>
            <Link
              href={`/${locale}/request`}
              className="mt-4 inline-block rounded-input bg-primary-600 px-6 py-3 text-label-button text-neutral-0 transition-colors hover:bg-primary-700"
            >
              {ctaButton}
            </Link>
          </div>
        </div>
      </div>
      <Footer dict={footerDict} locale={locale} />
    </main>
  )
}
