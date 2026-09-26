// Design Ref: Figma "Seepn 2.0 — UI Design" U-09-01 공지사항 목록 (node 346:2). 공지는 admin >
// 게시판 > 공지에서 대상을 'SEEPN 회원'으로 작성한 것만 보인다(lib/content/getPublishedSeepnNotices.ts).
import Link from 'next/link'
import { getPublishedSeepnNotices } from '@/lib/content/getPublishedSeepnNotices'
import { SeepnMainHeader } from '@/components/seepn/SeepnMainChrome'
import { SeepnFooter } from '@/components/seepn/SeepnFooter'
import { formatDotDate } from '@/lib/seepn/formatDate'

export const revalidate = 300

const NEW_BADGE_DAYS = 14

export default async function SeepnNoticesPage() {
  const notices = await getPublishedSeepnNotices()
  const now = Date.now()

  return (
    <div className="flex min-h-screen flex-col bg-[#f9fafb]">
      <SeepnMainHeader />
      <main className="mx-auto w-full max-w-[900px] flex-1 px-6 py-10">
        <h1 className="text-[22px] font-bold text-neutral-900">공지사항</h1>
        {notices.length === 0 ? (
          <p className="mt-6 rounded-input border border-dashed border-neutral-200 bg-white p-10 text-center text-body-sm text-neutral-500">아직 등록된 공지가 없습니다.</p>
        ) : (
          <ul className="mt-6 divide-y divide-neutral-200 overflow-hidden rounded-input border border-neutral-200 bg-white">
            {notices.map((n) => {
              const isNew = now - new Date(n.createdAt).getTime() < NEW_BADGE_DAYS * 86400000
              return (
                <li key={n.slug}>
                  <Link href={`/seepn/notices/${n.slug}`} className="flex items-center gap-2.5 px-4 py-3.5 hover:bg-neutral-50">
                    {isNew && <span className="rounded-sm bg-[#fee5e5] px-1.5 py-0.5 text-[10px] font-bold text-error">NEW</span>}
                    <span className="min-w-0 flex-1 truncate text-body-sm text-neutral-700">{n.title}</span>
                    <span className="shrink-0 text-[11px] text-neutral-500">{formatDotDate(n.createdAt)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
      <SeepnFooter />
    </div>
  )
}
