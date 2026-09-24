-- =============================================================================
-- SEEPN 마이페이지 > 비교 공급사: 사용자가 '저장'한 비교 조합 (2026-09-24)
--
-- 자동 이력이 아니라 **사용자가 저장 버튼을 눌렀을 때만** 기록한다(대표 결정). 저장은 RPC로만
-- 가능하고(직접 INSERT 권한 없음) 조합 2~5곳·공개 상태 파트너만·계정당 최대 20개를 서버에서
-- 검증한다. 조회·삭제는 본인 행만(RLS). 자발 탈퇴 시 buyer_withdraw()가 관심등록과 함께
-- 즉시 삭제한다(휴면 자동 탈퇴는 관심등록과 같이 보존 — 처리방침 제5조와 동일 구조).
--
-- 거래 공급사는 이 파일에 없다: 새 테이블 없이 본인 문의(seepn_inquiry, seepn_inquiry_partner)에서
-- 화면 쿼리로 파생한다.
--
-- 개인정보: 회원의 행동 기록(어떤 공급사를 비교했는지)이라 처리방침 수집 항목·보유기간에 추가가
-- 필요하다 — docs/03-security/legal-review-queue.md P-21 참조.
--
-- Not yet executed against Supabase — paste into the SQL Editor manually.
-- =============================================================================

create table if not exists public.buyer_saved_comparison (
  id uuid primary key default gen_random_uuid(),
  buyer_account_id uuid not null references public.buyer_account (id) on delete cascade,
  partner_ids uuid[] not null check (array_length(partner_ids, 1) between 2 and 5),
  created_at timestamptz not null default now()
);

create index if not exists idx_buyer_saved_comparison_account_created
  on public.buyer_saved_comparison (buyer_account_id, created_at desc);

alter table public.buyer_saved_comparison enable row level security;
alter table public.buyer_saved_comparison force row level security;
revoke all on public.buyer_saved_comparison from anon, authenticated;
grant select, delete on public.buyer_saved_comparison to authenticated;

create policy buyer_saved_comparison_self_select on public.buyer_saved_comparison
  for select to authenticated
  using ((select private.is_active_buyer()) and buyer_account_id = (select private.current_buyer_id()));

create policy buyer_saved_comparison_self_delete on public.buyer_saved_comparison
  for delete to authenticated
  using ((select private.is_active_buyer()) and buyer_account_id = (select private.current_buyer_id()));


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

revoke all on function public.buyer_save_comparison(uuid[]) from public;
grant execute on function public.buyer_save_comparison(uuid[]) to authenticated;


-- buyer_withdraw(): 20260910100000 §7 verbatim + the saved-comparison delete (marked below).
create or replace function public.buyer_withdraw()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_account_id uuid := private.current_buyer_id(v_auth_uid);
begin
  if v_account_id is null or not private.is_active_buyer(v_auth_uid) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  update public.buyer_account
  set status = 'withdrawn', withdrawn_at = now()
  where id = v_account_id;

  -- BP-13: bookmarks are hard-deleted immediately on withdrawal — the only
  -- purpose they served (showing the buyer their own list) disappears with
  -- the account, unlike partner Match rows which survive as business records.
  delete from public.buyer_bookmark where buyer_account_id = v_account_id;

  -- 20260924130000: saved comparisons follow the same rule as bookmarks — the only purpose they
  -- served (showing the buyer their own list) disappears with the account.
  delete from public.buyer_saved_comparison where buyer_account_id = v_account_id;

  -- BP-6(f): unresolved inquiries are force-closed and their body purged
  -- immediately — there is no longer a channel to reply to this buyer.
  update public.seepn_inquiry
  set status = 'closed', closed_at = now(), body = '[파기됨]', updated_at = now()
  where buyer_account_id = v_account_id and status <> 'closed';

  perform private.log_audit(
    p_action := 'buyer.withdraw', p_target_table := 'buyer_account', p_target_id := v_account_id::text,
    p_subject_ids := array[v_account_id]
  );
end;
$$;
