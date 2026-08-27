-- =============================================================================
-- 메뉴관리(E3-R5) — 형제 메뉴 간 순서 이동(위/아래) 함수
-- =============================================================================
--
-- Design Ref: 대표 피드백(2026-08-27) — sort_order 숫자를 직접 계산해서 입력하는 방식이
-- 불편하다는 지적. 같은 parent_id를 가진 "형제" 메뉴들 사이에서 바로 이전/다음 형제와
-- sort_order를 맞바꾸는 원자적 함수를 제공해, 관리자 화면에서는 위/아래 버튼만 누르면 되게
-- 한다. update_menu(20260827110000)와 별개 함수로 두는 이유: update_menu는 display_name/
-- path/is_active를 사람이 입력한 값으로 그대로 덮어쓰지만, 이 함수는 sort_order "값 자체"를
-- 계산해서 정하는 로직(형제 탐색 + swap)을 포함하므로 클라이언트가 값을 계산해 넘기게 하면
-- 동시 편집 시 경쟁 상태(race condition)가 생길 수 있다 — DB 트랜잭션 안에서 원자적으로
-- 처리한다.
create or replace function public.move_menu(
  p_id uuid,
  p_direction text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_id uuid;
  v_sort_order integer;
  v_swap_id uuid;
  v_swap_sort_order integer;
begin
  if not (
    private.is_active_admin()
    and private.is_aal2()
    and private.has_menu_permission('menu_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if p_direction not in ('up', 'down') then
    raise exception 'invalid_direction';
  end if;

  select parent_id, sort_order into v_parent_id, v_sort_order
  from public.menu where id = p_id;

  if not found then
    raise exception 'menu_not_found' using errcode = 'P0002';
  end if;

  if p_direction = 'up' then
    select id, sort_order into v_swap_id, v_swap_sort_order
    from public.menu
    where parent_id is not distinct from v_parent_id and sort_order < v_sort_order
    order by sort_order desc
    limit 1;
  else
    select id, sort_order into v_swap_id, v_swap_sort_order
    from public.menu
    where parent_id is not distinct from v_parent_id and sort_order > v_sort_order
    order by sort_order asc
    limit 1;
  end if;

  -- Already first/last among its siblings — no-op, not an error (button should have
  -- been disabled, but this makes the function safe to call regardless).
  if v_swap_id is null then
    return;
  end if;

  update public.menu set sort_order = v_swap_sort_order where id = p_id;
  update public.menu set sort_order = v_sort_order where id = v_swap_id;

  perform private.log_audit(
    p_action := 'menu.update',
    p_target_table := 'menu',
    p_target_id := p_id::text
  );
end;
$$;

grant execute on function public.move_menu(uuid, text) to authenticated;
