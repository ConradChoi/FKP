// Design Ref: supabase/migrations/20260829140000_partner_schema.sql §1 (public.partner),
// 20260829130000 §3 (public.partner_account), 20260829140000 §7 (public.partner_document).
// Column names/nullability mirror those tables exactly — keep in sync if the schema changes
// (same "TS mirror, drift risk accepted" convention already used by
// lib/admin/partnerSubmissionGaps.ts's PartnerForGapCheck).
export interface PartnerAccount {
  id: string
  display_name: string
  status: 'pending_email' | 'active' | 'suspended' | 'withdrawn'
}

export interface RepresentativeOffering {
  name: string
  description: string
}

export interface ReferenceProject {
  client_industry: string
  deliverable: string
  anonymized: boolean
}

export interface PartnerProfile {
  id: string
  verification_state: 'draft' | 'submitted' | 'under_review' | 'verified' | 'rejected' | 'suspended'
  rejection_reason: string | null
  business_entity_type: 'corporation' | 'sole_proprietor' | null
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
  representative_offerings: RepresentativeOffering[]
  certifications: string[]
  vertical: 'product' | 'service' | null
  moq: string | null
  price_band: string | null
  lead_time_days: number | null
  sample_available: boolean | null
  sample_terms: string | null
  oem_odm_type: 'oem' | 'odm' | 'own_brand' | null
  export_record: string | null
  service_types: string[]
  project_min_size: string | null
  pricing_model: 'project' | 'retainer' | 'hourly' | null
  standard_lead_time: string | null
  reference_projects: ReferenceProject[]
  team_size_band: string | null
  remote_onsite: 'remote' | 'onsite' | 'both' | null
  public_listing_state: 'off' | 'on' | 'suspended'
  capability_completeness_pct: number
  updated_at: string
}

export interface PartnerDocumentRow {
  id: string
  doc_type: 'business_registration_cert' | 'portfolio' | 'certification' | 'other'
  storage_path: string
  original_filename: string
  mime_type: string
  file_size_bytes: number
  created_at: string
}

export interface PartnerContactRecord {
  contact_name: string
  contact_title: string | null
  contact_email: string
  contact_phone: string | null
  representative_name: string | null
}

export interface ConsentRecord {
  granted: boolean
  collected_at: string
  document_version: string | null
}

// Design Ref: privacy review UI-B2 — keys are OMITTED (never present with a null value) when
// there is no history for that consent type, so the frontend can tell "미동의" apart from
// "기록 없음" (get_own_partner_consents's own comment).
export type ConsentsByType = Partial<Record<'terms' | 'privacy' | 'public_listing' | 'marketing', ConsentRecord>>

export interface OwnPartnerIds {
  partner_account_id: string | null
  partner_id: string | null
}
