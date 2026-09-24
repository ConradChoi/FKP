-- =============================================================================
-- buyer_saved_comparison 보강 (privacy-security-officer 검토 R1~R3, 2026-09-24)
-- 20260924130000은 이미 운영 DB에 실행되어 수정하지 않고, 이 파일로 덧붙인다.
--   R1 동시 호출로 같은 조합이 중복 저장되거나 20개 한도를 넘는 경쟁 -> unique index + 계정 행 잠금
--   R2 과대 입력(6개 이상)을 배열 가공 전에 거부
--   R3 파트너·관리자 화면 노출 금지를 테이블 comment로 명시
--
-- Not yet executed against Supabase — paste into the SQL Editor manually.
-- =============================================================================

create unique index if not exists uq_buyer_saved_comparison_set
  on public.buyer_saved_comparison (buyer_account_id, partner_ids);

comment on table public.buyer_saved_comparison is
  'Buyer-private saved comparison sets. NEVER expose to partner/admin screens in any form (counts included) - doing so needs privacy-security-officer re-review and a privacy policy art. 6 revision.';


create or replace function public.buyer_save_comparison(p_partner_ids uuid[])
returns table (comparison_id uuid, already_saved boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid := private.current_buyer_id(auth.uid());
  v_ids uuid[];
  v_existing uuid;
  v_new uuid;
begin
  if v_account_id is null or not private.is_active_buyer(auth.uid()) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if coalesce(cardinality(p_partner_ids), 0) > 5 then
    raise exception 'invalid_partner_count';
  end if;

  -- Serialize concurrent saves for one account so the 20-set cap and the duplicate check cannot race.
  perform 1 from public.buyer_account where id = v_account_id for update;

  -- Canonical form: distinct + sorted, so the same set saved twice (any order) is one row.
  select array_agg(x order by x) into v_ids from (select distinct unnest(p_partner_ids) as x) s;
  if v_ids is null or array_length(v_ids, 1) not between 2 and 5 then
    raise exception 'invalid_partner_count';
  end if;

  -- Only partners currently visible to buyers can be saved (same gate as the list/compare pages).
  if (select count(*) from public.partner_list_public pl where pl.id = any (v_ids)) <> array_length(v_ids, 1) then
    raise exception 'partner_not_available';
  end if;

  select c.id into v_existing
  from public.buyer_saved_comparison c
  where c.buyer_account_id = v_account_id and c.partner_ids = v_ids
  limit 1;
  if v_existing is not null then
    return query select v_existing, true;
    return;
  end if;

  if (select count(*) from public.buyer_saved_comparison c where c.buyer_account_id = v_account_id) >= 20 then
    raise exception 'limit_reached';
  end if;

  insert into public.buyer_saved_comparison (buyer_account_id, partner_ids)
  values (v_account_id, v_ids)
  returning id into v_new;

  return query select v_new, false;
end;
$$;
