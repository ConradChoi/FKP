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

export interface RequestFormPayload extends RequestFormData {
  locale: Locale
  honeypot: string // always empty string
}

// 작성 중에는 select 필드가 빈 값일 수 있으므로 모든 필드를 string으로 다루고,
// Step3 검증 통과 후 RequestFormPayload로 캐스팅한다.
export type RequestFormState = {
  [K in keyof RequestFormData]: string
} & { honeypot: string }

export type SubmitState = 'idle' | 'loading' | 'success' | 'error'
