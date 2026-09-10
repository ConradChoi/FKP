// Design Ref: screen-spec §7.1 (BY-10 관심목록/마이페이지).
import Link from 'next/link'
import { requireBuyerSession } from '@/lib/seepn/session'
import { BookmarksListClient, type BookmarkListItem } from '@/components/seepn/BookmarksListClient'
import type { PartnerCardData } from '@/components/seepn/PartnerCard'

export const dynamic = 'force-dynamic'

export default async function SeepnBookmarksPage() {
  const session = await requireBuyerSession()

  const { data: bookmarks } = await session.supabase
    .from('buyer_bookmark')
    .select('partner_id, created_at')
    .order('created_at', { ascending: false })

  const partnerIds = (bookmarks ?? []).map((b: { partner_id: string }) => b.partner_id)

  let publicById = new Map<string, PartnerCardData>()
  if (partnerIds.length > 0) {
    const { data: publicRows } = await session.supabase
      .from('partner_list_public')
      .select('id, company_name_ko, company_name_en, location_region, vertical, service_types, supported_languages, overseas_experience')
      .in('id', partnerIds)
    publicById = new Map((publicRows ?? []).map((p: PartnerCardData) => [p.id, p]))
  }

  const items: BookmarkListItem[] = (bookmarks ?? []).map((b: { partner_id: string }) => ({
    partnerId: b.partner_id,
    partner: publicById.get(b.partner_id) ?? null,
  }))

  return (
    <div>
      <h1 className="text-h3 text-neutral-900">관심목록</h1>

      {items.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-neutral-200 p-10 text-center">
          <p className="text-body text-neutral-500">아직 관심등록한 파트너가 없습니다.</p>
          <Link href="/seepn/partners" className="mt-3 inline-block text-body-sm text-primary-600 hover:underline">
            파트너 둘러보기
          </Link>
        </div>
      ) : (
        <div className="mt-6">
          <BookmarksListClient items={items} />
        </div>
      )}
    </div>
  )
}
