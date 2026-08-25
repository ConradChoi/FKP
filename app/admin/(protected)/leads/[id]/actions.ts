'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import type { ActionResult } from '@/lib/supabase/adminAuthActions'

export async function updateLeadStatusAction(requestId: string, status: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.from('requests').update({ status }).eq('id', requestId)
  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  await supabase.rpc('log_audit', { p_action: 'lead.status_change', p_target_table: 'requests', p_target_id: requestId })
  revalidatePath(`/admin/leads/${requestId}`)
  revalidatePath('/admin/leads')
  return { success: true }
}

export async function updateLeadAssigneeAction(requestId: string, assigneeId: string | null): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.from('requests').update({ assignee_id: assigneeId }).eq('id', requestId)
  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  await supabase.rpc('log_audit', { p_action: 'lead.assign', p_target_table: 'requests', p_target_id: requestId })
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
