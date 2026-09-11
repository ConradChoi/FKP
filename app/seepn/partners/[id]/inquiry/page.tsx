// Design Ref: screen-spec §7.2 (BY-11) — "참조 파트너 표시(읽기전용), 변경 불가(D-S5)" +
// "발신자 정보(읽기전용 표시) — '{display_name} · {email}로 회신드립니다', 폼에서 새로 입력받지
// 않음(INQ-3)". D-S5: this page always references exactly one partner (the [id] in the URL) —
// there is no "no partner referenced" entry point in P5a.
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { redirectToLoginIfNoBuyerSession } from '@/lib/seepn/loginGate'
import { requireBuyerSession } from '@/lib/seepn/session'
import { InquiryForm } from './InquiryForm'
import { SeepnFooter } from '@/components/seepn/SeepnFooter'

export const dynamic = 'force-dynamic'

export default async function SeepnPartnerInquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await redirectToLoginIfNoBuyerSession(`/seepn/partners/${id}/inquiry`)
  const session = await requireBuyerSession()

  const { data: partner } = await session.supabase
    .from('partner_detail_buyer')
    .select('id, company_name_ko')
    .eq('id', id)
    .maybeSingle<{ id: string; company_name_ko: string | null }>()

  if (!partner) notFound()

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

        <div className="mt-4 rounded-input border border-neutral-200 bg-neutral-0 px-4 py-3 text-body-sm">
          <span className="text-label-caption text-neutral-400">참조 파트너</span>
          <p className="mt-0.5 font-medium text-neutral-900">{partner.company_name_ko || '(회사명 미공개)'}</p>
        </div>

        <div className="mt-4">
          <InquiryForm partnerIds={[id]} replyEmail={session.email ?? '가입 시 등록한 이메일'} />
        </div>
      </main>

      <SeepnFooter />
    </div>
  )
}
