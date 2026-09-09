// Design Ref: notice-board.screen-spec.md §4.3 — detail page. `target_audience≠'partner'` OR
// `status≠'published'` OR `is_active=false` must all collapse to the identical notFound() (404)
// so a `seepn_user` notice's slug can never be distinguished from "doesn't exist" (N-E8, G-1's
// key verification point) — getPublishedPartnerNoticeBySlug already returns null for all three
// cases (see that file's comment), this route just has to actually call notFound() on null and
// nothing else.
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPublishedPartnerNoticeBySlug } from '@/lib/content/getPublishedNotices'
import { renderContentMarkdown } from '@/lib/content/renderMarkdown'

export const metadata = {
  robots: { index: false, follow: false },
}

export default async function SupplierNoticeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const notice = await getPublishedPartnerNoticeBySlug(slug)
  if (!notice) notFound()

  return (
    <div>
      <Link href="/supplier/notices" className="text-body-sm text-primary-600 hover:underline">
        ← 공지 목록으로
      </Link>
      <article className="mt-6">
        <h1 className="text-h2 text-neutral-900">{notice.title}</h1>
        <p className="mt-2 text-label-caption text-neutral-400">
          {new Date(notice.createdAt).toLocaleDateString('ko-KR')}
        </p>
        <div className="mt-6">{renderContentMarkdown(notice.bodyMarkdown)}</div>
      </article>
    </div>
  )
}
