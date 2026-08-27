// Design Ref: §8.3 L2: UI Action Test Scenarios. Phase 2
// (fkp-v0.2-phase2-request-flow.spec.md §13, v1.2) moved the whole 3-step flow into a
// horizontally-sliding carousel inside the Hero card (Panel1=Step1/Panel2=Step2/Panel3=Step3,
// no more scroll-to-panel), and Step3's submit now opens a confirm modal instead of submitting
// directly (§13.3). Tests updated to match, preserving the original intent of each scenario
// (inline validation blocks progress; success replaces the form; invalid email blocks
// submission; E2-R4's "exactly one active editable form/submit button") rather than loosening
// assertions.
import { test, expect } from '@playwright/test'
import { en } from '../../lib/i18n/en'
import { ja } from '../../lib/i18n/ja'
import {
  mockFormEndpoint,
  fillHeroStep1,
  fillStep2,
  fillStep3,
  confirmSubmitModal,
  expectPanelHidden,
  sampleEn,
} from './utils'

test('1. /en 페이지 로드 — 모든 섹션이 en 사전 값으로 노출된다', async ({ page }) => {
  await page.goto('/en')

  await expect(page.locator('header').getByText(en.header.logo, { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: en.hero.headline })).toBeVisible()
  await expect(page.getByRole('heading', { name: en.howItWorks.title })).toBeVisible()
  await expect(page.getByRole('heading', { name: en.categories.title })).toBeVisible()
  await expect(page.getByRole('heading', { name: en.whyUs.title })).toBeVisible()
  await expect(page.getByLabel(en.requestForm.step1.whatLookingFor.label)).toBeVisible()
  await expect(page.getByText(en.footer.intro)).toBeVisible()
})

test('2. /ja 페이지 로드 — 모든 섹션이 ja 사전 값으로 노출된다', async ({ page }) => {
  await page.goto('/ja')

  await expect(page.locator('header').getByText(ja.header.logo, { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: ja.hero.headline })).toBeVisible()
  await expect(page.getByRole('heading', { name: ja.howItWorks.title })).toBeVisible()
  await expect(page.getByRole('heading', { name: ja.categories.title })).toBeVisible()
  await expect(page.getByRole('heading', { name: ja.whyUs.title })).toBeVisible()
  await expect(page.getByLabel(ja.requestForm.step1.whatLookingFor.label)).toBeVisible()
  await expect(page.getByText(ja.footer.intro)).toBeVisible()
})

test('3. /en 헤더 [JA] 클릭 — /ja로 이동한다', async ({ page }) => {
  await page.goto('/en')

  await page.getByRole('link', { name: en.header.languageSwitcher.ja, exact: true }).click()
  await expect(page).toHaveURL(/\/ja$/)
})

test('4. /en Hero에서 Step1 제출 — Panel2(Step2)로 슬라이드 전환되고 Panel1은 접근 불가 처리된다', async ({ page }) => {
  await page.goto('/en')

  await fillHeroStep1(page, en, sampleEn)

  await expect(page.getByText(en.requestForm.step2.label)).toBeInViewport()
  // Design Ref: flow spec §13.2 — Panel1 becomes aria-hidden/inert once Panel2 is active, so
  // its CTA is no longer reachable via the accessibility tree at all (not just visually
  // off-screen). Headline/subheadline never move (§7 principle 1).
  await expectPanelHidden(page, 'hero-mini-form')
  await expect(page.getByRole('heading', { name: en.hero.headline })).toBeVisible()
})

test('5. Hero를 비운 채 Start My Request 클릭 — 인라인 검증 에러가 표시되고 Panel2로 전환되지 않는다', async ({
  page,
}) => {
  await page.goto('/en')

  await page.getByRole('button', { name: en.hero.ctaText, exact: true }).click()

  await expect(page.getByText(en.requestForm.validation.required).first()).toBeVisible()
  // Design Ref: flow spec §9/§13.2 — the carousel never advances past a failed step; Panel2's
  // fields stay unreachable (aria-hidden/inert), so there is still only one editable form.
  await expectPanelHidden(page, 'hero-panel-2')
})

test('6. Home에서 Step1~3 모두 채우고 컨펌 모달에서 확인 — success 화면과 "새 요청 시작" 버튼이 노출된다', async ({
  page,
}) => {
  await mockFormEndpoint(page, 'success')
  await page.goto('/en')

  await fillHeroStep1(page, en, sampleEn)
  await fillStep2(page, en.requestForm, sampleEn)
  await fillStep3(page, en.requestForm, sampleEn)

  // Design Ref: flow spec §13.3 — Submit doesn't fire immediately; the confirm modal opens
  // first and nothing is sent until "Confirm & Submit" is clicked.
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(en.requestForm.confirmModal.title)).toBeVisible()
  await confirmSubmitModal(page, en.requestForm)

  await expect(page.getByText(en.requestForm.status.success)).toBeVisible()
  await expect(page.getByRole('button', { name: en.requestForm.buttons.submit, exact: true })).not.toBeVisible()
  await expect(page.getByRole('button', { name: en.requestForm.buttons.startNew, exact: true })).toBeVisible()
})

test('7. Step3 잘못된 이메일 입력 후 Submit — 컨펌 모달이 열리지 않고 검증 에러가 표시된다', async ({ page }) => {
  await page.goto('/en')

  await fillHeroStep1(page, en, sampleEn)
  await fillStep2(page, en.requestForm, sampleEn)
  await page.getByLabel(en.requestForm.step3.companyNameWebsite.label).fill(sampleEn.companyNameWebsite)
  await page.getByLabel(en.requestForm.step3.contact.label).fill('not-an-email')
  await page.getByRole('button', { name: en.requestForm.buttons.submit, exact: true }).click()

  await expect(page.getByText(en.requestForm.validation.invalidEmail)).toBeVisible()
  await expect(page.getByText(en.requestForm.step3.label)).toBeVisible()
  await expect(page.getByRole('dialog')).not.toBeVisible()
})

test('8. 헤더 Request 진입점 클릭(idle) — Hero 미니입력으로 스크롤된다', async ({ page }) => {
  await page.goto('/en')

  await page.getByRole('button', { name: en.header.requestNav, exact: true }).click()

  await expect(page.getByLabel(en.requestForm.step1.whatLookingFor.label)).toBeInViewport()
})

test('9. 헤더 Request 진입점 클릭(step2 진행 중) — 페이지 이동 없이 Hero로 스크롤되고, Back으로 돌아가면 입력값이 보존되어 있다', async ({
  page,
}) => {
  await page.goto('/en')
  await fillHeroStep1(page, en, sampleEn)

  await page.getByRole('button', { name: en.header.requestNav, exact: true }).click()

  // Design Ref: flow spec §13.2 — Home no longer branches between two scroll targets; every
  // click just scrolls to Hero regardless of which panel is active.
  await expect(page).toHaveURL(/\/en$/)
  await expect(page.getByText(en.requestForm.step2.label)).toBeInViewport()

  // 입력값이 손실 없이 이어지는지 확인 (E2-R3) — Panel2에서 Back으로 Panel1로 슬라이드해도
  // 방금 입력한 값이 그대로 남아 있어야 한다(하나의 상태를 공유하는 카루셀일 뿐, 별도 폼이
  // 아니라는 것도 함께 확인한다 — flow spec §9).
  await page.getByRole('button', { name: en.requestForm.buttons.back, exact: true }).click()
  await expect(page.getByLabel(en.requestForm.step1.whatLookingFor.label)).toHaveValue(sampleEn.whatLookingFor)
})

test('10. Categories 카드 클릭(idle) — Hero에 category가 프리필된다', async ({ page }) => {
  await page.goto('/en')

  const firstCard = page.getByRole('button', { name: new RegExp(`^${en.categories.items.education.name}`) })
  await firstCard.click()

  await expect(page.getByLabel(en.requestForm.step1.category.label)).toHaveText(en.categories.items.education.name)
  await expect(page.getByLabel(en.requestForm.step1.whatLookingFor.label)).toBeInViewport()
})

test('11. 진행 중 언어 전환 — confirm 다이얼로그가 노출되고 취소 시 페이지에 남는다', async ({ page }) => {
  await page.goto('/en')
  await page.getByLabel(en.requestForm.step1.whatLookingFor.label).fill(sampleEn.whatLookingFor)

  let dialogMessage = ''
  page.once('dialog', async (dialog) => {
    dialogMessage = dialog.message()
    await dialog.dismiss()
  })
  await page.getByRole('link', { name: en.header.languageSwitcher.ja, exact: true }).click()

  expect(dialogMessage).toBe(en.header.languageSwitcher.switchWarning)
  await expect(page).toHaveURL(/\/en$/)
})

test('12. idle 상태에서 언어 전환 — confirm 없이 즉시 전환된다', async ({ page }) => {
  await page.goto('/en')

  await page.getByRole('link', { name: en.header.languageSwitcher.ja, exact: true }).click()

  await expect(page).toHaveURL(/\/ja$/)
})

test('13. Step3까지 진행 — 제출 버튼은 정확히 1개만 존재한다 (E2-R4)', async ({ page }) => {
  await page.goto('/en')
  await fillHeroStep1(page, en, sampleEn)
  await fillStep2(page, en.requestForm, sampleEn)

  await expect(page.getByRole('button', { name: en.requestForm.buttons.submit, exact: true })).toHaveCount(1)
  // Design Ref: flow spec §13.2 — Panel1/Panel2 are aria-hidden once Panel3 is active, so
  // there is exactly one reachable, editable panel at any time (E2-R4) even though the
  // carousel keeps all three panels mounted in the DOM underneath.
  await expectPanelHidden(page, 'hero-mini-form')
  await expectPanelHidden(page, 'hero-panel-2')
})

test('14. Categories 카드 클릭(step2 진행 중) — Panel1로 슬라이드되고 category가 갱신되며, 다시 Next를 누르면 Step2 값이 보존되어 있다', async ({
  page,
}) => {
  await page.goto('/en')
  await fillHeroStep1(page, en, sampleEn)
  await expect(page.getByText(en.requestForm.step2.label)).toBeInViewport()
  await page.getByLabel(en.requestForm.step2.purpose.label).fill(sampleEn.purpose)

  const itCard = page.getByRole('button', { name: new RegExp(`^${en.categories.items['it-ai'].name}`) })
  await itCard.click()

  // Design Ref: flow spec §13.4 — same mechanism as Back: slides to Panel1 and prefills
  // category, Panel2's half-filled value is preserved underneath (not cleared).
  await expect(page.getByLabel(en.requestForm.step1.category.label)).toHaveText(en.categories.items['it-ai'].name)
  await expect(page.getByLabel(en.requestForm.step1.whatLookingFor.label)).toBeInViewport()

  await page.getByRole('button', { name: en.hero.ctaText, exact: true }).click()
  await expect(page.getByLabel(en.requestForm.step2.purpose.label)).toHaveValue(sampleEn.purpose)
})

test('15. Step3 제출 → 컨펌 모달에서 취소 — 모달만 닫히고 입력값은 보존되며 아무 것도 전송되지 않는다', async ({
  page,
}) => {
  let requestCount = 0
  await page.route('**/api/requests', async (route) => {
    requestCount += 1
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, id: '00000000-0000-0000-0000-000000000000' }),
    })
  })
  await page.goto('/en')
  await fillHeroStep1(page, en, sampleEn)
  await fillStep2(page, en.requestForm, sampleEn)
  await fillStep3(page, en.requestForm, sampleEn)

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: en.requestForm.confirmModal.cancelButton, exact: true }).click()

  // Design Ref: flow spec §13.3 — Cancel only closes the modal, Step3's own input (and the
  // rest of the carousel) is left exactly as it was, and no request was ever sent.
  await expect(dialog).not.toBeVisible()
  await expect(page.getByText(en.requestForm.step3.label)).toBeVisible()
  await expect(page.getByLabel(en.requestForm.step3.companyNameWebsite.label)).toHaveValue(
    sampleEn.companyNameWebsite,
  )
  await expect(page.getByLabel(en.requestForm.step3.contact.label)).toHaveValue(sampleEn.contact)
  expect(requestCount).toBe(0)

  // Resubmitting after cancel still works end-to-end (modal isn't left in a stuck state).
  await page.getByRole('button', { name: en.requestForm.buttons.submit, exact: true }).click()
  await confirmSubmitModal(page, en.requestForm)
  await expect(page.getByText(en.requestForm.status.success)).toBeVisible()
  expect(requestCount).toBe(1)
})
