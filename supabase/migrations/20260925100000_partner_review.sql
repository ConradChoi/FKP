-- =============================================================================
-- SEEPN 공급사 리뷰·평가 (2026-09-25)
--
-- 대표 결정: ① 작성 자격 = 문의가 운영자 처리 단계(status<>'new')로 진행된 공급사에 대해서만,
-- 공급사당 회원 1건 ② 즉시 노출 + admin에서 숨김 ③ 4차원 별점(품질·가격·납기·서비스 1~5)
-- + 선택적 본문(1000자) ④ 파트너 답글은 이번 범위 제외.
--
-- 프라이버시 구조:
--   * partner_review 테이블은 본인 행만 SELECT(RLS). 쓰기는 RPC 전용(직접 INSERT/UPDATE/DELETE 없음).
--   * 다른 회원에게는 partner_review_public 뷰 — **작성자를 표시하지 않고**(검토 B2: 마스킹 이름도
--     제외) 작성일은 날짜 단위로만, 활성 바이어 세션에서만, 작성자 계정이 active이고 공개 목록에
--     있는 파트너의 게시(published) 리뷰만.
--   * 집계(partner_rating_summary)는 공개 목록의 파트너에 한해 익명 평균/건수만 노출(비로그인 목록 카드용).
--   * 파트너 화면에는 작성 회원의 신원을 어떤 형태로도 노출하지 않는다(admin은 운영 목적상 마스킹 표시명만).
--   * 숨김 리뷰를 작성자가 삭제 후 재작성해 재게시하지 못하도록 partner_review_block에 (공급사, 회원)
--     식별자만 남긴다(검토 B1). 숨김/해제 이력은 partner_review_moderation_log(append-only)에 남긴다.
--   * 자발 탈퇴 시 buyer_withdraw()가 작성한 리뷰를 즉시 삭제(자유서술에 개인정보가 섞일 수 있음).
-- audit_log action 화이트리스트를 확장하지 않기 위해 별도 moderation log 테이블을 쓴다(후속으로 audit_log
-- 연동 검토).
--
-- Re-runnable: tables use IF NOT EXISTS, the policy and the two views are dropped first, functions use
-- CREATE OR REPLACE. (Safe to run again after a partial/earlier run.)
-- Not yet executed against Supabase — paste into the SQL Editor manually.
-- =============================================================================

create table if not exists public.partner_review (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner (id) on delete cascade,
  buyer_account_id uuid not null references public.buyer_account (id) on delete cascade,
  rating_quality smallint not null check (rating_quality between 1 and 5),
  rating_price smallint not null check (rating_price between 1 and 5),
  rating_lead_time smallint not null check (rating_lead_time between 1 and 5),
  rating_service smallint not null check (rating_service between 1 and 5),
  body text check (body is null or char_length(body) <= 1000),
  status text not null default 'published' check (status in ('published', 'hidden')),
  hidden_at timestamptz,
  hidden_by_admin_id uuid references public.admin_user (id) on delete set null,
  hidden_reason text check (hidden_reason is null or char_length(hidden_reason) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, buyer_account_id)
);

create index if not exists idx_partner_review_partner_status on public.partner_review (partner_id, status, created_at desc);
create index if not exists idx_partner_review_buyer on public.partner_review (buyer_account_id);

comment on table public.partner_review is
  'Buyer-authored partner reviews. Author identity is never exposed to partners; other buyers see only a masked display name via partner_review_public. Writes go through buyer_save_review()/buyer_delete_review() only.';

alter table public.partner_review enable row level security;
alter table public.partner_review force row level security;
revoke all on public.partner_review from anon, authenticated;
grant select on public.partner_review to authenticated;

drop policy if exists partner_review_self_select on public.partner_review;
create policy partner_review_self_select on public.partner_review
  for select to authenticated
  using ((select private.is_active_buyer()) and buyer_account_id = (select private.current_buyer_id()));


-- B1: 숨김이 걸린 (공급사, 회원) 쌍. 리뷰 본문은 남기지 않고 식별자만 보관한다. RPC 전용(정책 없음).
create table if not exists public.partner_review_block (
  partner_id uuid not null references public.partner (id) on delete cascade,
  buyer_account_id uuid not null references public.buyer_account (id) on delete cascade,
  blocked_at timestamptz not null default now(),
  primary key (partner_id, buyer_account_id)
);
alter table public.partner_review_block enable row level security;
alter table public.partner_review_block force row level security;
revoke all on public.partner_review_block from anon, authenticated;

-- 숨김/해제 이력(append-only). 회원 식별자는 담지 않는다(review_id·partner_id·admin·사유·시각만).
create table if not exists public.partner_review_moderation_log (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null,
  partner_id uuid not null,
  action text not null check (action in ('hide', 'unhide')),
  admin_user_id uuid references public.admin_user (id) on delete set null,
  reason text check (reason is null or char_length(reason) <= 200),
  created_at timestamptz not null default now()
);
alter table public.partner_review_moderation_log enable row level security;
alter table public.partner_review_moderation_log force row level security;
revoke all on public.partner_review_moderation_log from anon, authenticated;


drop view if exists public.partner_review_public;
create view public.partner_review_public as
select
  r.id,
  r.partner_id,
  r.rating_quality,
  r.rating_price,
  r.rating_lead_time,
  r.rating_service,
  r.body,
  date_trunc('day', r.created_at) as created_at
from public.partner_review r
join public.buyer_account ba on ba.id = r.buyer_account_id and ba.status = 'active'
where r.status = 'published'
  and r.partner_id in (select pl.id from public.partner_list_public pl)
  and (select private.is_active_buyer());

revoke all on public.partner_review_public from public, anon, authenticated;
grant select on public.partner_review_public to authenticated;


drop view if exists public.partner_rating_summary;
create view public.partner_rating_summary as
select
  r.partner_id,
  count(*)::integer as review_count,
  round(avg(r.rating_quality)::numeric, 2) as avg_quality,
  round(avg(r.rating_price)::numeric, 2) as avg_price,
  round(avg(r.rating_lead_time)::numeric, 2) as avg_lead_time,
  round(avg(r.rating_service)::numeric, 2) as avg_service,
  round(avg((r.rating_quality + r.rating_price + r.rating_lead_time + r.rating_service) / 4.0)::numeric, 2) as avg_overall
from public.partner_review r
join public.buyer_account ba on ba.id = r.buyer_account_id and ba.status = 'active'
where r.status = 'published'
  and r.partner_id in (select pl.id from public.partner_list_public pl)
group by r.partner_id;

revoke all on public.partner_rating_summary from public, anon, authenticated;
grant select on public.partner_rating_summary to anon, authenticated;


create or replace function public.buyer_save_review(
  p_partner_id uuid,
  p_rating_quality integer,
  p_rating_price integer,
  p_rating_lead_time integer,
  p_rating_service integer,
  p_body text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid := private.current_buyer_id(auth.uid());
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_id uuid;
begin
  if v_account_id is null or not private.is_active_buyer(auth.uid()) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if p_rating_quality not between 1 and 5 or p_rating_price not between 1 and 5
     or p_rating_lead_time not between 1 and 5 or p_rating_service not between 1 and 5 then
    raise exception 'invalid_rating';
  end if;
  if v_body is not null and char_length(v_body) > 1000 then
    raise exception 'body_too_long';
  end if;

  if not exists (select 1 from public.partner_list_public pl where pl.id = p_partner_id) then
    raise exception 'partner_not_available';
  end if;

  -- Eligibility (대표 정의: 바이어-공급사 간 진행 데이터 = 운영자 처리 단계로 진행된 문의).
  if not exists (
    select 1
    from public.seepn_inquiry si
    join public.seepn_inquiry_partner sp on sp.inquiry_id = si.id
    where si.buyer_account_id = v_account_id
      and sp.partner_id = p_partner_id
      and si.status <> 'new'
  ) then
    raise exception 'not_eligible';
  end if;

  -- One review per (partner, buyer); editing keeps status — a review an admin hid stays hidden.
  insert into public.partner_review (
    partner_id, buyer_account_id, rating_quality, rating_price, rating_lead_time, rating_service, body, status
  ) values (
    p_partner_id, v_account_id, p_rating_quality, p_rating_price, p_rating_lead_time, p_rating_service, v_body,
    -- B1: a (partner, buyer) pair an admin hid stays hidden even after delete + re-write.
    case when exists (
      select 1 from public.partner_review_block b where b.partner_id = p_partner_id and b.buyer_account_id = v_account_id
    ) then 'hidden' else 'published' end
  )
  on conflict (partner_id, buyer_account_id) do update
    set rating_quality = excluded.rating_quality,
        rating_price = excluded.rating_price,
        rating_lead_time = excluded.rating_lead_time,
        rating_service = excluded.rating_service,
        body = excluded.body,
        updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.buyer_save_review(uuid, integer, integer, integer, integer, text) from public;
grant execute on function public.buyer_save_review(uuid, integer, integer, integer, integer, text) to authenticated;


create or replace function public.buyer_delete_review(p_partner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid := private.current_buyer_id(auth.uid());
begin
  if v_account_id is null or not private.is_active_buyer(auth.uid()) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  delete from public.partner_review where partner_id = p_partner_id and buyer_account_id = v_account_id;
end;
$$;

revoke all on function public.buyer_delete_review(uuid) from public;
grant execute on function public.buyer_delete_review(uuid) to authenticated;


create or replace function public.admin_list_partner_reviews(p_partner_id uuid)
returns table (
  id uuid,
  reviewer_masked text,
  rating_quality smallint,
  rating_price smallint,
  rating_lead_time smallint,
  rating_service smallint,
  body text,
  status text,
  hidden_at timestamptz,
  hidden_reason text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (private.is_active_admin() and private.is_aal2() and private.has_menu_permission('partner_management', 'read')) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  return query
  select r.id, private.mask_name(ba.display_name), r.rating_quality, r.rating_price, r.rating_lead_time,
         r.rating_service, r.body, r.status, r.hidden_at, r.hidden_reason, r.created_at
  from public.partner_review r
  join public.buyer_account ba on ba.id = r.buyer_account_id
  where r.partner_id = p_partner_id
  order by r.created_at desc;
end;
$$;

revoke all on function public.admin_list_partner_reviews(uuid) from public;
grant execute on function public.admin_list_partner_reviews(uuid) to authenticated;


create or replace function public.admin_set_partner_review_hidden(p_review_id uuid, p_hidden boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid;
  v_partner_id uuid;
  v_buyer_id uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not (private.is_active_admin() and private.is_aal2() and private.has_menu_permission('partner_management', 'update')) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  if v_reason is not null and char_length(v_reason) > 200 then
    raise exception 'reason_too_long';
  end if;

  select au.id into v_admin_id from public.admin_user au where au.auth_user_id = auth.uid() and au.status = 'active';

  select r.partner_id, r.buyer_account_id into v_partner_id, v_buyer_id from public.partner_review r where r.id = p_review_id;
  if v_partner_id is null then
    raise exception 'review_not_found';
  end if;

  update public.partner_review
  set status = case when p_hidden then 'hidden' else 'published' end,
      hidden_at = case when p_hidden then now() else null end,
      hidden_by_admin_id = case when p_hidden then v_admin_id else null end,
      hidden_reason = case when p_hidden then v_reason else null end,
      updated_at = now()
  where id = p_review_id;

  if p_hidden then
    insert into public.partner_review_block (partner_id, buyer_account_id) values (v_partner_id, v_buyer_id)
    on conflict do nothing;
  else
    delete from public.partner_review_block where partner_id = v_partner_id and buyer_account_id = v_buyer_id;
  end if;

  insert into public.partner_review_moderation_log (review_id, partner_id, action, admin_user_id, reason)
  values (p_review_id, v_partner_id, case when p_hidden then 'hide' else 'unhide' end, v_admin_id, v_reason);
end;
$$;

revoke all on function public.admin_set_partner_review_hidden(uuid, boolean, text) from public;
grant execute on function public.admin_set_partner_review_hidden(uuid, boolean, text) to authenticated;


-- buyer_withdraw(): 20260924130000 version verbatim + the review delete (marked below).
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

  -- 20260925100000: reviews the buyer wrote are deleted with the account (self-service withdrawal).
  -- Free text can contain personal data, so it is not kept detached from the account. Dormant
  -- auto-withdrawal keeps them, same structure as bookmarks / saved comparisons.
  delete from public.partner_review where buyer_account_id = v_account_id;
  delete from public.partner_review_block where buyer_account_id = v_account_id;

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
