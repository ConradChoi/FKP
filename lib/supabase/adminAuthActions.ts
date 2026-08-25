// Design Ref: fkp-v0.2-privacy-review-phase3-rbac.md §6 (session/MFA policy), §9
// (check_login_lockout/record_login_result/log_auth_event RPCs). Server Actions only —
// Supabase Auth calls happen here, never in the browser, so the anon key never needs a
// NEXT_PUBLIC_ prefix (keeps S-9's "server-only" property even for the Admin login screen).
'use server'

import { getSupabaseAuthServerClient } from './serverAuthClient'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export interface ActionResult<T = undefined> {
  success: boolean
  error?: string
  errorCode?: string
  data?: T
}

export async function signInAction(email: string, password: string): Promise<ActionResult> {
  const trimmedEmail = email.trim().toLowerCase()
  if (!EMAIL_RE.test(trimmedEmail) || password.length === 0) {
    return { success: false, error: 'invalid_input', errorCode: 'VALIDATION_ERROR' }
  }

  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { data: lockout } = await supabase.rpc('check_login_lockout', { p_email: trimmedEmail })
  if (lockout?.locked) {
    return { success: false, error: 'account_locked', errorCode: 'ACCOUNT_LOCKED' }
  }

  const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password })
  const success = !error

  await supabase.rpc('record_login_result', { p_email: trimmedEmail, p_success: success })
  await supabase.rpc('log_auth_event', {
    p_action: success ? 'auth.login_success' : 'auth.login_failed',
    p_result: success ? 'success' : 'failure',
    p_error_code: error?.code ?? null,
  })

  if (!success) {
    return { success: false, error: 'invalid_credentials', errorCode: 'INVALID_CREDENTIALS' }
  }

  return { success: true }
}

export async function signOutAction(): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }
  await supabase.rpc('log_auth_event', { p_action: 'auth.logout' })
  await supabase.auth.signOut()
  return { success: true }
}

export interface MfaEnrollData {
  factorId: string
  qrCodeDataUri: string
  secret: string
  uri: string
}

export async function startMfaEnrollAction(): Promise<ActionResult<MfaEnrollData>> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { data: existing } = await supabase.auth.mfa.listFactors()
  const unverified = existing?.all?.find((f) => f.factor_type === 'totp' && f.status === 'unverified')
  if (unverified) {
    await supabase.auth.mfa.unenroll({ factorId: unverified.id })
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
  if (error || !data) {
    return { success: false, error: error?.message ?? 'enroll_failed', errorCode: 'MFA_ENROLL_FAILED' }
  }

  return {
    success: true,
    data: {
      factorId: data.id,
      qrCodeDataUri: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    },
  }
}

export async function verifyMfaAction(factorId: string, code: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() })
  if (error) {
    return { success: false, error: error.message, errorCode: 'MFA_VERIFY_FAILED' }
  }

  await supabase.rpc('log_auth_event', { p_action: 'auth.mfa_enrolled' })
  return { success: true }
}

export interface PendingMfaFactor {
  factorId: string
}

export async function getPendingMfaFactorAction(): Promise<ActionResult<PendingMfaFactor>> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { data, error } = await supabase.auth.mfa.listFactors()
  const verified = data?.totp?.[0]
  if (error || !verified) {
    return { success: false, error: 'no_verified_factor', errorCode: 'MFA_NO_FACTOR' }
  }
  return { success: true, data: { factorId: verified.id } }
}
