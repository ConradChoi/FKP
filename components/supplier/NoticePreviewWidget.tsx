// Design Ref: notice-board.screen-spec.md §4.4 (N-R18, "포함으로 확정") + notice-board.ui-spec.md
// §4 — slim 1-line preview of the latest partner notice on the profile home. Deliberately using
// the buyer-facing shared tokens (text-body-sm/text-label-caption, Inter) that
// SupplierProfileShell already uses, NOT the admin-* (Pretendard) tokens from the /admin/board
// components in this same feature — ui-spec §0.4/§4.2 flags this exact mixup as the trap to
// avoid (/supplier/profile and /admin are two different typographic systems).
import Link from 'next/link'
import type { PublishedPartnerNoticeListItem } from '@/lib/content/getPublishedNotices'

export function NoticePreviewWidget({ notice }: { notice: PublishedPartnerNoticeListItem | null }) {
  // screen-spec §4.4 / N-E10 — 0 notices means this widget renders nothing at all (no empty-state
  // copy either): it's a discovery aid, not primary content, so it should disappear quietly.
  if (!notice) return null

  const date = new Date(notice.createdAt).toLocaleDateString('ko-KR')

  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-card border border-neutral-200 bg-neutral-0 px-4 py-3">
      {/* ui-spec §4.3 — title and "전체보기" are two separate links (not one card-wide link),
          since they go to two different destinations. */}
      <Link
        href={`/supplier/notices/${notice.slug}`}
        className="min-w-0 flex-1 truncate text-body-sm text-neutral-900 hover:text-primary-700 hover:underline"
        aria-label={`최신 공지: ${notice.title}, ${date}에 게시`}
      >
        최신 공지: <span className="font-medium">{notice.title}</span>{' '}
        <span className="text-label-caption text-neutral-400">({date})</span>
      </Link>
      <Link href="/supplier/notices" className="whitespace-nowrap text-label-caption text-primary-600 hover:underline">
        전체보기 →
      </Link>
    </div>
  )
}
