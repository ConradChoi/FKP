'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import type { ActionResult } from '@/lib/supabase/adminAuthActions'

// Design Ref: supabase/migrations/20260825160000 — these two used to do a plain table
// .update() followed by a separate supabase.rpc('log_audit', ...) call. There is no
// public.log_audit (only private.log_audit, unreachable via PostgREST RPC), so that audit
// call was silently failing on every status/assignee change. Fixed by routing through
// SECURITY DEFINER functions that make the update + audit insert atomic, matching the
// get_request_contact / set_request_internal_note pattern.

export async function updateLeadStatusAction(requestId: string, status: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('update_lead_status', { p_request_id: requestId, p_status: status })
  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  revalidatePath(`/admin/leads/${requestId}`)
  revalidatePath('/admin/leads')
  return { success: true }
}

export async function updateLeadAssigneeAction(requestId: string, assigneeId: string | null): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('update_lead_assignee', { p_request_id: requestId, p_assignee_id: assigneeId })
  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  revalidatePath(`/admin/leads/${requestId}`)
  revalidatePath('/admin/leads')
  return { success: true }
}

export async function updateInternalNoteAction(requestId: string, note: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('set_request_internal_note', { p_request_id: requestId, p_note: note })
  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  return { success: true }
}

export interface RevealedContact {
  contact: string
}

export async function revealContactAction(requestId: string): Promise<ActionResult<RevealedContact>> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { data, error } = await supabase.rpc('get_request_contact', { p_request_id: requestId })
  if (error || typeof data !== 'string') {
    return { success: false, error: error?.message ?? 'reveal_failed', errorCode: 'REVEAL_FAILED' }
  }

  return { success: true, data: { contact: data } }
}
