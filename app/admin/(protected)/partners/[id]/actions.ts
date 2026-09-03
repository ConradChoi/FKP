'use server'

// Design Ref: screen-spec §2.5 (상세 화면 6개 탭의 서버 액션). List-level actions
// (verify/reject/create-entry/duplicate-check) live in ../actions.ts and are re-exported here
// where the detail screen also needs them, to keep one canonical implementation.
import { randomUUID, createHash } from 'crypto'
import { revalidatePath } from 'next/cache'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { getSupabaseAdminClient } from '@/lib/supabase/adminClient'
import type { ActionResult } from '@/lib/supabase/adminAuthActions'

// verifyPartnerAction/rejectPartnerAction/checkDuplicateCandidatesAction live in ../actions.ts
// and are imported directly from there by the components that need them (VerificationRowActions,
// BasicInfoTab) — not re-exported here, since a "use server" file may only export async
// functions (re-exporting a name is a non-async export from this module's perspective).

// =============================================================================
// §2.5.6 동의/공개노출 — public listing 3-layer gate + admin_entry 사후 동의 기록
// =============================================================================

export async function setPublicListingAction(partnerId: string, on: boolean): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('partner_set_public_listing', { p_partner_id: partnerId, p_on: on })
  if (error) return { success: false, error: error.message, errorCode: 'PUBLIC_LISTING_FAILED' }

  revalidatePath(`/admin/partners/${partnerId}`)
  revalidatePath('/admin/partners')
  return { success: true }
}

export async function suspendListingAction(partnerId: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('admin_suspend_partner_listing', { p_partner_id: partnerId })
  if (error) return { success: false, error: error.message, errorCode: 'SUSPEND_FAILED' }

  revalidatePath(`/admin/partners/${partnerId}`)
  revalidatePath('/admin/partners')
  return { success: true }
}

export interface RecordConsentInput {
  partnerId: string
  method: string
  collectedAt: string // ISO
  consenterName: string
  consenterTitle: string
  evidenceKind: string
}

export async function adminRecordPartnerConsentAction(input: RecordConsentInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('admin_record_partner_consent', {
    p_partner_id: input.partnerId,
    p_method: input.method,
    p_collected_at: input.collectedAt,
    p_consenter_name: input.consenterName,
    p_consenter_title: input.consenterTitle,
    p_evidence_kind: input.evidenceKind,
  })
  if (error) return { success: false, error: error.message, errorCode: 'CONSENT_RECORD_FAILED' }

  revalidatePath(`/admin/partners/${input.partnerId}`)
  return { success: true }
}

// =============================================================================
// §2.5.4 연락처 — admin_entry 파트너의 연락처를 관리자가 입력/수정 (20260829180000 §1)
// =============================================================================

export interface SetContactInput {
  partnerId: string
  contactName: string
  contactTitle: string
  contactEmail: string
  contactPhone: string
  representativeName: string
}

export async function adminSetPartnerContactAction(input: SetContactInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('admin_set_partner_contact', {
    p_partner_id: input.partnerId,
    p_contact_name: input.contactName,
    p_contact_title: input.contactTitle || null,
    p_contact_email: input.contactEmail,
    p_contact_phone: input.contactPhone || null,
    p_representative_name: input.representativeName || null,
  })
  if (error) return { success: false, error: error.message, errorCode: 'CONTACT_SAVE_FAILED' }

  revalidatePath(`/admin/partners/${input.partnerId}`)
  return { success: true }
}

export interface RevealedContact {
  contact_name: string
  contact_title: string | null
  contact_email: string
  contact_phone: string | null
  representative_name: string | null
}

export async function revealPartnerContactAction(partnerId: string): Promise<ActionResult<RevealedContact>> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { data, error } = await supabase.rpc('get_partner_contact', { p_partner_id: partnerId })
  if (error || !data) return { success: false, error: error?.message ?? 'reveal_failed', errorCode: 'REVEAL_FAILED' }
  return { success: true, data: data as RevealedContact }
}

// =============================================================================
// §2.5.3 기본정보 + 제출 체크리스트 — draft/rejected + admin_entry의 [검증 제출]
// (20260829180000 §2 — admin_submit_partner_for_review)
// =============================================================================

export async function adminSubmitForReviewAction(partnerId: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('admin_submit_partner_for_review', { p_partner_id: partnerId })
  if (error) {
    const isIncomplete = error.message.includes('profile_incomplete')
    return { success: false, error: error.message, errorCode: isIncomplete ? 'PROFILE_INCOMPLETE' : 'SUBMIT_FAILED' }
  }

  revalidatePath(`/admin/partners/${partnerId}`)
  revalidatePath('/admin/partners')
  return { success: true }
}

// =============================================================================
// §2.5.3/§2.5.4 Capability 필드 저장 — 컬럼단위 직접 UPDATE (RPC 아님, Gap G-4: 감사로그 안 남음).
// §2.6 E2 낙관적 잠금: 저장 직전 updated_at을 재확인해 동시 저장 경합을 완화한다.
// =============================================================================

export interface PartnerCapabilityPatch {
  business_entity_type?: string | null
  company_name_ko?: string | null
  company_name_en?: string | null
  business_registration_number?: string | null
  founded_year?: number | null
  employee_band?: string | null
  location_region?: string | null
  website_url?: string | null
  supported_languages?: string[]
  overseas_experience?: boolean | null
  overseas_experience_countries?: string[]
  company_intro_text?: string | null
  company_intro_locale?: string | null
  representative_offerings?: { name: string; description: string }[]
  certifications?: string[]
  vertical?: string | null
  moq?: string | null
  price_band?: string | null
  lead_time_days?: number | null
  sample_available?: boolean | null
  sample_terms?: string | null
  oem_odm_type?: string | null
  export_record?: string | null
  service_types?: string[]
  project_min_size?: string | null
  pricing_model?: string | null
  standard_lead_time?: string | null
  reference_projects?: { client_industry: string; deliverable: string; anonymized: boolean }[]
  team_size_band?: string | null
  remote_onsite?: string | null
}

export async function updatePartnerCapabilityAction(
  partnerId: string,
  patch: PartnerCapabilityPatch,
  expectedUpdatedAt: string,
): Promise<ActionResult<{ updatedAt: string }>> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { data: current, error: currentError } = await supabase.from('partner').select('updated_at').eq('id', partnerId).single()
  if (currentError || !current) return { success: false, error: currentError?.message ?? 'not_found', errorCode: 'UPDATE_FAILED' }
  if (current.updated_at !== expectedUpdatedAt) {
    return { success: false, error: 'conflict', errorCode: 'CONFLICT' }
  }

  const { data: updated, error } = await supabase.from('partner').update(patch).eq('id', partnerId).select('updated_at').single()
  if (error || !updated) return { success: false, error: error?.message ?? 'update_failed', errorCode: 'UPDATE_FAILED' }

  revalidatePath(`/admin/partners/${partnerId}`)
  revalidatePath('/admin/partners')
  return { success: true, data: { updatedAt: updated.updated_at as string } }
}

export async function updatePartnerCategoriesAction(partnerId: string, categoryIds: string[]): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { data: existing, error: existingError } = await supabase
    .from('partner_standard_category')
    .select('standard_category_id')
    .eq('partner_id', partnerId)
  if (existingError) return { success: false, error: existingError.message, errorCode: 'UPDATE_FAILED' }

  const existingIds = new Set((existing ?? []).map((r) => r.standard_category_id))
  const nextIds = new Set(categoryIds)
  const toAdd = categoryIds.filter((id) => !existingIds.has(id))
  const toRemove = Array.from(existingIds).filter((id) => !nextIds.has(id))

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('partner_standard_category')
      .delete()
      .eq('partner_id', partnerId)
      .in('standard_category_id', toRemove)
    if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }
  }
  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('partner_standard_category')
      .insert(toAdd.map((standard_category_id) => ({ partner_id: partnerId, standard_category_id })))
    if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }
  }

  revalidatePath(`/admin/partners/${partnerId}`)
  revalidatePath('/admin/partners')
  return { success: true }
}

// =============================================================================
// §2.5.5 문서 — 업로드/열람(2단계)/삭제
// =============================================================================
// Storage RLS note (20260829140000 §8b): storage.objects has NO admin insert/delete policy —
// only `partner_doc_owner_insert` (the partner themselves) and `partner_doc_admin_select` exist.
// So an admin session's authenticated client can read (createSignedUrl) but cannot upload or
// delete Storage objects — those two operations must go through the service_role client
// (lib/supabase/adminClient.ts), AFTER independently re-verifying the caller's admin permission
// via has_menu_permission_check (since service_role bypasses RLS entirely and performs no
// authorization of its own). The public.partner_document ROW write still goes through the
// authenticated client so RLS/the table's own policies remain the source of truth for who wrote
// what.

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

function extensionFor(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType === 'image/jpeg') return 'jpg'
  return 'png'
}

export async function uploadPartnerDocumentAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const partnerId = formData.get('partnerId')
  const docType = formData.get('docType')
  const file = formData.get('file')
  if (typeof partnerId !== 'string' || typeof docType !== 'string' || !(file instanceof File)) {
    return { success: false, error: 'invalid_input', errorCode: 'VALIDATION_ERROR' }
  }
  // Fix (qa pass, 2026-09-03): both partnerId and docType are interpolated directly into the
  // Storage path below (storagePath) before any DB-side CHECK constraint ever sees them — a
  // Server Action is a public POST endpoint independent of the UI, so a caller could otherwise
  // submit an arbitrary docType/partnerId string and land bytes outside the intended
  // p/{partnerId}/{doc_type}/ prefix. Validate the exact same shapes the DB itself requires
  // (uuid for partnerId, the doc_type CHECK's enum for docType) before either is used in a path.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(partnerId)) {
    return { success: false, error: 'invalid_partner_id', errorCode: 'VALIDATION_ERROR' }
  }
  if (!['business_registration_cert', 'portfolio', 'certification', 'other'].includes(docType)) {
    return { success: false, error: 'invalid_doc_type', errorCode: 'VALIDATION_ERROR' }
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) return { success: false, error: 'invalid_mime_type', errorCode: 'VALIDATION_ERROR' }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) return { success: false, error: 'invalid_file_size', errorCode: 'VALIDATION_ERROR' }

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) return { success: false, error: 'access_denied', errorCode: 'ACCESS_DENIED' }

  const { data: canCreate } = await supabase.rpc('has_menu_permission_check', { p_menu_code: 'partner_management', p_action: 'create' })
  if (!canCreate) return { success: false, error: 'access_denied', errorCode: 'ACCESS_DENIED' }

  const adminClient = getSupabaseAdminClient()
  if (!adminClient) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const bytes = Buffer.from(await file.arrayBuffer())
  const sha256Hash = createHash('sha256').update(bytes).digest('hex')
  const storagePath = `p/${partnerId}/${docType}/${randomUUID()}.${extensionFor(file.type)}`

  const { error: uploadError } = await adminClient.storage.from('partner-doc').upload(storagePath, bytes, { contentType: file.type })
  if (uploadError) return { success: false, error: uploadError.message, errorCode: 'UPLOAD_FAILED' }

  const { data: inserted, error: insertError } = await supabase
    .from('partner_document')
    .insert({
      partner_id: partnerId,
      doc_type: docType,
      storage_path: storagePath,
      original_filename: file.name.slice(0, 255),
      mime_type: file.type,
      file_size_bytes: file.size,
      sha256_hash: sha256Hash,
      uploaded_by_kind: 'admin',
      uploaded_by_admin_id: context.admin_user_id,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    // Best-effort cleanup — the DB row is the source of truth; an orphaned Storage object here
    // is harmless and can be swept by an out-of-band audit (same stance as partner_delete_document's
    // own comment on the reverse-order case).
    await adminClient.storage.from('partner-doc').remove([storagePath])
    return { success: false, error: insertError?.message ?? 'insert_failed', errorCode: 'UPLOAD_FAILED' }
  }

  revalidatePath(`/admin/partners/${partnerId}`)
  return { success: true, data: { id: inserted.id as string } }
}

export async function revealPartnerDocumentAction(documentId: string): Promise<ActionResult<{ url: string }>> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  // MUST call this RPC and confirm it did not raise BEFORE requesting the signed URL
  // (log_partner_document_reveal's own comment — never after).
  const { error: logError } = await supabase.rpc('log_partner_document_reveal', { p_document_id: documentId })
  if (logError) return { success: false, error: logError.message, errorCode: 'REVEAL_DENIED' }

  // Fix (qa pass, 2026-09-03): re-derive storage_path from documentId server-side instead of
  // trusting a client-supplied path. This is a Server Action — an independent POST endpoint, not
  // gated by what the UI happens to render — so a caller could otherwise pass a documentId (what
  // gets audit-logged) that doesn't match the storagePath (what actually gets signed and
  // returned), breaking the "audit log reflects what was actually revealed" guarantee the
  // privacy review's §4 PR-2 two-step reveal flow depends on.
  const { data: doc, error: docError } = await supabase
    .from('partner_document')
    .select('storage_path')
    .eq('id', documentId)
    .single()
  if (docError || !doc) return { success: false, error: docError?.message ?? 'document_not_found', errorCode: 'REVEAL_DENIED' }

  const { data, error: signError } = await supabase.storage.from('partner-doc').createSignedUrl(doc.storage_path, 120)
  if (signError || !data) return { success: false, error: signError?.message ?? 'sign_failed', errorCode: 'SIGN_FAILED' }

  return { success: true, data: { url: data.signedUrl } }
}

export async function deletePartnerDocumentAction(documentId: string, storagePath: string, partnerId: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  // Call order per partner_delete_document's comment: DB row first, Storage object second.
  const { error: rpcError } = await supabase.rpc('partner_delete_document', { p_document_id: documentId })
  if (rpcError) return { success: false, error: rpcError.message, errorCode: 'DELETE_FAILED' }

  // Fix (qa pass, 2026-09-03): the DB row is already gone by this point (partner_delete_document
  // succeeded above) — a failure here only orphans a Storage object, never data-consistency-
  // threatening, but it was silently swallowed before. Log it so it's actually discoverable
  // instead of only showing up if someone happens to audit the bucket.
  const adminClient = getSupabaseAdminClient()
  if (adminClient) {
    const { error: removeError } = await adminClient.storage.from('partner-doc').remove([storagePath])
    if (removeError) {
      console.error(`[deletePartnerDocumentAction] orphaned Storage object ${storagePath} (document ${documentId}): ${removeError.message}`)
    }
  } else {
    console.error(`[deletePartnerDocumentAction] no service_role client — orphaned Storage object ${storagePath} (document ${documentId})`)
  }

  revalidatePath(`/admin/partners/${partnerId}`)
  return { success: true }
}
