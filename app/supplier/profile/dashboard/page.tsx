// Design Ref: docs/02-design/features/seepn-partner-web-p6-dashboard.screen-spec.md §3 (SUP-15) —
// two aggregate-count cards (관심수/문의수신 건수), nothing else. Deliberately does NOT add a
// time-series/breakdown/drill-down anywhere in this file (D-D4/D-D5) — a single integer per card
// is the entire scope (규모 S~M). Server Component: both RPCs are called once per render from
// requireSupplierSession()'s own `supabase` instance (§1.1) — no browser client, no client-side
// fetch/polling, since this screen has zero user interaction beyond the shared settings link
// (EDGE-D4 — 실시간 반영하지 않는다, 재방문 시에만 갱신).
import type { ReactNode } from 'react'
import Link from 'next/link'
import { requireSupplierSession } from '@/lib/supplier/session'
import { EnvelopeIcon, HeartIcon } from '@/components/icons/SupplierIcons'
import type { PartnerProfile } from '@/lib/supplier/types'

interface CardResult {
  count: number
  error: boolean
}

// EDGE-D3 — 카드별 독립 에러 처리. RPC 자체가 없어서 PostgREST가 42883(함수 없음)을 돌려주는
// 경우(문의수신 건수 RPC는 backend-developer가 병행 구현 중 — §4)도 이 경로로 그대로 흡수되어
// 이 카드만 "불러오지 못했습니다"로 표시되고 다른 카드는 정상 렌더링된다.
async function toCardResult(call: PromiseLike<{ data: number | null; error: unknown }>): Promise<CardResult> {
  const { data, error } = await call
  return { count: error ? 0 : (data ?? 0), error: Boolean(error) }
}

// §3.4 카드 상태 매트릭스 — verification_state/public_listing_state/count 조합별 하단 안내 문구.
// ux-writer 최종 확정 전 가안(의미만 §3.4 그대로, 문구 표현은 초안).
function cardNotice(
  kind: 'bookmark' | 'inquiry',
  verificationState: PartnerProfile['verification_state'],
  publicListingState: PartnerProfile['public_listing_state'],
  count: number,
): ReactNode {
  // D-D6 (OQ-D1 대표 확정: 노출) — 미검증 상태에서도 카드는 그대로 보여주되 안내 문구로 설명한다.
  if (verificationState !== 'verified') {
    return '검증이 완료되면 집계가 시작됩니다.'
  }
  if (publicListingState !== 'on') {
    return (
      <>
        {kind === 'bookmark' ? 'SEEPN에 공개하면 관심수가 집계됩니다.' : 'SEEPN에 공개하면 문의를 받을 수 있습니다.'}{' '}
        <Link href="/supplier/profile/settings" className="underline hover:text-primary-700">
          공개설정 바로가기
        </Link>
      </>
    )
  }
  if (count === 0) {
    return kind === 'bookmark' ? '아직 관심등록한 바이어가 없습니다.' : '아직 접수된 문의가 없습니다.'
  }
  // D-D5 — 문의수신 건수는 목록/상세로 이어지는 어떤 진입점도 만들지 않는다. 이 문구가 그
  // 대신 "어디서 상세를 보나"라는 질문에 미리 답한다.
  if (kind === 'inquiry') {
    return '운영자가 확인 후 별도로 연락드립니다.'
  }
  return null
}

function StatCard({
  label,
  icon,
  result,
  notice,
}: {
  label: string
  icon: ReactNode
  result: CardResult
  notice: ReactNode
}) {
  return (
    <div className="flex-1 rounded-card border border-neutral-200 bg-neutral-0 p-6">
      <div className="flex items-center gap-2 text-body-sm text-neutral-600">
        {icon}
        <span>{label}</span>
      </div>
      {result.error ? (
        <p className="mt-3 text-body-sm text-error">불러오지 못했습니다. 새로고침 후 다시 시도해주세요.</p>
      ) : (
        <>
          <p className="mt-3 text-h1 text-neutral-900">{result.count.toLocaleString('ko-KR')}</p>
          {notice && <p className="mt-2 text-label-caption text-neutral-500">{notice}</p>}
        </>
      )}
    </div>
  )
}

export default async function SupplierDashboardPage() {
  const { supabase, partner } = await requireSupplierSession()

  const [bookmarkResult, inquiryResult] = await Promise.all([
    toCardResult(supabase.rpc('get_own_partner_bookmark_count')),
    toCardResult(supabase.rpc('get_own_partner_inquiry_count')),
  ])

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <StatCard
        label="관심수"
        icon={<HeartIcon className="h-4 w-4" />}
        result={bookmarkResult}
        notice={cardNotice('bookmark', partner.verification_state, partner.public_listing_state, bookmarkResult.count)}
      />
      <StatCard
        label="문의수신 건수"
        icon={<EnvelopeIcon className="h-4 w-4" />}
        result={inquiryResult}
        notice={cardNotice('inquiry', partner.verification_state, partner.public_listing_state, inquiryResult.count)}
      />
    </div>
  )
}
