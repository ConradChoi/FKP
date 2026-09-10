'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import type { ActionResult } from '@/lib/supabase/adminAuthActions'

// Design Ref: app/admin/(protected)/leads/[id]/actions.ts (revealContactAction /
// updateLeadStatusAction pattern, mirrored for SEEPN inquiries) — privacy review §5.3(e):
// get_seepn_inquiry_contact is the ONLY path from an admin session to a buyer's raw
// email/display_name (buyer_account carries no admin-facing SELECT policy at all).

export interface RevealedInquiryContact {
  display_name: string
  email: string
}

export async function revealSeepnInquiryContactAction(inquiryId: string): Promise<ActionResult<RevealedInquiryContact>> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { data, error } = await supabase.rpc('get_seepn_inquiry_contact', { p_inquiry_id: inquiryId })
  if (error || !data) {
    return { success: false, error: error?.message ?? 'reveal_failed', errorCode: 'REVEAL_FAILED' }
  }

  return { success: true, data: data as RevealedInquiryContact }
}

export async function updateSeepnInquiryStatusAction(inquiryId: string, status: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('admin_update_seepn_inquiry_status', { p_inquiry_id: inquiryId, p_status: status })
  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  revalidatePath(`/admin/leads/inquiries/${inquiryId}`)
  revalidatePath('/admin/leads/inquiries')
  return { success: true }
}

export async function assignSeepnInquiryAction(inquiryId: string, adminId: string | null): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('admin_assign_seepn_inquiry', { p_inquiry_id: inquiryId, p_admin_id: adminId })
  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  revalidatePath(`/admin/leads/inquiries/${inquiryId}`)
  revalidatePath('/admin/leads/inquiries')
  return { success: true }
}
