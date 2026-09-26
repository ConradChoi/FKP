-- =============================================================================
-- 커뮤니티 보강 (privacy-security-officer 검토, 2026-09-26). 20260926100000/110000은 이미 운영 DB에
-- 실행되어 수정하지 않고 이 파일로 덧붙인다. Re-runnable.
--   N-1 닉네임 예약어 강화(밑줄 우회 차단, 사칭 단어 확대)
--   N-2 닉네임 변경 30일 쿨다운(nickname_changed_at)
--   N-5 부모 댓글이 숨김이면 답글도 뷰에서 제외
--   N-8 신고 남용 방지: 계정당 20건/시간
--   O-3 신고 보유기간: 종결 후 12개월 경과 또는 대상이 사라진 신고 행 파기(일일 배치)
--   N-9 관심등록 집계: 3건 미만 공급사는 제외(소수 건수로 개별 회원 추정 방지)
-- Not yet executed against Supabase — paste into the SQL Editor manually.
-- =============================================================================

alter table public.buyer_account add column if not exists nickname_changed_at timestamptz;

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
  -- Reserved / impersonation-prone words (underscores stripped so SEE_PN / ad_min cannot slip through).
  v_lower := replace(lower(v_nick), '_', '');
  if v_lower ~ '(seepn|admin|official|staff|manager|support|system|moderator)'
     or v_lower ~ '(운영|관리자|공식|탈퇴|고객센터|매니저|스태프|시픈|씨픈|담당자)' then
    raise exception 'nickname_reserved';
  end if;
  -- Cooldown: a nickname can be changed once per 30 days (blocks nickname-swap impersonation and
  -- immediate re-use of a just-released name by the same account).
  if exists (
    select 1 from public.buyer_account
    where id = v_account_id and nickname is not null and nickname_changed_at > now() - interval '30 days'
  ) then
    raise exception 'nickname_cooldown';
  end if;
  begin
    update public.buyer_account set nickname = v_nick, nickname_changed_at = now() where id = v_account_id;
  exception when unique_violation then
    raise exception 'nickname_taken';
  end;
end;
$$;

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
  -- N-5: a reply is not shown while its parent comment is hidden.
  and (c.parent_id is null or exists (select 1 from public.community_comment pc where pc.id = c.parent_id and pc.status = 'published'))
  and (select private.is_active_buyer());
revoke all on public.community_comment_public from public, anon, authenticated;
grant select on public.community_comment_public to authenticated;
grant select on public.community_comment_public to authenticated;

revoke all on public.community_comment_public from public, anon, authenticated;
grant select on public.community_comment_public to authenticated;


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
  if (select count(*) from public.community_report where reporter_buyer_account_id = v_account_id and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'rate_limited';
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


drop view if exists public.partner_bookmark_summary;
create view public.partner_bookmark_summary as
select
  b.partner_id,
  count(*)::integer as bookmark_count
from public.buyer_bookmark b
join public.buyer_account ba on ba.id = b.buyer_account_id and ba.status = 'active'
where b.partner_id in (select pl.id from public.partner_list_public pl)
group by b.partner_id
having count(*) >= 3;
revoke all on public.partner_bookmark_summary from public, anon, authenticated;
grant select on public.partner_bookmark_summary to anon, authenticated;


-- ---- 신고 보유기간 파기 ----
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.retention_jobs'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%job_type%';
  if v_conname is not null then
    execute format('alter table public.retention_jobs drop constraint %I', v_conname);
  end if;
  alter table public.retention_jobs
    add constraint retention_jobs_job_type_check
    check (job_type in (
      'anonymize', 'hard_delete', 'audit_purge', 'failed_submission_purge',
      'partner_unconsented_purge', 'partner_doc_purge', 'partner_rejected_purge',
      'partner_consent_meta_purge', 'partner_doc_storage_purge',
      'match_freetext_purge',
      'buyer_account_dormant_purge', 'seepn_inquiry_body_purge',
      'seepn_withdrawal_text_purge', 'community_report_purge'
    ));
end;
$$;

create or replace function private.purge_expired_community_reports()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  -- 종결된 신고는 종결 후 12개월, 대상 글/댓글이 이미 사라진 신고는 즉시 파기한다(신고자 식별자와
  -- 자유서술 detail이 대상 없이 남지 않도록).
  delete from public.community_report r
  where (r.status = 'resolved' and r.resolved_at is not null and r.resolved_at < now() - interval '12 months')
     or (r.target_type = 'post' and not exists (select 1 from public.community_post p where p.id = r.target_id))
     or (r.target_type = 'comment' and not exists (select 1 from public.community_comment c where c.id = r.target_id));
  get diagnostics v_count = row_count;

  insert into public.retention_jobs (job_type, target_condition, anonymized_count, notes)
  values (
    'community_report_purge',
    'resolved > 12 months, or target no longer exists',
    v_count,
    'Community report rows (reporter id + free-text detail).'
  );
  return v_count;
end;
$$;

create or replace function private.run_daily_retention_batches()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform private.run_requests_retention_batch();
  exception when others then
    raise warning 'run_requests_retention_batch failed: %', sqlerrm;
  end;

  begin
    perform private.purge_expired_failed_submissions();
  exception when others then
    raise warning 'purge_expired_failed_submissions failed: %', sqlerrm;
  end;

  begin
    perform private.purge_expired_audit_log();
  exception when others then
    raise warning 'purge_expired_audit_log failed: %', sqlerrm;
  end;

  begin
    perform private.purge_unconsented_partner_pii();
  exception when others then
    raise warning 'purge_unconsented_partner_pii failed: %', sqlerrm;
  end;

  begin
    perform private.mark_expired_partner_documents_for_purge();
  exception when others then
    raise warning 'mark_expired_partner_documents_for_purge failed: %', sqlerrm;
  end;

  begin
    perform private.purge_rejected_partner_pii();
  exception when others then
    raise warning 'purge_rejected_partner_pii failed: %', sqlerrm;
  end;

  begin
    perform private.purge_expired_partner_consent_meta();
  exception when others then
    raise warning 'purge_expired_partner_consent_meta failed: %', sqlerrm;
  end;

  begin
    perform private.purge_orphan_match_freetext();
  exception when others then
    raise warning 'purge_orphan_match_freetext failed: %', sqlerrm;
  end;

  -- SEEPN buyer web (P5a): independent blocks, added 20260910100000. Must
  -- never be merged into any block above.
  begin
    perform private.mark_dormant_buyer_accounts_for_notice();
  exception when others then
    raise warning 'mark_dormant_buyer_accounts_for_notice failed: %', sqlerrm;
  end;

  begin
    perform private.purge_dormant_buyer_accounts();
  exception when others then
    raise warning 'purge_dormant_buyer_accounts failed: %', sqlerrm;
  end;

  begin
    perform private.purge_expired_seepn_inquiry_body();
  exception when others then
    raise warning 'purge_expired_seepn_inquiry_body failed: %', sqlerrm;
  end;

  -- 탈퇴 사유 직접 입력(reason_text) 12개월 파기 — 20260924120000. Independent block; must
  -- never be merged into any block above.
  begin
    perform private.purge_expired_seepn_withdrawal_text();
  exception when others then
    raise warning 'purge_expired_seepn_withdrawal_text failed: %', sqlerrm;
  end;

  -- 커뮤니티 신고 보유기간 파기 — 20260926120000. Independent block; must never be merged above.
  begin
    perform private.purge_expired_community_reports();
  exception when others then
    raise warning 'purge_expired_community_reports failed: %', sqlerrm;
  end;
end;
$$;
