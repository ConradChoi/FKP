-- =============================================================================
-- 리뷰 작성 자격 확정(2026-09-26 대표 결정): 현행 정의(운영자 처리 단계로 넘어간 문의 = status<>'new')를
-- 유지하되, 운영자가 스팸으로 표시한 문의는 자격에서 제외한다.
--   - seepn_inquiry.is_spam (기본 false). 회원 본인 문의 행에는 보이지만 회원 화면에는 노출하지 않는다.
--   - public.admin_set_seepn_inquiry_spam(): lead_management 'update' 권한 + AAL2, 감사 로그는
--     기존 'admin_seepn_inquiry.status_change' 액션에 {spam: bool}을 담아 남긴다(허용 목록 변경 없음).
--   - public.admin_get_seepn_inquiry_spam(): 관리자 상세 화면 표시용.
--   - public.buyer_save_review(): 자격 조건에 is_spam = false 추가(그 외는 20260925100000과 동일).
-- 거래 공급사(마이페이지)도 같은 정의라 lib/seepn/deals.ts에서 같은 조건을 적용한다.
-- Re-runnable. Not yet executed — paste into the SQL Editor manually.
-- =============================================================================

alter table public.seepn_inquiry add column if not exists is_spam boolean not null default false;

create or replace function public.admin_set_seepn_inquiry_spam(p_inquiry_id uuid, p_spam boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    private.is_active_admin() and private.is_aal2()
    and private.has_menu_permission('lead_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  update public.seepn_inquiry set is_spam = coalesce(p_spam, false), updated_at = now() where id = p_inquiry_id;
  if not found then
    raise exception 'inquiry_not_found' using errcode = 'P0002';
  end if;

  perform private.log_audit(
    p_action := 'admin_seepn_inquiry.status_change',
    p_target_table := 'seepn_inquiry', p_target_id := p_inquiry_id::text,
    p_after_summary := jsonb_build_object('spam', coalesce(p_spam, false))
  );
end;
$$;
revoke all on function public.admin_set_seepn_inquiry_spam(uuid, boolean) from public;
grant execute on function public.admin_set_seepn_inquiry_spam(uuid, boolean) to authenticated;

create or replace function public.admin_get_seepn_inquiry_spam(p_inquiry_id uuid)
returns boolean
language plpgsql
stable
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
  return coalesce((select is_spam from public.seepn_inquiry where id = p_inquiry_id), false);
end;
$$;
revoke all on function public.admin_get_seepn_inquiry_spam(uuid) from public;
grant execute on function public.admin_get_seepn_inquiry_spam(uuid) to authenticated;

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
      and si.is_spam = false
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
