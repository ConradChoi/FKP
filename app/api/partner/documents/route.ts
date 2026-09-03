// Design Ref: docs/03-security/partner-supplier-app-ui-privacy-review.md §4.1
// (UI-B4) — the numbered steps in the comments below are that section's
// "권장 조치 (blocking)" 8-step procedure, implemented in the same order.
// Mirrors the server-side upload precedent already established for the admin
// path (app/admin/(protected)/partners/[id]/actions.ts uploadPartnerDocumentAction,
// ~lines 257-324: server-computed SHA-256, server-generated storage_path,
// service_role Storage upload, cleanup-on-failure) — same shape, new magic-byte
// check added (the admin path does not have one either; out of this ticket's
// scope, flagged for a follow-up in the backend-implementation-notes doc).
import { randomUUID, createHash } from 'crypto'
import { NextResponse } from 'next/server'
// NOTE (frontend-developer, 2026-09-04): this route originally imported the /admin server
// client (lib/supabase/serverAuthClient.ts), which reads the DEFAULT-named Supabase Auth
// cookie. That default name is also what /admin's own login uses — and screen-spec §1.4
// requires /supplier's session cookie to be namespaced separately (lib/supabase/
// supplierBrowserClient.ts's SUPPLIER_AUTH_COOKIE_NAME) so the two logins don't collide in the
// same browser. Using the admin client here would make this route 401 on every legitimate
// partner request (it would be looking for a cookie the partner's browser client never sets).
// Fixed to use the /supplier-scoped server client below.
import { getSupplierAuthServerClient } from '@/lib/supabase/supplierServerAuthClient'
import { getSupabaseAdminClient } from '@/lib/supabase/adminClient'
import { detectDocumentMimeType, extensionForDocumentMimeType } from '@/lib/forms/fileSignature'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB, matches partner_document's own CHECK
const MAX_PARTNER_TOTAL_BYTES = 50 * 1024 * 1024 // UI-R3
const ALLOWED_DOC_TYPES = new Set(['business_registration_cert', 'portfolio', 'certification', 'other'])

export async function POST(request: Request) {
  const authClient = await getSupplierAuthServerClient()
  if (!authClient) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })

  const {
    data: { user },
  } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Step 1: session verification + partner_id from a SERVER-SIDE lookup —
  // never trust a client-supplied partnerId for this.
  const { data: ids, error: idsError } = await authClient.rpc('get_own_partner_id').single()
  if (idsError || !ids) return NextResponse.json({ error: 'access_denied' }, { status: 403 })
  const { partner_account_id: accountId, partner_id: partnerId } = ids as {
    partner_account_id: string | null
    partner_id: string | null
  }
  if (!accountId || !partnerId) return NextResponse.json({ error: 'access_denied' }, { status: 403 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const docType = formData.get('docType')
  const file = formData.get('file')
  if (typeof docType !== 'string' || !ALLOWED_DOC_TYPES.has(docType)) {
    return NextResponse.json({ error: 'invalid_doc_type' }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'invalid_file' }, { status: 400 })
  }

  // Step 2: capacity — per-file size, then per-partner total (UI-R3, 50MB).
  if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: 'invalid_file_size' }, { status: 400 })
  }

  const adminClient = getSupabaseAdminClient()
  if (!adminClient) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })

  const { data: existingDocs, error: existingDocsError } = await adminClient
    .from('partner_document')
    .select('file_size_bytes')
    .eq('partner_id', partnerId)
  if (existingDocsError) return NextResponse.json({ error: 'quota_check_failed' }, { status: 500 })

  const currentTotal = (existingDocs ?? []).reduce(
    (sum, row) => sum + (typeof row.file_size_bytes === 'number' ? row.file_size_bytes : 0),
    0,
  )
  if (currentTotal + file.size > MAX_PARTNER_TOTAL_BYTES) {
    return NextResponse.json({ error: 'partner_storage_quota_exceeded' }, { status: 400 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())

  // Step 3: magic-byte allowlist check — the client's declared file.type /
  // filename extension play NO role in this decision (lib/forms/fileSignature.ts).
  const detectedMimeType = detectDocumentMimeType(bytes)
  if (!detectedMimeType) {
    return NextResponse.json({ error: 'invalid_file_content' }, { status: 400 })
  }

  // Step 4: server-computed hash — never trust a client-supplied sha256Hash.
  const sha256Hash = createHash('sha256').update(bytes).digest('hex')

  // Step 5: server-generated path. partnerId here is the value resolved in
  // step 1 (this session's own partner), never a client-supplied one — this
  // is what makes the storage_path/partner_id CHECK constraint (UI-R2)
  // meaningful rather than just trusting the same untrusted input twice.
  const storagePath = `p/${partnerId}/${docType}/${randomUUID()}.${extensionForDocumentMimeType(detectedMimeType)}`

  // Step 6: service_role Storage upload.
  const { error: uploadError } = await adminClient.storage
    .from('partner-doc')
    .upload(storagePath, bytes, { contentType: detectedMimeType })
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message ?? 'upload_failed' }, { status: 500 })
  }

  // Step 7: metadata row via the sanctioned SECURITY DEFINER RPC (never a raw
  // client-facing table insert — the RLS policy that used to allow that was
  // dropped by this same migration; see partner_record_document_upload's
  // own comment for why).
  const { data: documentId, error: insertError } = await adminClient.rpc('partner_record_document_upload', {
    p_partner_id: partnerId,
    p_doc_type: docType,
    p_storage_path: storagePath,
    p_original_filename: file.name.slice(0, 255),
    p_mime_type: detectedMimeType,
    p_file_size_bytes: file.size,
    p_sha256_hash: sha256Hash,
    p_uploaded_by_partner_account_id: accountId,
  })

  // Step 8: cleanup on failure (admin action's own precedent, ~lines 314-319).
  if (insertError || !documentId) {
    await adminClient.storage.from('partner-doc').remove([storagePath])
    return NextResponse.json({ error: insertError?.message ?? 'upload_failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: documentId })
}

// Design Ref: docs/03-security/partner-supplier-app-ui-privacy-review.md §0.3/G-S3
// (screen-spec) — "문서 삭제는 순수 클라이언트 호출로 끝나지 않는다": the DB row can be
// deleted directly by the partner's own session (public.partner_delete_document is GRANTed to
// `authenticated`, ownership-checked inside the function), but the Storage object itself has
// no `authenticated` DELETE policy at all (only a trusted service_role caller can remove it,
// per that function's own comment). This handler is that trusted caller — same "DB row first,
// then Storage object" order partner_delete_document's comment documents, so a failure between
// the two steps only ever leaves a harmless orphaned Storage object, never a dangling metadata
// row pointing at nothing.
export async function DELETE(request: Request) {
  const authClient = await getSupplierAuthServerClient()
  if (!authClient) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })

  const {
    data: { user },
  } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: ids, error: idsError } = await authClient.rpc('get_own_partner_id').single()
  if (idsError || !ids) return NextResponse.json({ error: 'access_denied' }, { status: 403 })
  const { partner_id: partnerId } = ids as { partner_account_id: string | null; partner_id: string | null }
  if (!partnerId) return NextResponse.json({ error: 'access_denied' }, { status: 403 })

  let body: { documentId?: unknown; storagePath?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const documentId = typeof body.documentId === 'string' ? body.documentId : ''
  const storagePath = typeof body.storagePath === 'string' ? body.storagePath : ''
  if (!documentId || !storagePath) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  // Never trust a client-supplied path beyond "does it fall inside MY OWN folder" — partnerId
  // above is server-resolved from the session, never client input (same principle as the POST
  // handler's step 1/5). This bounds the blast radius of a malformed/tampered storagePath to
  // the caller's own folder, where a document row's RLS-scoped SELECT already made it visible.
  if (!storagePath.startsWith(`p/${partnerId}/`)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  // Step 1: DB row, via the user's OWN session — partner_delete_document's ownership check
  // (owns_partner) is the real authorization boundary here, not this route's own logic.
  const { error: deleteError } = await authClient.rpc('partner_delete_document', { p_document_id: documentId })
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message ?? 'delete_failed' }, { status: 400 })
  }

  // Step 2: Storage object, via service_role (no `authenticated` DELETE policy exists on
  // storage.objects for this bucket). A failure here is logged but not surfaced as a user-
  // facing error — the metadata row is already gone, which is what the UI shows; an orphaned
  // Storage object is the same "harmless, cleaned up out-of-band" case the RPC's own comment
  // already accepts.
  const adminClient = getSupabaseAdminClient()
  if (adminClient) {
    const { error: removeError } = await adminClient.storage.from('partner-doc').remove([storagePath])
    if (removeError) {
      console.error(`partner.document_delete: storage.remove failed for ${storagePath}: ${removeError.message}`)
    }
  }

  return NextResponse.json({ success: true })
}
