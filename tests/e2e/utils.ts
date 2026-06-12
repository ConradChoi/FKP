// Design Ref: §8.5 Seed Data Requirements — L2/L3 공용 테스트 헬퍼 및 샘플 페이로드
import type { Page } from '@playwright/test'
import type { Dictionary } from '../../lib/i18n/types'

const FORM_ENDPOINT_PATTERN = '**/macros/s/**'

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

// 실제 Apps Script Web App(NEXT_PUBLIC_FORM_ENDPOINT)으로의 요청을 가로채어
// Sheets 기록/이메일 발송 등 실제 부수효과 없이 success/error 분기를 테스트한다.
export async function mockFormEndpoint(page: Page, outcome: 'success' | 'error') {
  await page.route(FORM_ENDPOINT_PATTERN, async (route) => {
    if (outcome === 'error') {
      await route.abort()
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' })
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
  if (submit) {
    await page.getByRole('button', { name: dict.buttons.submit, exact: true }).click()
  }
}
