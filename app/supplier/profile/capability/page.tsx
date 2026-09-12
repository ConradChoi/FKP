// Design Ref: screen-spec §4.3 (SUP-10).
import { requireSupplierSession } from '@/lib/supplier/session'
import { fetchCategoryOptions } from '@/app/admin/(protected)/partners/categoryOptions'
import { CapabilityForm } from './CapabilityForm'

export default async function SupplierCapabilityPage() {
  const { supabase, partner } = await requireSupplierSession()

  const [categoryOptions, { data: selectedRows }] = await Promise.all([
    fetchCategoryOptions(supabase),
    // Design Ref: category-picker-redesign.screen-spec.md §9 — 파트너 화면은 role이 붙은
    // 행만 조회한다(레거시 초과분 role=null은 이 화면에서 보이지 않아야 함).
    supabase.from('partner_standard_category').select('standard_category_id, role').eq('partner_id', partner.id).in('role', ['primary', 'sub']),
  ])

  const rows = selectedRows ?? []
  const primaryCategoryId = (rows.find((r) => r.role === 'primary')?.standard_category_id as string | undefined) ?? null
  const subCategoryIds = rows.filter((r) => r.role === 'sub').map((r) => r.standard_category_id as string)

  return (
    <CapabilityForm
      partner={partner}
      categoryOptions={categoryOptions}
      initialCategorySelection={{ primaryId: primaryCategoryId, subIds: subCategoryIds }}
    />
  )
}
