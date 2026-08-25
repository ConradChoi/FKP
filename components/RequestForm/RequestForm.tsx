// Design Ref: §5.3 RequestForm — 3단계 폼 상태(step/formData/status) 관리, client component.
// Phase 2: this is now the flat presentation used only by /[locale]/request (Step1 -> Step2
// -> Step3 -> SubmitStatus in sequence, no Hero split — ui spec §5). This page intentionally
// has no confirm modal (flow spec §13.6) — that's a Home-only addition. The Home page instead
// uses components/RequestFlow/useHomeFlowEngine.ts + Hero (which hosts the Step1-3 carousel +
// confirm modal, flow spec §13), sharing the same validation module
// (lib/forms/validateSteps.ts) and API contract.
'use client'

import { useEffect, useRef, useState } from 'react'
import type { Dictionary, Locale } from '@/lib/i18n/types'
import type {
  ConsentState,
  RequestFormData,
  RequestFormPayload,
  RequestFormState,
  RequestSource,
  SubmitState,
} from '@/types/request-form'
import { submitRequest } from '@/lib/forms/submitRequest'
import { trackEvent } from '@/lib/analytics'
import { PRIVACY_CONSENT_VERSION, TERMS_CONSENT_VERSION } from '@/lib/legal/consentVersions'
import { validateStep1, validateStep2, validateStep3 } from '@/lib/forms/validateSteps'
import { prefersReducedMotion, scrollToTop } from '@/lib/dom/scrollTo'
import type { RequestFlowStatus } from '@/components/RequestFlow/RequestFlowStatusContext'
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
  source: RequestSource
  /** Reports step/status changes upward so a page-level Header/LanguageSwitcher can read
   * flow state without owning the form itself (flow spec §5, §8 E-3). */
  onFlowStatusChange?: (status: RequestFlowStatus) => void
  /** Overrides the outer section's padding — /request tightens the top padding so the short
   * intro blurb above it doesn't create a double gap (ui spec §5). */
  sectionClassName?: string
}

export function RequestForm({
  dict,
  categoriesDict,
  locale,
  source,
  onFlowStatusChange,
  sectionClassName,
}: RequestFormProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [formData, setFormData] = useState<RequestFormState>(initialFormData)
  const [consent, setConsent] = useState<ConsentState>(initialConsent)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<SubmitState>('idle')
  const [formStarted, setFormStarted] = useState(false)
  const abandonFiredRef = useRef(false)

  function handleFieldFocus() {
    setFormStarted((started) => {
      if (!started) trackEvent('form_start', { source, locale })
      return true
    })
  }

  useEffect(() => {
    onFlowStatusChange?.({
      step,
      status,
      formStarted,
      source,
      locale,
      hasUnsavedProgress: formStarted && status !== 'success',
      isAtStep1: step === 1 && status !== 'success',
    })
    // onFlowStatusChange is expected to be a stable setter (e.g. useState's setter) —
    // intentionally excluded so a new inline function on every parent render doesn't loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, status, formStarted, source, locale])

  useEffect(() => {
    function fireAbandon() {
      if (formStarted && status !== 'success' && !abandonFiredRef.current) {
        abandonFiredRef.current = true
        trackEvent('form_abandon', { last_step: step, source, locale })
      }
    }
    function onVisibility() {
      if (document.visibilityState === 'hidden') fireAbandon()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', fireAbandon)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', fireAbandon)
    }
  }, [formStarted, status, step, source, locale])

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

  function handleNext() {
    const stepErrors = step === 1 ? validateStep1(formData, dict) : validateStep2(formData, dict)
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }
    setErrors({})
    trackEvent('step_complete', { step_no: step, source, locale })
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
      source,
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
    if (result.success) trackEvent('form_submit', { source, locale, category: formData.category })
    setStatus(result.success ? 'success' : 'error')
  }

  async function handleSubmit() {
    const stepErrors = validateStep3(formData, consent, dict)
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }
    setErrors({})
    await submit()
  }

  function resetAll() {
    setFormData(initialFormData)
    setConsent(initialConsent)
    setErrors({})
    setStep(1)
    setStatus('idle')
    setFormStarted(false)
    abandonFiredRef.current = false
  }

  function handleReset() {
    const reduce = prefersReducedMotion()
    scrollToTop()
    window.setTimeout(resetAll, reduce ? 0 : 500)
  }

  return (
    <section id="request-form" className={sectionClassName ?? 'px-section-x-mobile py-section-y lg:px-section-x'}>
      <div className="mx-auto max-w-[600px]">
        {status === 'idle' ? (
          <>
            {step === 1 && (
              <Step1
                dict={dict}
                categoriesDict={categoriesDict}
                formData={formData}
                errors={errors}
                onChange={handleChange}
                onNext={handleNext}
                onFieldFocus={handleFieldFocus}
                variant="panel"
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
                onSubmit={handleSubmit}
                locale={locale}
              />
            )}
          </>
        ) : (
          <SubmitStatus dict={dict} status={status} onRetry={submit} onReset={handleReset} />
        )}
      </div>
    </section>
  )
}
