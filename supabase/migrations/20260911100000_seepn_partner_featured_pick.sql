-- =============================================================================
-- supabase/migrations/20260911100000_seepn_partner_featured_pick.sql
--
-- SEEPN buyer-web P5b — B-12e "운영자 큐레이션 추천 파트너" (BY-16 목록 상단
-- 섹션 / BY-A2 Admin 지정). Spec: docs/02-design/features/
-- seepn-buyer-web-p5b.screen-spec.md §7 (BY-16, BY-A2), GAP-C3, EDGE-C11.
--
-- GAP-C3 (service-planner, 2026-09-10/11): PRD sized this feature as
-- "S (플래그 + 정렬 우선순위)" on the assumption that an `is_featured`-style
-- flag already exists somewhere on public.partner. It does not — a full grep
-- of every prior migration found zero `is_featured`/`recommended`/`curated`
-- columns or tables. This migration is therefore a genuinely NEW schema, not
-- "add a column to something that already exists".
--
-- Design decision: a small STATE table (public.partner_featured_pick), not a
-- boolean column on public.partner. Two independent reasons:
--   1. M-R12 (PRD, "임의 생성 숫자로 순위를 암시하지 않는다") + this repo's
--      audit convention (every consent/grant/admin action already carries
--      "누가/언제") both push toward a structured picked_by/picked_at pair
--      that a bare boolean cannot hold.
--   2. The full point-in-time HISTORY of every toggle ("누가 언제 지정/해제
--      했는가", the actual M-R12 audit requirement) does NOT live in this
--      table — it lives in public.audit_log, written by private.log_audit()
--      from admin_set_partner_featured() below (actions
--      'admin_partner_featured.set' / 'admin_partner_featured.unset', with
--      before/after summaries). This table only ever holds the CURRENT
--      designation state (one row per partner, upserted) — it is a state
--      table, not a log table. picked_by/picked_at on this table describe
--      "who/when last touched this partner's designation" (either direction,
--      set OR unset), which is a convenience read for the admin UI, not the
--      authoritative history. privacy-security-officer (PSO-C2, §10 of the
--      screen-spec): if you are auditing "who curated this list over time",
--      read audit_log filtered by action LIKE 'admin_partner_featured.%',
--      not this table.
--
-- EDGE-C11 (MUST, screen-spec §7.3 "노출 게이트 상속", the single most
-- important property of this migration): a partner that is designated
-- "featured" but later goes private (public_listing_state != 'on') or has
-- its verification revoked (verification_state != 'verified') or has its
-- public_listing consent withdrawn MUST disappear from the public curation
-- surface in the SAME statement it disappears from every other public
-- surface — no separate "featured cleanup" job, no possibility of drift.
-- This migration achieves that the exact same way 20260910100000 achieved it
-- for partner_category_public (§9 of that file): the public read surface
-- (public.partner_featured_public below) is a plain INNER JOIN between
-- partner_featured_pick and public.partner_list_public (itself `select ...
-- from private.partner_public_base`, the ONE place the 3-layer gate —
-- verification + public_listing_state + latest public_listing consent — is
-- evaluated). partner_featured_pick is NEVER joined to public.partner
-- directly, and NEVER exposed to anon/authenticated on its own. If a partner
-- drops out of partner_list_public, it drops out of partner_featured_public
-- in the same query, automatically, with no extra code to keep in sync.
--
-- Scope note (explicitly NOT in this migration): BY-16/BY-A2 frontend
-- screens are out of scope — this file only ships the table, the admin RPC,
-- and the public read view. frontend-developer wires these up separately.
-- =============================================================================


-- =============================================================================
-- §1. public.partner_featured_pick — current curation state (NOT a log; see
--     file header). One row per partner (upsert target), never exposed to
--     anon/authenticated directly (admin-only SELECT via RLS below; all
--     writes go through admin_set_partner_featured(), never direct DML —
--     same "no INSERT/DELETE grant, RPC-only" convention as public.partner
--     itself, 20260829140000 §4).
-- =============================================================================

create table if not exists public.partner_featured_pick (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null unique references public.partner (id) on delete cascade,

  -- Nullable: a partner can be designated (a row exists) without yet being
  -- placed in a specific order — admin_set_partner_featured() below fills
  -- this in with "append to the end of the current active set" when the
  -- caller does not specify one. NEVER surfaced to buyers as a number
  -- (M-R12) — public.partner_featured_public below uses it only inside an
  -- ORDER BY, never in the SELECT list.
  display_order integer check (display_order is null or display_order >= 0),

  -- The on/off switch. A row with active=false is history-shaped
  -- ("previously featured, now off") rather than deleted outright, mirroring
  -- this repo's general anonymize/soft-transition-in-place convention
  -- (public.partner is never hard-deleted either) — cheap to bring back if
  -- an admin re-toggles the same partner, and never queried by the public
  -- view (which filters `where active = true`).
  active boolean not null default true,

  -- "Who/when last changed this row's state" (set OR unset) — a convenience
  -- read for the admin UI, NOT the authoritative audit trail (see file
  -- header). on delete restrict: never silently orphan a curation decision
  -- by deleting the admin_user row out from under it.
  picked_by uuid references public.admin_user (id) on delete restrict,
  picked_at timestamptz not null default now(),

  created_at timestamptz not null default now()
);

comment on table public.partner_featured_pick is
  'B-12e (screen-spec §7). CURRENT curation state only, one row per partner '
  '(upsert target) — NOT the audit trail. The audit trail (every toggle, '
  'who/when, before/after) is public.audit_log, action IN '
  '(''admin_partner_featured.set'', ''admin_partner_featured.unset''), written '
  'by admin_set_partner_featured() below. NEVER joined directly to '
  'public.partner for a public read path — always go through '
  'public.partner_featured_public (joins public.partner_list_public, which '
  'inherits the private.partner_public_base 3-layer gate) — see EDGE-C11 in '
  'this file''s header. No INSERT/UPDATE/DELETE grant to any role: the only '
  'write path is admin_set_partner_featured() (SECURITY DEFINER).';

create index if not exists idx_partner_featured_pick_active_order
  on public.partner_featured_pick (active, display_order, picked_at);

alter table public.partner_featured_pick enable row level security;
alter table public.partner_featured_pick force row level security;

-- Admin-only direct read (e.g. the /admin/partners "추천 파트너만 보기"
-- filter, screen-spec §7.3 — that filter just needs "is this partner_id in
-- this table with active=true", which is a normal authenticated-admin
-- SELECT against this table, no new RPC needed for it).
create policy partner_featured_pick_admin_select on public.partner_featured_pick
  for select to authenticated
  using (
    (select private.is_active_admin())
    and (select private.is_aal2())
    and (select private.has_menu_permission('partner_management', 'read'))
  );

-- No INSERT/UPDATE/DELETE policy at all, and no GRANT beyond the SELECT
-- above — by construction, the only way to mutate this table is
-- admin_set_partner_featured() (SECURITY DEFINER, owned by the migration
-- role, which bypasses RLS the same way every other admin-mutation RPC in
-- this schema does).
revoke all on public.partner_featured_pick from anon, authenticated;
grant select on public.partner_featured_pick to authenticated; -- filtered to admin-only by the RLS policy above; anon gets nothing.


-- =============================================================================
-- §2. public.admin_set_partner_featured — the ONLY write path for
--     partner_featured_pick (BY-A2). Idempotent upsert on partner_id.
-- =============================================================================

create or replace function public.admin_set_partner_featured(
  p_partner_id uuid,
  p_featured boolean,
  p_display_order integer default null
)
-- Returns the full upserted row (public.partner_featured_pick's own column
-- names/types), not a hand-written RETURNS TABLE(...) list — a RETURNS
-- TABLE list here would declare implicit OUT-parameter variables that
-- collide by name with the very columns this function's INSERT ... ON
-- CONFLICT (partner_id) clause needs to reference unambiguously (plpgsql
-- substitutes bare identifiers matching a declared/OUT variable wherever
-- they appear in embedded SQL, including inside ON CONFLICT target lists).
returns public.partner_featured_pick
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid;
  v_before jsonb;
  v_next_order integer;
  v_row public.partner_featured_pick%rowtype;
begin
  if not (
    private.is_active_admin() and private.is_aal2()
    and private.has_menu_permission('partner_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  select au.id into v_admin_id from public.admin_user au where au.auth_user_id = auth.uid();

  -- Deliberately checks public.partner (existence only), NOT
  -- private.partner_public_base — an admin must be able to designate a
  -- partner as "featured" (or un-designate one) even while it is currently
  -- private/unverified, e.g. preparing the pick ahead of an upcoming
  -- verification. EDGE-C11's gate is enforced entirely at READ time by
  -- public.partner_featured_public (§3 below), not at write time here — a
  -- designated-but-not-yet-public partner simply does not appear anywhere
  -- until it independently clears the 3-layer gate.
  if not exists (select 1 from public.partner where id = p_partner_id) then
    raise exception 'partner_not_found' using errcode = 'P0002';
  end if;

  if p_display_order is not null and p_display_order < 0 then
    raise exception 'invalid_display_order';
  end if;

  select jsonb_build_object('active', fp.active, 'display_order', fp.display_order)
  into v_before
  from public.partner_featured_pick fp
  where fp.partner_id = p_partner_id;

  if p_display_order is not null then
    v_next_order := p_display_order;
  else
    -- Keep the existing order if this partner already has a row; otherwise
    -- append to the end of the current set (max + 1, 0 if the table is
    -- empty). Only bothers computing "append to the end" when actually
    -- (re)featuring — an unset with no explicit order just keeps whatever
    -- order it last had, in case it gets re-featured later.
    select fp.display_order into v_next_order
    from public.partner_featured_pick fp
    where fp.partner_id = p_partner_id;

    if v_next_order is null and p_featured then
      select coalesce(max(display_order), -1) + 1 into v_next_order
      from public.partner_featured_pick;
    end if;
  end if;

  insert into public.partner_featured_pick (partner_id, display_order, active, picked_by, picked_at)
  values (p_partner_id, v_next_order, p_featured, v_admin_id, now())
  on conflict (partner_id) do update set
    display_order = excluded.display_order,
    active = excluded.active,
    picked_by = excluded.picked_by,
    picked_at = now()
  returning * into v_row;

  -- M-R12 audit requirement (GAP-C3): the authoritative "누가/언제" record.
  -- Two distinct action codes (not one 'admin_partner_featured.update') so
  -- audit_log can be filtered by set vs. unset without inspecting jsonb.
  perform private.log_audit(
    p_action := case when p_featured then 'admin_partner_featured.set' else 'admin_partner_featured.unset' end,
    p_target_table := 'partner_featured_pick',
    p_target_id := p_partner_id::text,
    p_subject_ids := array[p_partner_id],
    p_before_summary := v_before,
    p_after_summary := jsonb_build_object('active', v_row.active, 'display_order', v_row.display_order)
  );

  return v_row;
end;
$$;

comment on function public.admin_set_partner_featured is
  'BY-A2 (screen-spec §7.3). Sole write path for public.partner_featured_pick '
  '— idempotent upsert on partner_id. Does NOT enforce the public-listing '
  '3-layer gate at write time (an admin may pre-designate a not-yet-public '
  'partner); the gate is enforced at READ time by '
  'public.partner_featured_public (EDGE-C11). No hard cap on the number of '
  'active rows (screen-spec §7.3: "6~8곳 소프트 권고", UI-level guidance only, '
  'not a DB constraint — PM/operator judgment call).';

revoke all on function public.admin_set_partner_featured(uuid, boolean, integer) from public;
grant execute on function public.admin_set_partner_featured(uuid, boolean, integer) to authenticated;


-- =============================================================================
-- §3. public.partner_featured_public — BY-16 read path. anon-readable
--     (BY-08/BY-16 are both bidirectional-anon), returns ONLY partners that
--     are BOTH (a) currently designated active=true AND (b) currently pass
--     the private.partner_public_base 3-layer gate (verification + public
--     listing + latest public_listing consent), via the INNER JOIN below.
--
--     EDGE-C11 / PSO-C2 (privacy-security-officer review checklist item,
--     screen-spec §10): this view is the ONLY sanctioned way to read
--     "featured" partners for a buyer-facing surface. It joins
--     public.partner_featured_pick to public.partner_list_public — NOT to
--     public.partner or private.partner_public_base's underlying table
--     directly — so the gate is inherited exactly once, from the exact same
--     place BY-08's own list is gated. There is no code path in this
--     migration that can show a private/unverified/consent-withdrawn
--     partner via curation while it is hidden everywhere else.
--
--     Column set intentionally mirrors public.partner_list_public 1:1 (same
--     "enumerated columns only" discipline as that view''s own comment,
--     20260910100000 §8) so BY-16 can render the exact same PartnerCard
--     component BY-08 already uses, with zero field-mapping work.
--     display_order is deliberately NOT selected here (M-R12: buyers must
--     never see a raw ordering number that could be read as a rank/score) —
--     it is used only inside ORDER BY, to produce a stable list order.
-- =============================================================================

create or replace view public.partner_featured_public as
select
  l.id, l.company_name_ko, l.company_name_en, l.location_region, l.vertical,
  l.service_types, l.supported_languages, l.overseas_experience, l.created_at
from public.partner_featured_pick fp
join public.partner_list_public l on l.id = fp.partner_id
where fp.active = true
order by fp.display_order nulls last, fp.picked_at asc;

comment on view public.partner_featured_public is
  'BY-16 (screen-spec §7.2, "운영자 선정" section, bidirectional-anon). EDGE-C11: '
  'joins partner_featured_pick to partner_list_public (NOT to partner or '
  'partner_public_base''s base table) so the 3-layer public-listing gate '
  '(verification + public_listing_state + latest public_listing consent, '
  'private.partner_public_base) is inherited automatically — a partner that '
  'goes private/unverified/consent-withdrawn disappears from here in the '
  'same statement it disappears from partner_list_public, with no possible '
  'drift. display_order is used only in ORDER BY, never SELECTed (M-R12: no '
  'ranking numbers shown to buyers). Caller-side filters (vertical/category/'
  'region, screen-spec §7.2 "필터 순응") are applied by the caller adding its '
  'own .eq()/.in() on top of this view, the same pattern already used '
  'against partner_list_public for BY-08.';

grant select on public.partner_featured_public to anon, authenticated;


-- =============================================================================
-- §4. audit_log action CHECK — widen to admit the two new B-12e actions.
--     Diff base is 20260910100000 (the latest file to touch this constraint
--     as of this migration, verified by grep across every migration filed
--     after it — see that file's own §4c comment for the same pattern).
-- =============================================================================

do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.audit_log'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%auth.login_success%';

  if v_conname is not null then
    execute format('alter table public.audit_log drop constraint %I', v_conname);
  end if;
end;
$$;

alter table public.audit_log add constraint audit_log_action_check check (action in (
  -- A. Authentication (§3.2-A)
  'auth.login_success', 'auth.login_failed', 'auth.logout', 'auth.session_expired',
  'auth.mfa_enrolled', 'auth.mfa_reset',
  'auth.password_reset_requested', 'auth.password_changed',
  'auth.access_denied',
  -- B. Lead PII access (§3.2-B)
  'lead.list', 'lead.view', 'lead.contact_reveal', 'lead.update',
  'lead.status_change', 'lead.assign', 'lead.note_write',
  'lead.export', 'lead.export_denied', 'lead.hide',
  -- C. Account / permission changes (§3.2-C)
  'admin_user.invite', 'admin_user.invite_resend', 'admin_user.invite_revoke',
  'admin_user.activate', 'admin_user.suspend', 'admin_user.withdraw',
  'admin_user.role_grant', 'admin_user.role_revoke', 'admin_user.profile_update',
  'admin_access_request.approve', 'admin_access_request.reject',
  'role.create', 'role.update', 'role.delete',
  'menu.create', 'menu.update', 'menu.delete',
  'role_menu_permission.change',
  -- E. Content management (Phase 5-A)
  'content.create', 'content.update', 'content.delete',
  -- F. Partner self-service actions (privacy review §2.6, new)
  'partner.signup', 'partner.email_verified', 'partner.login_success', 'partner.login_failed',
  'partner.password_changed', 'partner.withdraw',
  'partner.profile_update', 'partner.submit_for_review',
  'partner.consent_grant', 'partner.consent_revoke',
  'partner.public_listing_on', 'partner.public_listing_off',
  'partner.document_upload', 'partner.document_delete',
  -- G. Admin partner-management actions (privacy review §2.6, new)
  'admin_partner.list', 'admin_partner.view', 'admin_partner.contact_reveal',
  'admin_partner.document_reveal', 'admin_partner.update', 'admin_partner.verify',
  'admin_partner.reject', 'admin_partner.suspend_listing',
  'admin_partner.admin_entry_create', 'admin_partner.consent_evidence_write',
  'admin_partner.export', 'admin_partner.export_denied',
  -- H. Human matching (P4, screen-spec §10 / privacy review HM-B4)
  'match.candidate_add', 'match.candidate_remove', 'match.judge',
  'match.shortlist_confirm', 'match.outcome_transition', 'match.third_party_consent_record',
  -- I. Standard category translation AI-fill guard
  'standard_category.update',
  -- J. SEEPN buyer self-service actions (20260910100000, privacy review §4.2)
  'buyer.signup', 'buyer.login_success', 'buyer.login_failed',
  'buyer.consent_grant', 'buyer.consent_revoke', 'buyer.withdraw',
  'buyer.dormant_notice_sent', 'buyer.dormant_purge',
  -- K. SEEPN inquiry (20260910100000, privacy review §4.2 / INQ-7)
  'seepn_inquiry.create',
  'admin_seepn_inquiry.list', 'admin_seepn_inquiry.view',
  'admin_seepn_inquiry.contact_reveal',
  'admin_seepn_inquiry.status_change', 'admin_seepn_inquiry.assign',
  -- L. Breach-response tooling (20260910100000, D-14① BP-22)
  'security.breach_target_export',
  -- M. SEEPN B-12e operator curation (this migration, GAP-C3 / M-R12)
  'admin_partner_featured.set', 'admin_partner_featured.unset',
  -- D. Audit log itself (§3.2-D)
  'audit.view', 'audit.export', 'audit.review'
));
