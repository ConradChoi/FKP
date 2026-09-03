-- =============================================================================
-- FKP v0.2 — "화면에서 삭제" for closed leads (대표 요청, 2026-08-29).
-- =============================================================================
--
-- Not a real delete: `requests` rows are never removed. `hidden_at` only controls
-- whether /admin/leads's default list query shows the row — direct links
-- (/admin/leads/[id]) still work, and the data stays intact for audit/analytics.
-- Restricted to status = 'closed' both here (server-side, authoritative) and in the
-- UI (button only rendered for closed rows) — a lead an admin is still actively
-- working shouldn't disappear from the list by accident.
-- =============================================================================

alter table public.requests add column if not exists hidden_at timestamptz;

-- requests' SELECT grant (20260825120000) is an explicit column list, not a table-level
-- grant — a newly added column has zero SELECT privilege until named here, and both the
-- list page's `.is('hidden_at', null)` filter and the detail page's own select() need it.
-- Additive: does not need to repeat the existing column list.
grant select (hidden_at) on public.requests to authenticated;

create or replace function public.hide_closed_lead(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if not (
    private.is_active_admin()
    and private.is_aal2()
    and private.has_menu_permission('lead_management', 'delete')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  select status into v_status from public.requests where id = p_request_id;
  if v_status is null then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;
  if v_status <> 'closed' then
    raise exception 'lead_not_closed';
  end if;

  update public.requests set hidden_at = now() where id = p_request_id and hidden_at is null;

  perform private.log_audit(
    p_action := 'lead.hide',
    p_target_table := 'requests',
    p_target_id := p_request_id::text,
    p_subject_ids := array[p_request_id],
    p_before_summary := jsonb_build_object('hidden_at', null),
    p_after_summary := jsonb_build_object('hidden_at', now())
  );
end;
$$;

revoke all on function public.hide_closed_lead(uuid) from public;
grant execute on function public.hide_closed_lead(uuid) to authenticated;
