// Design Ref: docs/02-design/features/seepn-buyer-web-p5b.screen-spec.md §4 (BY-14 비교표) + §5
// (엣지케이스 EDGE-C1~C8). URL이 상태를 갖는다(`?ids=`) — 공유·뒤로가기 보존(§4.1). 로그인
// 필요(BY-09와 동일 원칙, requireBuyerSession()) but **소유권 검사는 하지 않는다**(D-C3) — ids가
// 호출자의 관심목록에 있는지 확인하지 않는다. 클라이언트가 보낸 ids는 절대 신뢰하지 않고 서버가
// 항상 개수/버티컬 혼합/존재 여부를 재계산한다(§4.1 "서버 재검증", P5a EDGE-B11과 동일 원칙) —
// BY-13의 체크박스 가드는 UX 편의일 뿐, 여기서 다시 전부 검증한다.
import Link from 'next/link'
import { redirectToLoginIfNoBuyerSession } from '@/lib/seepn/loginGate'
import { requireBuyerSession } from '@/lib/seepn/session'
import type { PartnerDetailBuyerRow } from '@/lib/seepn/types'
import { CompareTable } from '@/components/seepn/CompareTable'
import { SeepnFooter } from '@/components/seepn/SeepnFooter'

export const dynamic = 'force-dynamic'

const MAX_COMPARE = 5
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface ComparePageSearchParams {
  ids?: string
}

export default async function SeepnComparePage({ searchParams }: { searchParams: Promise<ComparePageSearchParams> }) {
  const sp = await searchParams
  const returnPath = `/seepn/compare${sp.ids ? `?ids=${encodeURIComponent(sp.ids)}` : ''}`
  await redirectToLoginIfNoBuyerSession(returnPath)
  const session = await requireBuyerSession()

  // Parse -> EDGE-C5(중복 제거, 순서 유지) -> EDGE-C1(6개 이상이면 앞 5개만 유효 처리).
  const parsedIds = (sp.ids ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s))
  const dedupedIds = Array.from(new Set(parsedIds))
  const capExceeded = dedupedIds.length > MAX_COMPARE
  const cappedIds = dedupedIds.slice(0, MAX_COMPARE)

  // EDGE-C3: 애초에 유효 후보가 1개 이하 — DB 조회조차 필요 없다.
  if (cappedIds.length === 0) {
    return <NeedMoreCandidatesScreen single={null} />
  }

  const { data: rows, error } = await session.supabase.from('partner_detail_buyer').select('*').in('id', cappedIds)

  if (error) {
    return <LoadFailedScreen retryHref={returnPath} />
  }

  const rowById = new Map((rows ?? []).map((r) => [r.id, r as PartnerDetailBuyerRow]))
  // EDGE-C4: 존재하지 않거나 게이트를 통과 못 한 id는 조용히 표에서 제외(전체 에러로 만들지 않음).
  const notFoundExcludedCount = cappedIds.filter((id) => !rowById.has(id)).length
  const foundOrdered = cappedIds.map((id) => rowById.get(id)).filter((r): r is PartnerDetailBuyerRow => Boolean(r))

  // EDGE-C2 / D-C1: 첫 번째(유효한) id의 vertical을 기준으로 채택, 다른 vertical은 제외.
  let verticalExcludedCount = 0
  let finalPartners = foundOrdered
  if (foundOrdered.length > 0) {
    const baselineVertical = foundOrdered[0].vertical
    finalPartners = foundOrdered.filter((p) => p.vertical === baselineVertical)
    verticalExcludedCount = foundOrdered.length - finalPartners.length
  }

  // EDGE-C3: 재검증 결과 유효 후보가 1개 이하로 귀결된 경우.
  if (finalPartners.length <= 1) {
    return <NeedMoreCandidatesScreen single={finalPartners[0] ?? null} />
  }

  const finalIds = finalPartners.map((p) => p.id)

  const { data: catLinks } = await session.supabase
    .from('partner_category_public')
    .select('partner_id, standard_category_id')
    .in('partner_id', finalIds)
  const linkRows = (catLinks ?? []) as { partner_id: string; standard_category_id: string }[]

  const categoryIds = Array.from(new Set(linkRows.map((l) => l.standard_category_id)))
  let nameByCategoryId = new Map<string, string>()
  if (categoryIds.length > 0) {
    const { data: translations } = await session.supabase
      .from('standard_category_translation')
      .select('category_id, name')
      .eq('locale', 'ko')
      .in('category_id', categoryIds)
    nameByCategoryId = new Map(
      (translations ?? []).map((t: { category_id: string; name: string }) => [t.category_id, t.name]),
    )
  }

  const categoryNamesByPartnerId = new Map<string, string[]>()
  for (const link of linkRows) {
    const name = nameByCategoryId.get(link.standard_category_id)
    if (!name) continue
    const existing = categoryNamesByPartnerId.get(link.partner_id) ?? []
    existing.push(name)
    categoryNamesByPartnerId.set(link.partner_id, existing)
  }

  const banners: string[] = []
  if (capExceeded) banners.push('비교는 최대 5곳까지 가능합니다. 일부 파트너가 제외되었습니다.')
  if (notFoundExcludedCount > 0) banners.push('일부 파트너는 현재 비공개 상태라 비교에서 제외되었습니다.')
  if (verticalExcludedCount > 0) banners.push('제품과 서비스 파트너는 함께 비교할 수 없어 일부 항목이 제외되었습니다.')

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 pb-28">
        <h1 className="text-h3 text-neutral-900">파트너 비교</h1>
        <p className="mt-1 text-body-sm text-neutral-500">{finalPartners.length}곳을 비교하고 있습니다.</p>

        {banners.length > 0 && (
          <div className="mt-4 space-y-2">
            {banners.map((b) => (
              <div key={b} className="rounded-input border border-primary-100 bg-primary-50 px-4 py-2 text-label-caption text-primary-800">
                {b}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6">
          <CompareTable partners={finalPartners} categoryNamesByPartnerId={categoryNamesByPartnerId} />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-neutral-0 px-4 py-3">
        <div className="mx-auto max-w-5xl">
          <Link
            href={`/seepn/compare/inquiry?ids=${finalIds.join(',')}`}
            className="block w-full rounded-input bg-primary-600 py-3 text-center text-label-button text-neutral-0 hover:bg-primary-700"
          >
            선택한 {finalPartners.length}곳에 대해 운영자에게 문의하기
          </Link>
        </div>
      </div>
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-neutral-0">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/seepn/partners" className="text-label-button text-primary-700">
            SEEPN
          </Link>
          <nav className="flex items-center gap-4 text-body-sm">
            <Link href="/seepn/my/bookmarks" className="text-neutral-600 hover:underline">
              관심목록
            </Link>
            <Link href="/seepn/my/inquiries" className="text-neutral-600 hover:underline">
              내 문의
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <SeepnFooter />
    </div>
  )
}

// EDGE-C3: 유효 후보가 0~1개로 귀결된 모든 경로(진입/재검증 후 공통)의 폴백 화면. 정확히 1곳이
// 남았다면 원래 의도(그 파트너를 보고 싶었을 것)를 살리는 "상세 보기" 링크를 함께 제공한다.
function NeedMoreCandidatesScreen({ single }: { single: PartnerDetailBuyerRow | null }) {
  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <p className="text-body text-neutral-700">비교하려면 2곳 이상 필요합니다.</p>
        <div className="mt-4 flex flex-col items-center gap-2">
          {single && (
            <Link href={`/seepn/partners/${single.id}`} className="text-body-sm text-primary-600 hover:underline">
              {single.company_name_ko || '이 파트너'} 상세 보기
            </Link>
          )}
          <Link href="/seepn/my/bookmarks" className="text-body-sm text-primary-600 hover:underline">
            관심목록으로 돌아가기
          </Link>
        </div>
      </div>
    </PageShell>
  )
}

function LoadFailedScreen({ retryHref }: { retryHref: string }) {
  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <p className="text-body text-error">비교표를 불러오지 못했습니다.</p>
        <a href={retryHref} className="mt-4 inline-block text-body-sm text-primary-600 hover:underline">
          다시 시도
        </a>
      </div>
    </PageShell>
  )
}
