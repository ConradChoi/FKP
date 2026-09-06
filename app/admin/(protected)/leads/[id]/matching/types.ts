// Design Ref: human-matching.screen-spec.md §2 (as superseded by
// human-matching-privacy-review.md §2/§3 and the actual columns in
// supabase/migrations/20260906100000_human_matching_schema.sql — this file mirrors that
// migration's public.match / match_shortlist_confirmation / match_outcome_event shapes,
// not the screen-spec §2 draft).
import type { JudgeStatus, OutcomeState } from '@/lib/admin/matchTags'

export interface MatchPartnerInfo {
  id: string
  company_name_ko: string | null
  company_name_en: string | null
  vertical: string | null
  business_entity_type: string | null
  verification_state: string
  location_region: string | null
  supported_languages: string[]
  capability_completeness_pct: number
  contact_name_masked: string | null
  contact_email_masked: string | null
  contact_phone_masked: string | null
}

export interface MatchRow {
  id: string
  partner_id: string
  judge_status: JudgeStatus
  selection_tags: string[]
  selection_memo: string | null
  exclusion_tags: string[]
  exclusion_memo: string | null
  judged_by_admin_id: string | null
  judged_at: string | null
  added_by_admin_id: string
  added_at: string
  is_confirmed_top3: boolean
  confirmed_rank: number | null
  current_outcome_state: OutcomeState | null
  meeting_date: string | null
  meeting_note: string | null
  quote_amount: number | null
  quote_currency: string | null
  deal_flag: boolean
  deal_amount: number | null
  deal_currency: string | null
  third_party_share_consent_at: string | null
  third_party_share_consent_method: string | null
  consent_scope: string[]
  evidence_kind: string | null
  // Populated client-side from a second query only when the caller has
  // partner_management:read (privacy review §4.3 / F-M8) — null otherwise.
  partner: MatchPartnerInfo | null
}

export interface ShortlistConfirmationSummary {
  latestConfirmedAt: string | null
  latestConfirmedByName: string | null
  initialConfirmedAt: string | null
  requirementCreatedAt: string | null
  confirmationCount: number
}

export interface OutcomeEventRow {
  id: string
  match_id: string
  outcome_state: OutcomeState
  transitioned_at: string
  note: string | null
  recorded_by_admin_id: string
  recorded_at: string
}

export interface RequirementSummary {
  id: string
  status: string
  created_at: string
  category: string | null
  locale: string | null
  english_speaking: string | null
}
