// Design Ref: §8.3 L2: UI Action Test Scenarios
import { test, expect } from '@playwright/test'
import { en } from '../../lib/i18n/en'
import { ja } from '../../lib/i18n/ja'
import { mockFormEndpoint, fillStep1, fillStep2, fillStep3, sampleEn } from './utils'

test('1. /en 페이지 로드 — 모든 섹션이 en 사전 값으로 노출된다', async ({ page }) => {
  await page.goto('/en')

  await expect(page.locator('header').getByText(en.header.logo, { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: en.hero.headline })).toBeVisible()
  await expect(page.getByRole('heading', { name: en.howItWorks.title })).toBeVisible()
  await expect(page.getByRole('heading', { name: en.categories.title })).toBeVisible()
  await expect(page.getByRole('heading', { name: en.whyUs.title })).toBeVisible()
  await expect(page.getByText(en.requestForm.step1.label)).toBeVisible()
  await expect(page.getByText(en.footer.intro)).toBeVisible()
})

test('2. /ja 페이지 로드 — 모든 섹션이 ja 사전 값으로 노출된다', async ({ page }) => {
  await page.goto('/ja')

  await expect(page.locator('header').getByText(ja.header.logo, { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: ja.hero.headline })).toBeVisible()
  await expect(page.getByRole('heading', { name: ja.howItWorks.title })).toBeVisible()
  await expect(page.getByRole('heading', { name: ja.categories.title })).toBeVisible()
  await expect(page.getByRole('heading', { name: ja.whyUs.title })).toBeVisible()
  await expect(page.getByText(ja.requestForm.step1.label)).toBeVisible()
  await expect(page.getByText(ja.footer.intro)).toBeVisible()
})

test('3. /en 헤더 [JA] 클릭 — /ja로 이동한다', async ({ page }) => {
  await page.goto('/en')

  await page.getByRole('link', { name: en.header.languageSwitcher.ja, exact: true }).click()
  await expect(page).toHaveURL(/\/ja$/)
})

test('4. /en Hero CTA 클릭 — #request-form으로 스크롤된다', async ({ page }) => {
  await page.goto('/en')

  await page.getByRole('link', { name: en.hero.ctaText, exact: true }).click()
  await expect(page.getByText(en.requestForm.step1.label)).toBeInViewport()
})

test('5. Step1 비우고 Next 클릭 — 인라인 검증 에러가 표시되고 Step2로 이동하지 않는다', async ({ page }) => {
  await page.goto('/en#request-form')

  await page.getByRole('button', { name: en.requestForm.buttons.next, exact: true }).click()

  await expect(page.getByText(en.requestForm.validation.required).first()).toBeVisible()
  await expect(page.getByText(en.requestForm.step1.label)).toBeVisible()
  await expect(page.getByText(en.requestForm.step2.label)).not.toBeVisible()
})

test('6. Step1~3 모두 채우고 Submit — SubmitStatus가 loading에서 success로 전환된다', async ({ page }) => {
  await mockFormEndpoint(page, 'success')
  await page.goto('/en#request-form')

  await fillStep1(page, en.requestForm, sampleEn)
  await fillStep2(page, en.requestForm, sampleEn)
  await fillStep3(page, en.requestForm, sampleEn)

  await expect(page.getByText(en.requestForm.status.success)).toBeVisible()
  await expect(page.getByRole('button', { name: en.requestForm.buttons.submit, exact: true })).not.toBeVisible()
})

test('7. Step3 잘못된 이메일 입력 후 Submit — 검증 에러가 표시되고 제출이 차단된다', async ({ page }) => {
  await page.goto('/en#request-form')

  await fillStep1(page, en.requestForm, sampleEn)
  await fillStep2(page, en.requestForm, sampleEn)
  await page.getByLabel(en.requestForm.step3.companyNameWebsite.label).fill(sampleEn.companyNameWebsite)
  await page.getByLabel(en.requestForm.step3.contact.label).fill('not-an-email')
  await page.getByRole('button', { name: en.requestForm.buttons.submit, exact: true }).click()

  await expect(page.getByText(en.requestForm.validation.invalidEmail)).toBeVisible()
  await expect(page.getByText(en.requestForm.step3.label)).toBeVisible()
})
