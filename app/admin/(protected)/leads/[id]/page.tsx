// Design Ref: human-matching.screen-spec.md §4.1 (탭 구조 전환) / ui-spec §1~§2. Data-fetching
// for both the "개요" tab (unchanged from the pre-tab page) and the new "매칭" tab is done here
// (server component) and handed down to LeadDetailTabs — same division of labor as
// app/admin/(protected)/partners/[id]/page.tsx + PartnerDetailTabs.tsx.
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { DeleteClosedLeadButton } from '../DeleteClosedLeadButton'
import { LeadDetailTabs } from './LeadDetailTabs'
import { fetchCategoryOptions } from '@/app/admin/(protected)/partners/categoryOptions'
import type { JudgeStatus, OutcomeState } from '@/lib/admin/matchTags'
import type { MatchPartnerInfo, MatchRow, OutcomeEventRow, ShortlistConfirmationSummary } from './matching/types'

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  // Explicit column list, not `*` — `contact` has zero GRANT to authenticated (privacy
  // review §7.3), so a `select('*')` here would error out entirely rather than just
  // omitting it (Postgres column-level GRANT: SELECT * fails if any column is ungranted).
  const { data: req, error } = await supabase
    .from('requests')
    .select(
      'id, what_looking_for, category, partner_type, purpose, description, budget, timeline, english_speaking, company_name_website, status, assignee_id, source, locale, contact_masked, created_at, hidden_at',
    )
    .eq('id', id)
    .single()
  if (error || !req) notFound()

  interface AdminOptionRow {
    id: string
    display_name: string
  }

  const [{ data: adminsRaw }, { data: internalNote }, { data: canCreateMatch }, { data: canUpdateMatch }, { data: canReadPartners }] =
    await Promise.all([
      supabase.rpc('list_admin_users_for_assignment'),
      supabase.rpc('get_request_internal_note', { p_request_id: id }),
      supabase.rpc('has_menu_permission_check', { p_menu_code: 'lead_management', p_action: 'create' }),
      supabase.rpc('has_menu_permission_check', { p_menu_code: 'lead_management', p_action: 'update' }),
      supabase.rpc('has_menu_permission_check', { p_menu_code: 'partner_management', p_action: 'read' }),
    ])
  const admins = (adminsRaw ?? []) as AdminOptionRow[]

  // =============================================================================
  // 매칭 탭 데이터 — human-matching-privacy-review.md §4.3: partner_management:read가 없으면
  // 파트너 조인 자체를 시도하지 않는다(F-M8: 어차피 partner RLS가 0행을 돌려주므로 시도해도
  // 안전하지만, 명시적으로 건너뛰어 "권한 없음"과 "결과 없음"을 프론트에서도 구분해 둔다).
  // =============================================================================
  const { data: matchRows } = await supabase
    .from('match')
    .select(
      'id, partner_id, judge_status, selection_tags, selection_memo, exclusion_tags, exclusion_memo, judged_by_admin_id, judged_at, added_by_admin_id, added_at, is_confirmed_top3, confirmed_rank, current_outcome_state, meeting_date, meeting_note, quote_amount, quote_currency, deal_flag, deal_amount, deal_currency, third_party_share_consent_at, third_party_share_consent_method, consent_scope, evidence_kind, created_at, updated_at',
    )
    .eq('requirement_id', id)
    .order('added_at', { ascending: false })

  const rawMatches = matchRows ?? []
  const partnerIds = Array.from(new Set(rawMatches.map((m) => m.partner_id as string)))

  let partnerById = new Map<string, MatchPartnerInfo>()
  if (canReadPartners && partnerIds.length > 0) {
    const { data: partnerRows } = await supabase
      .from('partner')
      .select(
        'id, company_name_ko, company_name_en, vertical, business_entity_type, verification_state, location_region, supported_languages, capability_completeness_pct, contact_name_masked, contact_email_masked, contact_phone_masked',
      )
      .in('id', partnerIds)
    partnerById = new Map((partnerRows ?? []).map((p) => [p.id as string, p as MatchPartnerInfo]))
  }

  const matches: MatchRow[] = rawMatches.map((m) => ({
    id: m.id,
    partner_id: m.partner_id,
    judge_status: m.judge_status as JudgeStatus,
    selection_tags: m.selection_tags ?? [],
    selection_memo: m.selection_memo,
    exclusion_tags: m.exclusion_tags ?? [],
    exclusion_memo: m.exclusion_memo,
    judged_by_admin_id: m.judged_by_admin_id,
    judged_at: m.judged_at,
    added_by_admin_id: m.added_by_admin_id,
    added_at: m.added_at,
    is_confirmed_top3: m.is_confirmed_top3,
    confirmed_rank: m.confirmed_rank,
    current_outcome_state: m.current_outcome_state as OutcomeState | null,
    meeting_date: m.meeting_date,
    meeting_note: m.meeting_note,
    quote_amount: m.quote_amount,
    quote_currency: m.quote_currency,
    deal_flag: m.deal_flag,
    deal_amount: m.deal_amount,
    deal_currency: m.deal_currency,
    third_party_share_consent_at: m.third_party_share_consent_at,
    third_party_share_consent_method: m.third_party_share_consent_method,
    consent_scope: m.consent_scope ?? [],
    evidence_kind: m.evidence_kind,
    partner: partnerById.get(m.partner_id) ?? null,
  }))

  const { data: confirmationRows } = await supabase
    .from('match_shortlist_confirmation')
    .select('id, confirmed_by_admin_id, confirmed_at, is_initial, requirement_created_at')
    .eq('requirement_id', id)
    .order('confirmed_at', { ascending: true })

  const confirmations = confirmationRows ?? []
  const initialRow = confirmations.find((c) => c.is_initial)
  const latestRow = confirmations[confirmations.length - 1]
  const adminDisplayNameByIdEarly = new Map<string, string>(admins.map((a) => [a.id, a.display_name]))
  const confirmation: ShortlistConfirmationSummary = {
    latestConfirmedAt: latestRow?.confirmed_at ?? null,
    latestConfirmedByName: latestRow ? (adminDisplayNameByIdEarly.get(latestRow.confirmed_by_admin_id) ?? null) : null,
    initialConfirmedAt: initialRow?.confirmed_at ?? null,
    requirementCreatedAt: initialRow?.requirement_created_at ?? null,
    confirmationCount: confirmations.length,
  }

  const confirmedMatchIds = matches.filter((m) => m.is_confirmed_top3).map((m) => m.id)
  const { data: outcomeEventRows } =
    confirmedMatchIds.length > 0
      ? await supabase
          .from('match_outcome_event')
          .select('id, match_id, outcome_state, transitioned_at, note, recorded_by_admin_id, recorded_at')
          .in('match_id', confirmedMatchIds)
          .order('transitioned_at', { ascending: false })
      : { data: [] as OutcomeEventRow[] }

  const outcomeEventsByMatchId = new Map<string, OutcomeEventRow[]>()
  for (const e of outcomeEventRows ?? []) {
    const list = outcomeEventsByMatchId.get(e.match_id) ?? []
    list.push(e as OutcomeEventRow)
    outcomeEventsByMatchId.set(e.match_id, list)
  }

  // Admin display-name lookup for "담은 사람"/"판정한 사람"/"기록자" attribution across both
  // match rows and outcome events — extend the assignment-picker list (active admins only,
  // list_admin_users_for_assignment) with any actor ids it's missing (e.g. a suspended admin
  // who judged a candidate while still active).
  const adminNameById = new Map(adminDisplayNameByIdEarly)
  const missingAdminIds = new Set<string>()
  for (const m of matches) {
    if (!adminNameById.has(m.added_by_admin_id)) missingAdminIds.add(m.added_by_admin_id)
    if (m.judged_by_admin_id && !adminNameById.has(m.judged_by_admin_id)) missingAdminIds.add(m.judged_by_admin_id)
  }
  for (const c of confirmations) {
    if (!adminNameById.has(c.confirmed_by_admin_id)) missingAdminIds.add(c.confirmed_by_admin_id)
  }
  for (const e of outcomeEventRows ?? []) {
    if (!adminNameById.has(e.recorded_by_admin_id)) missingAdminIds.add(e.recorded_by_admin_id)
  }
  if (missingAdminIds.size > 0) {
    const { data: extraAdmins } = await supabase.from('admin_user').select('id, display_name').in('id', Array.from(missingAdminIds))
    for (const a of extraAdmins ?? []) adminNameById.set(a.id as string, a.display_name as string)
  }

  const categoryOptions = await fetchCategoryOptions(supabase)

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link href="/admin/leads" className="admin-body-sm text-primary-600 hover:underline">
          ← 요청관리 목록으로
        </Link>
        {req.status === 'closed' && !req.hidden_at && (
          <DeleteClosedLeadButton requestId={id} redirectAfter="/admin/leads" />
        )}
      </div>
      {req.hidden_at && (
        <p className="mt-2 rounded-input bg-neutral-100 px-3 py-2 admin-body-sm text-neutral-500">
          이 요청은 목록에서 삭제(숨김) 처리되었습니다. ({new Date(req.hidden_at).toLocaleString('ko-KR')})
        </p>
      )}
      <p className="mt-2 admin-body-sm text-neutral-500">
        접수일: {new Date(req.created_at).toLocaleString('ko-KR')} · source: {req.source} · locale: {req.locale}
      </p>

      <div className="mt-4">
        <LeadDetailTabs
          req={req}
          admins={admins ?? []}
          internalNote={internalNote ?? ''}
          canAccessPii={!!context.can_access_pii}
          requirement={{ id: req.id, status: req.status, created_at: req.created_at, category: req.category, locale: req.locale, english_speaking: req.english_speaking }}
          matches={matches}
          confirmation={confirmation}
          outcomeEventsByMatchId={outcomeEventsByMatchId}
          adminNameById={adminNameById}
          categoryOptions={categoryOptions}
          canReadPartners={!!canReadPartners}
          canCreateMatch={!!canCreateMatch}
          canUpdateMatch={!!canUpdateMatch}
        />
      </div>
    </div>
  )
}
