// Design Ref: supabase/migrations/20260825130000_phase3_admin_access_request.sql —
// public "request Admin access" submission. Mirrors Phase 1's submit_request pattern
// (server-mediated, insert-only RPC, honeypot, rate limit) — this creates ONLY a request
// row, never a Supabase Auth account (E3-R1 stays satisfied: public sign-up is still off).
'use server'

import { headers } from 'next/headers'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { isRateLimited } from '@/lib/forms/rateLimit'
import type { ActionResult } from '@/lib/supabase/adminAuthActions'

interface AccessRequestInput {
  name: string
  email: string
  reason: string
  honeypot: string
}

export async function submitAccessRequestAction(input: AccessRequestInput): Promise<ActionResult> {
  const headerList = await headers()
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (isRateLimited(`admin-access-request:${ip}`)) {
    return { success: false, error: 'rate_limited', errorCode: 'RATE_LIMITED' }
  }

  if (input.honeypot.trim().length > 0) {
    // Mirror Phase 1: pretend success to a bot, insert nothing.
    return { success: true }
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('submit_access_request', {
    p_name: input.name.trim().slice(0, 100),
    p_email: input.email.trim().slice(0, 254),
    p_reason: input.reason.trim().slice(0, 1000),
    p_honeypot: '',
  })

  if (error) {
    const code = error.message?.includes('request_already_pending') ? 'REQUEST_ALREADY_PENDING' : 'SERVER_ERROR'
    return { success: false, error: error.message, errorCode: code }
  }

  return { success: true }
}
