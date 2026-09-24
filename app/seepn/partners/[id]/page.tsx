// Design Ref: Figma "Seepn 2.0 — UI Design" U-05-02 공급사 상세 (node 9:2) for the layout: cover band,
// overlapping profile card (logo, name, 신뢰도 지수, 4 score bars, action icons), 4 tabs
// (기업소개/상품/리뷰/평가). 신뢰도 지수·평가 점수·좋아요·평점·리뷰·평가 have no backing feature yet,
// so they render "-"/"준비 중" instead of invented numbers; all real profile data is kept, split
// into 기업소개 (company info, certifications, categories) and 상품 (offerings, capabilities).
// Original: docs/02-design/features/seepn-buyer-web-p5a.screen-spec.md §6 (BY-09) —
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
import { SeepnMainHeader } from '@/components/seepn/SeepnMainChrome'
import { PartnerDetailTabs } from '@/components/seepn/PartnerDetailTabs'

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

  const companyName = partner.company_name_ko || '(회사명 미공개)'

  const introPanel = (
    <div className="space-y-8">
      <section>
        <h2 className="text-[18px] font-semibold text-neutral-900">기업 소개</h2>
        {partner.company_intro_text ? (
          <>
            <p className="mt-3 whitespace-pre-wrap text-body-sm text-neutral-600">{partner.company_intro_text}</p>
            <p className="mt-1 text-label-caption text-neutral-400">원문: {partner.company_intro_locale ?? 'ko'} · 번역 미제공</p>
          </>
        ) : (
          <p className="mt-3 text-body-sm text-neutral-400">등록된 기업 소개가 없습니다.</p>
        )}
      </section>

      <dl className="grid grid-cols-2 gap-4 rounded-card border border-neutral-200 bg-white p-5 text-body-sm sm:grid-cols-4">
        {partner.founded_year && <Info label="설립연도" value={`${partner.founded_year}년`} />}
        {partner.employee_band && <Info label="임직원 규모" value={EMPLOYEE_BAND_LABELS[partner.employee_band] ?? partner.employee_band} />}
        {partner.supported_languages.length > 0 && <Info label="대응언어" value={partner.supported_languages.map(languageLabel).join(', ')} />}
        {partner.website_url && (
          <div>
            <dt className="text-label-caption text-neutral-400">홈페이지</dt>
            <dd className="break-all">
              <a href={partner.website_url} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">
                {partner.website_url}
              </a>
            </dd>
          </div>
        )}
      </dl>

      {partner.certifications?.length > 0 && (
        <section>
          <h2 className="text-[18px] font-semibold text-neutral-900">보유 인증</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {partner.certifications.map((c) => (
              <span key={c} className="rounded-sm bg-neutral-100 px-2 py-0.5 text-label-caption text-neutral-600">
                {c}
              </span>
            ))}
          </div>
        </section>
      )}

      {categoryNames.length > 0 && (
        <section>
          <h2 className="text-[18px] font-semibold text-neutral-900">표준 카테고리</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {categoryNames.map((name) => (
              <span key={name} className="rounded-sm bg-primary-50 px-2 py-0.5 text-label-caption text-primary-700">
                {name}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  )

  const offeringsPanel = (
    <div className="space-y-8">
      <section>
        <h2 className="text-[18px] font-semibold text-neutral-900">대표 제품/서비스</h2>
        {partner.representative_offerings?.length > 0 ? (
          <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            {partner.representative_offerings.slice(0, 3).map((o, i) => (
              <li key={i} className="rounded-card border border-neutral-200 bg-white p-4 text-body-sm">
                <p className="font-semibold text-neutral-900">{o.name}</p>
                <p className="mt-1 text-neutral-600">{o.description}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-body-sm text-neutral-400">등록된 대표 제품/서비스가 없습니다.</p>
        )}
      </section>

      {partner.vertical === 'product' && (
        <section>
          <h2 className="text-[18px] font-semibold text-neutral-900">역량 상세 (제품)</h2>
          <dl className="mt-3 grid grid-cols-2 gap-4 rounded-card border border-neutral-200 bg-white p-5 text-body-sm sm:grid-cols-3">
            {partner.moq && <Info label="MOQ" value={partner.moq} />}
            {partner.price_band && <Info label="가격밴드" value={partner.price_band} />}
            {partner.lead_time_days !== null && <Info label="리드타임" value={`${partner.lead_time_days}일`} />}
            {partner.sample_available !== null && (
              <Info label="샘플 가능여부" value={`${partner.sample_available ? '가능' : '불가'}${partner.sample_terms ? ` (${partner.sample_terms})` : ''}`} />
            )}
            {partner.oem_odm_type && <Info label="OEM/ODM" value={OEM_ODM_LABELS[partner.oem_odm_type]} />}
            {partner.export_record && <Info label="수출실적" value={partner.export_record} />}
          </dl>
        </section>
      )}

      {partner.vertical === 'service' && (
        <section>
          <h2 className="text-[18px] font-semibold text-neutral-900">역량 상세 (서비스)</h2>
          <dl className="mt-3 grid grid-cols-2 gap-4 rounded-card border border-neutral-200 bg-white p-5 text-body-sm sm:grid-cols-3">
            {partner.service_types.length > 0 && <Info label="서비스유형" value={partner.service_types.map(serviceTypeLabel).join(', ')} />}
            {partner.project_min_size && <Info label="최소 프로젝트 규모" value={partner.project_min_size} />}
            {partner.pricing_model && <Info label="과금모델" value={PRICING_MODEL_LABELS[partner.pricing_model]} />}
            {partner.standard_lead_time && <Info label="표준 소요기간" value={partner.standard_lead_time} />}
            {partner.team_size_band && <Info label="팀 규모" value={partner.team_size_band} />}
            {partner.remote_onsite && <Info label="진행방식" value={REMOTE_ONSITE_LABELS[partner.remote_onsite]} />}
          </dl>
          {partner.reference_projects?.length > 0 && (
            <div className="mt-5">
              <h3 className="text-body-sm font-semibold text-neutral-800">레퍼런스 프로젝트</h3>
              <ul className="mt-2 space-y-2">
                {partner.reference_projects.map((r, i) => (
                  <li key={i} className="rounded-input border border-neutral-200 bg-white p-3 text-body-sm text-neutral-700">
                    {r.client_industry} · {r.deliverable}
                    {r.anonymized && <span className="ml-1 text-label-caption text-neutral-400">(익명화됨)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  )

  const comingSoon = (title: string) => (
    <div>
      <h2 className="text-[18px] font-semibold text-neutral-900">{title}</h2>
      <div className="mt-3 rounded-card border border-dashed border-neutral-200 bg-white p-10 text-center">
        <p className="text-body text-neutral-700">준비 중인 기능입니다.</p>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col bg-[#f9fafb]">
      <SeepnMainHeader active="partners" />

      <div className="h-[200px] bg-primary-100 sm:h-[240px]" aria-hidden="true" />

      <div className="mx-auto w-full max-w-6xl px-6">
        <section className="relative -mt-10 rounded-card bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <span
            aria-hidden="true"
            className="absolute -top-9 left-4 flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white bg-primary-50 text-[24px] font-bold text-primary-600"
          >
            {companyName.slice(0, 1)}
          </span>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-h-[40px] pl-[88px]">
              <h1 className="text-[24px] font-bold text-neutral-900">{companyName}</h1>
              {partner.company_name_en && <p className="text-body-sm text-neutral-400">{partner.company_name_en}</p>}
            </div>
            <div className="flex items-center gap-3 text-body-sm text-neutral-400">
              <DetailBookmarkButton partnerId={id} initialBookmarked={Boolean(bookmarkRow)} />
              <span className="h-3 w-px bg-neutral-200" aria-hidden="true" />
              <span title="준비 중">추천 -</span>
              <span className="h-3 w-px bg-neutral-200" aria-hidden="true" />
              <span title="준비 중">★ - (-)</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {partner.location_region && (
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600">{partner.location_region}</span>
            )}
            {partner.vertical && (
              <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-medium text-primary-700">
                {VERTICAL_LABELS[partner.vertical] ?? partner.vertical}
              </span>
            )}
            {partner.overseas_experience && (
              <span className="rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-medium text-accent-700">
                해외거래 경험{partner.overseas_experience_countries?.length ? ` (${partner.overseas_experience_countries.join(', ')})` : ''}
              </span>
            )}
            <span className="ml-2 text-body-sm font-medium text-primary-600">신뢰도 지수 -</span>
          </div>

          <div className="mt-5 flex flex-wrap gap-x-3 gap-y-3">
            {['품질', '가격', '납기', '서비스'].map((label) => (
              <div key={label} className="w-[100px]">
                <p className="text-[10px] font-medium text-neutral-600">{label} -</p>
                <div className="mt-1 h-1 rounded-full bg-primary-200" />
              </div>
            ))}
          </div>
        </section>
      </div>

      <PartnerDetailTabs
        tabs={[
          { key: 'intro', label: '기업소개', content: introPanel },
          { key: 'offerings', label: '상품', content: offeringsPanel },
          { key: 'reviews', label: '리뷰', content: comingSoon('리뷰') },
          { key: 'ratings', label: '평가', content: comingSoon('평가') },
        ]}
      />

      <div className="sticky bottom-0 mt-auto border-t border-neutral-200 bg-white px-4 py-3">
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-label-caption text-neutral-400">{label}</dt>
      <dd className="text-neutral-800">{value}</dd>
    </div>
  )
}
