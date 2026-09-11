// Design Ref: docs/02-design/features/seepn-buyer-web-p5b.screen-spec.md §6 (BY-15, "BY-11
// 일반화") — 비교표(BY-14)에서 "선택한 N곳에 대해 운영자에게 문의하기"로 들어오는 다중 참조
// 문의 화면. 참조 파트너 목록은 읽기전용, 변경하려면 비교표로 돌아가야 한다(D-S5 원칙 승계,
// §6.3). EDGE-C10: 이 라우트는 "참조 0건 문의"를 지원하지 않는다 — ids 없이 직접 접근하면
// BY-14(/seepn/compare)로 돌려보낸다(그쪽이 0/1개 유효 후보를 이미 우아하게 처리한다).
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { redirectToLoginIfNoBuyerSession } from '@/lib/seepn/loginGate'
import { requireBuyerSession } from '@/lib/seepn/session'
import { InquiryForm } from '@/app/seepn/partners/[id]/inquiry/InquiryForm'
import { SeepnFooter } from '@/components/seepn/SeepnFooter'

export const dynamic = 'force-dynamic'

const MAX_COMPARE = 5
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface CompareInquirySearchParams {
  ids?: string
}

export default async function SeepnCompareInquiryPage({ searchParams }: { searchParams: Promise<CompareInquirySearchParams> }) {
  const sp = await searchParams
  const returnPath = `/seepn/compare/inquiry${sp.ids ? `?ids=${encodeURIComponent(sp.ids)}` : ''}`
  await redirectToLoginIfNoBuyerSession(returnPath)
  const session = await requireBuyerSession()

  // Same parse/dedupe/cap posture as BY-14 — this page never trusts the query string either.
  const ids = Array.from(
    new Set(
      (sp.ids ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => UUID_RE.test(s)),
    ),
  ).slice(0, MAX_COMPARE)

  // EDGE-C10: ids 없이 직접 접근 -> BY-14로 리다이렉트.
  if (ids.length === 0) {
    redirect('/seepn/compare')
  }

  const { data: rows } = await session.supabase.from('partner_detail_buyer').select('id, company_name_ko').in('id', ids)
  const byId = new Map((rows ?? []).map((r: { id: string; company_name_ko: string | null }) => [r.id, r]))
  const partners = ids.map((id) => byId.get(id)).filter((p): p is { id: string; company_name_ko: string | null } => Boolean(p))

  // 참조 파트너가 하나도 남지 않으면(레이스로 전부 비공개 전환 등) BY-14로 돌려보낸다 — 그쪽이
  // 남은 ids로 다시 재검증해 적절한 안내(EDGE-C3/C4)를 보여준다.
  if (partners.length === 0) {
    redirect(`/seepn/compare?ids=${ids.join(',')}`)
  }

  const compareHref = `/seepn/compare?ids=${ids.join(',')}`

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-neutral-0">
        <div className="mx-auto flex max-w-2xl items-center px-4 py-4">
          <Link href="/seepn/partners" className="text-label-button text-primary-700">
            SEEPN
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-h3 text-neutral-900">운영자에게 문의하기</h1>

        <div className="mt-4">
          <span className="text-label-caption text-neutral-400">참조 파트너 {partners.length}곳</span>
          <div className="mt-2 space-y-2">
            {partners.map((p) => (
              <div key={p.id} className="rounded-input border border-neutral-200 bg-neutral-0 px-4 py-3 text-body-sm">
                <p className="font-medium text-neutral-900">{p.company_name_ko || '(회사명 미공개)'}</p>
              </div>
            ))}
          </div>
          <Link href={compareHref} className="mt-2 inline-block text-label-caption text-neutral-500 hover:underline">
            비교표로 돌아가 다시 선택하기
          </Link>
        </div>

        <div className="mt-4">
          <InquiryForm
            partnerIds={partners.map((p) => p.id)}
            replyEmail={session.email ?? '가입 시 등록한 이메일'}
            compareHref={compareHref}
          />
        </div>
      </main>

      <SeepnFooter />
    </div>
  )
}
