// Design Ref: §3.1 Entity Definition
import type { Budget, Category, EnglishSpeaking, Locale, PartnerType, Timeline } from '@/lib/i18n/types'

export interface RequestFormData {
  whatLookingFor: string // Step1 - free text
  category: Category // Step1 - select
  partnerType: PartnerType // Step2 - select
  purpose: string // Step2 - free text
  description: string // Step2 - textarea
  budget: Budget // Step2 - select
  timeline: Timeline // Step2 - select
  englishSpeaking: EnglishSpeaking // Step2 - select
  companyNameWebsite: string // Step3 - free text
  contact: string // Step3 - email/contact
}

// Design Ref: privacy review §4.1/§4.3 — 개인정보 동의와 이용약관 동의는 별도 체크박스로
// 분리 수집한다(다크패턴 금지). version/locale은 "어느 문안에 동의했는지" 증빙용이며
// 클라이언트가 임의로 바꿀 수 없도록 서버(app/api/requests/route.ts)가 상수값으로 재검증한다.
export interface ConsentPayload {
  privacy: boolean
  terms: boolean
  marketing: boolean
  version: string // consent_version — privacy 문안 버전
  termsVersion: string // terms_version — 이용약관 문안 버전
  locale: string // consent_locale — 어느 언어 문안에 동의했는지
}

// Design Ref: fkp-v0.2-phase2-request-flow.spec.md §6 "payload source 필드 추가 권고" —
// which entry point the submission originated from. Stored as `requests.source` (Supabase
// column already accepts any text <=50 chars with default 'web', see
// supabase/migrations/20260824120000_phase1_requests_pipeline.sql §8 submit_request RPC).
export type RequestSource = 'home_hero' | 'request_page'

export interface RequestFormPayload extends RequestFormData {
  locale: Locale
  honeypot: string // always empty string
  source: RequestSource
  consent: ConsentPayload
}

// 작성 중에는 select 필드가 빈 값일 수 있으므로 모든 필드를 string으로 다루고,
// Step3 검증 통과 후 RequestFormPayload로 캐스팅한다.
export type RequestFormState = {
  [K in keyof RequestFormData]: string
} & { honeypot: string }

// 동의 체크박스는 boolean 상태이므로 RequestFormState(전부 string)와 분리해서 관리한다.
export type ConsentState = {
  privacy: boolean
  terms: boolean
  marketing: boolean
}

export type SubmitState = 'idle' | 'loading' | 'success' | 'error'
