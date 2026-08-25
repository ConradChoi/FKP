// Design Ref: §8.4 L3: E2E Scenario Test Scenarios. Phase 2 (fkp-v0.2-phase2-request-flow.spec.md
// §13, v1.2) — Home hosts the full Step1-3 carousel inside the Hero card (no separate
// continuation panel/scroll), Step3's submit opens a confirm modal before actually calling
// POST /api/requests, and /[locale]/request still offers the same engine as a single flat form
// with no modal (E2-R7). Scenarios updated to match while preserving original intent.
import { test, expect } from '@playwright/test'
import { en } from '../../lib/i18n/en'
import { ja } from '../../lib/i18n/ja'
import {
  mockFormEndpoint,
  injectGtagSpy,
  getGtagCalls,
  fillHeroStep1,
  fillStep1,
  fillStep2,
  fillStep3,
  confirmSubmitModal,
  sampleEn,
  sampleJa,
} from './utils'

test('1. Guest 전체 플로우 (en, Home) — 제출 성공 시 success 화면과 GA4 form_submit 이벤트가 발생한다', async ({
  page,
}) => {
  await injectGtagSpy(page)
  await mockFormEndpoint(page, 'success')
  await page.goto('/en')

  await expect(page.getByRole('heading', { name: en.hero.headline })).toBeVisible()
  await expect(page.getByRole('heading', { name: en.howItWorks.title })).toBeVisible()
  await expect(page.getByRole('heading', { name: en.categories.title })).toBeVisible()
  await expect(page.getByRole('heading', { name: en.whyUs.title })).toBeVisible()

  await fillHeroStep1(page, en, sampleEn)
  await fillStep2(page, en.requestForm, sampleEn)
  await fillStep3(page, en.requestForm, sampleEn)
  // Design Ref: flow spec §13.3 — Step3's Submit button opens a confirm modal; it doesn't
  // hit the network until this is clicked.
  await confirmSubmitModal(page, en.requestForm)

  await expect(page.getByText(en.requestForm.status.success)).toBeVisible()

  const gtagCalls = await getGtagCalls(page)
  const formSubmitCall = gtagCalls.find((args) => args[0] === 'event' && args[1] === 'form_submit')
  expect(formSubmitCall).toBeTruthy()
  expect(formSubmitCall?.[2]).toMatchObject({ source: 'home_hero', category: 'education' })

  const formStartCall = gtagCalls.find((args) => args[0] === 'event' && args[1] === 'form_start')
  expect(formStartCall?.[2]).toMatchObject({ source: 'home_hero' })

  const stepCompleteCalls = gtagCalls.filter((args) => args[0] === 'event' && args[1] === 'step_complete')
  expect(stepCompleteCalls.map((args) => (args[2] as { step_no: number }).step_no)).toEqual([1, 2])
})

test('2. i18n 전환 — /en에서 /ja로 이동 후 동일 플로우가 일본어로 정상 동작한다', async ({ page }) => {
  await mockFormEndpoint(page, 'success')
  await page.goto('/en')

  await page.getByRole('link', { name: en.header.languageSwitcher.ja, exact: true }).click()
  await expect(page).toHaveURL(/\/ja$/)
  await expect(page.getByRole('heading', { name: ja.hero.headline })).toBeVisible()

  await fillHeroStep1(page, ja, sampleJa)
  await fillStep2(page, ja.requestForm, sampleJa)
  await fillStep3(page, ja.requestForm, sampleJa)
  await confirmSubmitModal(page, ja.requestForm)

  await expect(page.getByText(ja.requestForm.status.success)).toBeVisible()
})

test('3. 검증/에러 처리 — 각 단계에서 인라인 에러가 노출되고 최종 제출 전까지 진행이 차단된다', async ({ page }) => {
  await page.goto('/en')

  // Step1 (Hero Panel 1): 비워두고 Start My Request
  await page.getByRole('button', { name: en.hero.ctaText, exact: true }).click()
  await expect(page.getByText(en.requestForm.validation.required).first()).toBeVisible()
  // Design Ref: flow spec §9/§13.2 — there is no separate continuation panel/form instance
  // anywhere on Home; the carousel is the only form.
  await expect(page.locator('#request-form')).toHaveCount(0)

  // Step1 입력 후 Panel 2로 슬라이드, Step2 필수값(budget) 비워두고 Next
  await fillHeroStep1(page, en, sampleEn)
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
  test(`4. 반응형 — ${name} 뷰포트에서 /en, /ja, /en/request가 가로 스크롤 없이 렌더링된다`, async ({ page }) => {
    await page.setViewportSize({ width, height })

    for (const path of ['/en', '/ja', '/en/request'] as const) {
      await page.goto(path)
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollWidth).toBeLessThanOrEqual(width + 1)
    }
  })
}

test('5. 네트워크 오류 처리 — 컨펌 모달에 에러+재시도가 노출되고(모달 유지), 재시도 시 재제출이 성공한다', async ({
  page,
}) => {
  await mockFormEndpoint(page, 'error')
  await page.goto('/en')

  await fillHeroStep1(page, en, sampleEn)
  await fillStep2(page, en.requestForm, sampleEn)
  await fillStep3(page, en.requestForm, sampleEn)
  await confirmSubmitModal(page, en.requestForm)

  // Design Ref: flow spec §13.3 — on failure the modal itself shows the error + a retry
  // button; it does not close, and Step3 behind it is untouched.
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(en.requestForm.status.error)).toBeVisible()
  const retryButton = dialog.getByRole('button', { name: en.requestForm.buttons.retry, exact: true })
  await expect(retryButton).toBeVisible()

  await page.unroute('**/api/requests')
  await mockFormEndpoint(page, 'success')
  await retryButton.click()

  await expect(page.getByText(en.requestForm.status.success)).toBeVisible()
  await expect(dialog).not.toBeVisible()
})

test('6. success 화면에서 "새 요청 시작" 클릭 — Hero가 idle로 리셋되어 새 요청을 처음부터 입력할 수 있다', async ({
  page,
}) => {
  await mockFormEndpoint(page, 'success')
  await page.goto('/en')

  await fillHeroStep1(page, en, sampleEn)
  await fillStep2(page, en.requestForm, sampleEn)
  await fillStep3(page, en.requestForm, sampleEn)
  await confirmSubmitModal(page, en.requestForm)
  await expect(page.getByText(en.requestForm.status.success)).toBeVisible()

  await page.getByRole('button', { name: en.requestForm.buttons.startNew, exact: true }).click()

  await expect(page.getByLabel(en.requestForm.step1.whatLookingFor.label)).toBeVisible()
  await expect(page.getByLabel(en.requestForm.step1.whatLookingFor.label)).toHaveValue('')
  await expect(page.locator('#request-form')).toHaveCount(0)
})

test('7. /request 전용 페이지 — Step1~3 연속 배치로 제출까지 완료된다 (E2-R7)', async ({ page }) => {
  await injectGtagSpy(page)
  await mockFormEndpoint(page, 'success')
  await page.goto('/en/request')

  await expect(page.getByText(en.requestPage.intro)).toBeVisible()
  await expect(page.getByText(en.requestForm.step1.label)).toBeVisible()

  await fillStep1(page, en.requestForm, sampleEn)
  await fillStep2(page, en.requestForm, sampleEn)
  await fillStep3(page, en.requestForm, sampleEn)

  await expect(page.getByText(en.requestForm.status.success)).toBeVisible()

  const gtagCalls = await getGtagCalls(page)
  const formSubmitCall = gtagCalls.find((args) => args[0] === 'event' && args[1] === 'form_submit')
  expect(formSubmitCall?.[2]).toMatchObject({ source: 'request_page' })
})
