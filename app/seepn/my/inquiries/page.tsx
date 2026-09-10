// Design Ref: screen-spec §7.3 (BY-12 문의 내역, OQ-B10 "포함 권고(Should)" 채택) —
// "본인 문의만(RLS), 참조 파트너명 + 본문 일부 + 상태 + 생성일". Read directly from
// public.seepn_inquiry (seepn_inquiry_self_select RLS already scopes to the caller's own rows —
// no RPC needed for the buyer's own read path, unlike the Admin side which has no SELECT policy
// at all and must go through admin_list_seepn_inquiries()/get_seepn_inquiry_detail()).
// GAP-C1 (2026-09-10, 20260910180000): referenced partner(s) now live in the
// public.seepn_inquiry_partner join table (1..5 per inquiry), not a partner_id column on
// seepn_inquiry itself. seepn_inquiry_partner_self_select RLS mirrors seepn_inquiry_self_select
// (own inquiries' rows only) — still no RPC needed for this read path.
import Link from 'next/link'
import { requireBuyerSession } from '@/lib/seepn/session'
import { INQUIRY_STATUS_LABELS } from '@/lib/seepn/partnerLabels'

export const dynamic = 'force-dynamic'

interface InquiryListRow {
  id: string
  body: string
  status: 'new' | 'in_progress' | 'closed'
  created_at: string
}

export default async function SeepnInquiriesPage() {
  const session = await requireBuyerSession()

  const { data: inquiries } = await session.supabase
    .from('seepn_inquiry')
    .select('id, body, status, created_at')
    .order('created_at', { ascending: false })

  const rows = (inquiries ?? []) as InquiryListRow[]
  const inquiryIds = rows.map((r) => r.id)

  let partnerNamesByInquiry = new Map<string, string[]>()
  if (inquiryIds.length > 0) {
    const { data: links } = await session.supabase
      .from('seepn_inquiry_partner')
      .select('inquiry_id, partner_id')
      .in('inquiry_id', inquiryIds)
    const linkRows = (links ?? []) as { inquiry_id: string; partner_id: string }[]

    const partnerIds = Array.from(new Set(linkRows.map((l) => l.partner_id)))
    let nameById = new Map<string, string>()
    if (partnerIds.length > 0) {
      const { data: partners } = await session.supabase
        .from('partner_list_public')
        .select('id, company_name_ko')
        .in('id', partnerIds)
      nameById = new Map((partners ?? []).map((p: { id: string; company_name_ko: string | null }) => [p.id, p.company_name_ko ?? '(회사명 미공개)']))
    }

    for (const link of linkRows) {
      const name = nameById.get(link.partner_id) ?? '(비공개 파트너)'
      const existing = partnerNamesByInquiry.get(link.inquiry_id) ?? []
      existing.push(name)
      partnerNamesByInquiry.set(link.inquiry_id, existing)
    }
  }

  return (
    <div>
      <h1 className="text-h3 text-neutral-900">내 문의 내역</h1>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-neutral-200 p-10 text-center">
          <p className="text-body text-neutral-500">보낸 문의가 없습니다.</p>
          <Link href="/seepn/partners" className="mt-3 inline-block text-body-sm text-primary-600 hover:underline">
            파트너 둘러보기
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-card border border-neutral-200 bg-neutral-0 p-4">
              <div className="flex items-center justify-between">
                <p className="text-body-sm font-medium text-neutral-900">
                  {(partnerNamesByInquiry.get(r.id) ?? []).join(', ') || '(비공개 파트너)'}
                </p>
                <span className="rounded-sm bg-neutral-100 px-2 py-0.5 text-label-caption text-neutral-600">
                  {INQUIRY_STATUS_LABELS[r.status] ?? r.status}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-body-sm text-neutral-600">{r.body}</p>
              <p className="mt-2 text-label-caption text-neutral-400">{new Date(r.created_at).toLocaleDateString('ko-KR')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
