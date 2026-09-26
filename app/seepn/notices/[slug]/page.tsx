// Design Ref: Figma U-09-02 공지사항 상세 (node 347:2). 대상이 SEEPN 회원이 아니거나 초안/비활성인
// 공지는 존재하지 않는 것과 구분되지 않게 모두 404로 접는다(getPublishedSeepnNoticeBySlug).
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPublishedSeepnNoticeBySlug } from '@/lib/content/getPublishedSeepnNotices'
import { renderContentMarkdown } from '@/lib/content/renderMarkdown'
import { SeepnMainHeader } from '@/components/seepn/SeepnMainChrome'
import { SeepnFooter } from '@/components/seepn/SeepnFooter'
import { formatDotDate } from '@/lib/seepn/formatDate'

export const revalidate = 300

export default async function SeepnNoticeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const notice = await getPublishedSeepnNoticeBySlug(slug)
  if (!notice) notFound()

  return (
    <div className="flex min-h-screen flex-col bg-[#f9fafb]">
      <SeepnMainHeader />
      <main className="mx-auto w-full max-w-[900px] flex-1 px-6 py-10">
        <article className="rounded-card border border-neutral-200 bg-white p-8">
          <h1 className="text-[20px] font-bold text-neutral-900">{notice.title}</h1>
          <p className="mt-4 text-label-caption text-neutral-500">{formatDotDate(notice.createdAt)}</p>
          <div className="my-4 border-t border-neutral-200" />
          <div className="text-body-sm text-neutral-700">{renderContentMarkdown(notice.bodyMarkdown)}</div>
          <Link href="/seepn/notices" className="mt-6 inline-block rounded-input border border-neutral-300 px-4 py-2.5 text-label-caption font-medium text-neutral-700 hover:bg-neutral-50">
            목록으로
          </Link>
        </article>
      </main>
      <SeepnFooter />
    </div>
  )
}
