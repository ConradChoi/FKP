-- =============================================================================
-- public.get_own_buyer_consents()
--
-- Buyer analog of public.get_own_partner_consents()
-- (20260904100000_supplier_app_privacy_fixes.sql §1, UI-B2). Fills the same
-- gap on the buyer side: public.buyer_grant_consent() (20260910100000
-- seepn_buyer_web_p5a.sql line ~637) can WRITE a consent row, but nothing can
-- READ current consent state back — needed for the marketing-consent
-- withdrawal screen (P-18) to know a toggle's initial position.
--
-- public.buyer_consent has RLS enabled+forced and
-- `revoke all ... from anon, authenticated, service_role` (same file, §6),
-- so PostgREST cannot SELECT it directly; a security definer function is the
-- only read path, exactly as for partner_consent.
--
-- Same field whitelist discipline as get_own_partner_consents: only
-- granted / collected_at / document_version are exposed. Latest recorded_at
-- row per consent_type; a type with no history is omitted from the object
-- entirely (never a null value), so the frontend can distinguish "미동의"
-- from "기록 없음".
--
-- consent_type scope is array['terms', 'privacy', 'marketing'] only —
-- 'third_party_share' is excluded for the same reason as the partner side
-- (D-14②: reserved value, no code path ever writes it in v1.0, and this RPC
-- must not flatten a future per-case consent type into a type-level summary).
--
-- Self-access to one's own consent history is not audited (PR-15, same
-- stance as get_own_partner_contact / get_own_partner_consents — auditing
-- every self-view would just bloat audit_log with no security value).
-- =============================================================================

create or replace function public.get_own_buyer_consents()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_account_id uuid := private.current_buyer_id(v_auth_uid);
  v_result jsonb := '{}'::jsonb;
  v_type text;
  v_row public.buyer_consent%rowtype;
begin
  if v_account_id is null or not private.is_active_buyer(v_auth_uid) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  -- D-14②: 'third_party_share' is explicitly OUT of scope for this RPC —
  -- reserved value only, see public.buyer_consent's table comment.
  foreach v_type in array array['terms', 'privacy', 'marketing']
  loop
    select * into v_row
    from public.buyer_consent
    where buyer_account_id = v_account_id and consent_type = v_type
    order by recorded_at desc
    limit 1;

    if found then
      v_result := v_result || jsonb_build_object(
        v_type, jsonb_build_object(
          'granted', v_row.granted,
          'collected_at', v_row.collected_at,
          'document_version', v_row.document_version
        )
      );
    end if;
  end loop;

  return v_result;
end;
$$;

comment on function public.get_own_buyer_consents is
  'Buyer analog of get_own_partner_consents (privacy review §1.2 discipline '
  'reused as-is). Field whitelist (granted/collected_at/document_version) is '
  'load-bearing, not incidental — do not add columns without re-checking the '
  'partner-side rationale first. consent_type scope is terms/privacy/marketing '
  'only; third_party_share stays reserved (D-14²).';

revoke all on function public.get_own_buyer_consents() from public;
grant execute on function public.get_own_buyer_consents() to authenticated;
