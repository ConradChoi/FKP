// Design Ref: §3.1 Entity Definition, §10.1 Naming Conventions (dictionary key = camelCase, section prefix)
export type Locale = 'en' | 'ja'

export type Category = 'education' | 'it-ai' | 'content-media' | 'beauty-lifestyle' | 'business-services'

export type PartnerType = 'purchase' | 'partnership' | 'license' | 'other'

export type Budget = 'under-500' | '500-1500' | '1500-3000' | 'over-3000' | 'not-sure'

export type Timeline = 'asap' | 'within-1-month' | '1-3-months' | '3-6-months' | 'flexible'

export type EnglishSpeaking = 'required' | 'preferred' | 'not-needed'

export interface CategoryInfo {
  name: string
  keywords: string[]
}

export interface SelectOption<T extends string> {
  options: Record<T, string>
}

// Design Ref: §1.2 "단일 진실 공급원" — select 옵션은 dictionary에서만 정의
export interface Dictionary {
  meta: {
    title: string
    description: string
  }
  header: {
    logo: string
    languageSwitcher: {
      en: string
      ja: string
    }
  }
  hero: {
    headline: string
    subheadline: string
    ctaText: string
  }
  howItWorks: {
    title: string
    steps: { title: string; description: string }[]
  }
  categories: {
    title: string
    items: Record<Category, CategoryInfo>
  }
  whyUs: {
    title: string
    points: { title: string; description: string }[]
  }
  requestForm: {
    selectPlaceholder: string
    step1: {
      label: string
      whatLookingFor: { label: string; placeholder: string }
      category: { label: string }
    }
    step2: {
      label: string
      partnerType: { label: string } & SelectOption<PartnerType>
      purpose: { label: string; placeholder: string }
      description: { label: string; placeholder: string }
      budget: { label: string } & SelectOption<Budget>
      timeline: { label: string } & SelectOption<Timeline>
      englishSpeaking: { label: string } & SelectOption<EnglishSpeaking>
    }
    step3: {
      label: string
      companyNameWebsite: { label: string; placeholder: string }
      contact: { label: string; placeholder: string }
    }
    buttons: {
      next: string
      back: string
      submit: string
      submitting: string
      retry: string
    }
    validation: {
      required: string
      invalidEmail: string
    }
    status: {
      success: string
      error: string
    }
  }
  footer: {
    intro: string
    contactEmail: string
  }
}
