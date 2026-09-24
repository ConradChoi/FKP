// Design Ref: Figma "Seepn 2.0 — UI Design" U-11 마이페이지 (node 42:2) main column — profile card,
// stat cards, 최근 찜한 공급사, 최근 1:1 문의. Everything shown is real data (buyer_account,
// buyer_bookmark, seepn_inquiry via the buyer's own RLS). 비교 이력/거래 공급사/작성 리뷰 cards are
// kept per Figma but show "-" until those features exist (no invented numbers); rating badges and
// company name are not rendered for the same reason.
import Link from 'next/link'
import { requireBuyerSession } from '@/lib/seepn/session'
import { INQUIRY_STATUS_LABELS, VERTICAL_LABELS } from '@/lib/seepn/partnerLabels'

export const dynamic = 'force-dynamic'

const RECENT_BOOKMARK_LIMIT = 3
const RECENT_INQUIRY_LIMIT = 3

interface RecentPartner {
  id: string
  company_name_ko: string | null
  location_region: string | null
  vertical: 'product' | 'service' | null
}

interface RecentInquiry {
  id: string
  body: string
  status: 'new' | 'in_progress' | 'closed'
  created_at: string
}

export default async function SeepnMyHomePage() {
  const session = await requireBuyerSession()
  const { supabase } = session

  const [{ data: account }, { count: bookmarkCount }, { count: inquiryCount }, { data: recentBookmarks }, { data: recentInquiries }] = await Promise.all([
    supabase.from('buyer_account').select('created_at').maybeSingle<{ created_at: string }>(),
    supabase.from('buyer_bookmark').select('partner_id', { count: 'exact', head: true }),
    supabase.from('seepn_inquiry').select('id', { count: 'exact', head: true }),
    supabase.from('buyer_bookmark').select('partner_id').order('created_at', { ascending: false }).limit(RECENT_BOOKMARK_LIMIT),
    supabase.from('seepn_inquiry').select('id, body, status, created_at').order('created_at', { ascending: false }).limit(RECENT_INQUIRY_LIMIT),
  ])

  const bookmarkIds = (recentBookmarks ?? []).map((b: { partner_id: string }) => b.partner_id)
  let partners: RecentPartner[] = []
  if (bookmarkIds.length > 0) {
    const { data } = await supabase.from('partner_list_public').select('id, company_name_ko, location_region, vertical').in('id', bookmarkIds)
    const byId = new Map((data ?? []).map((p: RecentPartner) => [p.id, p]))
    // Keep the bookmark recency order; a partner no longer publicly listed simply drops out.
    partners = bookmarkIds.map((id) => byId.get(id)).filter((p): p is RecentPartner => Boolean(p))
  }
  const inquiries = (recentInquiries ?? []) as RecentInquiry[]
  const displayName = session.account.display_name

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-5 rounded-card border border-neutral-200 bg-white p-6">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[24px] font-bold text-white">
          {displayName.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[20px] font-semibold text-neutral-900">{displayName}</p>
          {session.email && <p className="mt-1 truncate text-body-sm text-neutral-500">{session.email}</p>}
        </div>
        <div className="flex items-center gap-6">
          {account?.created_at && (
            <div>
              <p className="text-label-caption text-neutral-500">가입일</p>
              <p className="mt-1 text-body-sm font-semibold text-neutral-700">{new Date(account.created_at).toISOString().slice(0, 10)}</p>
            </div>
          )}
          <Link href="/seepn/my/profile" className="rounded-input border border-neutral-300 px-4 py-2 text-label-caption text-neutral-700 hover:bg-neutral-50">
            정보 수정
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard href="/seepn/my/bookmarks" value={`${bookmarkCount ?? 0}개`} label="찜한 공급사" />
        <StatCard href="/seepn/my/compared" value="-" label="비교 이력" />
        <StatCard href="/seepn/my/deals" value="-" label="거래 공급사" />
        <StatCard value="-" label="작성 리뷰" />
        <StatCard href="/seepn/my/inquiries" value={`${inquiryCount ?? 0}건`} label="1:1 문의" />
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-body font-semibold text-neutral-900">
            찜한 공급사 <span className="ml-2 text-label-caption font-normal text-neutral-500">최근 찜한 {partners.length}개</span>
          </h2>
          <Link href="/seepn/my/bookmarks" className="text-label-caption text-primary-600 hover:underline">
            전체 보기 →
          </Link>
        </div>
        {partners.length === 0 ? (
          <div className="mt-3 rounded-card border border-dashed border-neutral-200 bg-white p-8 text-center">
            <p className="text-body-sm text-neutral-500">아직 찜한 공급사가 없습니다.</p>
            <Link href="/seepn/partners" className="mt-2 inline-block text-body-sm text-primary-600 hover:underline">
              공급사 둘러보기
            </Link>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {partners.map((p) => (
              <div key={p.id} className="flex flex-col rounded-card border border-neutral-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input bg-primary-50 text-label-caption font-bold text-primary-600">
                    {(p.company_name_ko ?? '?').slice(0, 2)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-neutral-900">{p.company_name_ko || '(회사명 미공개)'}</p>
                    <p className="truncate text-label-caption text-neutral-500">
                      {[p.vertical ? VERTICAL_LABELS[p.vertical] : null, p.location_region].filter(Boolean).join(' · ') || '-'}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/seepn/partners/${p.id}`}
                  className="mt-6 block rounded-input bg-primary-50 py-1.5 text-center text-label-caption text-primary-600 hover:bg-primary-100"
                >
                  상세보기
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-body font-semibold text-neutral-900">최근 1:1 문의</h2>
          <Link href="/seepn/my/inquiries" className="text-label-caption text-primary-600 hover:underline">
            전체 보기 →
          </Link>
        </div>
        {inquiries.length === 0 ? (
          <div className="mt-3 rounded-card border border-dashed border-neutral-200 bg-white p-8 text-center">
            <p className="text-body-sm text-neutral-500">보낸 문의가 없습니다.</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {inquiries.map((r) => (
              <li key={r.id} className="flex items-center gap-4 rounded-input border border-neutral-200 bg-white px-4 py-3">
                <p className="min-w-0 flex-1 truncate text-body-sm text-neutral-900">{r.body}</p>
                <span className="shrink-0 text-label-caption text-neutral-500">{new Date(r.created_at).toISOString().slice(0, 10)}</span>
                <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
                  {INQUIRY_STATUS_LABELS[r.status] ?? r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function StatCard({ href, value, label }: { href?: string; value: string; label: string }) {
  const body = (
    <>
      <p className="text-[22px] font-bold text-primary-600">{value}</p>
      <p className="mt-2 text-label-caption text-neutral-500">{label}</p>
    </>
  )
  const cls = 'rounded-card border border-neutral-200 bg-white p-5'
  return href ? (
    <Link href={href} className={`${cls} hover:border-primary-200`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
