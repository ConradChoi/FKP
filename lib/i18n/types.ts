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
    requestNav: string
    languageSwitcher: {
      en: string
      ja: string
      switchWarning: string
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
    selectHint: string
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
      // Bound to docs/legal/privacy-v1.0-{en,ja}.md / terms-v1.0-{en,ja}.md via
      // lib/legal/consentVersions.ts. before/linkText/after split so each
      // language can place the link naturally in its own sentence order.
      consent: {
        privacy: { before: string; linkText: string; after: string }
        terms: { before: string; linkText: string; after: string }
        marketingLabel: string
      }
    }
    buttons: {
      next: string
      back: string
      submit: string
      submitting: string
      retry: string
      startNew: string
    }
    validation: {
      required: string
      invalidEmail: string
      consentRequired: string
    }
    status: {
      success: string
      error: string
    }
    // Design Ref: fkp-v0.2-phase2-request-ui.spec.md §2.3/§3.2 — recap card copy shared by
    // Hero's Step1 recap and the continuation panel's Step1/Step2 recap.
    recap: {
      step1Label: string
      step2Label: string
      editLabel: string
    }
    // Design Ref: fkp-v0.2-phase2-request-flow.spec.md §13.3/§13.5 — copy for the confirm
    // modal that appears when Step3's submit button is clicked, before the actual
    // POST /api/requests call. Field/option labels reuse step1/step2/step3 above and
    // categoriesDict — only the modal chrome itself needs its own copy.
    confirmModal: {
      title: string
      description: string
      sections: {
        step1: string
        step2: string
        step3: string
      }
      confirmButton: string
      cancelButton: string
    }
  }
  requestPage: {
    intro: string
  }
  // Design Ref: fkp-v0.2-phase5d-blog-case-faq.spec.md §7 — blog/case_study 공용 카피
  // 구조(동일 템플릿이라 동일 키셋을 쓴다). ctaTitle/ctaButton은 상세 페이지 하단 CTA용.
  blog: {
    pageTitle: string
    emptyState: string
    backToList: string
    ctaTitle: string
    ctaButton: string
  }
  caseStudies: {
    pageTitle: string
    emptyState: string
    backToList: string
    ctaTitle: string
    ctaButton: string
  }
  faq: {
    pageTitle: string
    emptyState: string
  }
  footer: {
    intro: string
    contactEmail: string
    privacyLinkText: string
    termsLinkText: string
    blogLinkText: string
    caseStudiesLinkText: string
    faqLinkText: string
  }
  legal: {
    backToHome: string
  }
  cookieConsent: {
    before: string
    linkText: string
    after: string
    accept: string
    decline: string
  }
}
