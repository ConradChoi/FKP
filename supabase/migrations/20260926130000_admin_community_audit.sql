-- =============================================================================
-- admin 커뮤니티·리뷰 조회/처리 접속기록 (privacy-security-officer 검토 O-2, 2026-09-26)
--
-- 개인정보취급자(admin)가 게시글 본문·닉네임·신고 내역·리뷰를 조회하거나 숨김/해제한 사실을
-- audit_log에 남긴다(안전성 확보조치 기준 제8조; 문의 조회의 admin_seepn_inquiry.* 와 같은 수준).
-- 숨김/해제는 기존 moderation log(누가·언제·사유)에 더해 audit_log에도 남긴다. action 허용 목록에
-- 이번 항목과 휴면 계정 항목(buyer.dormant_mark/release, 20260926140000에서 사용)을 함께 추가한다.
-- Diff base: 20260911100000 (the latest file to touch audit_log_action_check — verified: no later
-- migration changes it). Re-runnable. Not yet executed against Supabase — paste into the SQL Editor manually.
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
  -- N. Admin community / review moderation (20260926130000, privacy review O-2)
  'admin_community.list', 'admin_community.view_comments', 'admin_community.hide',
  'admin_community.unhide', 'admin_community.resolve',
  'admin_partner_review.list', 'admin_partner_review.hide', 'admin_partner_review.unhide',
  -- O. SEEPN dormant-account lifecycle (20260926140000): 1y inactive -> dormant, release, 1y dormant -> delete
  'buyer.dormant_mark', 'buyer.dormant_release',
  -- D. Audit log itself (§3.2-D)
  'audit.view', 'audit.export', 'audit.review'
));

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
  perform private.log_audit(p_action := 'admin_community.list', p_target_table := 'community_report');
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
  perform private.log_audit(p_action := 'admin_community.list', p_target_table := 'community_post');
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
  perform private.log_audit(p_action := 'admin_community.view_comments', p_target_table := 'community_post', p_target_id := p_post_id::text);
  return query
  select c.id, c.parent_id, c.body, ba.nickname, c.status, c.created_at
  from public.community_comment c
  join public.buyer_account ba on ba.id = c.buyer_account_id
  where c.post_id = p_post_id
  order by c.created_at;
end;
$$;

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
  v_author uuid;
begin
  if not (private.is_active_admin() and private.is_aal2() and private.has_menu_permission('content_management', 'update')) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  if v_reason is not null and char_length(v_reason) > 200 then
    raise exception 'reason_too_long';
  end if;
  select au.id into v_admin_id from public.admin_user au where au.auth_user_id = auth.uid() and au.status = 'active';

  if p_target_type = 'post' then
    update public.community_post set status = v_status, updated_at = now() where id = p_target_id returning buyer_account_id into v_author;
  elsif p_target_type = 'comment' then
    update public.community_comment set status = v_status where id = p_target_id returning buyer_account_id into v_author;
  else
    raise exception 'invalid_target';
  end if;
  if not found then
    raise exception 'target_not_found';
  end if;

  insert into public.community_moderation_log (target_type, target_id, action, admin_user_id, reason)
  values (p_target_type, p_target_id, case when p_hidden then 'hide' else 'unhide' end, v_admin_id, v_reason);

  perform private.log_audit(
    p_action := case when p_hidden then 'admin_community.hide' else 'admin_community.unhide' end,
    p_target_table := 'community_' || p_target_type,
    p_target_id := p_target_id::text,
    p_subject_ids := array[v_author],
    p_after_summary := jsonb_build_object('reason', v_reason)
  );

  if p_hidden then
    update public.community_report set status = 'resolved', resolved_by_admin_id = v_admin_id, resolved_at = now()
    where target_type = p_target_type and target_id = p_target_id and status = 'open';
  end if;
end;
$$;

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
  perform private.log_audit(p_action := 'admin_community.resolve', p_target_table := 'community_' || p_target_type, p_target_id := p_target_id::text);
  update public.community_report set status = 'resolved', resolved_by_admin_id = v_admin_id, resolved_at = now()
  where target_type = p_target_type and target_id = p_target_id and status = 'open';
end;
$$;

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

  perform private.log_audit(p_action := 'admin_partner_review.list', p_target_table := 'partner', p_target_id := p_partner_id::text);
  return query
  select r.id, private.mask_name(ba.display_name), r.rating_quality, r.rating_price, r.rating_lead_time,
         r.rating_service, r.body, r.status, r.hidden_at, r.hidden_reason, r.created_at
  from public.partner_review r
  join public.buyer_account ba on ba.id = r.buyer_account_id
  where r.partner_id = p_partner_id
  order by r.created_at desc;
end;
$$;

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

  perform private.log_audit(
    p_action := case when p_hidden then 'admin_partner_review.hide' else 'admin_partner_review.unhide' end,
    p_target_table := 'partner_review',
    p_target_id := p_review_id::text,
    p_subject_ids := array[v_buyer_id],
    p_after_summary := jsonb_build_object('reason', v_reason)
  );

  insert into public.partner_review_moderation_log (review_id, partner_id, action, admin_user_id, reason)
  values (p_review_id, v_partner_id, case when p_hidden then 'hide' else 'unhide' end, v_admin_id, v_reason);
end;
$$;
