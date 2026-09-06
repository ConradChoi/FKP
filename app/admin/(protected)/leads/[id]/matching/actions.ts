'use server'

// Design Ref: human-matching.screen-spec.md §6 / ui-spec §3~§6. All writes go through the 6
// RPCs defined in supabase/migrations/20260906100000_human_matching_schema.sql — signatures
// are copied byte-for-byte from that file, never guessed (per task instructions).
import { revalidatePath } from 'next/cache'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import type { ActionResult } from '@/lib/supabase/adminAuthActions'
import type { JudgeStatus, OutcomeState } from '@/lib/admin/matchTags'

// =============================================================================
// (a) 후보 검색 — direct `partner` table query (RLS-gated by partner_management:read,
// F-M8). Not an RPC: search/filter is read-only and the existing partner-list screen
// (`/admin/partners`) already queries this table directly the same way.
// =============================================================================

export interface CandidateSearchFilters {
  q?: string
  vertical?: string // 'product' | 'service' | 'all'
  region?: string
  languages?: string[]
  countries?: string[]
  verificationStates?: string[]
  includeExcluded?: boolean
  categoryIds?: string[]
}

export interface CandidateSearchResultRow {
  id: string
  company_name_ko: string | null
  company_name_en: string | null
  vertical: string | null
  business_entity_type: string | null
  verification_state: string
  location_region: string | null
  supported_languages: string[]
  capability_completeness_pct: number
  other_requirement_match_count: number
}

const DEFAULT_VERIFICATION_STATES = ['draft', 'submitted', 'under_review', 'verified']

export async function searchPartnerCandidatesAction(
  requirementId: string,
  filters: CandidateSearchFilters,
): Promise<ActionResult<CandidateSearchResultRow[]>> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  let partnerIdFilter: string[] | null = null
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    const { data: links, error: linkError } = await supabase
      .from('partner_standard_category')
      .select('partner_id')
      .in('standard_category_id', filters.categoryIds)
    if (linkError) return { success: false, error: linkError.message, errorCode: 'SEARCH_FAILED' }
    partnerIdFilter = Array.from(new Set((links ?? []).map((l) => l.partner_id as string)))
  }

  let query = supabase
    .from('partner')
    .select(
      'id, company_name_ko, company_name_en, vertical, business_entity_type, verification_state, location_region, supported_languages, capability_completeness_pct',
    )

  const baseStates = filters.verificationStates && filters.verificationStates.length > 0 ? filters.verificationStates : DEFAULT_VERIFICATION_STATES
  const states = filters.includeExcluded ? Array.from(new Set([...baseStates, 'rejected', 'suspended'])) : baseStates
  query = query.in('verification_state', states)

  if (filters.q && filters.q.trim()) {
    const term = filters.q.trim().replace(/[%_]/g, '')
    query = query.or(`company_name_ko.ilike.%${term}%,company_name_en.ilike.%${term}%,business_registration_number.ilike.%${term}%`)
  }
  if (filters.vertical && filters.vertical !== 'all') query = query.eq('vertical', filters.vertical)
  if (filters.region && filters.region !== 'all') query = query.eq('location_region', filters.region)
  if (filters.languages && filters.languages.length > 0) query = query.overlaps('supported_languages', filters.languages)
  if (filters.countries && filters.countries.length > 0) query = query.overlaps('overseas_experience_countries', filters.countries)
  if (partnerIdFilter !== null) {
    query = query.in('id', partnerIdFilter.length > 0 ? partnerIdFilter : ['00000000-0000-0000-0000-000000000000'])
  }

  query = query.order('created_at', { ascending: false }).limit(50)

  const { data, error } = await query
  if (error) return { success: false, error: error.message, errorCode: 'SEARCH_FAILED' }

  const rows = data ?? []
  const partnerIds = rows.map((p) => p.id as string)
  const { data: otherMatches } =
    partnerIds.length > 0
      ? await supabase.from('match').select('partner_id, requirement_id').in('partner_id', partnerIds)
      : { data: [] as { partner_id: string; requirement_id: string | null }[] }

  const countMap = new Map<string, number>()
  for (const m of otherMatches ?? []) {
    if (!m.requirement_id || m.requirement_id === requirementId) continue
    countMap.set(m.partner_id, (countMap.get(m.partner_id) ?? 0) + 1)
  }

  const result: CandidateSearchResultRow[] = rows.map((p) => ({
    id: p.id,
    company_name_ko: p.company_name_ko,
    company_name_en: p.company_name_en,
    vertical: p.vertical,
    business_entity_type: p.business_entity_type,
    verification_state: p.verification_state,
    location_region: p.location_region,
    supported_languages: p.supported_languages ?? [],
    capability_completeness_pct: p.capability_completeness_pct,
    other_requirement_match_count: countMap.get(p.id) ?? 0,
  }))

  return { success: true, data: result }
}

// =============================================================================
// (a)->(b) 후보 담기/제거 — match_candidate_add / match_candidate_remove
// =============================================================================

export async function addCandidateAction(requirementId: string, partnerId: string): Promise<ActionResult<{ matchId: string }>> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { data, error } = await supabase.rpc('match_candidate_add', { p_requirement_id: requirementId, p_partner_id: partnerId })
  if (error) return { success: false, error: error.message, errorCode: 'ADD_FAILED' }

  revalidatePath(`/admin/leads/${requirementId}`)
  return { success: true, data: { matchId: data as string } }
}

export async function removeCandidateAction(requirementId: string, matchId: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('match_candidate_remove', { p_match_id: matchId })
  if (error) return { success: false, error: error.message, errorCode: 'REMOVE_FAILED' }

  revalidatePath(`/admin/leads/${requirementId}`)
  return { success: true }
}

// =============================================================================
// (b) 판정 저장 — match_judge (판정+태그+메모 한 번에, RPC 1회)
// =============================================================================

export async function judgeMatchAction(
  requirementId: string,
  matchId: string,
  judgeStatus: JudgeStatus,
  tags: string[],
  memo: string | null,
): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('match_judge', {
    p_match_id: matchId,
    p_judge_status: judgeStatus,
    p_tags: tags,
    p_memo: memo,
  })
  if (error) return { success: false, error: error.message, errorCode: 'JUDGE_FAILED' }

  revalidatePath(`/admin/leads/${requirementId}`)
  return { success: true }
}

// =============================================================================
// (c) Top3 확정 — match_shortlist_confirm
// =============================================================================

export interface ShortlistConfirmResult {
  confirmation_id: string
  is_initial: boolean
  confirmed_at: string
}

export async function confirmTop3Action(requirementId: string, matchIds: string[]): Promise<ActionResult<ShortlistConfirmResult>> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { data, error } = await supabase.rpc('match_shortlist_confirm', { p_requirement_id: requirementId, p_match_ids: matchIds })
  if (error) return { success: false, error: error.message, errorCode: 'CONFIRM_FAILED' }

  revalidatePath(`/admin/leads/${requirementId}`)
  return { success: true, data: data as unknown as ShortlistConfirmResult }
}

// =============================================================================
// (d) Outcome 전이 기록 — match_outcome_transition
// =============================================================================

export interface OutcomeTransitionInput {
  matchId: string
  outcomeState: OutcomeState
  transitionedAt: string // ISO
  note?: string | null
  meetingDate?: string | null
  meetingNote?: string | null
  quoteAmount?: number | null
  quoteCurrency?: string | null
  dealFlag?: boolean | null
  dealAmount?: number | null
  dealCurrency?: string | null
}

export async function recordOutcomeTransitionAction(requirementId: string, input: OutcomeTransitionInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('match_outcome_transition', {
    p_match_id: input.matchId,
    p_outcome_state: input.outcomeState,
    p_transitioned_at: input.transitionedAt,
    p_note: input.note ?? null,
    p_meeting_date: input.meetingDate ?? null,
    p_meeting_note: input.meetingNote ?? null,
    p_quote_amount: input.quoteAmount ?? null,
    p_quote_currency: input.quoteCurrency ?? null,
    p_deal_flag: input.dealFlag ?? null,
    p_deal_amount: input.dealAmount ?? null,
    p_deal_currency: input.dealCurrency ?? null,
  })
  if (error) return { success: false, error: error.message, errorCode: 'OUTCOME_FAILED' }

  revalidatePath(`/admin/leads/${requirementId}`)
  return { success: true }
}

// =============================================================================
// HM-B5 / ceo-decision §4 item 1 — 2단계(담당자 연락처) 전달 전 파트너 개별 동의 기록
// =============================================================================

export interface ThirdPartyConsentInput {
  matchId: string
  consentMethod: string
  consentScope: string[]
  evidenceKind: string
  consentAt: string // ISO
}

export async function recordThirdPartyConsentAction(requirementId: string, input: ThirdPartyConsentInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('match_record_third_party_consent', {
    p_match_id: input.matchId,
    p_consent_method: input.consentMethod,
    p_consent_scope: input.consentScope,
    p_evidence_kind: input.evidenceKind,
    p_consent_at: input.consentAt,
  })
  if (error) return { success: false, error: error.message, errorCode: 'CONSENT_RECORD_FAILED' }

  revalidatePath(`/admin/leads/${requirementId}`)
  return { success: true }
}
