// Design Ref: lib/supplier/types.ts (the pattern this file mirrors) +
// supabase/migrations/20260910100000_seepn_buyer_web_p5a.sql §2 (public.buyer_account),
// §8 (public.partner_list_public / public.partner_detail_buyer), §11 (public.seepn_inquiry).
// Column names/nullability mirror those tables/views exactly — keep in sync if the schema
// changes (same "TS mirror, drift risk accepted" convention as lib/supplier/types.ts).
export interface BuyerAccount {
  id: string
  display_name: string
  status: 'pending_email' | 'active' | 'suspended' | 'withdrawn'
}

export interface PartnerListPublicRow {
  id: string
  company_name_ko: string | null
  company_name_en: string | null
  location_region: string | null
  vertical: 'product' | 'service' | null
  service_types: string[]
  supported_languages: string[]
  overseas_experience: boolean | null
  created_at: string
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

// public.partner_detail_buyer — deliberately has NO contact/business-registration-number/
// document fields (they do not exist in the view at all, not merely omitted here — see the
// view's own comment in the migration) and NO capability_completeness_pct (BP-12 default:
// excluded from every buyer-facing surface pending a partner-consent-notice update).
export interface PartnerDetailBuyerRow {
  id: string
  company_name_ko: string | null
  company_name_en: string | null
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
  created_at: string
}

// Design Ref: lib/supplier/types.ts's ConsentRecord/ConsentsByType (same pattern, buyer
// domain copy per docs/02-design/features/seepn-buyer-marketing-consent-settings.screen-spec.md
// §8) — get_own_buyer_consents() omits a key entirely (never present with a null value) when
// there is no consent/withdrawal history for that type, so the frontend can tell "이력 없음"
// apart from "명시적으로 거부함".
export interface ConsentRecord {
  granted: boolean
  collected_at: string
  document_version: string | null
}

// `public_listing` is a partner-only concept, deliberately excluded here.
export type BuyerConsentsByType = Partial<Record<'terms' | 'privacy' | 'marketing', ConsentRecord>>

// GAP-C1 (2026-09-10, 20260910180000): public.seepn_inquiry.partner_id was dropped —
// referenced partners now live in the public.seepn_inquiry_partner join table (1..5 per
// inquiry). This type is currently unused anywhere in the codebase; kept as the base row
// shape sans partner reference, matching the actual table.
export interface SeepnInquiryRow {
  id: string
  body: string
  status: 'new' | 'in_progress' | 'closed'
  created_at: string
  updated_at: string
}

// admin_list_seepn_inquiries() RPC return shape — NO body column, by design
// (privacy review §5.3(d): list must never preview inquiry body).
// GAP-C1 (2026-09-10, 20260910180000): a single partner_id/partner_company_name_ko pair was
// replaced by a `partners` array (1..5 referenced partners per inquiry).
export interface AdminSeepnInquiryPartner {
  id: string
  company_name_ko: string | null
}

export interface AdminSeepnInquiryListRow {
  id: string
  partners: AdminSeepnInquiryPartner[] | null
  buyer_display_name_masked: string
  status: 'new' | 'in_progress' | 'closed'
  assigned_admin_id: string | null
  assigned_admin_name: string | null
  created_at: string
}

// get_seepn_inquiry_detail() RPC return shape — body IS present here (detail-only exposure).
export interface AdminSeepnInquiryDetail {
  id: string
  partners: AdminSeepnInquiryPartner[]
  buyer_display_name: string
  body: string
  status: 'new' | 'in_progress' | 'closed'
  assigned_admin_id: string | null
  assigned_admin_name: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
}
