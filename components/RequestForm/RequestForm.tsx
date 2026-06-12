// Design Ref: §5.3 RequestForm — 3단계 폼 상태(step/formData/status) 관리, client component
'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Dictionary, Locale } from '@/lib/i18n/types'
import type { RequestFormPayload, RequestFormState, SubmitState } from '@/types/request-form'
import { submitRequest } from '@/lib/forms/submitRequest'
import { trackEvent } from '@/lib/analytics'
import { Step1 } from './Step1'
import { Step2 } from './Step2'
import { Step3 } from './Step3'
import { SubmitStatus } from './SubmitStatus'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

interface RequestFormProps {
  dict: Dictionary['requestForm']
  categoriesDict: Dictionary['categories']
  locale: Locale
}

export function RequestForm({ dict, categoriesDict, locale }: RequestFormProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [formData, setFormData] = useState<RequestFormState>(initialFormData)
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
    const payload = { ...formData, locale } as RequestFormPayload
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
              <Step3 dict={dict} formData={formData} errors={errors} onChange={handleChange} onBack={handleBack} />
            )}
          </form>
        ) : (
          <SubmitStatus dict={dict} status={status} onRetry={submit} />
        )}
      </div>
    </section>
  )
}
