// Design Ref: docs/02-design/features/seepn-buyer-web-p5a.screen-spec.md §6 (BY-09) —
// login-required detail. §6.1: DB itself denies anon/non-buyer reads of partner_detail_buyer
// (privacy review §2 BP-1), and this page ALSO guards defensively so a signed-out visitor gets a
// login redirect (with return URL) instead of a bare 404/error.
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { redirectToLoginIfNoBuyerSession } from '@/lib/seepn/loginGate'
import { requireBuyerSession } from '@/lib/seepn/session'
import type { PartnerDetailBuyerRow } from '@/lib/seepn/types'
import {
  VERTICAL_LABELS,
  EMPLOYEE_BAND_LABELS,
  OEM_ODM_LABELS,
  PRICING_MODEL_LABELS,
  REMOTE_ONSITE_LABELS,
  languageLabel,
  serviceTypeLabel,
} from '@/lib/seepn/partnerLabels'
import { DetailBookmarkButton } from '@/components/seepn/DetailBookmarkButton'
import { SeepnFooter } from '@/components/seepn/SeepnFooter'

export const dynamic = 'force-dynamic'

export default async function SeepnPartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await redirectToLoginIfNoBuyerSession(`/seepn/partners/${id}`)
  const session = await requireBuyerSession()

  const { data: partner, error } = await session.supabase
    .from('partner_detail_buyer')
    .select('*')
    .eq('id', id)
    .maybeSingle<PartnerDetailBuyerRow>()

  // §6.1: a nonexistent id and a partner that fell out of public listing/verification/consent
  // both surface as "no row" from this view's WHERE clause — deliberately not distinguished
  // (privacy review's own reasoning: do not tell the buyer a profile "used to be public").
  if (error || !partner) notFound()

  const [{ data: categoryLinks }, { data: bookmarkRow }] = await Promise.all([
    session.supabase.from('partner_category_public').select('standard_category_id').eq('partner_id', id),
    session.supabase.from('buyer_bookmark').select('partner_id').eq('partner_id', id).maybeSingle(),
  ])

  const categoryIds = (categoryLinks ?? []).map((c: { standard_category_id: string }) => c.standard_category_id)
  let categoryNames: string[] = []
  if (categoryIds.length > 0) {
    const { data: translations } = await session.supabase
      .from('standard_category_translation')
      .select('category_id, name')
      .eq('locale', 'ko')
      .in('category_id', categoryIds)
    categoryNames = (translations ?? []).map((t: { name: string }) => t.name)
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-neutral-0">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
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

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 pb-28">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-h3 text-neutral-900">{partner.company_name_ko || '(회사명 미공개)'}</h1>
            {partner.company_name_en && <p className="text-body-sm text-neutral-400">{partner.company_name_en}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {partner.location_region && (
                <span className="rounded-sm bg-neutral-100 px-2 py-0.5 text-label-caption text-neutral-600">{partner.location_region}</span>
              )}
              {partner.vertical && (
                <span className="rounded-sm bg-primary-50 px-2 py-0.5 text-label-caption text-primary-700">
                  {VERTICAL_LABELS[partner.vertical] ?? partner.vertical}
                </span>
              )}
              {partner.overseas_experience && (
                <span className="rounded-sm bg-accent-50 px-2 py-0.5 text-label-caption text-accent-700">
                  해외거래 경험{partner.overseas_experience_countries?.length ? ` (${partner.overseas_experience_countries.join(', ')})` : ''}
                </span>
              )}
            </div>
          </div>
          <DetailBookmarkButton partnerId={id} initialBookmarked={Boolean(bookmarkRow)} />
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 rounded-card border border-neutral-200 bg-neutral-0 p-4 text-body-sm">
          {partner.founded_year && (
            <div>
              <dt className="text-label-caption text-neutral-400">설립연도</dt>
              <dd className="text-neutral-800">{partner.founded_year}년</dd>
            </div>
          )}
          {partner.employee_band && (
            <div>
              <dt className="text-label-caption text-neutral-400">임직원 규모</dt>
              <dd className="text-neutral-800">{EMPLOYEE_BAND_LABELS[partner.employee_band] ?? partner.employee_band}</dd>
            </div>
          )}
          {partner.supported_languages.length > 0 && (
            <div>
              <dt className="text-label-caption text-neutral-400">대응언어</dt>
              <dd className="text-neutral-800">{partner.supported_languages.map(languageLabel).join(', ')}</dd>
            </div>
          )}
          {partner.website_url && (
            <div>
              <dt className="text-label-caption text-neutral-400">홈페이지</dt>
              <dd>
                <a href={partner.website_url} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">
                  {partner.website_url}
                </a>
              </dd>
            </div>
          )}
        </dl>

        {partner.company_intro_text && (
          <section className="mt-6">
            <h2 className="text-h4 text-neutral-900">회사소개</h2>
            <p className="mt-2 whitespace-pre-wrap text-body text-neutral-700">{partner.company_intro_text}</p>
            <p className="mt-1 text-label-caption text-neutral-400">
              원문: {partner.company_intro_locale ?? 'ko'} · 번역 미제공
            </p>
          </section>
        )}

        {partner.representative_offerings?.length > 0 && (
          <section className="mt-6">
            <h2 className="text-h4 text-neutral-900">대표 제품/서비스</h2>
            <ul className="mt-2 space-y-2">
              {partner.representative_offerings.slice(0, 3).map((o, i) => (
                <li key={i} className="rounded-input border border-neutral-100 p-3 text-body-sm">
                  <p className="font-medium text-neutral-800">{o.name}</p>
                  <p className="mt-1 text-neutral-600">{o.description}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {partner.vertical === 'product' && (
          <section className="mt-6">
            <h2 className="text-h4 text-neutral-900">역량 상세 (제품)</h2>
            <dl className="mt-2 grid grid-cols-2 gap-4 text-body-sm">
              {partner.moq && (
                <div>
                  <dt className="text-label-caption text-neutral-400">MOQ</dt>
                  <dd className="text-neutral-800">{partner.moq}</dd>
                </div>
              )}
              {partner.price_band && (
                <div>
                  <dt className="text-label-caption text-neutral-400">가격밴드</dt>
                  <dd className="text-neutral-800">{partner.price_band}</dd>
                </div>
              )}
              {partner.lead_time_days !== null && (
                <div>
                  <dt className="text-label-caption text-neutral-400">리드타임</dt>
                  <dd className="text-neutral-800">{partner.lead_time_days}일</dd>
                </div>
              )}
              {partner.sample_available !== null && (
                <div>
                  <dt className="text-label-caption text-neutral-400">샘플 가능여부</dt>
                  <dd className="text-neutral-800">{partner.sample_available ? '가능' : '불가'}{partner.sample_terms ? ` (${partner.sample_terms})` : ''}</dd>
                </div>
              )}
              {partner.oem_odm_type && (
                <div>
                  <dt className="text-label-caption text-neutral-400">OEM/ODM</dt>
                  <dd className="text-neutral-800">{OEM_ODM_LABELS[partner.oem_odm_type]}</dd>
                </div>
              )}
              {partner.export_record && (
                <div>
                  <dt className="text-label-caption text-neutral-400">수출실적</dt>
                  <dd className="text-neutral-800">{partner.export_record}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {partner.vertical === 'service' && (
          <section className="mt-6">
            <h2 className="text-h4 text-neutral-900">역량 상세 (서비스)</h2>
            <dl className="mt-2 grid grid-cols-2 gap-4 text-body-sm">
              {partner.service_types.length > 0 && (
                <div>
                  <dt className="text-label-caption text-neutral-400">서비스유형</dt>
                  <dd className="text-neutral-800">{partner.service_types.map(serviceTypeLabel).join(', ')}</dd>
                </div>
              )}
              {partner.project_min_size && (
                <div>
                  <dt className="text-label-caption text-neutral-400">최소 프로젝트 규모</dt>
                  <dd className="text-neutral-800">{partner.project_min_size}</dd>
                </div>
              )}
              {partner.pricing_model && (
                <div>
                  <dt className="text-label-caption text-neutral-400">과금모델</dt>
                  <dd className="text-neutral-800">{PRICING_MODEL_LABELS[partner.pricing_model]}</dd>
                </div>
              )}
              {partner.standard_lead_time && (
                <div>
                  <dt className="text-label-caption text-neutral-400">표준 소요기간</dt>
                  <dd className="text-neutral-800">{partner.standard_lead_time}</dd>
                </div>
              )}
              {partner.team_size_band && (
                <div>
                  <dt className="text-label-caption text-neutral-400">팀 규모</dt>
                  <dd className="text-neutral-800">{partner.team_size_band}</dd>
                </div>
              )}
              {partner.remote_onsite && (
                <div>
                  <dt className="text-label-caption text-neutral-400">진행방식</dt>
                  <dd className="text-neutral-800">{REMOTE_ONSITE_LABELS[partner.remote_onsite]}</dd>
                </div>
              )}
            </dl>
            {partner.reference_projects?.length > 0 && (
              <div className="mt-4">
                <h3 className="text-body-sm font-medium text-neutral-800">레퍼런스 프로젝트</h3>
                <ul className="mt-2 space-y-2">
                  {partner.reference_projects.map((r, i) => (
                    <li key={i} className="rounded-input border border-neutral-100 p-3 text-body-sm text-neutral-700">
                      {r.client_industry} · {r.deliverable}
                      {r.anonymized && <span className="ml-1 text-label-caption text-neutral-400">(익명화됨)</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {partner.certifications?.length > 0 && (
          <section className="mt-6">
            <h2 className="text-h4 text-neutral-900">보유 인증</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {partner.certifications.map((c) => (
                <span key={c} className="rounded-sm bg-neutral-100 px-2 py-0.5 text-label-caption text-neutral-600">
                  {c}
                </span>
              ))}
            </div>
          </section>
        )}

        {categoryNames.length > 0 && (
          <section className="mt-6">
            <h2 className="text-h4 text-neutral-900">표준 카테고리</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {categoryNames.map((name) => (
                <span key={name} className="rounded-sm bg-primary-50 px-2 py-0.5 text-label-caption text-primary-700">
                  {name}
                </span>
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="sticky bottom-0 border-t border-neutral-200 bg-neutral-0 px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <Link
            href={`/seepn/partners/${id}/inquiry`}
            className="block w-full rounded-input bg-primary-600 py-3 text-center text-label-button text-neutral-0 hover:bg-primary-700"
          >
            운영자에게 문의하기
          </Link>
        </div>
      </div>

      <SeepnFooter />
    </div>
  )
}
