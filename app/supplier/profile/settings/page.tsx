// Design Ref: screen-spec §4.6/§4.7 (SUP-13/SUP-14) + backend-implementation-notes.md §1
// (UI-B3 disabled conditions need verification_state + business_registration_cert presence).
import { requireSupplierSession } from '@/lib/supplier/session'
import type { ConsentsByType } from '@/lib/supplier/types'
import { SettingsForm } from './SettingsForm'

export default async function SupplierSettingsPage() {
  const { supabase, partner } = await requireSupplierSession()

  const [{ count: bizCertCount }, { data: consentsData }] = await Promise.all([
    supabase
      .from('partner_document')
      .select('id', { count: 'exact', head: true })
      .eq('partner_id', partner.id)
      .eq('doc_type', 'business_registration_cert'),
    supabase.rpc('get_own_partner_consents'),
  ])

  return (
    <SettingsForm
      partnerId={partner.id}
      verificationState={partner.verification_state}
      publicListingState={partner.public_listing_state}
      businessEntityType={partner.business_entity_type}
      hasBizCertDocument={(bizCertCount ?? 0) > 0}
      consents={(consentsData ?? {}) as ConsentsByType}
    />
  )
}
