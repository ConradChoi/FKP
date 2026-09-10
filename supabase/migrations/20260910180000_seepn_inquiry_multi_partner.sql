-- =============================================================================
-- supabase/migrations/20260910180000_seepn_inquiry_multi_partner.sql
--
-- GAP-C1 (qa-reviewer/service-planner, 2026-09-10): the PRD
-- (seepn-unified-platform-v1.0.prd.md §3.1.5 INQ-2) assumed public.seepn_inquiry
-- already accepted 0..N referenced partners via a join table. It did not —
-- 20260910100000_seepn_buyer_web_p5a.sql §11 shipped `partner_id uuid not
-- null` (exactly one partner per inquiry). That assumption is only now being
-- made true, ahead of P5b (partner comparison, up to 5) needing a
-- "문의 여러 파트너에게 한 번에" flow. This migration does NOT touch
-- 20260910100000 in place (already-deployed file, may already have live
-- rows) — every change here is additive/ALTER, in a new file, per this
-- project's convention.
--
-- What this file does, in order:
--   §1. public.seepn_inquiry_partner — new join table (inquiry_id, partner_id).
--   §2. Data migration — copy every existing seepn_inquiry.partner_id value
--       into the join table, THEN drop the now-redundant column (data
--       preserved; today's real inquiries, if any, survive this migration
--       intact as 1-row join entries).
--   §3. create_seepn_inquiry(p_partner_ids uuid[], p_body text) — signature
--       change from a single p_partner_id uuid. 1..5 partners, no duplicates,
--       every partner_id must satisfy the exact private.partner_public_base
--       gate (verified + public_listing on + latest public_listing consent
--       granted) — NOT just "exists in public.partner" (P5a's check was
--       looser than this; tightened here on purpose per today's direction).
--       A single-element array reproduces P5a's exact behaviour (backward
--       compatible with the existing partner-detail-page "이 파트너에게
--       문의" flow).
--   §4. admin_list_seepn_inquiries() / get_seepn_inquiry_detail() — updated
--       to return a `partners` jsonb array instead of a single
--       partner_id/partner_company_name_ko pair.
--   §5. Buyer self-read RLS policy on the new join table (BY-12 "내 문의
--       내역" reads seepn_inquiry_partner directly, same no-RPC-needed
--       posture as seepn_inquiry itself).
-- =============================================================================


-- =============================================================================
-- §1. public.seepn_inquiry_partner
-- =============================================================================

create table if not exists public.seepn_inquiry_partner (
  inquiry_id uuid not null references public.seepn_inquiry (id) on delete cascade,
  partner_id uuid not null references public.partner (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (inquiry_id, partner_id)
);

comment on table public.seepn_inquiry_partner is
  'GAP-C1: 0..N (product decision 2026-09-10: 1..5, enforced in
  create_seepn_inquiry() — a CHECK counting sibling rows is not clean in
  Postgres, see that function''s comment) partners referenced by one
  seepn_inquiry row. inquiry_id cascades (deleting the parent inquiry, which
  nothing in this app currently does, removes its partner refs too);
  partner_id is `on delete restrict` — same posture as seepn_inquiry.partner_id
  had, a partner row is never hard-deleted while referenced by an inquiry.';

create index if not exists idx_seepn_inquiry_partner_partner_id
  on public.seepn_inquiry_partner (partner_id);

alter table public.seepn_inquiry_partner enable row level security;
alter table public.seepn_inquiry_partner force row level security;
revoke all on public.seepn_inquiry_partner from anon, authenticated;

-- Same posture as seepn_inquiry itself: no admin-facing SELECT policy at all
-- (admin reads go through admin_list_seepn_inquiries()/get_seepn_inquiry_detail(),
-- §4 below). The only direct-table read is the buyer's own rows, §5 below.
grant select on public.seepn_inquiry_partner to authenticated;


-- =============================================================================
-- §2. Data migration: seepn_inquiry.partner_id -> seepn_inquiry_partner, then
--     drop the column. `on conflict do nothing` makes the insert idempotent
--     (safe if this file is ever replayed against a DB where it already ran).
-- =============================================================================

insert into public.seepn_inquiry_partner (inquiry_id, partner_id, created_at)
select id, partner_id, created_at
from public.seepn_inquiry
on conflict (inquiry_id, partner_id) do nothing;

-- Sanity check: every SPECIFIC inquiry row must have migrated before the
-- column is dropped — abort the whole migration rather than silently lose a
-- reference if this ever somehow doesn't hold (defense in depth; the insert
-- above should never leave a gap since partner_id was NOT NULL on the source
-- column). A total-count comparison (v_migrated_count <> v_source_count)
-- would not actually catch "this particular inquiry lost its reference" —
-- privacy review 2026-09-10 flagged that a per-row existence check is the
-- correct guard here, not an aggregate count.
do $$
declare
  v_missing_count bigint;
begin
  select count(*) into v_missing_count
  from public.seepn_inquiry si
  where not exists (
    select 1 from public.seepn_inquiry_partner sip where sip.inquiry_id = si.id
  );
  if v_missing_count > 0 then
    raise exception 'seepn_inquiry_partner migration incomplete: % inquiry row(s) have no migrated partner reference', v_missing_count;
  end if;
end;
$$;

-- idx_seepn_inquiry_partner_id (on the column being dropped) is dropped
-- automatically by `drop column` — Postgres always drops indexes that
-- reference a dropped column, no separate `drop index` needed.
alter table public.seepn_inquiry drop column if exists partner_id;

comment on table public.seepn_inquiry is
  'B-18 minimal schema (INQ-1). Deliberately ONLY these columns — no
  category/budget/timeline/structured fields (SP-13 / B-11 boundary: adding
  any of those makes this B-11, which is Won''t in v1.0). No sender contact
  column either (INQ-3): the buyer''s email is looked up from auth.users /
  buyer_account at read time by get_seepn_inquiry_contact() (§12), never
  snapshotted here (privacy review §5.3(e) — a snapshot would create a
  second PII store and mean "withdrawn buyer" could still be emailed).
  GAP-C1 (2026-09-10): referenced partner(s) live in the
  public.seepn_inquiry_partner join table, NOT a partner_id column on this
  table (that column existed 2026-09-10 09:00-18:00 and was migrated out —
  see 20260910180000).';


-- =============================================================================
-- §3. create_seepn_inquiry(p_partner_ids uuid[], p_body text)
-- =============================================================================

drop function if exists public.create_seepn_inquiry(uuid, text);

create or replace function public.create_seepn_inquiry(p_partner_ids uuid[], p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_buyer_id uuid := private.current_buyer_id(v_auth_uid);
  v_inquiry_id uuid;
  v_partner_count integer;
  v_found_count integer;
  v_count_1h integer;
  v_count_24h integer;
  v_partner_id uuid;
  v_count_this_partner_24h integer;
begin
  if v_buyer_id is null or not private.is_active_buyer(v_auth_uid) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if p_body is null or char_length(p_body) < 20 or char_length(p_body) > 2000 then
    raise exception 'invalid_body_length';
  end if;

  -- GAP-C1 / product decision 2026-09-10: 1..5 partners (P5b comparison cap).
  -- Enforced HERE, not as a table CHECK — a CHECK constraint cannot count
  -- sibling rows in seepn_inquiry_partner cleanly in Postgres, and the RPC
  -- is the only INSERT path into either table anyway (same rationale as the
  -- body-length CHECK note on seepn_inquiry itself).
  v_partner_count := coalesce(array_length(p_partner_ids, 1), 0);
  if v_partner_count < 1 or v_partner_count > 5 then
    raise exception 'invalid_partner_count' using errcode = 'P0001';
  end if;

  if array_length(array(select distinct unnest(p_partner_ids)), 1) <> v_partner_count then
    raise exception 'duplicate_partner_ids' using errcode = 'P0001';
  end if;

  -- Gate: identical to the exact 3-layer public-listing gate
  -- private.partner_public_base applies (verified + public_listing on +
  -- latest public_listing consent granted) — tightened vs. P5a's original
  -- `exists (select 1 from public.partner where id = p_partner_id)`, which
  -- only checked the partner row existed at all, not that it was actually
  -- publicly listed. A buyer must not be able to inquire about a partner
  -- they could never have seen via partner_list_public/partner_detail_buyer
  -- in the first place. Every id must be found — a single miss (whether the
  -- id doesn't exist at all, or exists but fails the gate) is reported
  -- identically as partner_not_found, same non-leaking posture as P5a.
  select count(*) into v_found_count
  from private.partner_public_base b
  where b.id = any(p_partner_ids);
  if v_found_count <> v_partner_count then
    raise exception 'partner_not_found' using errcode = 'P0002';
  end if;

  -- BP-8: rate limit is enforced HERE (inside the SECURITY DEFINER RPC, via a
  -- direct DB count), never in a calling server route — a route-level limit
  -- is trivially bypassed because this RPC is granted to `authenticated` and
  -- a buyer can call it directly via PostgREST with their own JWT (privacy
  -- review §5.3(g)). Thresholds are operationally adjustable; the REQUIREMENT
  -- is the location (inside the DB), not these specific numbers. The 1h/24h
  -- buyer-wide counts are unchanged (one row in seepn_inquiry == one "send"
  -- action regardless of how many partners it references); the per-partner
  -- 24h cap is now evaluated per referenced partner via the join table.
  select count(*) into v_count_1h from public.seepn_inquiry
  where buyer_account_id = v_buyer_id and created_at > now() - interval '1 hour';
  if v_count_1h >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select count(*) into v_count_24h from public.seepn_inquiry
  where buyer_account_id = v_buyer_id and created_at > now() - interval '24 hours';
  if v_count_24h >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  foreach v_partner_id in array p_partner_ids loop
    select count(distinct sip.inquiry_id) into v_count_this_partner_24h
    from public.seepn_inquiry_partner sip
    join public.seepn_inquiry si on si.id = sip.inquiry_id
    where si.buyer_account_id = v_buyer_id
      and sip.partner_id = v_partner_id
      and si.created_at > now() - interval '24 hours';
    if v_count_this_partner_24h >= 3 then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
  end loop;

  insert into public.seepn_inquiry (buyer_account_id, body)
  values (v_buyer_id, p_body)
  returning id into v_inquiry_id;

  insert into public.seepn_inquiry_partner (inquiry_id, partner_id)
  select v_inquiry_id, x from unnest(p_partner_ids) as x;

  perform private.log_audit(
    p_action := 'seepn_inquiry.create',
    p_target_table := 'seepn_inquiry', p_target_id := v_inquiry_id::text,
    p_subject_ids := p_partner_ids
  );

  return v_inquiry_id;
end;
$$;

comment on function public.create_seepn_inquiry is
  'D-S5/INQ-2/SP-13, revised 2026-09-10 (GAP-C1): p_partner_ids uuid[]
  (1..5, no duplicates, each must pass the private.partner_public_base gate),
  p_body text — still only 2 parameters, on purpose — no sender-contact
  parameter (INQ-3, server looks it up), no structured fields (category/
  budget/timeline — SP-13 B-11 boundary). Passing a single-element array
  reproduces the original P5a single-partner behaviour exactly (backward
  compatible). Adding a parameter to this function''s signature beyond
  p_partner_ids/p_body without a corresponding product-planner sign-off is a
  scope violation, not a refactor.';

revoke all on function public.create_seepn_inquiry(uuid[], text) from public;
grant execute on function public.create_seepn_inquiry(uuid[], text) to authenticated;


-- =============================================================================
-- §4. Admin consumption: admin_list_seepn_inquiries() / get_seepn_inquiry_detail()
-- =============================================================================

-- Return shape changed (partner_id/partner_company_name_ko columns replaced
-- by a single `partners` jsonb array) — CREATE OR REPLACE cannot change a
-- function's return TABLE shape, so the old signature is dropped first.
drop function if exists public.admin_list_seepn_inquiries(text, text, integer, integer);

create or replace function public.admin_list_seepn_inquiries(
  p_status text default null,
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  partners jsonb,
  buyer_display_name_masked text,
  status text,
  assigned_admin_id uuid,
  assigned_admin_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    private.is_active_admin() and private.is_aal2()
    and private.has_menu_permission('lead_management', 'read')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  perform private.log_audit(p_action := 'admin_seepn_inquiry.list');

  return query
  select
    si.id,
    (
      select jsonb_agg(jsonb_build_object('id', p.id, 'company_name_ko', p.company_name_ko) order by p.company_name_ko)
      from public.seepn_inquiry_partner sip
      join public.partner p on p.id = sip.partner_id
      where sip.inquiry_id = si.id
    ) as partners,
    private.mask_name(ba.display_name) as buyer_display_name_masked,
    si.status, si.assigned_admin_id, au.display_name as assigned_admin_name,
    si.created_at
  from public.seepn_inquiry si
  join public.buyer_account ba on ba.id = si.buyer_account_id
  left join public.admin_user au on au.id = si.assigned_admin_id
  where (p_status is null or si.status = p_status)
    and (
      p_search is null or p_search = ''
      or ba.display_name ilike '%' || p_search || '%'
      or exists (
        select 1
        from public.seepn_inquiry_partner sip
        join public.partner p on p.id = sip.partner_id
        where sip.inquiry_id = si.id
          and p.company_name_ko ilike '%' || p_search || '%'
      )
    )
  order by si.created_at desc
  limit greatest(least(coalesce(p_limit, 50), 200), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

comment on function public.admin_list_seepn_inquiries is
  'Privacy review §5.3(d)/(e): NO body column in the return shape — "본문
  미리보기 없음" (기본값 채택). buyer_display_name_masked uses
  private.mask_name(), never the raw display_name (raw is only available via
  get_seepn_inquiry_detail(), and raw email only via
  get_seepn_inquiry_contact()). GAP-C1 (2026-09-10): `partners` is a jsonb
  array of {id, company_name_ko}, one element per referenced partner (was a
  single partner_id/partner_company_name_ko pair before this migration) — can
  be empty-array-as-null (jsonb_agg with no rows returns null) only if an
  inquiry somehow has zero partner refs, which create_seepn_inquiry() never
  allows to happen (1..5 enforced at INSERT time).';

revoke all on function public.admin_list_seepn_inquiries(text, text, integer, integer) from public;
grant execute on function public.admin_list_seepn_inquiries(text, text, integer, integer) to authenticated;


create or replace function public.get_seepn_inquiry_detail(p_inquiry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_partners jsonb;
  v_partner_ids uuid[];
  v_audit_id bigint;
begin
  if not (
    private.is_active_admin() and private.is_aal2()
    and private.has_menu_permission('lead_management', 'read')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  select si.*, ba.display_name as buyer_display_name, au.display_name as assigned_admin_name
  into v_row
  from public.seepn_inquiry si
  join public.buyer_account ba on ba.id = si.buyer_account_id
  left join public.admin_user au on au.id = si.assigned_admin_id
  where si.id = p_inquiry_id;

  if not found then
    raise exception 'inquiry_not_found' using errcode = 'P0002';
  end if;

  select jsonb_agg(jsonb_build_object('id', p.id, 'company_name_ko', p.company_name_ko) order by p.company_name_ko),
         array_agg(sip.partner_id)
  into v_partners, v_partner_ids
  from public.seepn_inquiry_partner sip
  join public.partner p on p.id = sip.partner_id
  where sip.inquiry_id = p_inquiry_id;

  -- INQ-7: opening the detail view (which DOES reveal the body — screen-spec
  -- §7.3 "상세 클릭시에만 노출") is itself audited, unlike list access which
  -- is masked and lower-stakes.
  v_audit_id := private.log_audit(
    p_action := 'admin_seepn_inquiry.view',
    p_target_table := 'seepn_inquiry', p_target_id := p_inquiry_id::text,
    p_subject_ids := v_partner_ids
  );
  if v_audit_id is null then
    raise exception 'audit_log_write_failed: inquiry detail view aborted because the audit record could not be written'
      using errcode = '55000';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'partners', coalesce(v_partners, '[]'::jsonb),
    'buyer_display_name', v_row.buyer_display_name,
    'body', v_row.body,
    'status', v_row.status,
    'assigned_admin_id', v_row.assigned_admin_id,
    'assigned_admin_name', v_row.assigned_admin_name,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at,
    'closed_at', v_row.closed_at
  );
end;
$$;

comment on function public.get_seepn_inquiry_detail is
  'GAP-C1 (2026-09-10): returns `partners` (jsonb array of
  {id, company_name_ko}) instead of a single partner_id/partner_company_name_ko
  pair. Audit p_subject_ids now carries every referenced partner_id, not just
  one (private.log_audit already accepted uuid[] — no change needed there).';

revoke all on function public.get_seepn_inquiry_detail(uuid) from public;
grant execute on function public.get_seepn_inquiry_detail(uuid) to authenticated;


-- =============================================================================
-- §5. Buyer self-read RLS on the join table (BY-12 "내 문의 내역", mirrors
--     seepn_inquiry_self_select — direct table read, no RPC, since the buyer
--     is only ever allowed to see their OWN inquiries' partner refs).
-- =============================================================================

drop policy if exists seepn_inquiry_partner_self_select on public.seepn_inquiry_partner;

create policy seepn_inquiry_partner_self_select on public.seepn_inquiry_partner
  for select to authenticated
  using (
    (select private.is_active_buyer())
    and exists (
      select 1 from public.seepn_inquiry si
      where si.id = seepn_inquiry_partner.inquiry_id
        and si.buyer_account_id = (select private.current_buyer_id())
    )
  );

-- =============================================================================
-- End of seepn_inquiry multi-partner migration.
-- =============================================================================
