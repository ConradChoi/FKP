-- =============================================================================
-- SEEPN 커뮤니티(자유토론방) (2026-09-26)
--
-- 대표 결정: 작성자는 회원이 직접 설정한 닉네임 / 즉시 게시 + 신고 접수 + admin 숨김 / 글·댓글·
-- 답글(1단계)·글 좋아요·조회수 / 로그인한 회원만 열람·작성(공급사는 참여하지 않음).
--
-- 프라이버시 구조:
--   * 작성자 신원(buyer_account_id)은 공개 뷰에 나가지 않는다 — 닉네임과 is_mine(본인 글 여부)만.
--   * 조회수는 누가 봤는지 기록하지 않는 익명 카운터(회원의 열람 이력은 행태정보라 저장하지 않는다).
--   * 좋아요는 (글, 회원) 쌍을 저장하되 화면에는 개수만 노출한다.
--   * 자발 탈퇴 시 buyer_withdraw()가 작성한 글·댓글·좋아요·신고를 즉시 삭제하고 닉네임을 해제한다.
--   * 열람·작성 모두 활성 바이어 세션이 필요하다(뷰가 is_active_buyer()로 게이트).
--   * 도배 방지: 계정당 글 5개/시간, 댓글 30개/시간(서버 검증).
--
-- Re-runnable. Not yet executed against Supabase — paste into the SQL Editor manually.
-- =============================================================================

-- ---- nickname ----
alter table public.buyer_account add column if not exists nickname text;
alter table public.buyer_account drop constraint if exists chk_buyer_account_nickname;
alter table public.buyer_account add constraint chk_buyer_account_nickname
  check (nickname is null or (char_length(nickname) between 2 and 12 and nickname ~ '^[가-힣a-zA-Z0-9_]+$'));
create unique index if not exists uq_buyer_account_nickname_lower on public.buyer_account (lower(nickname)) where nickname is not null;

create or replace function public.buyer_set_nickname(p_nickname text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid := private.current_buyer_id(auth.uid());
  v_nick text := btrim(coalesce(p_nickname, ''));
  v_lower text;
begin
  if v_account_id is null or not private.is_active_buyer(auth.uid()) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  if char_length(v_nick) not between 2 and 12 or v_nick !~ '^[가-힣a-zA-Z0-9_]+$' then
    raise exception 'invalid_nickname';
  end if;
  -- Reserved / impersonation-prone words.
  v_lower := lower(v_nick);
  if v_lower like '%seepn%' or v_lower like '%admin%' or v_nick like '%운영%' or v_nick like '%관리자%' or v_nick like '%공식%' or v_nick like '%탈퇴%' then
    raise exception 'nickname_reserved';
  end if;
  begin
    update public.buyer_account set nickname = v_nick where id = v_account_id;
  exception when unique_violation then
    raise exception 'nickname_taken';
  end;
end;
$$;

revoke all on function public.buyer_set_nickname(text) from public;
grant execute on function public.buyer_set_nickname(text) to authenticated;


-- ---- tables ----
create table if not exists public.community_post (
  id uuid primary key default gen_random_uuid(),
  buyer_account_id uuid not null references public.buyer_account (id) on delete cascade,
  category text not null check (category in ('금속가공', '전자/전기', '화학/소재', '기타')),
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 5000),
  status text not null default 'published' check (status in ('published', 'hidden')),
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_community_post_list on public.community_post (status, category, created_at desc);
create index if not exists idx_community_post_author on public.community_post (buyer_account_id, created_at desc);

create table if not exists public.community_comment (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_post (id) on delete cascade,
  parent_id uuid references public.community_comment (id) on delete cascade,
  buyer_account_id uuid not null references public.buyer_account (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now()
);
create index if not exists idx_community_comment_post on public.community_comment (post_id, created_at);
create index if not exists idx_community_comment_author on public.community_comment (buyer_account_id, created_at desc);

create table if not exists public.community_post_like (
  post_id uuid not null references public.community_post (id) on delete cascade,
  buyer_account_id uuid not null references public.buyer_account (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, buyer_account_id)
);

create table if not exists public.community_report (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  reporter_buyer_account_id uuid not null references public.buyer_account (id) on delete cascade,
  reason text not null check (reason in ('spam', 'abuse', 'privacy', 'illegal', 'other')),
  detail text check (detail is null or char_length(detail) <= 300),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by_admin_id uuid references public.admin_user (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (target_type, target_id, reporter_buyer_account_id)
);
create index if not exists idx_community_report_status on public.community_report (status, created_at desc);

create table if not exists public.community_moderation_log (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  action text not null check (action in ('hide', 'unhide')),
  admin_user_id uuid references public.admin_user (id) on delete set null,
  reason text check (reason is null or char_length(reason) <= 200),
  created_at timestamptz not null default now()
);

alter table public.community_post enable row level security;
alter table public.community_post force row level security;
alter table public.community_comment enable row level security;
alter table public.community_comment force row level security;
alter table public.community_post_like enable row level security;
alter table public.community_post_like force row level security;
alter table public.community_report enable row level security;
alter table public.community_report force row level security;
alter table public.community_moderation_log enable row level security;
alter table public.community_moderation_log force row level security;
revoke all on public.community_post, public.community_comment, public.community_post_like, public.community_report, public.community_moderation_log from anon, authenticated;

-- Own rows only (author state / liked-by-me). Everything else goes through the views and RPCs.
grant select on public.community_post, public.community_comment, public.community_post_like to authenticated;
drop policy if exists community_post_self_select on public.community_post;
create policy community_post_self_select on public.community_post
  for select to authenticated
  using ((select private.is_active_buyer()) and buyer_account_id = (select private.current_buyer_id()));
drop policy if exists community_comment_self_select on public.community_comment;
create policy community_comment_self_select on public.community_comment
  for select to authenticated
  using ((select private.is_active_buyer()) and buyer_account_id = (select private.current_buyer_id()));
drop policy if exists community_post_like_self_select on public.community_post_like;
create policy community_post_like_self_select on public.community_post_like
  for select to authenticated
  using ((select private.is_active_buyer()) and buyer_account_id = (select private.current_buyer_id()));


-- ---- public views (no author id; nickname + is_mine only) ----
drop view if exists public.community_post_public;
create view public.community_post_public as
select
  p.id,
  p.category,
  p.title,
  p.body,
  ba.nickname,
  p.view_count,
  p.created_at,
  (select count(*) from public.community_comment c where c.post_id = p.id and c.status = 'published')::integer as comment_count,
  (select count(*) from public.community_post_like l where l.post_id = p.id)::integer as like_count,
  (p.buyer_account_id = (select private.current_buyer_id())) as is_mine
from public.community_post p
join public.buyer_account ba on ba.id = p.buyer_account_id and ba.status = 'active'
where p.status = 'published'
  and (select private.is_active_buyer());
revoke all on public.community_post_public from public, anon, authenticated;
grant select on public.community_post_public to authenticated;

drop view if exists public.community_comment_public;
create view public.community_comment_public as
select
  c.id,
  c.post_id,
  c.parent_id,
  c.body,
  ba.nickname,
  c.created_at,
  (c.buyer_account_id = (select private.current_buyer_id())) as is_mine
from public.community_comment c
join public.community_post p on p.id = c.post_id and p.status = 'published'
join public.buyer_account ba on ba.id = c.buyer_account_id and ba.status = 'active'
where c.status = 'published'
  and (select private.is_active_buyer());
revoke all on public.community_comment_public from public, anon, authenticated;
grant select on public.community_comment_public to authenticated;


-- ---- buyer RPCs ----
create or replace function public.community_create_post(p_category text, p_title text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid := private.current_buyer_id(auth.uid());
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if v_account_id is null or not private.is_active_buyer(auth.uid()) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  if not exists (select 1 from public.buyer_account where id = v_account_id and nickname is not null) then
    raise exception 'nickname_required';
  end if;
  if p_category not in ('금속가공', '전자/전기', '화학/소재', '기타') then
    raise exception 'invalid_category';
  end if;
  if char_length(v_title) not between 1 and 100 or char_length(v_body) not between 1 and 5000 then
    raise exception 'invalid_content';
  end if;
  if (select count(*) from public.community_post where buyer_account_id = v_account_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited';
  end if;
  insert into public.community_post (buyer_account_id, category, title, body) values (v_account_id, p_category, v_title, v_body)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.community_create_post(text, text, text) from public;
grant execute on function public.community_create_post(text, text, text) to authenticated;

create or replace function public.community_delete_post(p_post_id uuid)
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
  delete from public.community_post where id = p_post_id and buyer_account_id = v_account_id;
end;
$$;
revoke all on function public.community_delete_post(uuid) from public;
grant execute on function public.community_delete_post(uuid) to authenticated;

create or replace function public.community_create_comment(p_post_id uuid, p_parent_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid := private.current_buyer_id(auth.uid());
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if v_account_id is null or not private.is_active_buyer(auth.uid()) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  if not exists (select 1 from public.buyer_account where id = v_account_id and nickname is not null) then
    raise exception 'nickname_required';
  end if;
  if char_length(v_body) not between 1 and 1000 then
    raise exception 'invalid_content';
  end if;
  if not exists (select 1 from public.community_post where id = p_post_id and status = 'published') then
    raise exception 'post_not_available';
  end if;
  -- One level of replies only: the parent must be a published top-level comment of the same post.
  if p_parent_id is not null and not exists (
    select 1 from public.community_comment c
    where c.id = p_parent_id and c.post_id = p_post_id and c.parent_id is null and c.status = 'published'
  ) then
    raise exception 'invalid_parent';
  end if;
  if (select count(*) from public.community_comment where buyer_account_id = v_account_id and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited';
  end if;
  insert into public.community_comment (post_id, parent_id, buyer_account_id, body) values (p_post_id, p_parent_id, v_account_id, v_body)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.community_create_comment(uuid, uuid, text) from public;
grant execute on function public.community_create_comment(uuid, uuid, text) to authenticated;

create or replace function public.community_delete_comment(p_comment_id uuid)
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
  delete from public.community_comment where id = p_comment_id and buyer_account_id = v_account_id;
end;
$$;
revoke all on function public.community_delete_comment(uuid) from public;
grant execute on function public.community_delete_comment(uuid) to authenticated;

create or replace function public.community_toggle_like(p_post_id uuid)
returns boolean
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
  if not exists (select 1 from public.community_post where id = p_post_id and status = 'published') then
    raise exception 'post_not_available';
  end if;
  if exists (select 1 from public.community_post_like where post_id = p_post_id and buyer_account_id = v_account_id) then
    delete from public.community_post_like where post_id = p_post_id and buyer_account_id = v_account_id;
    return false;
  end if;
  insert into public.community_post_like (post_id, buyer_account_id) values (p_post_id, v_account_id);
  return true;
end;
$$;
revoke all on function public.community_toggle_like(uuid) from public;
grant execute on function public.community_toggle_like(uuid) to authenticated;

-- Anonymous counter: records nothing about WHO viewed (viewing history is behavioural data).
create or replace function public.community_view_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_buyer_id(auth.uid()) is null or not private.is_active_buyer(auth.uid()) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  update public.community_post set view_count = view_count + 1 where id = p_post_id and status = 'published';
end;
$$;
revoke all on function public.community_view_post(uuid) from public;
grant execute on function public.community_view_post(uuid) to authenticated;

create or replace function public.community_report(p_target_type text, p_target_id uuid, p_reason text, p_detail text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid := private.current_buyer_id(auth.uid());
  v_detail text := nullif(btrim(coalesce(p_detail, '')), '');
begin
  if v_account_id is null or not private.is_active_buyer(auth.uid()) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  if p_reason not in ('spam', 'abuse', 'privacy', 'illegal', 'other') then
    raise exception 'invalid_reason';
  end if;
  if v_detail is not null and char_length(v_detail) > 300 then
    raise exception 'detail_too_long';
  end if;
  if p_target_type = 'post' then
    if not exists (select 1 from public.community_post where id = p_target_id and status = 'published') then
      raise exception 'target_not_available';
    end if;
  elsif p_target_type = 'comment' then
    if not exists (select 1 from public.community_comment where id = p_target_id and status = 'published') then
      raise exception 'target_not_available';
    end if;
  else
    raise exception 'invalid_target';
  end if;
  insert into public.community_report (target_type, target_id, reporter_buyer_account_id, reason, detail)
  values (p_target_type, p_target_id, v_account_id, p_reason, v_detail)
  on conflict (target_type, target_id, reporter_buyer_account_id) do nothing;
end;
$$;
revoke all on function public.community_report(text, uuid, text, text) from public;
grant execute on function public.community_report(text, uuid, text, text) to authenticated;


-- ---- admin RPCs (admin + AAL2 + content_management) ----
create or replace function public.admin_list_community_reports(p_status text default 'open')
returns table (
  report_id uuid,
  target_type text,
  target_id uuid,
  reason text,
  detail text,
  report_status text,
  reported_at timestamptz,
  target_status text,
  target_nickname text,
  target_excerpt text,
  report_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (private.is_active_admin() and private.is_aal2() and private.has_menu_permission('content_management', 'read')) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  return query
  select r.id, r.target_type, r.target_id, r.reason, r.detail, r.status, r.created_at,
         coalesce(p.status, c.status),
         ba.nickname,
         left(coalesce(p.title || ' — ' || p.body, c.body), 200),
         (select count(*) from public.community_report r2 where r2.target_type = r.target_type and r2.target_id = r.target_id)::integer
  from public.community_report r
  left join public.community_post p on r.target_type = 'post' and p.id = r.target_id
  left join public.community_comment c on r.target_type = 'comment' and c.id = r.target_id
  left join public.buyer_account ba on ba.id = coalesce(p.buyer_account_id, c.buyer_account_id)
  where r.status = p_status
  order by r.created_at desc
  limit 200;
end;
$$;
revoke all on function public.admin_list_community_reports(text) from public;
grant execute on function public.admin_list_community_reports(text) to authenticated;

create or replace function public.admin_list_community_posts(p_status text default null)
returns table (
  id uuid,
  category text,
  title text,
  body text,
  nickname text,
  status text,
  created_at timestamptz,
  comment_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (private.is_active_admin() and private.is_aal2() and private.has_menu_permission('content_management', 'read')) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  return query
  select p.id, p.category, p.title, p.body, ba.nickname, p.status, p.created_at,
         (select count(*) from public.community_comment c where c.post_id = p.id)::integer
  from public.community_post p
  join public.buyer_account ba on ba.id = p.buyer_account_id
  where p_status is null or p.status = p_status
  order by p.created_at desc
  limit 100;
end;
$$;
revoke all on function public.admin_list_community_posts(text) from public;
grant execute on function public.admin_list_community_posts(text) to authenticated;

create or replace function public.admin_list_community_comments(p_post_id uuid)
returns table (
  id uuid,
  parent_id uuid,
  body text,
  nickname text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (private.is_active_admin() and private.is_aal2() and private.has_menu_permission('content_management', 'read')) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  return query
  select c.id, c.parent_id, c.body, ba.nickname, c.status, c.created_at
  from public.community_comment c
  join public.buyer_account ba on ba.id = c.buyer_account_id
  where c.post_id = p_post_id
  order by c.created_at;
end;
$$;
revoke all on function public.admin_list_community_comments(uuid) from public;
grant execute on function public.admin_list_community_comments(uuid) to authenticated;

create or replace function public.admin_set_community_hidden(p_target_type text, p_target_id uuid, p_hidden boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_status text := case when p_hidden then 'hidden' else 'published' end;
begin
  if not (private.is_active_admin() and private.is_aal2() and private.has_menu_permission('content_management', 'update')) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  if v_reason is not null and char_length(v_reason) > 200 then
    raise exception 'reason_too_long';
  end if;
  select au.id into v_admin_id from public.admin_user au where au.auth_user_id = auth.uid() and au.status = 'active';

  if p_target_type = 'post' then
    update public.community_post set status = v_status, updated_at = now() where id = p_target_id;
  elsif p_target_type = 'comment' then
    update public.community_comment set status = v_status where id = p_target_id;
  else
    raise exception 'invalid_target';
  end if;
  if not found then
    raise exception 'target_not_found';
  end if;

  insert into public.community_moderation_log (target_type, target_id, action, admin_user_id, reason)
  values (p_target_type, p_target_id, case when p_hidden then 'hide' else 'unhide' end, v_admin_id, v_reason);

  if p_hidden then
    update public.community_report set status = 'resolved', resolved_by_admin_id = v_admin_id, resolved_at = now()
    where target_type = p_target_type and target_id = p_target_id and status = 'open';
  end if;
end;
$$;
revoke all on function public.admin_set_community_hidden(text, uuid, boolean, text) from public;
grant execute on function public.admin_set_community_hidden(text, uuid, boolean, text) to authenticated;

create or replace function public.admin_resolve_community_reports(p_target_type text, p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid;
begin
  if not (private.is_active_admin() and private.is_aal2() and private.has_menu_permission('content_management', 'update')) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  select au.id into v_admin_id from public.admin_user au where au.auth_user_id = auth.uid() and au.status = 'active';
  update public.community_report set status = 'resolved', resolved_by_admin_id = v_admin_id, resolved_at = now()
  where target_type = p_target_type and target_id = p_target_id and status = 'open';
end;
$$;
revoke all on function public.admin_resolve_community_reports(text, uuid) from public;
grant execute on function public.admin_resolve_community_reports(text, uuid) to authenticated;


-- buyer_withdraw(): 20260925100000 version verbatim + community cleanup (marked below).
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

  -- 20260926110000: community content the buyer authored is deleted with the account (posts take
  -- their comments with them via FK cascade; other members' comments on the buyer's posts go too).
  -- Free text can contain personal data, so it is not kept detached from the account. The
  -- nickname is released. Dormant auto-withdrawal keeps everything, same structure as bookmarks.
  delete from public.community_post where buyer_account_id = v_account_id;
  delete from public.community_comment where buyer_account_id = v_account_id;
  delete from public.community_post_like where buyer_account_id = v_account_id;
  delete from public.community_report where reporter_buyer_account_id = v_account_id;
  update public.buyer_account set nickname = null where id = v_account_id;

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
