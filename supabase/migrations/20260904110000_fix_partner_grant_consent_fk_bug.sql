-- =============================================================================
-- Follow-up fix to 20260829140000 / 20260904100000 — qa-reviewer finding,
-- 2026-09-04, on the `/supplier` privacy-fix batch (not yet run against
-- Supabase at review time; 20260904100000 was already executed by the user
-- before this fix landed, so it ships as its own migration rather than an
-- edit to either already-applied file).
--
-- §0. [CRITICAL] public.partner_grant_consent() inserts the wrong id.
--     private.current_partner_id() returns partner_account.id (see its own
--     comment, 20260829130000 lines 529-533: "returns only the CALLING
--     user's own partner_account.id"). partner_consent.partner_id is
--     `references public.partner(id)` — a DIFFERENT uuid identifying the
--     company profile row, not the login account row (exactly the
--     distinction finalize_partner_signup keeps separate as v_account_id vs
--     v_partner_id, 20260829140000 lines ~1070-1076, and that
--     get_own_partner_consents correctly re-resolves via `where
--     owner_account_id = private.current_partner_id(...)`,
--     20260904100000 line 116).
--
--     partner_grant_consent skipped that re-resolution step and inserted
--     the account id directly (20260829140000 lines 1650-1689, originally
--     shipped as part of that migration — this bug predates the
--     `/supplier` app work and was live in Supabase, unused, since that
--     migration first ran). Because partner_consent.partner_id is NOT NULL
--     + immediately-checked FK to partner(id), and an account id matching
--     an unrelated partner id by chance is not a real possibility, EVERY
--     call to this function fails with a foreign_key_violation. This is
--     the function UI-B3 (public-listing consent revocation, ceo-advisor:
--     blocking) and the marketing-consent toggle both depend on — as
--     shipped, neither can ever succeed.
--
--     20260904100000's own header comment (line 40-44) asserted "no SQL
--     change needed — partner_grant_consent already exists and is
--     correct." That assertion was wrong; this file corrects it.
--
-- §1. [MAJOR, qa-reviewer] public.get_own_partner_id() has no defense
--     against a caller ending up with more than one public.partner row
--     (partner.owner_account_id carries no unique constraint, only a plain
--     btree index — 20260829140000 line 178). Nothing in today's
--     application code path can create a second row for one account, but
--     the schema does not forbid it, and the three new Route Handlers
--     (withdraw/documents/check-brn) all consume this RPC with `.single()`
--     — a future bug or manual data fix that produced a second row would
--     make all three misfire as `access_denied` for a legitimate partner,
--     in a form that is hard to diagnose from the client side. A partial
--     unique index closes this at the schema level instead of relying on
--     every future caller remembering to defend against it.
--
-- Not yet executed against Supabase — paste into the SQL Editor manually.
-- =============================================================================


-- =============================================================================
-- §0. Fix: resolve the caller's actual partner.id before inserting into
--     partner_consent, the same way get_own_partner_consents already does.
--     Everything else about the function (guard, allowed consent_type
--     values, audit call, GRANT) is unchanged from 20260829140000.
-- =============================================================================

create or replace function public.partner_grant_consent(
  p_consent_type text,
  p_granted boolean,
  p_document_version text default null,
  p_consent_locale text default 'ko'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_account_id uuid := private.current_partner_id(v_auth_uid);
  v_partner_id uuid;
begin
  if v_account_id is null or not private.is_active_partner(v_auth_uid) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  -- Bug fix (this migration): v_account_id is partner_account.id, NOT
  -- partner.id — partner_consent.partner_id references the latter. Must
  -- re-resolve, exactly as get_own_partner_consents does.
  select id into v_partner_id from public.partner where owner_account_id = v_account_id;
  if v_partner_id is null then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if p_consent_type not in ('public_listing', 'marketing') then
    raise exception 'consent_type_not_self_service' using errcode = 'P0001';
  end if;

  insert into public.partner_consent (
    partner_id, consent_type, granted, document_version, consent_locale, method, collected_at
  ) values (
    v_partner_id, p_consent_type, p_granted, p_document_version, p_consent_locale, 'online_self', now()
  );

  perform private.log_audit(
    p_action := case when p_granted then 'partner.consent_grant' else 'partner.consent_revoke' end,
    p_target_table := 'partner_consent', p_target_id := v_partner_id::text,
    p_subject_ids := array[v_partner_id],
    p_after_summary := jsonb_build_object('consent_type', p_consent_type, 'granted', p_granted)
  );
end;
$$;

revoke all on function public.partner_grant_consent(text, boolean, text, text) from public;
grant execute on function public.partner_grant_consent(text, boolean, text, text) to authenticated;


-- =============================================================================
-- §1. Schema-level defense: one partner row per owning account, max.
-- =============================================================================

create unique index if not exists uq_partner_owner_account_id
  on public.partner (owner_account_id)
  where owner_account_id is not null;

comment on index public.uq_partner_owner_account_id is
  'qa-reviewer finding, 2026-09-04: get_own_partner_id() and every '
  '"select ... where owner_account_id = ..." lookup in this schema assume '
  'at most one partner row per account. Nothing previously enforced that; '
  'this makes the assumption structurally true instead of relying on every '
  'caller defending against it.';
