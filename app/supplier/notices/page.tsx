// Design Ref: notice-board.screen-spec.md §4.2 — list page. Uses
// lib/content/getPublishedNotices.ts's getPublishedPartnerNotices (anon-role read, G-1;
// target_audience='partner' filter applied inside that function, NOT here — see that file's
// header comment for why re-implementing the filter here would be the exact bypass privacy
// review NB-B6 warns about).
import Link from 'next/link'
import { getPublishedPartnerNotices } from '@/lib/content/getPublishedNotices'

export const metadata = {
  robots: { index: false, follow: false },
}

export default async function SupplierNoticesPage() {
  const notices = await getPublishedPartnerNotices()

  return (
    <div>
      <h1 className="text-h3 text-neutral-900">공지사항</h1>

      {notices.length === 0 ? (
        <p className="mt-6 text-body-sm text-neutral-500">아직 등록된 공지가 없습니다.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {notices.map((notice) => (
            <Link
              key={notice.slug}
              href={`/supplier/notices/${notice.slug}`}
              className="block rounded-card border border-neutral-200 bg-neutral-0 p-5 transition-colors hover:border-primary-300"
            >
              <p className="text-body font-medium text-neutral-900">{notice.title}</p>
              {notice.excerpt && <p className="mt-1 line-clamp-2 text-body-sm text-neutral-600">{notice.excerpt}</p>}
              <p className="mt-2 text-label-caption text-neutral-400">
                {new Date(notice.createdAt).toLocaleDateString('ko-KR')}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
