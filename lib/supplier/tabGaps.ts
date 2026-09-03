// Design Ref: docs/02-design/features/partner-supplier-app.ui-spec.md §6.1 — "이 매핑
// 테이블(필드 키 -> 탭 ID)은 체크리스트 카드의 '항목 클릭 시 해당 탭으로 이동' 기능과 동일한
// 테이블을 공유해야 한다". Single source of truth for both SubmissionChecklist (§2.2 sidebar
// card) and ProfileTabs's per-tab "미입력" dot indicator (§6.1). Keys match
// lib/admin/partnerSubmissionGaps.ts's computeSubmissionGaps() SubmissionGapItem.key exactly.
export type SupplierTabId = 'basic' | 'capability' | 'documents' | 'contact' | 'settings'

export const GAP_KEY_TO_TAB: Record<string, SupplierTabId> = {
  business_entity_type: 'basic',
  company_name_ko: 'basic',
  business_registration_number: 'basic',
  supported_languages: 'basic',
  overseas_experience: 'basic',
  company_intro_text: 'basic',
  representative_offerings: 'basic',
  vertical: 'basic',
  moq: 'capability',
  lead_time_days: 'capability',
  oem_odm_type: 'capability',
  service_types: 'capability',
  project_min_size: 'capability',
  pricing_model: 'capability',
  standard_lead_time: 'capability',
  reference_projects: 'capability',
  business_registration_cert_document: 'documents',
  contact: 'contact',
}

export function tabsWithUnmetGaps(unmetKeys: string[]): Set<SupplierTabId> {
  const tabs = new Set<SupplierTabId>()
  for (const key of unmetKeys) {
    const tab = GAP_KEY_TO_TAB[key]
    if (tab) tabs.add(tab)
  }
  return tabs
}
