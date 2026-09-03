// Design Ref: docs/02-design/features/partner-category-management.screen-spec.md §2.5.3 —
// "제출 가능 여부" checklist. Gap G-7: no public RPC wraps
// private.partner_profile_submission_gaps(), so this is a deliberate, documented TS mirror of
// that function's exact logic (supabase/migrations/20260829140000_partner_schema.sql §9). Keep
// this in sync with that SQL function if it ever changes — drift risk is accepted per the
// screen-spec's own note (§2.5.3, "이 문서는 임시로 TS 복제를 허용").
export interface PartnerForGapCheck {
  business_entity_type: string | null
  company_name_ko: string | null
  business_registration_number: string | null
  supported_languages: string[] | null
  overseas_experience: boolean | null
  company_intro_text: string | null
  representative_offerings: unknown[] | null
  vertical: string | null
  moq: string | null
  lead_time_days: number | null
  oem_odm_type: string | null
  service_types: string[] | null
  project_min_size: string | null
  pricing_model: string | null
  standard_lead_time: string | null
  reference_projects: unknown[] | null
}

export interface SubmissionGapItem {
  key: string
  label: string
  satisfied: boolean
}

export function computeSubmissionGaps(
  partner: PartnerForGapCheck,
  hasBusinessRegistrationCertDocument: boolean,
  hasContact: boolean,
): SubmissionGapItem[] {
  const items: SubmissionGapItem[] = [
    { key: 'business_entity_type', label: '법인/개인사업자 구분', satisfied: !!partner.business_entity_type },
    { key: 'company_name_ko', label: '회사명(한글)', satisfied: !!partner.company_name_ko },
    { key: 'business_registration_number', label: '사업자등록번호', satisfied: !!partner.business_registration_number },
    { key: 'supported_languages', label: '대응 가능 언어', satisfied: (partner.supported_languages?.length ?? 0) > 0 },
    { key: 'overseas_experience', label: '해외거래 경험 응답', satisfied: partner.overseas_experience !== null },
    { key: 'company_intro_text', label: '회사소개', satisfied: !!partner.company_intro_text },
    {
      key: 'representative_offerings',
      label: '대표 제품/서비스(1개 이상)',
      satisfied: (partner.representative_offerings?.length ?? 0) > 0,
    },
    { key: 'vertical', label: '버티컬 구분', satisfied: !!partner.vertical },
  ]

  if (partner.vertical === 'product') {
    items.push(
      { key: 'moq', label: 'MOQ(최소주문수량)', satisfied: !!partner.moq },
      { key: 'lead_time_days', label: '리드타임(일)', satisfied: partner.lead_time_days !== null },
      { key: 'oem_odm_type', label: 'OEM/ODM/자사브랜드 구분', satisfied: !!partner.oem_odm_type },
    )
  } else if (partner.vertical === 'service') {
    items.push(
      { key: 'service_types', label: '서비스 유형(1개 이상)', satisfied: (partner.service_types?.length ?? 0) > 0 },
      { key: 'project_min_size', label: '최소 프로젝트 규모', satisfied: !!partner.project_min_size },
      { key: 'pricing_model', label: '과금 모델', satisfied: !!partner.pricing_model },
      { key: 'standard_lead_time', label: '표준 소요기간', satisfied: !!partner.standard_lead_time },
      { key: 'reference_projects', label: '레퍼런스 프로젝트(1개 이상)', satisfied: (partner.reference_projects?.length ?? 0) > 0 },
    )
  }

  items.push(
    { key: 'business_registration_cert_document', label: '사업자등록증 파일', satisfied: hasBusinessRegistrationCertDocument },
    { key: 'contact', label: '담당자 연락처', satisfied: hasContact },
  )

  return items
}
