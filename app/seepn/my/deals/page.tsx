// Design Ref: Figma U-11 마이페이지 side menu "거래 공급사" — 내 문의 중 운영자가 처리에 착수한
// 건에 포함된 공급사 (정의: lib/seepn/deals.ts). Session gate: my/layout.tsx.
import Link from 'next/link'
import { requireBuyerSession } from '@/lib/seepn/session'
import { fetchDealPartners } from '@/lib/seepn/deals'
import { INQUIRY_STATUS_LABELS } from '@/lib/seepn/partnerLabels'

export const dynamic = 'force-dynamic'

export default async function SeepnMyDealsPage() {
  const { supabase } = await requireBuyerSession()
  const deals = await fetchDealPartners(supabase)

  return (
    <div>
      <h1 className="text-h3 text-neutral-900">거래 공급사</h1>
      <p className="mt-1 text-body-sm text-neutral-500">운영자가 검토 중이거나 검토를 마친 문의에 포함된 공급사입니다. 공급사와 계약·거래가 성사되었다는 뜻은 아니며, 회원님의 정보는 별도 동의 없이 공급사에 전달되지 않습니다.</p>

      {deals.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-neutral-200 bg-white p-10 text-center">
          <p className="text-body text-neutral-500">아직 운영자 검토 단계로 진행된 문의가 없습니다.</p>
          <Link href="/seepn/partners" className="mt-3 inline-block text-body-sm text-primary-600 hover:underline">
            공급사 둘러보기
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {deals.map((d) => (
            <div key={d.partnerId} className="flex flex-col rounded-card border border-neutral-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input bg-primary-50 text-label-caption font-bold text-primary-600">
                  {d.name.slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-semibold text-neutral-900">{d.name}</p>
                  <p className="text-label-caption text-neutral-500">
                    문의 {d.inquiryCount}건 · {INQUIRY_STATUS_LABELS[d.latestStatus] ?? d.latestStatus}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-label-caption text-neutral-400">최근 진행 {new Date(d.latestAt).toISOString().slice(0, 10)}</p>
              <div className="mt-4 flex gap-2">
                {d.listed && (
                  <Link href={`/seepn/partners/${d.partnerId}`} className="flex-1 rounded-input bg-primary-50 py-1.5 text-center text-label-caption text-primary-600 hover:bg-primary-100">
                    상세보기
                  </Link>
                )}
                <Link href="/seepn/my/inquiries" className="flex-1 rounded-input border border-neutral-200 py-1.5 text-center text-label-caption text-neutral-600 hover:bg-neutral-50">
                  문의 내역
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
