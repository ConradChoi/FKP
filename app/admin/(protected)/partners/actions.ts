'use server'

// Design Ref: screen-spec §2.3 (검증 큐 액션 — admin_verify_partner/admin_reject_partner),
// §2.4 (admin_create_partner_entry, 중복 후보 조회). List-level actions only; per-detail-screen
// actions (contact/consent/documents/capability/public-listing) live in [id]/actions.ts.
import { revalidatePath } from 'next/cache'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import type { ActionResult } from '@/lib/supabase/adminAuthActions'

export async function verifyPartnerAction(partnerId: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('admin_verify_partner', { p_partner_id: partnerId })
  if (error) {
    const isStateConflict = error.message.includes('invalid_state_for_verification')
    return { success: false, error: error.message, errorCode: isStateConflict ? 'STATE_CONFLICT' : 'VERIFY_FAILED' }
  }

  revalidatePath('/admin/partners')
  revalidatePath(`/admin/partners/${partnerId}`)
  return { success: true }
}

export async function rejectPartnerAction(partnerId: string, reason: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  if (!reason.trim()) return { success: false, error: 'rejection_reason_required', errorCode: 'VALIDATION_ERROR' }

  const { error } = await supabase.rpc('admin_reject_partner', { p_partner_id: partnerId, p_reason: reason.trim() })
  if (error) {
    const isStateConflict = error.message.includes('invalid_state_for_rejection')
    return { success: false, error: error.message, errorCode: isStateConflict ? 'STATE_CONFLICT' : 'REJECT_FAILED' }
  }

  revalidatePath('/admin/partners')
  revalidatePath(`/admin/partners/${partnerId}`)
  return { success: true }
}

export interface DuplicateCandidate {
  id: string
  company_name_ko: string | null
  verification_state: string
  intake_source: string
}

// Design Ref: screen-spec §2.4.1 — admin already has SELECT on public.partner
// (partner_admin_select), so a direct query is used instead of the boolean-only
// check_business_registration_duplicate RPC (that RPC is reserved for the non-admin,
// anon-adjacent SS-5 duplicate check per its own comment).
export async function checkDuplicateCandidatesAction(brn: string): Promise<ActionResult<{ candidates: DuplicateCandidate[] }>> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }
  if (!brn.trim()) return { success: true, data: { candidates: [] } }

  const { data, error } = await supabase
    .from('partner')
    .select('id, company_name_ko, verification_state, intake_source')
    .eq('business_registration_number', brn.trim())

  if (error) return { success: false, error: error.message, errorCode: 'LOOKUP_FAILED' }
  return { success: true, data: { candidates: data ?? [] } }
}

export interface CreatePartnerEntryInput {
  businessEntityType: string
  companyNameKo: string
  vertical: string
  businessRegistrationNumber: string
  method: string
  collectedAt: string // ISO
  consenterName: string
  consenterTitle: string
  collectionSourceDetail: string
  evidenceKind: string
  publicListingConsent: boolean
}

export async function createPartnerEntryAction(input: CreatePartnerEntryInput): Promise<ActionResult<{ id: string }>> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { data, error } = await supabase.rpc('admin_create_partner_entry', {
    p_business_entity_type: input.businessEntityType,
    p_company_name_ko: input.companyNameKo,
    p_vertical: input.vertical,
    p_business_registration_number: input.businessRegistrationNumber,
    p_method: input.method,
    p_collected_at: input.collectedAt,
    p_consenter_name: input.consenterName,
    p_consenter_title: input.consenterTitle,
    p_collection_source_detail: input.collectionSourceDetail,
    p_evidence_kind: input.evidenceKind,
    p_public_listing_consent: input.publicListingConsent,
  })

  if (error || !data) return { success: false, error: error?.message ?? 'create_failed', errorCode: 'CREATE_FAILED' }

  revalidatePath('/admin/partners')
  return { success: true, data: { id: data as string } }
}
