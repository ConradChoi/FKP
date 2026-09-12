-- =============================================================================
-- public.get_own_partner_inquiry_count()
--
-- SUP-15 (P6 Opportunity Feed, docs/02-design/features/
-- seepn-partner-web-p6-dashboard.screen-spec.md §4). Mirrors
-- public.get_own_partner_bookmark_count() (20260910100000_seepn_buyer_web_p5a.sql
-- §10) EXACTLY, same pattern: no arguments, single SQL statement, `stable`,
-- `security definer`, `set search_path = ''`, `authenticated`-only grant.
--
-- The ONLY thing a partner may ever learn about seepn_inquiry / GAP-C1's
-- seepn_inquiry_partner (20260910180000_seepn_inquiry_multi_partner.sql §1)
-- is a single aggregate integer for their OWN partner row — never which
-- buyer, never the inquiry body, never a status breakdown, never a
-- time-bucketed series (same re-identification concern already documented on
-- get_own_partner_bookmark_count; screen-spec §0.2 D-D4/D-D5 explicitly
-- re-affirm and extend that principle to this RPC). Per OQ-D2 (대표 확정,
-- 2026-09-12), the count is the TOTAL cumulative count, with no status
-- filter (new/in_progress/closed all included) — a status-filtered count
-- would itself be a step toward "which of my inquiries is being worked on",
-- which is out of scope by the same D-D5 reasoning.
--
-- seepn_inquiry_partner has no partner-facing RLS SELECT policy by design
-- (20260910180000 §1 — only a buyer self-select policy exists) — this
-- SECURITY DEFINER function is the sole partner-side read path, exactly as
-- get_own_partner_bookmark_count() is for buyer_bookmark.
--
-- Counting seepn_inquiry_partner directly (rather than joining
-- seepn_inquiry) is deliberate: GAP-C1 already moved the partner reference
-- off seepn_inquiry (that column was dropped), so "how many inquiries
-- reference me" is exactly `count(*)` of this join table's rows for my
-- partner_id — no need to touch seepn_inquiry's body/status/buyer columns at
-- all, which also means there is no column here to accidentally widen later
-- into a PII leak.
--
-- Self-view of one's own aggregate count is not audited, matching
-- get_own_partner_bookmark_count() (also a single `language sql` statement
-- with no audit_log insert) and the same stance taken for
-- get_own_partner_contact / get_own_partner_consents / get_own_buyer_consents
-- (PR-15: auditing every self-view of one's own aggregate has no security
-- value).
--
-- Not a partner (private.current_partner_id() is null, e.g. an admin/buyer
-- session that somehow reaches this call) or a partner with zero inquiries:
-- both fall through to `count(*)` = 0, no exception raised — identical to
-- get_own_partner_bookmark_count()'s behaviour, not re-derived here.
-- =============================================================================

create or replace function public.get_own_partner_inquiry_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.seepn_inquiry_partner sip
  where sip.partner_id = (select id from public.partner where owner_account_id = private.current_partner_id());
$$;

comment on function public.get_own_partner_inquiry_count is
  'SUP-15 (P6 Opportunity Feed): mirrors get_own_partner_bookmark_count() exactly.
  The ONLY thing a partner may learn about seepn_inquiry is a single aggregate
  integer for their OWN partner row — never which buyer, never inquiry body,
  never a status breakdown, never a time-bucketed series (same
  re-identification concern already documented on
  get_own_partner_bookmark_count). Total cumulative count, no status filter
  (OQ-D2, 대표 확정 2026-09-12). seepn_inquiry_partner has no partner-facing
  RLS SELECT policy by design (20260910180000 §1) — this SECURITY DEFINER
  function is the sole partner-side read path.';

revoke all on function public.get_own_partner_inquiry_count() from public;
grant execute on function public.get_own_partner_inquiry_count() to authenticated;
