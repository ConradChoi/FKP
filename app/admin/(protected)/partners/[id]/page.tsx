// Design Ref: screen-spec §2.5 (상세 화면 — 헤더 §2.5.1, 탭 구성 §2.5.2). Server Component data
// fetching pattern from leads/[id]/page.tsx; all 6 tab bodies are delegated to
// PartnerDetailTabs (client) since every tab needs interactivity (edit forms, reveal buttons,
// dirty-state saves).
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { StatusBadge } from '@/components/admin/StatusBadge'
import {
  VERIFICATION_STATE_LABELS,
  VERIFICATION_STATE_TONE,
  PUBLIC_LISTING_LABELS,
  PUBLIC_LISTING_TONE,
  INTAKE_SOURCE_LABELS,
} from '@/lib/admin/partnerLabels'
import { fetchCategoryOptions } from '../categoryOptions'
import { PartnerDetailTabs } from './PartnerDetailTabs'
import { PartnerHeaderActions } from './PartnerHeaderActions'

export interface PartnerDetail {
  id: string
  intake_source: string
  verification_state: string
  owner_account_id: string | null
  business_entity_type: string | null
  referred_by: string | null
  referred_at: string | null
  collection_source_detail: string | null
  consent_deadline_at: string | null
  rejected_at: string | null
  rejection_reason: string | null
  pii_purged_at: string | null

  company_name_ko: string | null
  company_name_en: string | null
  business_registration_number: string | null
  founded_year: number | null
  employee_band: string | null
  location_region: string | null
  website_url: string | null

  supported_languages: string[]
  overseas_experience: boolean | null
  overseas_experience_countries: string[]

  company_intro_text: string | null
  company_intro_locale: string | null
  representative_offerings: { name: string; description: string }[]
  certifications: string[]

  vertical: string | null

  moq: string | null
  price_band: string | null
  lead_time_days: number | null
  sample_available: boolean | null
  sample_terms: string | null
  oem_odm_type: string | null
  export_record: string | null

  service_types: string[]
  project_min_size: string | null
  pricing_model: string | null
  standard_lead_time: string | null
  reference_projects: { client_industry: string; deliverable: string; anonymized: boolean }[]
  team_size_band: string | null
  remote_onsite: string | null

  public_listing_state: string
  capability_completeness_pct: number

  contact_name_masked: string | null
  contact_email_masked: string | null
  contact_phone_masked: string | null

  created_at: string
  updated_at: string
}

export interface PartnerDocumentRecord {
  id: string
  doc_type: string
  storage_path: string
  original_filename: string
  mime_type: string
  file_size_bytes: number
  uploaded_by_kind: string
  purge_after: string | null
  pending_deletion_at: string | null
  created_at: string
}

export interface PartnerConsentRecord {
  id: string
  consent_type: string
  granted: boolean
  method: string
  collected_at: string
  recorded_at: string
  evidence_kind: string
}

export interface AuditLogEntry {
  id: number
  occurred_at: string
  action: string
  actor_kind: string
  actor_name_snapshot: string | null
  result: string
}

export default async function PartnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string }>
}) {
  const { id } = await params
  const { created } = await searchParams
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  const { data: partner, error } = await supabase.from('partner').select('*').eq('id', id).single()
  if (error || !partner) notFound()

  // Fix (qa pass, 2026-09-03) — 화면정의서 §1.2 / E8: 상세 화면의 승인/반려/검증제출/공개전환/
  // 공개중단/Capability저장/문서업로드 버튼 전부가 권한과 무관하게 항상 노출되고 있었다.
  const [{ data: canUpdate }, { data: canCreate }] = await Promise.all([
    supabase.rpc('has_menu_permission_check', { p_menu_code: 'partner_management', p_action: 'update' }),
    // Fix (qa re-review, 2026-09-03) — 문서 업로드는 partner_document_admin_insert 정책이
    // 'update'가 아니라 'create' 권한을 요구한다(20260829140000 §8a). update만 있고 create가
    // 없는 역할은 업로드 버튼을 볼 수 있어도 서버가 항상 거부하는 회귀가 있었음 — 별도로 조회.
    supabase.rpc('has_menu_permission_check', { p_menu_code: 'partner_management', p_action: 'create' }),
  ])

  const [{ data: documents }, { data: consents }, { data: categoryLinks }, { data: auditEntries }, categoryOptions] = await Promise.all([
    supabase
      .from('partner_document')
      .select('id, doc_type, storage_path, original_filename, mime_type, file_size_bytes, uploaded_by_kind, purge_after, pending_deletion_at, created_at')
      .eq('partner_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('partner_consent')
      .select('id, consent_type, granted, method, collected_at, recorded_at, evidence_kind')
      .eq('partner_id', id)
      .order('recorded_at', { ascending: false }),
    supabase.from('partner_standard_category').select('standard_category_id').eq('partner_id', id),
    supabase
      .from('audit_log')
      .select('id, occurred_at, action, actor_kind, actor_name_snapshot, result')
      .eq('target_table', 'partner')
      .eq('target_id', id)
      .order('occurred_at', { ascending: false })
      .limit(200),
    fetchCategoryOptions(supabase),
  ])

  let referredByName: string | null = null
  if (partner.referred_by) {
    const { data: admin } = await supabase.from('admin_user').select('display_name').eq('id', partner.referred_by).maybeSingle()
    referredByName = admin?.display_name ?? null
  }

  const hasContact = !!(partner.contact_name_masked && partner.contact_email_masked)
  const rejectedPiiPurged =
    partner.verification_state === 'rejected' &&
    partner.rejected_at &&
    Date.now() - new Date(partner.rejected_at).getTime() > 90 * 24 * 60 * 60 * 1000

  // §2.5.1 — "검증 이후 정보가 수정됨" 배지: verified 상태이고, 마지막 admin_partner.verify
  // 감사기록 시각보다 updated_at이 이후인 경우(E1: 자동 재검증 없음 + 육안 플래그만, §4.1).
  const lastVerifyEntry = (auditEntries ?? []).find((a) => a.action === 'admin_partner.verify')
  const modifiedSinceVerify =
    partner.verification_state === 'verified' && lastVerifyEntry && new Date(partner.updated_at) > new Date(lastVerifyEntry.occurred_at)

  return (
    <div>
      <Link href="/admin/partners" className="admin-body-sm text-primary-600 hover:underline">
        ← 공급사 관리 목록으로
      </Link>

      {created === '1' && (
        <p className="mt-3 rounded-input bg-primary-50 px-3 py-2 admin-body-sm text-primary-700">
          기본정보가 저장되었습니다. 검증 제출을 위해 나머지 항목을 입력해주세요.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="admin-heading-2 text-neutral-900">{partner.company_name_ko || '(회사명 미입력)'}</h1>
        {partner.company_name_en && <span className="admin-body text-neutral-400">{partner.company_name_en}</span>}
        <StatusBadge tone={VERIFICATION_STATE_TONE[partner.verification_state]} label={VERIFICATION_STATE_LABELS[partner.verification_state]} />
        <StatusBadge tone={PUBLIC_LISTING_TONE[partner.public_listing_state]} label={PUBLIC_LISTING_LABELS[partner.public_listing_state]} />
        <span className="admin-body-sm text-neutral-400">{INTAKE_SOURCE_LABELS[partner.intake_source]}</span>
      </div>

      {partner.intake_source === 'admin_entry' && (
        <p className="mt-1 admin-body-sm text-neutral-500">
          {referredByName ?? '(권한 밖 계정)'}이(가) {partner.referred_at ? new Date(partner.referred_at).toLocaleString('ko-KR') : ''} 등록
        </p>
      )}

      {partner.verification_state === 'rejected' && partner.rejection_reason && (
        <p className="mt-3 rounded-input bg-error-100 px-3 py-2 admin-body-sm text-error">반려 사유: {partner.rejection_reason}</p>
      )}

      {modifiedSinceVerify && (
        <a href="#history" className="mt-3 block rounded-input bg-accent-100 px-3 py-2 admin-body-sm text-accent-700 hover:underline">
          검증 이후 정보가 수정됨 — 변경이력에서 확인하기
        </a>
      )}

      {canUpdate && (
        <PartnerHeaderActions partnerId={partner.id} verificationState={partner.verification_state} intakeSource={partner.intake_source} />
      )}

      <div className="mt-6">
        <PartnerDetailTabs
          partner={partner as PartnerDetail}
          documents={(documents ?? []) as PartnerDocumentRecord[]}
          consents={(consents ?? []) as PartnerConsentRecord[]}
          auditEntries={(auditEntries ?? []) as AuditLogEntry[]}
          categoryOptions={categoryOptions}
          selectedCategoryIds={(categoryLinks ?? []).map((c) => c.standard_category_id)}
          canAccessPii={!!context.can_access_pii}
          hasContact={hasContact}
          rejectedPiiPurged={!!rejectedPiiPurged}
          canUpdate={!!canUpdate}
          canCreateDocument={!!canCreate}
        />
      </div>
    </div>
  )
}
