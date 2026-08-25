// Design Ref: extracted from the original RequestForm.tsx client-side validation so the
// Home page's Hero+panel flow (components/RequestFlow/useHomeFlowEngine.ts) and the
// /request page's flat RequestForm.tsx can both reuse identical validation logic without
// duplicating it (fkp-v0.2-phase2-request-flow.spec.md §11 "동일한 검증 로직 재사용").
import type { Dictionary } from '@/lib/i18n/types'
import type { ConsentState, RequestFormState } from '@/types/request-form'
import { EMAIL_REGEX } from './emailRegex'

export function validateStep1(
  formData: RequestFormState,
  dict: Dictionary['requestForm'],
): Record<string, string> {
  const next: Record<string, string> = {}
  if (!formData.whatLookingFor.trim()) next.whatLookingFor = dict.validation.required
  if (!formData.category) next.category = dict.validation.required
  return next
}

export function validateStep2(
  formData: RequestFormState,
  dict: Dictionary['requestForm'],
): Record<string, string> {
  const next: Record<string, string> = {}
  if (!formData.partnerType) next.partnerType = dict.validation.required
  if (!formData.purpose.trim()) next.purpose = dict.validation.required
  if (!formData.description.trim()) next.description = dict.validation.required
  if (!formData.budget) next.budget = dict.validation.required
  if (!formData.timeline) next.timeline = dict.validation.required
  if (!formData.englishSpeaking) next.englishSpeaking = dict.validation.required
  return next
}

export function validateStep3(
  formData: RequestFormState,
  consent: ConsentState,
  dict: Dictionary['requestForm'],
): Record<string, string> {
  const next: Record<string, string> = {}
  if (!formData.companyNameWebsite.trim()) next.companyNameWebsite = dict.validation.required
  if (!formData.contact.trim()) {
    next.contact = dict.validation.required
  } else if (!EMAIL_REGEX.test(formData.contact.trim())) {
    next.contact = dict.validation.invalidEmail
  }
  // Design Ref: privacy review §4.2 — 동의 없이는 제출 불가(다크패턴 금지: 기본 미체크,
  // 미체크 시 명시적 에러). 서버(app/api/requests/route.ts)도 동일 조건을 재검증한다.
  if (!consent.privacy || !consent.terms) next.consent = dict.validation.consentRequired
  return next
}
