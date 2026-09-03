// Design Ref: screen-spec §4.4 (SUP-11).
import { requireSupplierSession } from '@/lib/supplier/session'
import type { PartnerDocumentRow } from '@/lib/supplier/types'
import { DocumentsForm } from './DocumentsForm'

export default async function SupplierDocumentsPage() {
  const { supabase, partner } = await requireSupplierSession()

  const { data: documents } = await supabase
    .from('partner_document')
    .select('id, doc_type, storage_path, original_filename, mime_type, file_size_bytes, created_at')
    .eq('partner_id', partner.id)
    .order('created_at', { ascending: false })

  return (
    <DocumentsForm
      partnerId={partner.id}
      businessEntityType={partner.business_entity_type}
      documents={(documents ?? []) as PartnerDocumentRow[]}
      verificationState={partner.verification_state}
      rejectionReason={partner.rejection_reason}
    />
  )
}
