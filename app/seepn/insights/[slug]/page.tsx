// Design Ref: Figma U-08-02 인사이트 상세 (node 345:2) — 브레드크럼, 카테고리 칩, 제목, 메타, 본문,
// 관련 인사이트. 조회수는 집계 기능이 없어 표시하지 않는다.
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPublishedSeepnInsightBySlug, getPublishedSeepnInsights } from '@/lib/content/getPublishedSeepnContent'
import { renderContentMarkdown } from '@/lib/content/renderMarkdown'
import { SeepnMainHeader } from '@/components/seepn/SeepnMainChrome'
import { SeepnFooter } from '@/components/seepn/SeepnFooter'
import { formatDotDate } from '@/lib/seepn/formatDate'

export const revalidate = 60

export default async function SeepnInsightDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const insight = await getPublishedSeepnInsightBySlug(slug)
  if (!insight) notFound()

  const related = (await getPublishedSeepnInsights()).filter((i) => i.slug !== slug && i.category === insight.category).slice(0, 3)

  return (
    <div className="flex min-h-screen flex-col bg-[#f9fafb]">
      <SeepnMainHeader active="insights" />
      <main className="mx-auto w-full max-w-[760px] flex-1 px-6 py-10">
        <p className="text-label-caption text-neutral-500">
          <Link href="/seepn/insights" className="hover:underline">
            인사이트
          </Link>{' '}
          &gt; {insight.category}
        </p>
        <span className="mt-3 inline-block rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-medium text-primary-600">{insight.category}</span>
        <h1 className="mt-2 text-[28px] font-bold leading-tight text-neutral-900">{insight.title}</h1>
        <p className="mt-3 text-label-caption text-neutral-500">SEEPN 인사이트팀 · {formatDotDate(insight.createdAt)}</p>
        <div className="mt-6 text-body-sm text-neutral-700">{renderContentMarkdown(insight.bodyMarkdown)}</div>

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[15px] font-bold text-neutral-900">관련 인사이트</h2>
            <ul className="mt-3 divide-y divide-neutral-200 overflow-hidden rounded-input border border-neutral-200 bg-white">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/seepn/insights/${r.slug}`} className="block px-4 py-3.5 text-[13px] text-neutral-700 hover:bg-neutral-50">
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <SeepnFooter />
    </div>
  )
}
