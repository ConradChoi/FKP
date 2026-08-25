// Design Ref: §8.5 Seed Data Requirements — L2/L3 공용 테스트 헬퍼 및 샘플 페이로드.
// Phase 2: Step1 now lives in two different presentations — Hero (Home, button labeled
// dict.hero.ctaText) and the flat panel form (/request, button labeled
// dict.requestForm.buttons.next) — see fkp-v0.2-phase2-request-flow.spec.md §2/§3. v1.2 (§13):
// on Home, Step3's "Submit" button opens a confirm modal instead of submitting directly —
// fillStep3's `submit` option only clicks that button; use confirmSubmitModal() to actually
// confirm (Home only, /request has no modal).
import { expect, type Page } from '@playwright/test'
import type { Dictionary } from '../../lib/i18n/types'

// Phase 1 (Supabase migration): submission now goes through our own Next.js route
// handler (app/api/requests/route.ts) instead of the external Apps Script Web App.
const FORM_ENDPOINT_PATTERN = '**/api/requests'

export interface RequestFormValues {
  whatLookingFor: string
  category: string
  partnerType: string
  purpose: string
  description: string
  budget: string
  timeline: string
  englishSpeaking: string
  companyNameWebsite: string
  contact: string
}

export const sampleEn: RequestFormValues = {
  whatLookingFor: 'A Korean EdTech company for AI curriculum licensing',
  category: 'education',
  partnerType: 'license',
  purpose: 'Licensing curriculum for our online platform',
  description: 'We are looking for a Korean EdTech partner to license AI-based curriculum content.',
  budget: '1500-3000',
  timeline: 'within-1-month',
  englishSpeaking: 'preferred',
  companyNameWebsite: 'Acme Inc. / https://acme.example.com',
  contact: 'test@example.com',
}

export const sampleJa: RequestFormValues = {
  whatLookingFor: 'AIカリキュラムのライセンス供与が可能な韓国のEdTech企業',
  category: 'education',
  partnerType: 'license',
  purpose: 'オンラインプラットフォーム向けカリキュラムのライセンス供与',
  description: '韓国のEdTechパートナーを探しています。AIベースのカリキュラムコンテンツのライセンスを希望します。',
  budget: '1500-3000',
  timeline: 'within-1-month',
  englishSpeaking: 'preferred',
  companyNameWebsite: '株式会社サンプル / https://example.co.jp',
  contact: 'test@example.com',
}

// 실제 /api/requests(Supabase RPC 경유)로의 요청을 가로채어, 실제 DB 부수효과 없이
// success/error 분기를 테스트한다.
export async function mockFormEndpoint(page: Page, outcome: 'success' | 'error') {
  await page.route(FORM_ENDPOINT_PATTERN, async (route) => {
    if (outcome === 'error') {
      await route.abort()
    } else {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, id: '00000000-0000-0000-0000-000000000000' }),
      })
    }
  })
}

export async function injectGtagSpy(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __gtagCalls: unknown[][]; gtag: (...args: unknown[]) => void }
    w.__gtagCalls = []
    w.gtag = (...args: unknown[]) => {
      w.__gtagCalls.push(args)
    }
  })
}

export async function getGtagCalls(page: Page): Promise<unknown[][]> {
  return page.evaluate(() => (window as unknown as { __gtagCalls?: unknown[][] }).__gtagCalls ?? [])
}

/** Home page: Step1 lives inside the Hero, submitted via the "Start My Request" CTA. */
export async function fillHeroStep1(page: Page, dict: Dictionary, values: RequestFormValues) {
  await page.getByLabel(dict.requestForm.step1.whatLookingFor.label).fill(values.whatLookingFor)
  await page.getByLabel(dict.requestForm.step1.category.label).selectOption(values.category)
  await page.getByRole('button', { name: dict.hero.ctaText, exact: true }).click()
}

/** /request page: Step1 is the flat panel form, submitted via the generic "Next" button. */
export async function fillStep1(page: Page, dict: Dictionary['requestForm'], values: RequestFormValues) {
  await page.getByLabel(dict.step1.whatLookingFor.label).fill(values.whatLookingFor)
  await page.getByLabel(dict.step1.category.label).selectOption(values.category)
  await page.getByRole('button', { name: dict.buttons.next, exact: true }).click()
}

export async function fillStep2(page: Page, dict: Dictionary['requestForm'], values: RequestFormValues) {
  await page.getByLabel(dict.step2.partnerType.label).selectOption(values.partnerType)
  await page.getByLabel(dict.step2.purpose.label).fill(values.purpose)
  await page.getByLabel(dict.step2.description.label).fill(values.description)
  await page.getByLabel(dict.step2.budget.label).selectOption(values.budget)
  await page.getByLabel(dict.step2.timeline.label).selectOption(values.timeline)
  await page.getByLabel(dict.step2.englishSpeaking.label).selectOption(values.englishSpeaking)
  await page.getByRole('button', { name: dict.buttons.next, exact: true }).click()
}

export async function fillStep3(
  page: Page,
  dict: Dictionary['requestForm'],
  values: RequestFormValues,
  { submit = true }: { submit?: boolean } = {},
) {
  await page.getByLabel(dict.step3.companyNameWebsite.label).fill(values.companyNameWebsite)
  await page.getByLabel(dict.step3.contact.label).fill(values.contact)
  // Privacy/terms consent checkboxes are required to submit (privacy review §4.2).
  // Marketing consent stays unchecked (optional). Label text is split into
  // before/linkText/after (see Step3.tsx) so the accessible name is their
  // concatenation.
  const { privacy, terms } = dict.step3.consent
  await page.getByLabel(`${privacy.before}${privacy.linkText}${privacy.after}`).check()
  await page.getByLabel(`${terms.before}${terms.linkText}${terms.after}`).check()
  if (submit) {
    await page.getByRole('button', { name: dict.buttons.submit, exact: true }).click()
  }
}

/** Home only (flow spec §13.3): Step3's "Submit" button opens a confirm modal instead of
 * submitting directly. Call this after fillStep3() on Home to actually trigger
 * POST /api/requests. The /request page has no modal — fillStep3()'s submit click there goes
 * straight through, so this helper must not be called for that page. */
export async function confirmSubmitModal(page: Page, dict: Dictionary['requestForm']) {
  await page
    .getByRole('dialog')
    .getByRole('button', { name: dict.confirmModal.confirmButton, exact: true })
    .click()
}

/** Asserts a Hero carousel panel (#hero-mini-form / #hero-panel-2 / #hero-panel-3) is hidden
 * from assistive tech and non-interactive (flow spec §13.2). Checking the `inert` DOM property
 * directly is the reliable signal here — CSS bounding-box visibility isn't, since a panel
 * slid out of view by translateX can still overlap the browser's physical viewport depending
 * on layout, even though it's clipped by the carousel's `overflow-hidden` ancestor. */
export async function expectPanelHidden(page: Page, panelId: string) {
  await expect(page.locator(`#${panelId}`)).toHaveAttribute('aria-hidden', 'true')
  await expect.poll(() => page.locator(`#${panelId}`).evaluate((el) => (el as HTMLElement).inert)).toBe(true)
}
