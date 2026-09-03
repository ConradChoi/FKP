// Design Ref: screen-spec §4.3 (SUP-10).
import { requireSupplierSession } from '@/lib/supplier/session'
import { fetchCategoryOptions } from '@/app/admin/(protected)/partners/categoryOptions'
import { CapabilityForm } from './CapabilityForm'

export default async function SupplierCapabilityPage() {
  const { supabase, partner } = await requireSupplierSession()

  const [categoryOptions, { data: selectedRows }] = await Promise.all([
    fetchCategoryOptions(supabase),
    supabase.from('partner_standard_category').select('standard_category_id').eq('partner_id', partner.id),
  ])

  const selectedCategoryIds = (selectedRows ?? []).map((r) => r.standard_category_id as string)

  return <CapabilityForm partner={partner} categoryOptions={categoryOptions} selectedCategoryIds={selectedCategoryIds} />
}
