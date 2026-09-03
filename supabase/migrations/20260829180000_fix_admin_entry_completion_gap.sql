-- =============================================================================
-- Fix (service-planner, 2026-08-30) — the admin_entry exception path (D-6/
-- PC-1) can never actually reach 'submitted'. admin_create_partner_entry()
-- creates the row with intake_source='admin_entry' and owner_account_id
-- left NULL (unclaimed — by design, PC-3), but every RPC that can write
-- private.partner_contact or transition draft -> submitted is gated on
-- private.is_active_partner() + owner_account_id = current_partner_id(),
-- which no admin session can ever satisfy. Combined with
-- private.partner_profile_submission_gaps() always requiring a
-- private.partner_contact row to exist, an admin_entry partner is
-- structurally stuck in 'draft' forever — the "예외 경로"에 fields exists on
-- paper (A1-R2) but has no way to finish. This was found while
-- service-planner was writing the /admin/partners screen spec, not by the
-- earlier qa-reviewer pass (which checked security properties, not whether
-- every state transition PRD/schema promise is actually reachable).
-- =============================================================================

-- =============================================================================
-- §1. public.admin_set_partner_contact — admin-side write for
-- private.partner_contact, mirroring set_own_partner_contact (20260829140000)
-- but for a partner that has no owning partner_account yet (or ever, if it
-- stays admin_entry-only). Upsert, not insert-only: admin_entry contact
-- details are commonly corrected across the phone/in-person conversation
-- described in PC-7's evidence trail, so requiring the admin to know whether
-- a row already exists would just be friction.
-- =============================================================================

create or replace function public.admin_set_partner_contact(
  p_partner_id uuid,
  p_contact_name text,
  p_contact_title text,
  p_contact_email text,
  p_contact_phone text,
  p_representative_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    private.is_active_admin() and private.is_aal2()
    and private.has_menu_permission('partner_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if not exists (select 1 from public.partner where id = p_partner_id) then
    raise exception 'partner_not_found' using errcode = 'P0002';
  end if;

  if p_contact_name is null or char_length(trim(p_contact_name)) = 0 then
    raise exception 'invalid_contact_name';
  end if;
  if p_contact_email is null or p_contact_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'invalid_contact_email';
  end if;

  insert into private.partner_contact (
    partner_id, contact_name, contact_title, contact_email, contact_phone, representative_name
  ) values (
    p_partner_id, trim(p_contact_name), p_contact_title, lower(trim(p_contact_email)), p_contact_phone, p_representative_name
  )
  on conflict (partner_id) do update set
    contact_name = excluded.contact_name,
    contact_title = excluded.contact_title,
    contact_email = excluded.contact_email,
    contact_phone = excluded.contact_phone,
    representative_name = excluded.representative_name,
    updated_at = now();

  -- Same masked-column sync obligation set_own_partner_contact's own trigger
  -- handles for the self-service path — private.partner_contact has an
  -- AFTER INSERT OR UPDATE trigger (trg_partner_contact_sync_masked, see
  -- 20260829140000 §5) that keeps public.partner's masked display columns
  -- current regardless of which RPC wrote the row, so nothing further is
  -- needed here.

  perform private.log_audit(
    p_action := 'admin_partner.update', p_target_table := 'partner', p_target_id := p_partner_id::text,
    p_subject_ids := array[p_partner_id],
    p_after_summary := jsonb_build_object('field', 'contact')
  );
end;
$$;

revoke all on function public.admin_set_partner_contact(uuid, text, text, text, text, text) from public;
grant execute on function public.admin_set_partner_contact(uuid, text, text, text, text, text) to authenticated;


-- =============================================================================
-- §2. public.admin_submit_partner_for_review — admin-side draft -> submitted
-- transition, mirroring partner_submit_for_review() but reachable without an
-- owning partner_account. Reuses the SAME gap-check function so "what counts
-- as complete" never drifts between the two intake paths.
-- =============================================================================

create or replace function public.admin_submit_partner_for_review(p_partner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner public.partner%rowtype;
  v_gaps text[];
begin
  if not (
    private.is_active_admin() and private.is_aal2()
    and private.has_menu_permission('partner_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  select * into v_partner from public.partner where id = p_partner_id;
  if v_partner.id is null then
    raise exception 'partner_not_found' using errcode = 'P0002';
  end if;

  if v_partner.verification_state not in ('draft', 'rejected') then
    raise exception 'invalid_state_for_submission';
  end if;

  v_gaps := private.partner_profile_submission_gaps(v_partner);
  if array_length(v_gaps, 1) > 0 then
    raise exception 'profile_incomplete: %', array_to_string(v_gaps, ', ') using errcode = 'P0001';
  end if;

  update public.partner set verification_state = 'submitted' where id = p_partner_id;

  perform private.log_audit(
    p_action := 'admin_partner.update', p_target_table := 'partner', p_target_id := p_partner_id::text,
    p_subject_ids := array[p_partner_id],
    p_after_summary := jsonb_build_object('verification_state', 'submitted')
  );
end;
$$;

revoke all on function public.admin_submit_partner_for_review(uuid) from public;
grant execute on function public.admin_submit_partner_for_review(uuid) to authenticated;


-- =============================================================================
-- §3. admin_create_partner_entry — extend with an optional public_listing
-- consent grant captured in the SAME phone/in-person conversation as terms/
-- privacy, per review §3.4: "운영자가 '구두로 공개 동의도 받았다'고 체크하려면
-- evidence_kind를 none이 아닌 값으로 입력하게 강제" — p_evidence_kind is
-- already required non-null with a non-'none' default ('call_log'), so the
-- existing parameter already satisfies that condition; this only adds the
-- explicit opt-in boolean so the consent row is created ONLY when the admin
-- affirmatively confirms it was discussed, never implicitly. Trailing
-- parameter with a default — safe to CREATE OR REPLACE without breaking the
-- existing call shape.
-- =============================================================================

create or replace function public.admin_create_partner_entry(
  p_business_entity_type text,
  p_company_name_ko text,
  p_vertical text,
  p_business_registration_number text,
  p_method text,
  p_collected_at timestamptz,
  p_consenter_name text,
  p_consenter_title text,
  p_collection_source_detail text,
  p_evidence_kind text default 'call_log',
  p_public_listing_consent boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_admin_id uuid;
  v_partner_id uuid;
  v_consent_id uuid;
begin
  if not (
    private.is_active_admin(v_auth_uid)
    and private.is_aal2()
    and private.has_menu_permission('partner_management', 'create', v_auth_uid)
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if p_method not in ('phone', 'in_person') then
    raise exception 'invalid_consent_method';
  end if;
  if p_collected_at > now() or p_collected_at < now() - interval '30 days' then
    raise exception 'invalid_collected_at';
  end if;
  if p_consenter_name is null or char_length(trim(p_consenter_name)) = 0 then
    raise exception 'consenter_name_required';
  end if;
  if p_consenter_title is null or char_length(trim(p_consenter_title)) = 0 then
    raise exception 'consenter_title_required';
  end if;
  if p_collection_source_detail is null or char_length(trim(p_collection_source_detail)) = 0 then
    raise exception 'collection_source_detail_required';
  end if;

  select id into v_admin_id from public.admin_user where auth_user_id = v_auth_uid;

  insert into public.partner (
    intake_source, verification_state, business_entity_type, company_name_ko, vertical,
    business_registration_number, referred_by, referred_at, collection_source_detail, consent_deadline_at
  ) values (
    'admin_entry', 'draft', p_business_entity_type, p_company_name_ko, p_vertical,
    p_business_registration_number, v_admin_id, now(), p_collection_source_detail, now() + interval '90 days'
  )
  returning id into v_partner_id;

  insert into public.partner_consent (partner_id, consent_type, granted, method, collected_at, recorded_by_admin_id, evidence_kind)
  values (v_partner_id, 'terms', true, p_method, p_collected_at, v_admin_id, p_evidence_kind)
  returning id into v_consent_id;
  insert into private.partner_consent_meta (consent_id, consenter_name, consenter_title)
  values (v_consent_id, trim(p_consenter_name), trim(p_consenter_title));

  insert into public.partner_consent (partner_id, consent_type, granted, method, collected_at, recorded_by_admin_id, evidence_kind)
  values (v_partner_id, 'privacy', true, p_method, p_collected_at, v_admin_id, p_evidence_kind)
  returning id into v_consent_id;
  insert into private.partner_consent_meta (consent_id, consenter_name, consenter_title)
  values (v_consent_id, trim(p_consenter_name), trim(p_consenter_title));

  -- New: only when the admin explicitly confirms this specific consent was
  -- also covered in the same call/visit.
  -- Fix (qa-reviewer re-review, 2026-08-30): a default of 'call_log' on
  -- p_evidence_kind is not the same as ENFORCING non-'none' — a caller can
  -- still explicitly pass evidence_kind:='none' alongside
  -- public_listing_consent:=true, which this block did not reject, silently
  -- producing a "granted" public_listing consent row with no evidence at
  -- all. This is exactly the case privacy review §3.4 says must be blocked
  -- ("evidence_kind를 none이 아닌 값으로 입력하게 강제"), and
  -- admin_record_partner_consent (§4 below) already enforces it correctly —
  -- this path was the inconsistent one.
  if p_public_listing_consent and p_evidence_kind = 'none' then
    raise exception 'evidence_kind_required';
  end if;

  if p_public_listing_consent then
    insert into public.partner_consent (partner_id, consent_type, granted, method, collected_at, recorded_by_admin_id, evidence_kind)
    values (v_partner_id, 'public_listing', true, p_method, p_collected_at, v_admin_id, p_evidence_kind)
    returning id into v_consent_id;
    insert into private.partner_consent_meta (consent_id, consenter_name, consenter_title)
    values (v_consent_id, trim(p_consenter_name), trim(p_consenter_title));
  end if;

  perform private.log_audit(
    p_action := 'admin_partner.admin_entry_create',
    p_target_table := 'partner', p_target_id := v_partner_id::text,
    p_subject_ids := array[v_partner_id],
    p_after_summary := jsonb_build_object(
      'business_entity_type', p_business_entity_type, 'vertical', p_vertical,
      'public_listing_consent', p_public_listing_consent
    )
  );
  perform private.log_audit(
    p_action := 'admin_partner.consent_evidence_write',
    p_target_table := 'partner', p_target_id := v_partner_id::text,
    p_subject_ids := array[v_partner_id],
    p_after_summary := jsonb_build_object('method', p_method, 'evidence_kind', p_evidence_kind)
  );

  return v_partner_id;
end;
$$;

revoke all on function public.admin_create_partner_entry(text, text, text, text, text, timestamptz, text, text, text, text, boolean) from public;
grant execute on function public.admin_create_partner_entry(text, text, text, text, text, timestamptz, text, text, text, text, boolean) to authenticated;

-- The old 10-arg signature is a DISTINCT overload as far as Postgres is
-- concerned (CREATE OR REPLACE with an added parameter creates a new
-- overload, it does not replace the old one) — drop it explicitly so the
-- old call shape (without p_public_listing_consent) can never be invoked
-- and silently skip the new opt-in.
drop function if exists public.admin_create_partner_entry(text, text, text, text, text, timestamptz, text, text, text, text);


-- =============================================================================
-- §4. public.admin_record_partner_consent — closes the remaining half of G-3:
-- an admin_entry partner who declined (or was never asked about)
-- public_listing at creation time may confirm it in a LATER phone/in-person
-- follow-up. §3 above only covers the "captured in the same conversation as
-- signup" case; this covers every subsequent case for an existing row.
-- Scoped to 'public_listing' only (the review's §3.4 "구두 동의" scenario)
-- — 'terms'/'privacy' are always granted at admin_entry creation already,
-- 'marketing' is a simple self-service opt-in with no evidence requirement
-- (partner_grant_consent), and 'third_party_share' is per-match only (F-8),
-- never collected here.
-- =============================================================================

create or replace function public.admin_record_partner_consent(
  p_partner_id uuid,
  p_method text,
  p_collected_at timestamptz,
  p_consenter_name text,
  p_consenter_title text,
  p_evidence_kind text default 'call_log'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid;
  v_consent_id uuid;
begin
  if not (
    private.is_active_admin() and private.is_aal2()
    and private.has_menu_permission('partner_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if not exists (select 1 from public.partner where id = p_partner_id) then
    raise exception 'partner_not_found' using errcode = 'P0002';
  end if;

  if p_method not in ('phone', 'in_person') then
    raise exception 'invalid_consent_method';
  end if;
  if p_collected_at > now() or p_collected_at < now() - interval '30 days' then
    raise exception 'invalid_collected_at';
  end if;
  if p_consenter_name is null or char_length(trim(p_consenter_name)) = 0 then
    raise exception 'consenter_name_required';
  end if;
  if p_consenter_title is null or char_length(trim(p_consenter_title)) = 0 then
    raise exception 'consenter_title_required';
  end if;
  if p_evidence_kind = 'none' then
    raise exception 'evidence_kind_required';
  end if;

  select id into v_admin_id from public.admin_user where auth_user_id = auth.uid();

  insert into public.partner_consent (partner_id, consent_type, granted, method, collected_at, recorded_by_admin_id, evidence_kind)
  values (p_partner_id, 'public_listing', true, p_method, p_collected_at, v_admin_id, p_evidence_kind)
  returning id into v_consent_id;
  insert into private.partner_consent_meta (consent_id, consenter_name, consenter_title)
  values (v_consent_id, trim(p_consenter_name), trim(p_consenter_title));

  perform private.log_audit(
    p_action := 'admin_partner.consent_evidence_write',
    p_target_table := 'partner', p_target_id := p_partner_id::text,
    p_subject_ids := array[p_partner_id],
    p_after_summary := jsonb_build_object('consent_type', 'public_listing', 'method', p_method, 'evidence_kind', p_evidence_kind)
  );
end;
$$;

comment on function public.admin_record_partner_consent is
  'Closes the follow-up half of G-3 (service-planner, 2026-08-30): admin_create_partner_entry''s '
  'p_public_listing_consent only covers consent captured at row-creation time. This RPC lets an '
  'admin record public_listing consent for an ALREADY-EXISTING partner from a later phone/in-person '
  'confirmation, so partner_set_public_listing''s condition (c) evidence check can ever be satisfied '
  'for an admin_entry row that did not confirm public listing up front.';

revoke all on function public.admin_record_partner_consent(uuid, text, timestamptz, text, text, text) from public;
grant execute on function public.admin_record_partner_consent(uuid, text, timestamptz, text, text, text) to authenticated;
