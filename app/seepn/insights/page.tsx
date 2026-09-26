// Design Ref: Figma U-08-01 인사이트 목록 (node 344:2) — 카테고리 탭 + 3열 카드. 콘텐츠는 admin >
// 게시판 > SEEPN 인사이트에서 게시한 것만 보인다(lib/content/getPublishedSeepnContent.ts).
import Link from 'next/link'
import { getPublishedSeepnInsights, SEEPN_INSIGHT_CATEGORIES } from '@/lib/content/getPublishedSeepnContent'
import { SeepnMainHeader } from '@/components/seepn/SeepnMainChrome'
import { SeepnFooter } from '@/components/seepn/SeepnFooter'
import { formatDotDate } from '@/lib/seepn/formatDate'

export const revalidate = 60

export default async function SeepnInsightsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams
  const all = await getPublishedSeepnInsights()
  const active = (SEEPN_INSIGHT_CATEGORIES as readonly string[]).includes(category ?? '') ? category : undefined
  const insights = active ? all.filter((i) => i.category === active) : all

  const tabClass = (on: boolean) => `rounded-full px-3.5 py-2 text-label-caption font-medium ${on ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`

  return (
    <div className="flex min-h-screen flex-col bg-[#f9fafb]">
      <SeepnMainHeader active="insights" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <h1 className="text-[22px] font-bold text-neutral-900">B2B 인사이트</h1>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/seepn/insights" className={tabClass(!active)}>
            전체
          </Link>
          {SEEPN_INSIGHT_CATEGORIES.map((c) => (
            <Link key={c} href={`/seepn/insights?category=${encodeURIComponent(c)}`} className={tabClass(active === c)}>
              {c}
            </Link>
          ))}
        </div>

        {insights.length === 0 ? (
          <p className="mt-8 rounded-input border border-dashed border-neutral-200 bg-white p-10 text-center text-body-sm text-neutral-500">등록된 인사이트가 없습니다.</p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {insights.map((i) => (
              <Link key={i.slug} href={`/seepn/insights/${i.slug}`} className="overflow-hidden rounded-card border border-neutral-200 bg-white transition-shadow hover:shadow-sm">
                <div className="h-[140px] bg-neutral-100" aria-hidden="true" />
                <div className="space-y-1.5 px-3.5 pb-3.5 pt-3">
                  <span className="inline-block rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-medium text-primary-600">{i.category}</span>
                  <p className="text-[13px] font-medium text-neutral-900">{i.title}</p>
                  <p className="text-[11px] text-neutral-500">{formatDotDate(i.createdAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SeepnFooter />
    </div>
  )
}
