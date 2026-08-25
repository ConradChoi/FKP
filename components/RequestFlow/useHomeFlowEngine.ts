// Design Ref: fkp-v0.2-phase2-request-flow.spec.md §13 (v1.2 — Hero-internal carousel + confirm
// modal, supersedes §2/§4.2/§5.1/§9's "continuation panel" model), §6 (funnel events), §8 E-1/E-3
// (edit location, edge cases). Single source of truth for the Home page's Hero carousel. Hero and
// ConfirmSubmitModal both read/write this via components/RequestFlow/HomeFlowContext.tsx so there
// is exactly one form instance/state object shared between them (flow spec §9 E2-R4, reaffirmed
// by §13.2 — the carousel only ever exposes one editable panel at a time).
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
import { focusFirstFieldWithin, prefersReducedMotion, scrollToTop, smoothScrollToId } from '@/lib/dom/scrollTo'
import type { RequestFlowStatus } from './RequestFlowStatusContext'

const HOME_SOURCE: RequestSource = 'home_hero'

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

const initialConsent: ConsentState = { privacy: false, terms: false, marketing: false }

export interface HomeFlowEngine {
  /** Which panel of the Hero carousel is currently visible/editable (flow spec §13.2). Back
   * simply slides to the previous panel — form values are never cleared, so sliding forward
   * again picks up exactly where the user left off. */
  step: 1 | 2 | 3
  formData: RequestFormState
  consent: ConsentState
  errors: Record<string, string>
  status: SubmitState
  formStarted: boolean
  locale: Locale
  flowStatus: RequestFlowStatus
  /** True while the Step3 submit confirmation modal (flow spec §13.3) is open. */
  confirmModalOpen: boolean
  handleFieldFocus: () => void
  handleChange: (field: keyof RequestFormState, value: string) => void
  handleConsentChange: (field: keyof ConsentState, value: boolean) => void
  /** Returns true on successful validation. */
  handleStep1Submit: () => boolean
  handleStep2Submit: () => boolean
  /** Validates Step3 and, if it passes, opens the confirm modal (flow spec §13.3) — this no
   * longer submits directly. The actual POST /api/requests happens in `confirmSubmit`. */
  handleStep3Submit: () => void
  handleBackFromStep2: () => void
  handleBackFromStep3: () => void
  /** Confirm modal's "Confirm & Submit" / retry-after-error button. */
  confirmSubmit: () => void
  /** Confirm modal's "Cancel" / backdrop / Esc handler — closes the modal without submitting,
   * Step3's input is left exactly as it was (flow spec §13.3). No-ops while a submit request
   * is in flight. */
  cancelConfirmModal: () => void
  retry: () => void
  prefillCategory: (category: string) => void
  startNewRequest: () => void
  /** Bumped whenever prefillCategory sets `category` while Panel 1 is the visible editor
   * (step===1). Step1 (variant="hero") watches this to flash the category field so a click on
   * an already-visible panel isn't a silent, easy-to-miss change (flow spec §5.1, QA Major
   * finding on fkp-v0.2-platform-foundation Phase 2). */
  categoryHighlightKey: number
}

export function useHomeFlowEngine(dict: Dictionary['requestForm'], locale: Locale): HomeFlowEngine {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [formData, setFormData] = useState<RequestFormState>(initialFormData)
  const [consent, setConsent] = useState<ConsentState>(initialConsent)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<SubmitState>('idle')
  const [formStarted, setFormStarted] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [categoryHighlightKey, setCategoryHighlightKey] = useState(0)
  const abandonFiredRef = useRef(false)

  const handleFieldFocus = useCallback(() => {
    setFormStarted((started) => {
      if (!started) trackEvent('form_start', { source: HOME_SOURCE, locale })
      return true
    })
  }, [locale])

  // Design Ref: flow spec §6 form_abandon — fires once per flow instance if the user
  // navigates away (tab hidden/closed) after form_start but before success.
  useEffect(() => {
    function fireAbandon() {
      if (formStarted && status !== 'success' && !abandonFiredRef.current) {
        abandonFiredRef.current = true
        trackEvent('form_abandon', { last_step: step, source: HOME_SOURCE, locale })
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
  }, [formStarted, status, step, locale])

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

  function handleStep1Submit(): boolean {
    const stepErrors = validateStep1(formData, dict)
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return false
    }
    setErrors({})
    trackEvent('step_complete', { step_no: 1, source: HOME_SOURCE, locale })
    setStep(2)
    return true
  }

  function handleStep2Submit(): boolean {
    const stepErrors = validateStep2(formData, dict)
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return false
    }
    setErrors({})
    trackEvent('step_complete', { step_no: 2, source: HOME_SOURCE, locale })
    setStep(3)
    return true
  }

  // Design Ref: flow spec §13.2 — "Back" slides to the previous panel in place, values are
  // preserved (no recap/[Edit] indirection needed since the carousel only ever shows one
  // editable panel at a time).
  function handleBackFromStep2() {
    setErrors({})
    setStep(1)
  }

  function handleBackFromStep3() {
    setErrors({})
    setStep(2)
  }

  async function doSubmit() {
    setStatus('loading')
    const payload: RequestFormPayload = {
      ...(formData as unknown as RequestFormData),
      locale,
      honeypot: formData.honeypot,
      source: HOME_SOURCE,
      consent: {
        privacy: consent.privacy,
        terms: consent.terms,
        marketing: consent.marketing,
        version: PRIVACY_CONSENT_VERSION,
        termsVersion: TERMS_CONSENT_VERSION,
        locale,
      },
    }
    const result = await submitRequest(payload)
    if (result.success) {
      trackEvent('form_submit', { source: HOME_SOURCE, locale, category: formData.category })
      setConfirmModalOpen(false)
    }
    setStatus(result.success ? 'success' : 'error')
  }

  // Design Ref: flow spec §13.3 — Step3's submit button no longer submits directly. It only
  // validates and, on success, opens the confirm modal. The actual POST /api/requests is
  // deferred to confirmSubmit (the modal's "Confirm & Submit" button).
  function handleStep3Submit() {
    const stepErrors = validateStep3(formData, consent, dict)
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }
    setErrors({})
    setConfirmModalOpen(true)
  }

  function confirmSubmit() {
    void doSubmit()
  }

  function cancelConfirmModal() {
    if (status === 'loading') return
    setConfirmModalOpen(false)
    // Clear a stale error so re-opening the modal later (e.g. after editing Step3 again)
    // starts fresh instead of showing yesterday's failure.
    if (status === 'error') setStatus('idle')
  }

  function retry() {
    void doSubmit()
  }

  function resetAll() {
    setFormData(initialFormData)
    setConsent(initialConsent)
    setErrors({})
    setStep(1)
    setStatus('idle')
    setFormStarted(false)
    setConfirmModalOpen(false)
    abandonFiredRef.current = false
  }

  // Design Ref: ui spec §6.2 — scroll first, reset only after the scroll settles so the
  // carousel's collapse back to Panel 1 happens off-screen (no visible layout jump).
  function startNewRequest() {
    const reduce = prefersReducedMotion()
    scrollToTop()
    window.setTimeout(resetAll, reduce ? 0 : 500)
  }

  // Design Ref: flow spec §13.4 (supersedes §5.1) — Categories card click branches on the
  // carousel's current panel instead of the old panel-scroll model.
  function prefillCategory(category: string) {
    if (status === 'success') {
      const reduce = prefersReducedMotion()
      scrollToTop()
      window.setTimeout(() => {
        resetAll()
        setFormData((prev) => ({ ...prev, category }))
        handleFieldFocus()
        focusFirstFieldWithin('hero-mini-form')
      }, reduce ? 0 : 500)
      return
    }

    // The confirm modal being open implies Step3 was already completed once — treat a
    // category change the same as Back-to-Panel-1: close the modal and slide there.
    if (confirmModalOpen) {
      setConfirmModalOpen(false)
      if (status === 'error') setStatus('idle')
      setFormData((prev) => ({ ...prev, category }))
      setStep(1)
      smoothScrollToId('hero')
      return
    }

    if (step === 1) {
      const alreadyStarted = formStarted
      setFormData((prev) => ({ ...prev, category }))
      setCategoryHighlightKey((n) => n + 1)
      if (!alreadyStarted) handleFieldFocus()
      smoothScrollToId('hero')
      if (!alreadyStarted) focusFirstFieldWithin('hero-mini-form')
      return
    }

    // Panel 2 or Panel 3 — slide the carousel back to Panel 1 (same transition as Back),
    // Step2/3 values already entered are preserved and can be reached again via Next.
    setFormData((prev) => ({ ...prev, category }))
    setStep(1)
    smoothScrollToId('hero')
  }

  const flowStatus: RequestFlowStatus = {
    step,
    status,
    formStarted,
    source: HOME_SOURCE,
    locale,
    hasUnsavedProgress: formStarted && status !== 'success',
    isAtStep1: step === 1 && status !== 'success',
  }

  return {
    step,
    formData,
    consent,
    errors,
    status,
    formStarted,
    locale,
    flowStatus,
    confirmModalOpen,
    handleFieldFocus,
    handleChange,
    handleConsentChange,
    handleStep1Submit,
    handleStep2Submit,
    handleStep3Submit,
    handleBackFromStep2,
    handleBackFromStep3,
    confirmSubmit,
    cancelConfirmModal,
    retry,
    prefillCategory,
    startNewRequest,
    categoryHighlightKey,
  }
}
