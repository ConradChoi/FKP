// Design Ref: fkp-v0.2-phase2-request-flow.spec.md §13 (v1.2) — Header / Hero (hosts the full
// Step1-3 carousel + confirm modal, no separate continuation panel) / HowItWorks / Categories /
// WhyUs / Footer.
import { getDictionary, locales } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/types'
import { getLandingCopyMap } from '@/lib/content/getLandingCopy'
import { AnalyticsPageView } from '@/components/AnalyticsPageView'
import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { HowItWorks } from '@/components/HowItWorks'
import { Categories } from '@/components/Categories'
import { WhyUs } from '@/components/WhyUs'
import { Footer } from '@/components/Footer'
import { HomeFlowProvider } from '@/components/RequestFlow/HomeFlowProvider'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

// Design Ref: Phase 5-C — 대표 확정(2026-08-27): 관리자가 저장한 랜딩카피가 재배포 없이도
// 사이트에 반영되도록 ISR 60초 채택. 정적 캐싱의 성능 이점은 유지하면서, 관리자가 카피를
// 저장하면 최대 1분 이내에 다음 요청에서 최신 DB 내용으로 재생성된다.
export const revalidate = 60

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const dict = getDictionary(locale as Locale)
  const copy = await getLandingCopyMap(locale as Locale)

  // Design Ref: Phase 5-C — hero/howItWorks/whyUs/footer 소개는 이제 content_item/
  // content_translation(관리자 화면에서 편집)이 진실 공급원이다. copy[key]가 없으면(DB
  // 조회 실패, 아직 채워지지 않은 항목 등) dict의 정적 값으로 조용히 폴백한다.
  const heroDict = {
    ...dict.hero,
    headline: copy['landing.hero.headline'] ?? dict.hero.headline,
    subheadline: copy['landing.hero.subheadline'] ?? dict.hero.subheadline,
    ctaText: copy['landing.hero.cta'] ?? dict.hero.ctaText,
  }

  const howItWorksDict = {
    ...dict.howItWorks,
    title: copy['landing.how_it_works.title'] ?? dict.howItWorks.title,
    steps: dict.howItWorks.steps.map((step, i) => ({
      title: copy[`landing.how_it_works.step_${i + 1}.title`] ?? step.title,
      description: copy[`landing.how_it_works.step_${i + 1}.description`] ?? step.description,
    })),
  }

  const whyUsDict = {
    ...dict.whyUs,
    title: copy['landing.why_us.title'] ?? dict.whyUs.title,
    points: dict.whyUs.points.map((point, i) => ({
      title: copy[`landing.why_us.point_${i + 1}.title`] ?? point.title,
      description: copy[`landing.why_us.point_${i + 1}.description`] ?? point.description,
    })),
  }

  const footerDict = {
    ...dict.footer,
    intro: copy['landing.footer.intro'] ?? dict.footer.intro,
  }

  return (
    <main>
      <AnalyticsPageView path={`/${locale}`} />

      <HomeFlowProvider dict={dict.requestForm} categoriesDict={dict.categories} locale={locale as Locale}>
        <Header locale={locale as Locale} dict={dict.header} />

        <Hero
          dict={heroDict}
          requestFormDict={dict.requestForm}
          categoriesDict={dict.categories}
          locale={locale as Locale}
        />

        <HowItWorks dict={howItWorksDict} />
        <Categories dict={dict.categories} />
        <WhyUs dict={whyUsDict} />

        <Footer dict={footerDict} locale={locale as Locale} />
      </HomeFlowProvider>
    </main>
  )
}
