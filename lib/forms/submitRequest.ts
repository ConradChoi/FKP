// Design Ref: PRD E1-R1/E1-R2 — client submits to our own Next.js server route
// (app/api/requests/route.ts), never directly to Supabase (see lib/supabase/serverClient.ts).
//
// FIX (F-2 / R2, formerly the root cause of over-reported "success"): this function used
// to `await fetch(...)` and return `{ success: true }` unconditionally, without reading the
// response at all — a dead endpoint, a validation failure, or a DB outage all looked like
// success to the user and to GA4 (`form_submit` fired on that fake success). This version
// checks both `response.ok` AND the parsed response body's `success` field, and never
// reports success unless the server actually confirmed a row was created (or a benign
// honeypot no-op).
import type { RequestFormPayload } from '@/types/request-form'

export type SubmitErrorCode =
  | 'VALIDATION_ERROR'
  | 'CONSENT_REQUIRED'
  | 'RATE_LIMITED'
  | 'CONFIG_ERROR'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'

export interface SubmitResult {
  success: boolean
  id?: string
  errorCode?: SubmitErrorCode
  fields?: Record<string, string>
}

interface ApiResponseBody {
  success?: boolean
  id?: string
  error?: {
    code?: SubmitErrorCode
    fields?: Record<string, string>
  }
}

export async function submitRequest(payload: RequestFormPayload): Promise<SubmitResult> {
  let response: Response
  try {
    response = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // fetch() itself threw — offline, DNS failure, CORS, etc. Definitely not a success.
    return { success: false, errorCode: 'NETWORK_ERROR' }
  }

  let body: ApiResponseBody | null = null
  try {
    body = (await response.json()) as ApiResponseBody
  } catch {
    body = null
  }

  // Both conditions matter: a 200 with `{ success: false }` body, or a non-2xx status with
  // an unreadable/missing body, must both be treated as failure. Neither check alone is
  // sufficient (this is exactly the gap the previous implementation had).
  if (!response.ok || body?.success !== true) {
    return {
      success: false,
      errorCode: body?.error?.code ?? 'SERVER_ERROR',
      fields: body?.error?.fields,
    }
  }

  return { success: true, id: body.id }
}
