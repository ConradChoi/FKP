// Design Ref: Admin UI is Korean-only (E3-R13), separate from lib/i18n (en/ja, User-facing).
// Value sets mirror the CHECK constraints in supabase/migrations/20260824120000_phase1_requests_pipeline.sql
// exactly — keep in sync if those constraints ever change.

export const STATUS_LABELS: Record<string, string> = {
  new: '신규접수',
  reviewing: '검토중',
  matching: '파트너매칭중',
  matched: '매칭완료',
  on_hold: '보류',
  closed: '종료',
}

export const STATUS_ORDER = ['new', 'reviewing', 'matching', 'matched', 'on_hold', 'closed'] as const

export const CATEGORY_LABELS: Record<string, string> = {
  education: '교육 & 에듀테크',
  'it-ai': 'IT & AI',
  'content-media': '콘텐츠 & 미디어',
  'beauty-lifestyle': '뷰티 & 라이프스타일',
  'business-services': '비즈니스 서비스',
}

export const PARTNER_TYPE_LABELS: Record<string, string> = {
  purchase: '제품/서비스 구매',
  partnership: '비즈니스 파트너십',
  license: '콘텐츠/기술 라이선스',
  other: '기타',
}

export const BUDGET_LABELS: Record<string, string> = {
  'under-500': '$500 미만',
  '500-1500': '$500–$1,500',
  '1500-3000': '$1,500–$3,000',
  'over-3000': '$3,000 이상',
  'not-sure': '미정',
}

export const TIMELINE_LABELS: Record<string, string> = {
  asap: '최대한 빨리',
  'within-1-month': '1개월 이내',
  '1-3-months': '1~3개월',
  '3-6-months': '3~6개월',
  flexible: '유동적',
}

export const ENGLISH_SPEAKING_LABELS: Record<string, string> = {
  required: '필수',
  preferred: '선호(필수 아님)',
  'not-needed': '불필요',
}

export function label(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return '-'
  return map[value] ?? value
}
