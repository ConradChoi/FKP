// Design Ref: docs/02-design/features/seepn-buyer-web-p5a.screen-spec.md §4 (BY-08) + §5 (empty
// states, D-13②) + app/admin/(protected)/partners/page.tsx (server-fetch/filter/sort/paginate
// pattern, reused in SHAPE only — this page never imports anything admin-scoped).
//
// Deliberately uses lib/supabase/serverClient.ts's plain anon client (getSupabaseServerClient),
// NOT lib/supabase/buyerServerAuthClient.ts — this page must not read cookies() at all, so that
// its own render stays independent of whether a buyer session exists (privacy review §7.4 BP-15:
// "찜 상태를 서버 렌더에 섞지 말 것" — the safest way to guarantee that is to never look at the
// session here in the first place; bookmark state is 100% client-side, see PartnerListClient).
import Link from 'next/link'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { fetchPublicCategoryTree, expandCategoryIdsWithDescendants } from '@/lib/seepn/categoryTree'
import { PartnerFilters, type PartnerFilterValues } from '@/components/seepn/PartnerFilters'
import { PartnerListClient } from '@/components/seepn/PartnerListClient'
import type { PartnerCardData } from '@/components/seepn/PartnerCard'
import { SeepnFooter } from '@/components/seepn/SeepnFooter'

const PAGE_SIZE = 18
const NO_MATCH_SENTINEL = ['00000000-0000-0000-0000-000000000000']

interface SearchParams {
  q?: string
  category?: string
  region?: string
  languages?: string
  overseas?: string
  vertical?: string
  serviceTypes?: string
  sort?: string
  page?: string
  primaryOnly?: string
}

export default async function SeepnPartnersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return (
      <PageShell>
        <p className="text-body text-error">목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>
      </PageShell>
    )
  }

  const [categoryTree, { count: totalCount }] = await Promise.all([
    fetchPublicCategoryTree(supabase),
    supabase.from('partner_list_public').select('id', { count: 'exact', head: true }),
  ])
  const total = totalCount ?? 0

  let partnerIdFilter: string[] | null = null
  if (sp.category) {
    const selectedIds = sp.category.split(',').filter(Boolean)
    if (selectedIds.length > 0) {
      const expandedIds = expandCategoryIdsWithDescendants(categoryTree, selectedIds)
      // Design Ref: partner-standard-category-picker-redesign.screen-spec.md §8/§11 OQ-2
      // (2026-09-12 대표 확정) — "주력분야만 보기" 체크 시 partner_category_public.role='primary'
      // 조건을 추가한다. 카테고리 필터 자체가 없으면(sp.category 미지정) 이 토글은 적용할 대상이
      // 없으므로 조용히 무시된다(D-8 "기존 그대로 전체 노출" 기본 동작 유지).
      let categoryLinkQuery = supabase.from('partner_category_public').select('partner_id').in('standard_category_id', expandedIds)
      if (sp.primaryOnly === '1') categoryLinkQuery = categoryLinkQuery.eq('role', 'primary')
      const { data: links } = await categoryLinkQuery
      partnerIdFilter = Array.from(new Set((links ?? []).map((l: { partner_id: string }) => l.partner_id)))
    }
  }

  let query = supabase
    .from('partner_list_public')
    .select('id, company_name_ko, company_name_en, location_region, vertical, service_types, supported_languages, overseas_experience, created_at', {
      count: 'exact',
    })

  if (sp.q && sp.q.trim()) {
    const term = sp.q.trim().replace(/[%_]/g, '')
    query = query.or(`company_name_ko.ilike.%${term}%,company_name_en.ilike.%${term}%`)
  }
  if (sp.region) {
    const regions = sp.region.split(',').filter(Boolean)
    if (regions.length > 0) query = query.in('location_region', regions)
  }
  if (sp.languages) {
    const languages = sp.languages.split(',').filter(Boolean)
    if (languages.length > 0) query = query.overlaps('supported_languages', languages)
  }
  if (sp.overseas === 'yes') query = query.eq('overseas_experience', true)
  if (sp.overseas === 'no') query = query.eq('overseas_experience', false)
  if (sp.vertical === 'product' || sp.vertical === 'service') query = query.eq('vertical', sp.vertical)
  if (sp.vertical === 'service' && sp.serviceTypes) {
    const types = sp.serviceTypes.split(',').filter(Boolean)
    if (types.length > 0) query = query.overlaps('service_types', types)
  }
  if (partnerIdFilter !== null) {
    query = query.in('id', partnerIdFilter.length > 0 ? partnerIdFilter : NO_MATCH_SENTINEL)
  }

  if (sp.sort === 'name') query = query.order('company_name_ko', { ascending: true, nullsFirst: false })
  else query = query.order('created_at', { ascending: false })

  // BY-16 (screen-spec §7.2) — "운영자 선정" section. `partner_featured_public` is already
  // returned in curation order (display_order — never selected, only used server-side for
  // ordering per M-R12), so no .order() is added here. §7.2 "필터 순응": every active filter
  // that also applies to the main `partner_list_public` query above is mirrored 1:1 here, so a
  // buyer never sees a recommended partner that doesn't match their own filter selection. Only
  // fetched on page 1 — repeating the same curated set on every paginated page would be noise
  // rather than a first-impression surface (screen-spec §7.1's stated purpose).
  let featuredQuery = supabase
    .from('partner_featured_public')
    .select('id, company_name_ko, company_name_en, location_region, vertical, service_types, supported_languages, overseas_experience, created_at')

  if (sp.q && sp.q.trim()) {
    const term = sp.q.trim().replace(/[%_]/g, '')
    featuredQuery = featuredQuery.or(`company_name_ko.ilike.%${term}%,company_name_en.ilike.%${term}%`)
  }
  if (sp.region) {
    const regions = sp.region.split(',').filter(Boolean)
    if (regions.length > 0) featuredQuery = featuredQuery.in('location_region', regions)
  }
  if (sp.languages) {
    const languages = sp.languages.split(',').filter(Boolean)
    if (languages.length > 0) featuredQuery = featuredQuery.overlaps('supported_languages', languages)
  }
  if (sp.overseas === 'yes') featuredQuery = featuredQuery.eq('overseas_experience', true)
  if (sp.overseas === 'no') featuredQuery = featuredQuery.eq('overseas_experience', false)
  if (sp.vertical === 'product' || sp.vertical === 'service') featuredQuery = featuredQuery.eq('vertical', sp.vertical)
  if (sp.vertical === 'service' && sp.serviceTypes) {
    const types = sp.serviceTypes.split(',').filter(Boolean)
    if (types.length > 0) featuredQuery = featuredQuery.overlaps('service_types', types)
  }
  if (partnerIdFilter !== null) {
    featuredQuery = featuredQuery.in('id', partnerIdFilter.length > 0 ? partnerIdFilter : NO_MATCH_SENTINEL)
  }

  const from = (page - 1) * PAGE_SIZE
  const [{ data: rows, count: filteredCount, error }, { data: featuredRows }] = await Promise.all([
    query.range(from, from + PAGE_SIZE - 1),
    page === 1 ? featuredQuery : Promise.resolve({ data: [] as PartnerCardData[] }),
  ])
  const partners = (rows ?? []) as PartnerCardData[]
  const featuredPartners = (featuredRows ?? []) as PartnerCardData[]
  const totalPages = Math.max(1, Math.ceil((filteredCount ?? 0) / PAGE_SIZE))

  const filterValues: PartnerFilterValues = {
    q: sp.q,
    category: sp.category,
    region: sp.region,
    languages: sp.languages,
    overseas: sp.overseas,
    vertical: sp.vertical,
    serviceTypes: sp.serviceTypes,
    sort: sp.sort,
    primaryOnly: sp.primaryOnly,
  }

  const hasAnyFilter = Boolean(sp.q || sp.category || sp.region || sp.languages || sp.overseas || sp.vertical || sp.serviceTypes)

  function pageHref(p: number) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) {
      if (k !== 'page' && v) params.set(k, v)
    }
    params.set('page', String(p))
    return `/seepn/partners?${params.toString()}`
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-h3 text-neutral-900">파트너 찾기</h1>

        {total === 0 && <EmptyAll />}
        {total > 0 && total <= 5 && <SparseBanner total={total} />}

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <PartnerFilters initial={filterValues} categoryTree={categoryTree} />

          <div>
            {featuredPartners.length > 0 && (
              <section className="mb-6 rounded-card border border-primary-100 bg-primary-50 p-4">
                <h2 className="text-body font-semibold text-primary-800">운영자 선정</h2>
                <p className="mt-0.5 text-label-caption text-primary-700">SEEPN이 추천하는 파트너입니다.</p>
                <div className="mt-3">
                  <PartnerListClient partners={featuredPartners} featured />
                </div>
              </section>
            )}

            <p className="mb-3 text-body-sm text-neutral-500">총 {filteredCount ?? 0}곳</p>

            {error && <p className="text-body-sm text-error">목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>}

            {!error && partners.length === 0 && (
              <div className="rounded-card border border-dashed border-neutral-200 p-10 text-center">
                <p className="text-body text-neutral-500">
                  {hasAnyFilter ? '조건에 맞는 파트너가 없습니다.' : total === 0 ? '아직 등록된 파트너가 없습니다.' : '결과가 없습니다.'}
                </p>
                {hasAnyFilter && (
                  <Link href="/seepn/partners" className="mt-3 inline-block text-body-sm text-primary-600 hover:underline">
                    필터 초기화
                  </Link>
                )}
              </div>
            )}

            {!error && partners.length > 0 && <PartnerListClient partners={partners} />}

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2 text-body-sm">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Link
                    key={p}
                    href={pageHref(p)}
                    className={`rounded-input px-3 py-1.5 ${p === page ? 'bg-primary-600 text-neutral-0' : 'text-neutral-600 hover:bg-neutral-100'}`}
                  >
                    {p}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-neutral-0">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/seepn/partners" className="text-label-button text-primary-700">
            SEEPN
          </Link>
          <nav className="flex items-center gap-4 text-body-sm">
            <Link href="/seepn/my/bookmarks" className="text-neutral-600 hover:underline">
              관심목록
            </Link>
            <Link href="/seepn/login" className="text-neutral-600 hover:underline">
              로그인
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <SeepnFooter />
    </div>
  )
}

// screen-spec §5.1 — D-13② means "0곳"은 실제 배포된다. 방어적 문구, 성장 중 프레이밍.
function EmptyAll() {
  return (
    <div className="mt-4 rounded-card border border-neutral-200 bg-neutral-0 p-8 text-center">
      <p className="text-body text-neutral-700">지금 SEEPN에 파트너를 모으고 있습니다.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3 text-body-sm">
        <Link href="/supplier/signup" className="text-primary-600 hover:underline">
          한국 파트너이신가요? 지금 등록하기
        </Link>
      </div>
    </div>
  )
}

// screen-spec §5.2
function SparseBanner({ total }: { total: number }) {
  return (
    <div className="mt-4 rounded-card border border-primary-100 bg-primary-50 px-4 py-3 text-body-sm text-primary-800">
      지금 {total}곳의 파트너가 있습니다. 계속 추가되고 있어요.
    </div>
  )
}
