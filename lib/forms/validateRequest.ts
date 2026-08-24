// Design Ref: E1-R3 — server-side re-validation (required fields, email format, allowed
// enum values, length caps). Client-side validation in RequestForm.tsx is a UX
// convenience only; this is the actual security/data-integrity boundary (never trust the
// client). Enum value sets and length caps are kept in sync with the CHECK constraints in
// supabase/migrations/20260824120000_phase1_requests_pipeline.sql — if one changes, the
// other must too.
import { EMAIL_REGEX } from './emailRegex'

const CATEGORY_VALUES = ['education', 'it-ai', 'content-media', 'beauty-lifestyle', 'business-services'] as const
const PARTNER_TYPE_VALUES = ['purchase', 'partnership', 'license', 'other'] as const
const BUDGET_VALUES = ['under-500', '500-1500', '1500-3000', 'over-3000', 'not-sure'] as const
const TIMELINE_VALUES = ['asap', 'within-1-month', '1-3-months', '3-6-months', 'flexible'] as const
const ENGLISH_SPEAKING_VALUES = ['required', 'preferred', 'not-needed'] as const
const LOCALE_VALUES = ['en', 'ja'] as const // Phase 4 will widen this set (ko/zh)

const MAX_LENGTHS = {
  whatLookingFor: 300,
  purpose: 500,
  description: 5000,
  companyNameWebsite: 300,
  contact: 254,
  consentVersion: 100,
  termsVersion: 100,
} as const

export interface RawRequestBody {
  whatLookingFor?: unknown
  category?: unknown
  partnerType?: unknown
  purpose?: unknown
  description?: unknown
  budget?: unknown
  timeline?: unknown
  englishSpeaking?: unknown
  companyNameWebsite?: unknown
  contact?: unknown
  locale?: unknown
  honeypot?: unknown
  consent?: {
    privacy?: unknown
    terms?: unknown
    marketing?: unknown
    version?: unknown
    termsVersion?: unknown
    locale?: unknown
  }
}

export interface ValidatedRequest {
  whatLookingFor: string
  category: string
  partnerType: string
  purpose: string
  description: string
  budget: string
  timeline: string
  englishSpeaking: string
  companyNameWebsite: string
  contact: string
  locale: string
  consent: {
    privacy: boolean
    terms: boolean
    marketing: boolean
    version: string
    termsVersion: string
    locale: string
  }
}

export type ValidationErrors = Record<string, string>

export interface ValidationResult {
  ok: boolean
  data?: ValidatedRequest
  errors?: ValidationErrors
  /** true if this submission should be silently accepted-but-discarded (bot honeypot) */
  isBot?: boolean
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function requiredText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > maxLength) return null
  return trimmed
}

export function validateRequestBody(body: RawRequestBody): ValidationResult {
  // Honeypot: a real visitor never fills this hidden field. Mirrors the existing
  // apps-script/Code.gs behavior — treat as spam, do not persist, but respond as if
  // successful so bots gain no signal (see app/api/requests/route.ts).
  if (typeof body.honeypot === 'string' && body.honeypot.trim().length > 0) {
    return { ok: false, isBot: true }
  }

  const errors: ValidationErrors = {}

  const whatLookingFor = requiredText(body.whatLookingFor, MAX_LENGTHS.whatLookingFor)
  if (!whatLookingFor) errors.whatLookingFor = 'required_or_too_long'

  const category = isNonEmptyString(body.category) && CATEGORY_VALUES.includes(body.category as never)
    ? (body.category as string)
    : null
  if (!category) errors.category = 'invalid_enum'

  const partnerType = isNonEmptyString(body.partnerType) && PARTNER_TYPE_VALUES.includes(body.partnerType as never)
    ? (body.partnerType as string)
    : null
  if (!partnerType) errors.partnerType = 'invalid_enum'

  const purpose = requiredText(body.purpose, MAX_LENGTHS.purpose)
  if (!purpose) errors.purpose = 'required_or_too_long'

  const description = requiredText(body.description, MAX_LENGTHS.description)
  if (!description) errors.description = 'required_or_too_long'

  const budget = isNonEmptyString(body.budget) && BUDGET_VALUES.includes(body.budget as never)
    ? (body.budget as string)
    : null
  if (!budget) errors.budget = 'invalid_enum'

  const timeline = isNonEmptyString(body.timeline) && TIMELINE_VALUES.includes(body.timeline as never)
    ? (body.timeline as string)
    : null
  if (!timeline) errors.timeline = 'invalid_enum'

  const englishSpeaking =
    isNonEmptyString(body.englishSpeaking) && ENGLISH_SPEAKING_VALUES.includes(body.englishSpeaking as never)
      ? (body.englishSpeaking as string)
      : null
  if (!englishSpeaking) errors.englishSpeaking = 'invalid_enum'

  const companyNameWebsite = requiredText(body.companyNameWebsite, MAX_LENGTHS.companyNameWebsite)
  if (!companyNameWebsite) errors.companyNameWebsite = 'required_or_too_long'

  const contactRaw = requiredText(body.contact, MAX_LENGTHS.contact)
  const contact = contactRaw && EMAIL_REGEX.test(contactRaw) ? contactRaw : null
  if (!contact) errors.contact = 'invalid_email'

  const locale = isNonEmptyString(body.locale) && LOCALE_VALUES.includes(body.locale as never)
    ? (body.locale as string)
    : null
  if (!locale) errors.locale = 'invalid_enum'

  const consentInput = body.consent ?? {}
  const consentPrivacy = consentInput.privacy === true
  const consentTerms = consentInput.terms === true
  const consentMarketing = consentInput.marketing === true
  const consentVersion = requiredText(consentInput.version, MAX_LENGTHS.consentVersion)
  const termsVersion = requiredText(consentInput.termsVersion, MAX_LENGTHS.termsVersion)
  const consentLocale = isNonEmptyString(consentInput.locale) && LOCALE_VALUES.includes(consentInput.locale as never)
    ? (consentInput.locale as string)
    : null

  if (!consentPrivacy || !consentTerms) {
    errors.consent = 'consent_required'
  } else if (!consentVersion || !termsVersion || !consentLocale) {
    // Should never happen from the real UI (versions are app constants, not user input) —
    // but if it does, treat it the same as missing consent rather than silently accepting.
    errors.consent = 'consent_required'
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    data: {
      whatLookingFor: whatLookingFor as string,
      category: category as string,
      partnerType: partnerType as string,
      purpose: purpose as string,
      description: description as string,
      budget: budget as string,
      timeline: timeline as string,
      englishSpeaking: englishSpeaking as string,
      companyNameWebsite: companyNameWebsite as string,
      contact: contact as string,
      locale: locale as string,
      consent: {
        privacy: consentPrivacy,
        terms: consentTerms,
        marketing: consentMarketing,
        version: consentVersion as string,
        termsVersion: termsVersion as string,
        locale: consentLocale as string,
      },
    },
  }
}
