// Design Ref: Figma "Seepn 2.0 — UI Design" file (IEnOaPxIdGMKoIZ1rMWv06), page "👤 User App",
// frame "U-01 Main — Desktop (1440)" (node 7:2) — the standalone-domain (seepn.me) home screen
// requested 2026-09-14. Per that request's agreed scope: Header/Hero search/카테고리별 공급사
// 찾기/추천 공급사/Footer are wired to real data; KPI numbers, "Why SEEPN", 인사이트, and the
// supplier-CTA copy are static placeholders — this app has no ratings/likes/insights-article
// feature yet, so faking that data would be worse than an honest static section. See
// middleware.ts's SEEPN_STANDALONE_HOSTS for how a request to seepn.me's bare `/` reaches this
// page (internal rewrite, not a route the FKP domain itself links to).
import Link from 'next/link'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { fetchPublicCategoryTree, type CategoryNode } from '@/lib/seepn/categoryTree'
import { PartnerListClient } from '@/components/seepn/PartnerListClient'
import type { PartnerCardData } from '@/components/seepn/PartnerCard'
import { SeepnFooter } from '@/components/seepn/SeepnFooter'

const CATEGORY_CARD_COUNT = 5
const CATEGORY_CARD_CHILDREN_LIMIT = 4
const FEATURED_PARTNER_LIMIT = 4

const POPULAR_SEARCH_TERMS = ['정수기 렌탈', '사무용품', 'IT 장비', '물류 운송', '전기설비']

// No searchParams/cookies here (unlike /seepn/partners), so Next would otherwise statically
// freeze this page's category/featured-partner data at build time. 5-minute ISR keeps it close
// to live without hitting the DB on every request — this is public, non-personalized content.
export const revalidate = 300

export default async function SeepnHomePage() {
  const supabase = getSupabaseServerClient()

  let l1Categories: CategoryNode[] = []
  let featuredPartners: PartnerCardData[] = []

  if (supabase) {
    const [categoryTree, { data: featuredRows }] = await Promise.all([
      fetchPublicCategoryTree(supabase),
      supabase
        .from('partner_featured_public')
        .select('id, company_name_ko, company_name_en, location_region, vertical, service_types, supported_languages, overseas_experience')
        .limit(FEATURED_PARTNER_LIMIT),
    ])
    // categoryTree's roots are the 3 L0 nodes (상품/서비스/상품+서비스, see
    // app/admin/(protected)/partners/categoryOptions.ts's CATEGORY_ROOT_NAME_* for that same
    // 3-node structure on the partner side) — this page's category nav operates one level down,
    // across all three, matching how /seepn/partners' own sidebar filter already treats them.
    l1Categories = categoryTree.flatMap((root) => root.children)
    featuredPartners = (featuredRows ?? []) as PartnerCardData[]
  }

  const cardCategories = l1Categories.filter((c) => c.children.length > 0).slice(0, CATEGORY_CARD_COUNT)
  const tabCategories = l1Categories.slice(0, 18)

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <Header />
      <Hero />
      <PopularSuppliers partners={featuredPartners} />
      <CategoryQuick tabs={tabCategories} cards={cardCategories} />
      <WhySeepn />
      <Insights />
      <SupplierCta />
      <div className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-3 text-label-caption text-neutral-400">© 2026 SEEPN Inc. All rights reserved.</div>
        <SeepnFooter />
      </div>
    </div>
  )
}

function Header() {
  return (
    <header className="bg-[#0f1732]">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-body-lg font-semibold text-white">
            SEEPN
          </Link>
          <nav className="hidden items-center gap-6 text-body-sm text-[#b2bfd9] md:flex">
            <Link href="/seepn/partners" className="hover:text-white">
              공급사 찾기
            </Link>
            <span className="cursor-default text-[#6b7699]">TOP100</span>
            <span className="cursor-default text-[#6b7699]">커뮤니티</span>
            <span className="cursor-default text-[#6b7699]">인사이트</span>
            <span className="cursor-default text-[#6b7699]">FAQ</span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <form action="/seepn/partners" method="get" className="hidden lg:block">
            <input
              type="text"
              name="q"
              placeholder="공급사, 품목명으로 검색"
              className="w-[300px] rounded-input bg-[#254182] px-4 py-2 text-body-sm text-white placeholder:text-[#808cb2] focus:outline-none"
            />
          </form>
          <Link
            href="/supplier/signup"
            className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-label-caption text-white hover:bg-white/20"
          >
            공급사 등록
          </Link>
          <Link href="/seepn/login" className="rounded-full bg-primary-600 px-4 py-2 text-body-sm font-semibold text-white hover:bg-primary-700">
            로그인
          </Link>
          <Link href="/seepn/my/bookmarks" className="rounded-full bg-white/10 px-4 py-2 text-label-caption text-[#99a6bf] hover:bg-white/20">
            마이페이지
          </Link>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#0f1732] py-16">
      <div className="pointer-events-none absolute -right-32 -top-32 h-[520px] w-[520px] rounded-full bg-[#254182]" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_auto]">
        <div>
          <span className="inline-block rounded-full bg-[#254182] px-4 py-1.5 text-label-caption text-primary-100">
            대한민국 No.1 B2B 공급사 플랫폼
          </span>
          <h1 className="mt-6 text-[40px] font-semibold leading-tight text-white">
            공급사 찾는 시간
            <br />
            이제 5분이면 충분합니다
          </h1>
          <p className="mt-6 text-body text-primary-100">
            검증된 공급사를 품목 검색 · 4차원 평가 · 실시간 비교로
            <br />더 현명한 B2B 구매를 경험하세요
          </p>
          <form action="/seepn/partners" method="get" className="mt-8 flex max-w-xl overflow-hidden rounded-full bg-white p-1.5">
            <input
              type="text"
              name="q"
              placeholder="어떤 공급사를 찾고 계신가요? (품목명, 카테고리, 회사명)"
              className="flex-1 rounded-full px-5 text-body-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
            />
            <button type="submit" className="rounded-full bg-primary-600 px-6 py-2.5 text-body-sm font-semibold text-white hover:bg-primary-700">
              검색
            </button>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-label-caption text-[#94a3b8]">
            <span>인기 검색 :</span>
            {POPULAR_SEARCH_TERMS.map((term) => (
              <Link
                key={term}
                href={`/seepn/partners?q=${encodeURIComponent(term)}`}
                className="rounded-full bg-[#254182] px-3 py-1 text-primary-100 hover:bg-[#2f4f9c]"
              >
                # {term}
              </Link>
            ))}
          </div>
        </div>
        {/* KPI 카드: 정적 플레이스홀더 — 평점/응답시간 등은 이 서비스에 아직 없는 지표입니다. */}
        <div className="grid grid-cols-2 gap-4">
          {[
            ['12,847+', '등록 공급사'],
            ['247개', '품목 분류'],
            ['4.8★', '평균 평점'],
            ['2.3시간', '평균 응답'],
          ].map(([value, label]) => (
            <div key={label} className="w-[160px] rounded-card bg-[#1b2d5f] p-5">
              <p className="text-[28px] font-semibold text-white">{value}</p>
              <p className="mt-4 text-body-sm text-primary-100">{label}</p>
              <div className="mt-4 h-1 w-10 rounded-full bg-primary-500" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PopularSuppliers({ partners }: { partners: PartnerCardData[] }) {
  if (partners.length === 0) return null
  return (
    <section className="border-t border-neutral-200 bg-white py-14">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-h3 text-neutral-900">추천 공급사</h2>
          <Link href="/seepn/partners" className="text-body-sm text-primary-600 hover:underline">
            전체 공급사 보기 →
          </Link>
        </div>
        <div className="mt-6">
          <PartnerListClient partners={partners} featured />
        </div>
      </div>
    </section>
  )
}

function CategoryQuick({ tabs, cards }: { tabs: CategoryNode[]; cards: CategoryNode[] }) {
  if (tabs.length === 0) return null
  return (
    <section className="border-t border-neutral-200 bg-[#f9fafb] py-14">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-h3 text-neutral-900">카테고리별 공급사 찾기</h2>
          <Link href="/seepn/partners" className="text-body-sm text-primary-600 hover:underline">
            전체 카테고리 보기 →
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-neutral-200 bg-neutral-200 sm:grid-cols-3 lg:grid-cols-6">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={`/seepn/partners?category=${tab.id}`}
              className="bg-white px-2 py-3 text-center text-body-sm text-neutral-700 hover:bg-primary-50 hover:text-primary-700"
            >
              {tab.name}
            </Link>
          ))}
        </div>

        {cards.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {cards.map((card) => {
              const shown = card.children.slice(0, CATEGORY_CARD_CHILDREN_LIMIT)
              const overflow = card.children.length - shown.length
              return (
                <div key={card.id} className="rounded-card border border-neutral-200 bg-white p-3">
                  <p className="text-body-sm font-semibold text-neutral-900">{card.name}</p>
                  <div className="mt-2 border-t border-neutral-100 pt-2">
                    {shown.map((child) => (
                      <p key={child.id} className="truncate text-label-caption text-neutral-600">
                        · {child.name}
                      </p>
                    ))}
                  </div>
                  {overflow > 0 && (
                    <Link href={`/seepn/partners?category=${card.id}`} className="mt-1 block text-label-caption text-primary-600 hover:underline">
                      외 {overflow}개 →
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

// 정적 플레이스홀더 섹션 — 4차원 평가/실시간 비교/인증 시스템은 카피만 옮긴 것으로, 이 서비스가
// 실제로 그 기준을 계산해 보여주는 기능은 아직 없습니다.
function WhySeepn() {
  const items = [
    { title: '4차원 신뢰 평가', desc: '품질·가격·서비스·납기 4가지 기준으로 검증된 공급사 정보를 제공합니다' },
    { title: '실시간 비교', desc: '여러 공급사를 한 화면에서 비교하고 최적의 파트너를 선택하세요' },
    { title: '인증 시스템', desc: '파트너·우수·ISO 인증을 받은 신뢰할 수 있는 공급사만 표시됩니다' },
  ]
  return (
    <section className="border-t border-neutral-200 bg-white py-14">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-h3 text-neutral-900">SEEPN을 선택해야 하는 이유</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {items.map((item) => (
            <div key={item.title} className="rounded-card border border-neutral-200 p-5">
              <div className="h-11 w-11 rounded-full bg-primary-50" aria-hidden="true" />
              <p className="mt-4 text-body font-semibold text-neutral-900">{item.title}</p>
              <p className="mt-2 text-body-sm text-neutral-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// 정적 플레이스홀더 — 인사이트(블로그/아티클) 기능 자체가 아직 이 서비스에 없습니다.
function Insights() {
  const articles = [
    { tag: 'IT·소프트웨어', title: '2026 IT 장비 조달 트렌드 TOP 10', date: '2026.06.01' },
    { tag: '물류', title: '효율적인 공급사 평가 방법 가이드', date: '2026.05.28' },
    { tag: '시설관리', title: '물류비 절감을 위한 공급사 선택 기준', date: '2026.05.24' },
  ]
  return (
    <section className="border-t border-neutral-200 bg-[#f9fafb] py-14">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-h3 text-neutral-900">조달 담당자를 위한 B2B 인사이트</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {articles.map((a) => (
            <div key={a.title} className="rounded-card border border-neutral-200 bg-white p-4">
              <span className="inline-block rounded-full bg-primary-50 px-2.5 py-1 text-label-caption text-primary-600">{a.tag}</span>
              <p className="mt-3 text-body-sm font-semibold text-neutral-900">{a.title}</p>
              <p className="mt-6 text-label-caption text-neutral-400">{a.date}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SupplierCta() {
  return (
    <section className="border-t border-primary-100 bg-primary-50 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-h3 text-neutral-900">공급사라면? SEEPN에 등록하고 더 많은 바이어를 만나보세요</p>
          <p className="mt-2 text-body-sm text-neutral-600">무료로 시작하세요</p>
        </div>
        <Link href="/supplier/signup" className="rounded-full bg-primary-600 px-6 py-3 text-body-sm font-semibold text-white hover:bg-primary-700">
          공급사 등록하기 →
        </Link>
      </div>
    </section>
  )
}
