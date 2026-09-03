// Design Ref: docs/02-design/features/partner-category-management.screen-spec.md §2 —
// value sets mirror the CHECK constraints in supabase/migrations/20260829140000_partner_schema.sql
// exactly (same convention as lib/admin/labels.ts for the requests pipeline — keep in sync if
// those constraints ever change).
import type { BadgeTone } from '@/components/admin/StatusBadge'

export const VERIFICATION_STATE_LABELS: Record<string, string> = {
  draft: '임시저장',
  submitted: '검증대기',
  under_review: '검증대기',
  verified: '승인완료',
  rejected: '반려',
  suspended: '중단됨',
}

// screen-spec §2.2.2 G-6: submitted/under_review are shown as a single "검증대기" bucket —
// no UI distinguishes them (no RPC transitions submitted -> under_review).
export const VERIFICATION_STATE_TONE: Record<string, BadgeTone> = {
  draft: 'neutral',
  submitted: 'info',
  under_review: 'warning',
  verified: 'success',
  rejected: 'error',
  suspended: 'neutral',
}

export const PUBLIC_LISTING_LABELS: Record<string, string> = {
  off: '비공개',
  on: '공개중',
  suspended: '중단됨',
}

export const PUBLIC_LISTING_TONE: Record<string, BadgeTone> = {
  off: 'neutral',
  on: 'success',
  suspended: 'warning',
}

export const INTAKE_SOURCE_LABELS: Record<string, string> = {
  self_service: '자가등록',
  admin_entry: '예외입력',
}

export const BUSINESS_ENTITY_TYPE_LABELS: Record<string, string> = {
  corporation: '법인',
  sole_proprietor: '개인사업자',
}

export const VERTICAL_LABELS: Record<string, string> = {
  product: '제품',
  service: '서비스',
}

export const EMPLOYEE_BAND_LABELS: Record<string, string> = {
  '1-9': '1~9명',
  '10-49': '10~49명',
  '50-99': '50~99명',
  '100-299': '100~299명',
  '300+': '300명 이상',
}

export const OEM_ODM_LABELS: Record<string, string> = {
  oem: 'OEM',
  odm: 'ODM',
  own_brand: '자사브랜드',
}

export const PRICING_MODEL_LABELS: Record<string, string> = {
  project: '프로젝트',
  retainer: '월정액',
  hourly: '시간',
}

export const REMOTE_ONSITE_LABELS: Record<string, string> = {
  remote: '원격',
  onsite: '온사이트',
  both: '모두',
}

export const CONSENT_METHOD_LABELS: Record<string, string> = {
  online_self: '본인 온라인',
  phone: '전화',
  in_person: '대면',
  email: '이메일',
  paper: '서면',
}

export const EVIDENCE_KIND_LABELS: Record<string, string> = {
  none: '없음',
  call_log: '통화기록',
  signed_form: '서명양식',
  email_thread: '이메일스레드',
  recording: '녹취',
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  business_registration_cert: '사업자등록증',
  portfolio: '포트폴리오',
  certification: '인증서',
  other: '기타',
}

export const CONSENT_TYPE_LABELS: Record<string, string> = {
  terms: '이용약관',
  privacy: '개인정보',
  public_listing: '공개노출',
  third_party_share: '제3자제공',
  marketing: '마케팅',
}

export const LANGUAGE_OPTIONS = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: '영어' },
  { value: 'ja', label: '일본어' },
  { value: 'zh', label: '중국어' },
]

export const REGION_OPTIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
]

export const SERVICE_TYPE_OPTIONS = [
  { value: 'marketing_pr', label: '마케팅/PR' },
  { value: 'it_dev', label: 'IT·웹앱개발' },
  { value: 'ai_automation', label: 'AI자동화' },
  { value: 'content', label: '콘텐츠' },
  { value: 'translation', label: '번역·로컬라이제이션' },
]

// Design Ref: screen-spec §2.5.7 — audit_log timeline labels for the actions
// admin_partner.*/partner.* that can appear on a partner's target_id.
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'admin_partner.list': '목록 조회',
  'admin_partner.view': '상세 조회',
  'admin_partner.contact_reveal': '연락처 원문 열람',
  'admin_partner.document_reveal': '문서 열람',
  'admin_partner.update': '정보 수정',
  'admin_partner.verify': '검증 승인',
  'admin_partner.reject': '반려',
  'admin_partner.suspend_listing': '공개 중단',
  'admin_partner.admin_entry_create': '예외등록(신규)',
  'admin_partner.consent_evidence_write': '동의 증빙 기록',
  'admin_partner.export': '내보내기',
  'admin_partner.export_denied': '내보내기 거부됨',
  'partner.signup': '파트너 가입',
  'partner.profile_update': '본인 정보 수정',
  'partner.submit_for_review': '본인 검증 제출',
  'partner.consent_grant': '동의',
  'partner.consent_revoke': '동의 철회',
  'partner.public_listing_on': '공개 전환',
  'partner.public_listing_off': '공개 중단(본인)',
  'partner.document_upload': '문서 업로드',
  'partner.document_delete': '문서 삭제',
  'partner.withdraw': '탈퇴',
}

export function label(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return '-'
  return map[value] ?? value
}
