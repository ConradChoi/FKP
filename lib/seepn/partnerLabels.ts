// Design Ref: docs/02-design/features/seepn-buyer-web-p5a.screen-spec.md §1.1 "재사용 자산" —
// REGION_OPTIONS/LANGUAGE_OPTIONS/SERVICE_TYPE_OPTIONS/VERTICAL_LABELS values are reused as-is
// from lib/admin/partnerLabels.ts (same underlying CHECK constraints), but the buyer-facing
// LABEL TEXT is kept as its own copy here — screen-spec §1.1 explicitly says "값(value) 자체는
// 그대로 재사용" while allowing the label tone to differ (buyer UI, not Admin table headers).
import {
  LANGUAGE_OPTIONS as ADMIN_LANGUAGE_OPTIONS,
  REGION_OPTIONS as ADMIN_REGION_OPTIONS,
  SERVICE_TYPE_OPTIONS as ADMIN_SERVICE_TYPE_OPTIONS,
} from '@/lib/admin/partnerLabels'

export const LANGUAGE_OPTIONS = ADMIN_LANGUAGE_OPTIONS
export const REGION_OPTIONS = ADMIN_REGION_OPTIONS
export const SERVICE_TYPE_OPTIONS = ADMIN_SERVICE_TYPE_OPTIONS

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
  both: '원격/온사이트 모두',
}

export const INQUIRY_STATUS_LABELS: Record<string, string> = {
  new: '신규',
  in_progress: '처리중',
  closed: '완료',
}

export function label(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return '-'
  return map[value] ?? value
}

export function serviceTypeLabel(value: string): string {
  return SERVICE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value
}

export function languageLabel(value: string): string {
  return LANGUAGE_OPTIONS.find((o) => o.value === value)?.label ?? value
}
