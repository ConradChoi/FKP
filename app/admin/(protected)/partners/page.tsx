// Design Ref: docs/02-design/features/partner-category-management.screen-spec.md §2.2
// (목록 화면 — 모니터링 바/상태 탭/필터바/테이블). leads/page.tsx의 서버 컴포넌트 데이터 페칭
// 패턴을 그대로 따르되, 상태 필터는 탭(§2.2.2)이 verification_state 5종 중 "검증대기"만
// submitted+under_review 두 값을 묶어서 처리한다(G-6).
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { Avatar } from '@/components/admin/Avatar'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { ProgressBar } from '@/components/admin/ProgressBar'
import {
  VERIFICATION_STATE_LABELS,
  VERIFICATION_STATE_TONE,
  PUBLIC_LISTING_LABELS,
  PUBLIC_LISTING_TONE,
  INTAKE_SOURCE_LABELS,
  VERTICAL_LABELS,
  BUSINESS_ENTITY_TYPE_LABELS,
} from '@/lib/admin/partnerLabels'
import { PartnerStatusTabs } from './PartnerStatusTabs'
import { PartnerFilters, type PartnerFilterValues } from './PartnerFilters'
import { VerificationRowActions } from './VerificationRowActions'
import { fetchCategoryOptions } from './categoryOptions'

const PAGE_SIZE = 20
const ADMIN_ENTRY_WARN_THRESHOLD = 0.2 // screen-spec §2.2.1 — OQ-S4, PSO 권고값 잠정 채택

interface SearchParams {
  state?: string
  q?: string
  vertical?: string
  region?: string
  languages?: string
  overseas?: string
  intakeSource?: string
  category?: string
  sort?: string
  page?: string
}

interface PartnerListRow {
  id: string
  company_name_ko: string | null
  company_name_en: string | null
  vertical: string | null
  business_entity_type: string | null
  verification_state: string
  public_listing_state: string
  intake_source: string
  capability_completeness_pct: number
  created_at: string
  consent_deadline_at: string | null
}

export default async function PartnersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)

  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  // Fix (qa pass, 2026-09-03) — 화면정의서 §1.2 / qa-reviewer 필수 점검 E8: 서버(RLS/RPC)는
  // 이미 update/create 권한을 재검증하지만, 프론트 버튼 자체는 권한과 무관하게 항상 노출되고
  // 있었다. read 전용 역할이 승인/반려/신규등록 버튼을 클릭하면 원인 불명 에러만 보게 되는
  // 문제 — has_menu_permission_check로 여기서 한 번만 조회해 하위 컴포넌트에 내려준다.
  const [{ data: canUpdate }, { data: canCreate }] = await Promise.all([
    supabase.rpc('has_menu_permission_check', { p_menu_code: 'partner_management', p_action: 'update' }),
    supabase.rpc('has_menu_permission_check', { p_menu_code: 'partner_management', p_action: 'create' }),
  ])

  // §2.2.1 모니터링 바 — 필터와 무관하게 전체 파트너 기준 intake_source 비율.
  const [{ count: totalCount }, { count: adminEntryCount }] = await Promise.all([
    supabase.from('partner').select('id', { count: 'exact', head: true }),
    supabase.from('partner').select('id', { count: 'exact', head: true }).eq('intake_source', 'admin_entry'),
  ])
  const total = totalCount ?? 0
  const adminEntry = adminEntryCount ?? 0
  const selfService = total - adminEntry
  const adminEntryRatio = total > 0 ? adminEntry / total : 0
  const isOverThreshold = adminEntryRatio > ADMIN_ENTRY_WARN_THRESHOLD

  const categoryOptions = await fetchCategoryOptions(supabase)

  let partnerIdFilter: string[] | null = null
  if (sp.category) {
    const categoryIds = sp.category.split(',').filter(Boolean)
    if (categoryIds.length > 0) {
      const { data: links } = await supabase.from('partner_standard_category').select('partner_id').in('standard_category_id', categoryIds)
      partnerIdFilter = Array.from(new Set((links ?? []).map((l) => l.partner_id)))
    }
  }

  let query = supabase
    .from('partner')
    .select(
      'id, company_name_ko, company_name_en, vertical, business_entity_type, verification_state, public_listing_state, intake_source, capability_completeness_pct, created_at, consent_deadline_at',
      { count: 'exact' },
    )

  if (sp.state === 'pending_review') {
    query = query.in('verification_state', ['submitted', 'under_review'])
  } else if (sp.state && sp.state in VERIFICATION_STATE_LABELS) {
    query = query.eq('verification_state', sp.state)
  }

  if (sp.q && sp.q.trim()) {
    const term = sp.q.trim().replace(/[%_]/g, '')
    query = query.or(`company_name_ko.ilike.%${term}%,company_name_en.ilike.%${term}%,business_registration_number.ilike.%${term}%`)
  }
  if (sp.vertical && sp.vertical !== 'all') query = query.eq('vertical', sp.vertical)
  if (sp.region && sp.region !== 'all') query = query.eq('location_region', sp.region)
  if (sp.languages) {
    const languages = sp.languages.split(',').filter(Boolean)
    if (languages.length > 0) query = query.overlaps('supported_languages', languages)
  }
  if (sp.overseas === 'yes') query = query.eq('overseas_experience', true)
  if (sp.overseas === 'no') query = query.eq('overseas_experience', false)
  if (sp.intakeSource && sp.intakeSource !== 'all') query = query.eq('intake_source', sp.intakeSource)
  if (partnerIdFilter !== null) query = query.in('id', partnerIdFilter.length > 0 ? partnerIdFilter : ['00000000-0000-0000-0000-000000000000'])

  if (sp.sort === 'completeness') query = query.order('capability_completeness_pct', { ascending: true })
  else if (sp.sort === 'name') query = query.order('company_name_ko', { ascending: true })
  else query = query.order('created_at', { ascending: false })

  const from = (page - 1) * PAGE_SIZE
  const { data: partners, count, error } = await query.range(from, from + PAGE_SIZE - 1)
  const rows = (partners ?? []) as PartnerListRow[]
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  const partnerIds = rows.map((r) => r.id)
  const { data: categoryLinks } = partnerIds.length
    ? await supabase.from('partner_standard_category').select('partner_id, standard_category_id').in('partner_id', partnerIds)
    : { data: [] as { partner_id: string; standard_category_id: string }[] }
  const categoryNameById = new Map(categoryOptions.map((c) => [c.id, c.name]))
  const categoriesByPartner = new Map<string, string[]>()
  for (const link of categoryLinks ?? []) {
    const list = categoriesByPartner.get(link.partner_id) ?? []
    list.push(categoryNameById.get(link.standard_category_id) ?? '(알수없음)')
    categoriesByPartner.set(link.partner_id, list)
  }

  const filterValues: PartnerFilterValues = {
    state: sp.state,
    q: sp.q,
    vertical: sp.vertical,
    region: sp.region,
    languages: sp.languages,
    overseas: sp.overseas,
    intakeSource: sp.intakeSource,
    category: sp.category,
    sort: sp.sort,
  }
  const otherParams: Record<string, string | undefined> = {
    q: sp.q,
    vertical: sp.vertical,
    region: sp.region,
    languages: sp.languages,
    overseas: sp.overseas,
    intakeSource: sp.intakeSource,
    category: sp.category,
    sort: sp.sort,
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className={`admin-body-sm ${isOverThreshold ? 'font-medium text-accent-700' : 'text-neutral-500'}`}>
          <Link href="/admin/partners" className="hover:underline">
            전체 {total}곳
          </Link>{' '}
          · 자가등록 {selfService}곳({total > 0 ? Math.round((selfService / total) * 100) : 0}%) ·{' '}
          <Link href="/admin/partners?intakeSource=admin_entry" className="hover:underline">
            예외입력 {adminEntry}곳({total > 0 ? Math.round(adminEntryRatio * 100) : 0}%)
          </Link>
          {isOverThreshold && ' ⚠ 임계치(20%) 초과'}
        </p>
        {canCreate && (
          <Link href="/admin/partners/new" className="admin-body-sm text-primary-600 hover:underline">
            + 신규 등록(예외입력)
          </Link>
        )}
      </div>

      <div className="mt-4">
        <PartnerStatusTabs currentState={sp.state} otherParams={otherParams} />
      </div>
      <PartnerFilters initial={filterValues} categoryOptions={categoryOptions} />

      {error && <p className="mt-6 admin-body-sm text-error">목록을 불러오지 못했습니다: {error.message}</p>}

      <div className="mt-4 overflow-x-auto rounded-card border border-neutral-200 bg-neutral-0">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-64" />
            <col className="w-40" />
            <col className="w-32" />
            <col className="w-24" />
            <col className="w-24" />
            <col className="w-24" />
            <col className="w-28" />
            <col className="w-32" />
          </colgroup>
          <thead>
            <tr className="border-b border-neutral-200 text-left">
              <th className="whitespace-nowrap px-4 py-3 admin-body-sm font-medium uppercase tracking-wide text-neutral-500">회사명</th>
              <th className="whitespace-nowrap px-4 py-3 admin-body-sm font-medium uppercase tracking-wide text-neutral-500">카테고리</th>
              <th className="whitespace-nowrap px-4 py-3 admin-body-sm font-medium uppercase tracking-wide text-neutral-500">Completeness</th>
              <th className="whitespace-nowrap px-4 py-3 admin-body-sm font-medium uppercase tracking-wide text-neutral-500">상태</th>
              <th className="whitespace-nowrap px-4 py-3 admin-body-sm font-medium uppercase tracking-wide text-neutral-500">공개상태</th>
              <th className="whitespace-nowrap px-4 py-3 admin-body-sm font-medium uppercase tracking-wide text-neutral-500">유입경로</th>
              <th className="whitespace-nowrap px-4 py-3 admin-body-sm font-medium uppercase tracking-wide text-neutral-500">등록일</th>
              <th className="whitespace-nowrap px-4 py-3 admin-body-sm font-medium uppercase tracking-wide text-neutral-500">관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const categoryNames = categoriesByPartner.get(p.id) ?? []
              const isPendingReview = p.verification_state === 'submitted' || p.verification_state === 'under_review'
              const consentImminent =
                p.intake_source === 'admin_entry' &&
                p.consent_deadline_at &&
                new Date(p.consent_deadline_at).getTime() - Date.now() < 14 * 24 * 60 * 60 * 1000
              return (
                <tr key={p.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-3 admin-body">
                    <Link href={`/admin/partners/${p.id}`} className="flex items-center gap-2.5">
                      <Avatar name={p.company_name_ko || '(회사명 미입력)'} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-primary-600">{p.company_name_ko || '(회사명 미입력)'}</span>
                        <span className="block truncate admin-body-sm text-neutral-400">
                          {p.company_name_en ?? ''} {p.vertical ? VERTICAL_LABELS[p.vertical] : ''}{' '}
                          {p.business_entity_type ? BUSINESS_ENTITY_TYPE_LABELS[p.business_entity_type] : ''}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 admin-body-sm">
                    {categoryNames.length === 0 ? (
                      <span className="text-neutral-400">(미분류)</span>
                    ) : (
                      <span className="text-neutral-600">
                        {categoryNames.slice(0, 2).join(', ')}
                        {categoryNames.length > 2 && ` +${categoryNames.length - 2}`}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ProgressBar value={p.capability_completeness_pct} total={100} tone={p.capability_completeness_pct >= 80 ? 'complete' : 'in-progress'} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={VERIFICATION_STATE_TONE[p.verification_state]} label={VERIFICATION_STATE_LABELS[p.verification_state]} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={PUBLIC_LISTING_TONE[p.public_listing_state]} label={PUBLIC_LISTING_LABELS[p.public_listing_state]} />
                  </td>
                  <td className="px-4 py-3 admin-body-sm text-neutral-600">
                    {INTAKE_SOURCE_LABELS[p.intake_source]}
                    {consentImminent && <span className="ml-1 text-accent-600" title="동의 확보 기한 임박">⚠</span>}
                  </td>
                  <td className="px-4 py-3 admin-body-sm text-neutral-500">{new Date(p.created_at).toLocaleDateString('ko-KR')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link href={`/admin/partners/${p.id}`} className="admin-body-sm text-primary-600 hover:underline">
                        상세보기
                      </Link>
                      {isPendingReview && canUpdate && <VerificationRowActions partnerId={p.id} />}
                    </div>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center admin-body text-neutral-400">
                  조건에 맞는 파트너가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 admin-body-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
            const params = new URLSearchParams()
            for (const [k, v] of Object.entries({ state: sp.state, ...otherParams })) {
              if (v) params.set(k, v)
            }
            params.set('page', String(p))
            return (
              <Link
                key={p}
                href={`/admin/partners?${params.toString()}`}
                className={`rounded-input px-3 py-1.5 ${p === page ? 'bg-primary-600 text-neutral-0' : 'text-neutral-600 hover:bg-neutral-100'}`}
              >
                {p}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
