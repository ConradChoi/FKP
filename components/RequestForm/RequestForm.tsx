// Design Ref: §5.3 RequestForm — 3단계 폼 상태(step/formData/status) 관리, client component
'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Dictionary, Locale } from '@/lib/i18n/types'
import type { ConsentState, RequestFormData, RequestFormPayload, RequestFormState, SubmitState } from '@/types/request-form'
import { submitRequest } from '@/lib/forms/submitRequest'
import { trackEvent } from '@/lib/analytics'
import { PRIVACY_CONSENT_VERSION, TERMS_CONSENT_VERSION } from '@/lib/legal/consentVersions'
import { EMAIL_REGEX } from '@/lib/forms/emailRegex'
import { Step1 } from './Step1'
import { Step2 } from './Step2'
import { Step3 } from './Step3'
import { SubmitStatus } from './SubmitStatus'

const initialFormData: RequestFormState = {
  whatLookingFor: '',
  category: '',
  partnerType: '',
  purpose: '',
  description: '',
  budget: '',
  timeline: '',
  englishSpeaking: '',
  companyNameWebsite: '',
  contact: '',
  honeypot: '',
}

const initialConsent: ConsentState = {
  privacy: false,
  terms: false,
  marketing: false,
}

interface RequestFormProps {
  dict: Dictionary['requestForm']
  categoriesDict: Dictionary['categories']
  locale: Locale
}

export function RequestForm({ dict, categoriesDict, locale }: RequestFormProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [formData, setFormData] = useState<RequestFormState>(initialFormData)
  const [consent, setConsent] = useState<ConsentState>(initialConsent)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<SubmitState>('idle')

  function handleChange(field: keyof RequestFormState, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      if (!(field in prev)) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function handleConsentChange(field: keyof ConsentState, value: boolean) {
    setConsent((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      if (!('consent' in prev)) return prev
      const next = { ...prev }
      delete next.consent
      return next
    })
  }

  function validateStep1(): Record<string, string> {
    const next: Record<string, string> = {}
    if (!formData.whatLookingFor.trim()) next.whatLookingFor = dict.validation.required
    if (!formData.category) next.category = dict.validation.required
    return next
  }

  function validateStep2(): Record<string, string> {
    const next: Record<string, string> = {}
    if (!formData.partnerType) next.partnerType = dict.validation.required
    if (!formData.purpose.trim()) next.purpose = dict.validation.required
    if (!formData.description.trim()) next.description = dict.validation.required
    if (!formData.budget) next.budget = dict.validation.required
    if (!formData.timeline) next.timeline = dict.validation.required
    if (!formData.englishSpeaking) next.englishSpeaking = dict.validation.required
    return next
  }

  function validateStep3(): Record<string, string> {
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

  function handleNext() {
    const stepErrors = step === 1 ? validateStep1() : validateStep2()
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }
    setErrors({})
    setStep((s) => (s === 1 ? 2 : 3))
  }

  function handleBack() {
    setErrors({})
    setStep((s) => (s === 3 ? 2 : 1))
  }

  async function submit() {
    setStatus('loading')
    const payload: RequestFormPayload = {
      ...(formData as unknown as RequestFormData),
      locale,
      honeypot: formData.honeypot,
      consent: {
        privacy: consent.privacy,
        terms: consent.terms,
        marketing: consent.marketing,
        // version/termsVersion/locale are informational on the client; the server
        // (app/api/requests/route.ts) uses its own constants as the source of truth
        // and does not trust these values (privacy review §4.3 note 1).
        version: PRIVACY_CONSENT_VERSION,
        termsVersion: TERMS_CONSENT_VERSION,
        locale,
      },
    }
    const result = await submitRequest(payload)
    if (result.success) trackEvent('form_submit', { locale })
    setStatus(result.success ? 'success' : 'error')
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const stepErrors = validateStep3()
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }
    setErrors({})
    await submit()
  }

  return (
    <section id="request-form" className="px-section-x-mobile py-section-y lg:px-section-x">
      <div className="mx-auto max-w-[600px]">
        {status === 'idle' ? (
          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <Step1
                dict={dict}
                categoriesDict={categoriesDict}
                formData={formData}
                errors={errors}
                onChange={handleChange}
                onNext={handleNext}
              />
            )}
            {step === 2 && (
              <Step2
                dict={dict}
                formData={formData}
                errors={errors}
                onChange={handleChange}
                onNext={handleNext}
                onBack={handleBack}
              />
            )}
            {step === 3 && (
              <Step3
                dict={dict}
                formData={formData}
                errors={errors}
                onChange={handleChange}
                consent={consent}
                onConsentChange={handleConsentChange}
                onBack={handleBack}
                locale={locale}
              />
            )}
          </form>
        ) : (
          <SubmitStatus dict={dict} status={status} onRetry={submit} />
        )}
      </div>
    </section>
  )
}
