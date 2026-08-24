// Design Ref: §8.4 L3: E2E Scenario Test Scenarios
import { test, expect } from '@playwright/test'
import { en } from '../../lib/i18n/en'
import { ja } from '../../lib/i18n/ja'
import {
  mockFormEndpoint,
  injectGtagSpy,
  getGtagCalls,
  fillStep1,
  fillStep2,
  fillStep3,
  sampleEn,
  sampleJa,
} from './utils'

test('1. Guest 전체 플로우 (en) — 제출 성공 시 success 화면과 GA4 form_submit 이벤트가 발생한다', async ({ page }) => {
  await injectGtagSpy(page)
  await mockFormEndpoint(page, 'success')
  await page.goto('/en')

  await expect(page.getByRole('heading', { name: en.hero.headline })).toBeVisible()
  await expect(page.getByRole('heading', { name: en.howItWorks.title })).toBeVisible()
  await expect(page.getByRole('heading', { name: en.categories.title })).toBeVisible()
  await expect(page.getByRole('heading', { name: en.whyUs.title })).toBeVisible()

  await page.getByRole('link', { name: en.hero.ctaText, exact: true }).click()
  await fillStep1(page, en.requestForm, sampleEn)
  await fillStep2(page, en.requestForm, sampleEn)
  await fillStep3(page, en.requestForm, sampleEn)

  await expect(page.getByText(en.requestForm.status.success)).toBeVisible()

  const gtagCalls = await getGtagCalls(page)
  const formSubmitCall = gtagCalls.find((args) => args[0] === 'event' && args[1] === 'form_submit')
  expect(formSubmitCall).toBeTruthy()
})

test('2. i18n 전환 — /en에서 /ja로 이동 후 동일 플로우가 일본어로 정상 동작한다', async ({ page }) => {
  await mockFormEndpoint(page, 'success')
  await page.goto('/en')

  await page.getByRole('link', { name: en.header.languageSwitcher.ja, exact: true }).click()
  await expect(page).toHaveURL(/\/ja$/)
  await expect(page.getByRole('heading', { name: ja.hero.headline })).toBeVisible()

  await page.getByRole('link', { name: ja.hero.ctaText, exact: true }).click()
  await fillStep1(page, ja.requestForm, sampleJa)
  await fillStep2(page, ja.requestForm, sampleJa)
  await fillStep3(page, ja.requestForm, sampleJa)

  await expect(page.getByText(ja.requestForm.status.success)).toBeVisible()
})

test('3. 검증/에러 처리 — 각 단계에서 인라인 에러가 노출되고 최종 제출 전까지 진행이 차단된다', async ({ page }) => {
  await page.goto('/en#request-form')

  // Step1: 비워두고 Next
  await page.getByRole('button', { name: en.requestForm.buttons.next, exact: true }).click()
  await expect(page.getByText(en.requestForm.validation.required).first()).toBeVisible()
  await expect(page.getByText(en.requestForm.step1.label)).toBeVisible()

  // Step1 입력 후 Step2 진입, 필수값(budget) 비워두고 Next
  await fillStep1(page, en.requestForm, sampleEn)
  await page.getByLabel(en.requestForm.step2.partnerType.label).selectOption(sampleEn.partnerType)
  await page.getByLabel(en.requestForm.step2.purpose.label).fill(sampleEn.purpose)
  await page.getByLabel(en.requestForm.step2.description.label).fill(sampleEn.description)
  await page.getByLabel(en.requestForm.step2.timeline.label).selectOption(sampleEn.timeline)
  await page.getByLabel(en.requestForm.step2.englishSpeaking.label).selectOption(sampleEn.englishSpeaking)
  await page.getByRole('button', { name: en.requestForm.buttons.next, exact: true }).click()
  await expect(page.getByText(en.requestForm.validation.required).first()).toBeVisible()
  await expect(page.getByText(en.requestForm.step2.label)).toBeVisible()

  // budget 채우고 Step3 진입, 잘못된 이메일 입력
  await page.getByLabel(en.requestForm.step2.budget.label).selectOption(sampleEn.budget)
  await page.getByRole('button', { name: en.requestForm.buttons.next, exact: true }).click()
  await page.getByLabel(en.requestForm.step3.companyNameWebsite.label).fill(sampleEn.companyNameWebsite)
  await page.getByLabel(en.requestForm.step3.contact.label).fill('not-an-email')
  await page.getByRole('button', { name: en.requestForm.buttons.submit, exact: true }).click()
  await expect(page.getByText(en.requestForm.validation.invalidEmail)).toBeVisible()
})

for (const { name, width, height } of [
  { name: '375px (mobile)', width: 375, height: 812 },
  { name: '768px (tablet)', width: 768, height: 1024 },
  { name: '1440px (desktop)', width: 1440, height: 900 },
]) {
  test(`4. 반응형 — ${name} 뷰포트에서 /en, /ja가 가로 스크롤 없이 렌더링된다`, async ({ page }) => {
    await page.setViewportSize({ width, height })

    for (const locale of ['/en', '/ja'] as const) {
      await page.goto(locale)
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollWidth).toBeLessThanOrEqual(width + 1)
    }
  })
}

test('5. 네트워크 오류 처리 — SubmitStatus=error + Retry 노출, Retry 시 재제출이 성공한다', async ({ page }) => {
  await mockFormEndpoint(page, 'error')
  await page.goto('/en#request-form')

  await fillStep1(page, en.requestForm, sampleEn)
  await fillStep2(page, en.requestForm, sampleEn)
  await fillStep3(page, en.requestForm, sampleEn)

  await expect(page.getByText(en.requestForm.status.error)).toBeVisible()
  const retryButton = page.getByRole('button', { name: en.requestForm.buttons.retry, exact: true })
  await expect(retryButton).toBeVisible()

  await page.unroute('**/api/requests')
  await mockFormEndpoint(page, 'success')
  await retryButton.click()

  await expect(page.getByText(en.requestForm.status.success)).toBeVisible()
})
