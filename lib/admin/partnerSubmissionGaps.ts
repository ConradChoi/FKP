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
  // 파트너 표준 카테고리 UX 개선(2026-09-12, screen-spec §6/D-6) — 주 카테고리
  // (role='primary') 1개 필수 게이트. 기본값 `true`(만족한 것으로 간주)는 이
  // 백엔드 변경과 동시에 병렬로 진행 중인 프론트엔드 작업이 기존 3-인자 호출부
  // (app/supplier/profile/layout.tsx, app/admin/(protected)/partners/[id]/
  // BasicInfoTab.tsx)를 아직 갱신하지 않은 과도기에도 빌드/런타임을 깨지 않기
  // 위함이다 — 게이트를 실제로 켜려면 호출부가 partner_standard_category에서
  // role='primary' 존재 여부를 조회해 이 인자로 명시적으로 넘겨야 한다. SQL
  // 미러(private.partner_profile_submission_gaps, 20260912110000)는 이미
  // 무조건 이 게이트를 적용하므로, 실제 제출 차단(partner_submit_for_review())은
  // 이 TS 인자의 기본값과 무관하게 서버에서 강제된다 — 이 TS 함수는 UI 체크리스트
  // 표시용일 뿐 최종 방어선이 아니다(SQL 함수 자신의 코멘트와 동일 원칙).
  hasPrimaryCategory = true,
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
    // screen-spec §6/D-6 — SQL 미러(private.partner_profile_submission_gaps)와
    // 동일한 key('standard_category_primary')를 사용해 lib/supplier/tabGaps.ts의
    // GAP_KEY_TO_TAB 매핑과 정합을 유지한다.
    { key: 'standard_category_primary', label: '표준 카테고리(주 1개)', satisfied: hasPrimaryCategory },
  )

  return items
}
