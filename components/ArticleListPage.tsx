// Design Ref: fkp-v0.2-phase5d-blog-case-faq.spec.md §4.1 — blog/case_study 공용 목록 템플릿.
import Link from 'next/link'
import type { Dictionary, Locale } from '@/lib/i18n/types'
import { Header } from './Header'
import { Footer } from './Footer'
import type { PublishedListItem } from '@/lib/content/getPublishedContent'

interface ArticleListPageProps {
  locale: Locale
  headerDict: Dictionary['header']
  footerDict: Dictionary['footer']
  urlSegment: string
  pageTitle: string
  emptyState: string
  items: PublishedListItem[]
}

export function ArticleListPage({
  locale,
  headerDict,
  footerDict,
  urlSegment,
  pageTitle,
  emptyState,
  items,
}: ArticleListPageProps) {
  return (
    <main>
      <Header locale={locale} dict={headerDict} />
      <div className="px-section-x-mobile py-section-y lg:px-section-x">
        <div className="mx-auto max-w-[1000px]">
          <h1 className="text-h2 text-neutral-900">{pageTitle}</h1>
          {items.length === 0 ? (
            <p className="mt-6 text-body text-neutral-500">{emptyState}</p>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
              {items.map((item) => (
                <Link
                  key={item.slug}
                  href={`/${locale}/${urlSegment}/${item.slug}`}
                  className="rounded-card border border-neutral-200 bg-neutral-0 p-6 transition-colors hover:border-primary-300 hover:bg-primary-50"
                >
                  <h2 className="text-h3 text-neutral-900">{item.title}</h2>
                  {item.excerpt && <p className="mt-2 line-clamp-3 text-body-sm text-neutral-600">{item.excerpt}</p>}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer dict={footerDict} locale={locale} />
    </main>
  )
}
