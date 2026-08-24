// Design Ref: shared client/server email format check — must stay identical to the
// `contact ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'` CHECK constraint in
// supabase/migrations/20260824120000_phase1_requests_pipeline.sql (public.requests.contact).
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
