// =============================================================================
// API Contract — POST /api/requests
// =============================================================================
// Design Ref: PRD §4.1 E1-R1 (server-mediated, browser never talks to Supabase
// directly), E1-R2 (server responds with an explicit, verifiable success/failure
// status), E1-R3 (server-side re-validation), privacy review §4/§5/S-5.
//
// Request body (application/json):
//   {
//     whatLookingFor: string,
//     category: 'education' | 'it-ai' | 'content-media' | 'beauty-lifestyle' | 'business-services',
//     partnerType: 'purchase' | 'partnership' | 'license' | 'other',
//     purpose: string,
//     description: string,
//     budget: 'under-500' | '500-1500' | '1500-3000' | 'over-3000' | 'not-sure',
//     timeline: 'asap' | 'within-1-month' | '1-3-months' | '3-6-months' | 'flexible',
//     englishSpeaking: 'required' | 'preferred' | 'not-needed',
//     companyNameWebsite: string,
//     contact: string,               // email
//     locale: 'en' | 'ja',
//     honeypot: string,               // must be empty; non-empty => treated as bot
//     consent: {
//       privacy: boolean,             // must be true or the request is rejected
//       terms: boolean,               // must be true or the request is rejected
//       marketing: boolean,
//       version: string,              // consent_version (app constant, not user input)
//       termsVersion: string,         // terms_version (app constant, not user input)
//       locale: string,               // consent_locale — which language copy was shown
//     },
//   }
//
// Responses:
//   201 { success: true, id: string }
//     — row created in Supabase.
//   200 { success: true }
//     — honeypot triggered (bot). Nothing was persisted. Client cannot tell this
//       apart from a real success on purpose (do not give bots a signal).
//   400 { success: false, error: { code: 'VALIDATION_ERROR', fields: Record<string,string> } }
//     — required field missing/invalid, bad enum value, bad email format, length cap.
//   400 { success: false, error: { code: 'CONSENT_REQUIRED', fields: { consent: string } } }
//     — privacy_consent or terms_consent was not true. (Should not happen from the
//       real UI — Step3 blocks submission client-side — this is defense in depth.)
//   429 { success: false, error: { code: 'RATE_LIMITED' } }
//     — best-effort in-memory per-IP rate limit exceeded (E1-R10, Should).
//   503 { success: false, error: { code: 'CONFIG_ERROR' } }
//     — Supabase env vars not configured on this deployment. Logged server-side.
//   500 { success: false, error: { code: 'SERVER_ERROR' } }
//     — Supabase RPC failed or was unreachable. The (masked) payload is recorded
//       in failed_submissions for manual recovery (E1-R9) on a best-effort basis.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server'
import { PRIVACY_CONSENT_VERSION, TERMS_CONSENT_VERSION } from '@/lib/legal/consentVersions'
import { extractClientIp, maskEmail, maskIp } from '@/lib/forms/mask'
import { isRateLimited } from '@/lib/forms/rateLimit'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { validateRequestBody, type RawRequestBody } from '@/lib/forms/validateRequest'

export const runtime = 'nodejs'

type ErrorCode = 'VALIDATION_ERROR' | 'CONSENT_REQUIRED' | 'RATE_LIMITED' | 'CONFIG_ERROR' | 'SERVER_ERROR'

function errorResponse(status: number, code: ErrorCode, fields?: Record<string, string>) {
  return NextResponse.json({ success: false, error: { code, fields } }, { status })
}

async function logFailedSubmissionSafely(params: {
  reason: string
  errorDetail?: string
  contact?: string
  whatLookingForLength?: number
  purposeLength?: number
  descriptionLength?: number
  companyNameWebsiteLength?: number
  category?: string
  partnerType?: string
  budget?: string
  timeline?: string
  englishSpeaking?: string
  locale?: string
  requestIp?: string | null
}) {
  const masked = {
    reason: params.reason,
    errorDetail: params.errorDetail,
    maskedContact: params.contact ? maskEmail(params.contact) : undefined,
    whatLookingForLength: params.whatLookingForLength,
    purposeLength: params.purposeLength,
    descriptionLength: params.descriptionLength,
    companyNameWebsiteLength: params.companyNameWebsiteLength,
    category: params.category,
    partnerType: params.partnerType,
    budget: params.budget,
    timeline: params.timeline,
    englishSpeaking: params.englishSpeaking,
    locale: params.locale,
    requestIp: maskIp(params.requestIp ?? null),
  }

  try {
    const client = getSupabaseServerClient()
    if (!client) throw new Error('supabase client unavailable')

    const { error } = await client.rpc('log_failed_submission', {
      p_reason: masked.reason,
      p_error_detail: masked.errorDetail ?? null,
      p_masked_contact: masked.maskedContact ?? null,
      p_what_looking_for_length: masked.whatLookingForLength ?? null,
      p_purpose_length: masked.purposeLength ?? null,
      p_description_length: masked.descriptionLength ?? null,
      p_company_name_website_length: masked.companyNameWebsiteLength ?? null,
      p_category: masked.category ?? null,
      p_partner_type: masked.partnerType ?? null,
      p_budget: masked.budget ?? null,
      p_timeline: masked.timeline ?? null,
      p_english_speaking: masked.englishSpeaking ?? null,
      p_locale: masked.locale ?? null,
      p_source: 'web',
      p_request_ip: masked.requestIp ?? null,
    })

    if (error) throw error
  } catch {
    // Last-resort safety net (E1-R9): Supabase itself is unreachable, so this is the
    // only surviving record. Never log raw PII here — `masked` already has email/IP
    // masked and free-text fields reduced to lengths only (privacy review S-5).
    console.error('[requests] failed_submissions fallback log', masked)
  }
}

export async function POST(request: NextRequest) {
  const clientIp = extractClientIp(request.headers)
  const rateLimitKey = clientIp ?? 'unknown'

  if (isRateLimited(rateLimitKey)) {
    return errorResponse(429, 'RATE_LIMITED')
  }

  let body: RawRequestBody
  try {
    body = (await request.json()) as RawRequestBody
  } catch {
    return errorResponse(400, 'VALIDATION_ERROR', { _body: 'invalid_json' })
  }

  const result = validateRequestBody(body)

  if (result.isBot) {
    // Mirrors apps-script/Code.gs behavior: silently discard, respond as if successful
    // so scripted submitters get no signal that they were detected.
    return NextResponse.json({ success: true }, { status: 200 })
  }

  if (!result.ok || !result.data) {
    const fields = result.errors ?? {}
    const code: ErrorCode = fields.consent ? 'CONSENT_REQUIRED' : 'VALIDATION_ERROR'
    return errorResponse(400, code, fields)
  }

  const data = result.data

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    console.error('[requests] Supabase env vars not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_ANON_KEY)')
    await logFailedSubmissionSafely({
      reason: 'config_error',
      contact: data.contact,
      whatLookingForLength: data.whatLookingFor.length,
      purposeLength: data.purpose.length,
      descriptionLength: data.description.length,
      companyNameWebsiteLength: data.companyNameWebsite.length,
      category: data.category,
      partnerType: data.partnerType,
      budget: data.budget,
      timeline: data.timeline,
      englishSpeaking: data.englishSpeaking,
      locale: data.locale,
      requestIp: clientIp,
    })
    return errorResponse(503, 'CONFIG_ERROR')
  }

  // Server owns the consent version/timestamp semantics — the client cannot spoof
  // which document version it "consented" to. We use our own constants rather than
  // trusting body.consent.version/termsVersion so a stale client build can never
  // record a mismatched version (privacy review §4.3 note 1).
  const consentVersion = PRIVACY_CONSENT_VERSION
  const termsVersion = TERMS_CONSENT_VERSION
  const maskedConsentIp = maskIp(clientIp)

  try {
    const { data: rpcData, error } = await supabase
      .rpc('submit_request', {
        p_what_looking_for: data.whatLookingFor,
        p_category: data.category,
        p_partner_type: data.partnerType,
        p_purpose: data.purpose,
        p_description: data.description,
        p_budget: data.budget,
        p_timeline: data.timeline,
        p_english_speaking: data.englishSpeaking,
        p_company_name_website: data.companyNameWebsite,
        p_contact: data.contact,
        p_locale: data.locale,
        p_privacy_consent: data.consent.privacy,
        p_consent_version: consentVersion,
        p_consent_locale: data.consent.locale,
        p_terms_consent: data.consent.terms,
        p_terms_version: termsVersion,
        p_marketing_consent: data.consent.marketing,
        p_consent_ip: maskedConsentIp,
        p_source: 'web',
      })
      .single()

    if (error) throw error

    const id = (rpcData as { id?: string } | null)?.id
    if (!id) throw new Error('submit_request returned no id')

    return NextResponse.json({ success: true, id }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await logFailedSubmissionSafely({
      reason: 'rpc_error',
      errorDetail: message,
      contact: data.contact,
      whatLookingForLength: data.whatLookingFor.length,
      purposeLength: data.purpose.length,
      descriptionLength: data.description.length,
      companyNameWebsiteLength: data.companyNameWebsite.length,
      category: data.category,
      partnerType: data.partnerType,
      budget: data.budget,
      timeline: data.timeline,
      englishSpeaking: data.englishSpeaking,
      locale: data.locale,
      requestIp: clientIp,
    })
    return errorResponse(500, 'SERVER_ERROR')
  }
}
