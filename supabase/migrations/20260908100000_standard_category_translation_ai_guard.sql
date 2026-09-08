-- =============================================================================
-- Standard category translation — Gap G-1 closure for "AI 초벌 채우기" (TR-4″(1))
-- =============================================================================
--
-- Design Ref:
--   - docs/02-design/features/admin-ai-translation-draft.screen-spec.md §3.3
--     (Gap G-1), §7 — "표준 카테고리에는 (a) upsert RPC가 없고 (b)
--     (translation_source='ai' AND status='published') 금지 CHECK도 없다."
--   - supabase/migrations/20260907100000_add_translation_source_column.sql L70-78
--     (comment on public.standard_category_translation.translation_source) —
--     that migration's own header explicitly instructs: "whoever builds an
--     'AI 초벌 채우기' for standard categories MUST add the same guard (RPC
--     raise + table CHECK, see content_translation_no_unreviewed_ai_publish)
--     before that ships — do not assume RLS alone will catch it." This
--     migration is that follow-up, applying the identical pattern already
--     proven on content_translation / content_category_translation.
--
-- Scope: public.standard_category_translation only. Does NOT touch
-- content_translation / content_category_translation (already guarded).
--
-- STATUS: not yet applied — run manually via Supabase console per this
-- project's existing workflow (repo memory: local-only verification during
-- the SEEPN integration arc; 대표가 콘솔에서 직접 실행).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Table-level CHECK — the real enforcement boundary (RLS alone cannot
--    stop an admin-permissioned caller from writing translation_source='ai'
--    + status='published' directly via PostgREST, same analysis as
--    20260907100000's own §1a for the other two tables).
-- ---------------------------------------------------------------------------

alter table public.standard_category_translation
  add constraint standard_category_translation_no_unreviewed_ai_publish
  check (not (translation_source = 'ai' and status = 'published'));


-- ---------------------------------------------------------------------------
-- 2. New RPC: public.upsert_standard_category_translation
-- ---------------------------------------------------------------------------
-- Unlike content_translation/content_category_translation (which extended an
-- existing RPC in place, 20260907100000 §2), standard_category_translation
-- had NO RPC at all before this migration — the admin screen has always
-- written via direct `.upsert()` calls from
-- app/admin/(protected)/categories/actions.ts (upsertStandardCategoryTranslationAction),
-- which is why that action manually replicated the source_synced_at
-- bookkeeping by hand (see that file's comment, screen-spec §3.3 "service-
-- planner 권고" rationale (a)). This RPC is a genuinely new function (not a
-- `drop function if exists` + recreate of something pre-existing), matching
-- the same permission check / source_synced_at bookkeeping / audit log /
-- ai->ai_reviewed auto-promotion shape as the other two RPCs so all three
-- translation tables now share one enforcement pattern instead of two.
--
-- Menu code: 'standard_category_management' (NOT 'content_management') —
-- this is the menu code standard_category / standard_category_translation's
-- own RLS policies already use (20260829150000 §1/§2), unlike
-- content_translation/content_category_translation which use
-- 'content_management'. Using the wrong menu code here would let someone
-- with content_management permission (but not standard_category_management)
-- write AI translations into a table their role was never granted access to
-- — the RLS policies would still block them (defense in depth holds), but
-- the RPC's own check must match its own table's actual authorization
-- boundary, not copy the other RPCs' menu code by rote.
--
-- Source locale: 'ko' (나라장터 표준은 한글 원본), matching
-- upsertStandardCategoryTranslationAction's existing hardcoded assumption —
-- NOT 'en' like content_category_translation's upsert_category_translation.

create function public.upsert_standard_category_translation(
  p_category_id uuid,
  p_locale text,
  p_name text,
  p_status text,
  p_translation_source text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid;
  v_source_locale text := 'ko';
  v_source_updated_at timestamptz;
  v_before jsonb;
  v_prev_source text;
  v_next_source text;
begin
  if not (
    private.is_active_admin()
    and private.is_aal2()
    and private.has_menu_permission('standard_category_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if p_status not in ('draft', 'translated', 'published') then
    raise exception 'invalid_status';
  end if;

  if p_translation_source is not null and p_translation_source not in ('human', 'ai', 'ai_reviewed') then
    raise exception 'invalid_translation_source';
  end if;

  -- Same guard as upsert_content_translation / upsert_category_translation
  -- (20260907100000, PSO-A): an 'ai' first-draft can never be saved as
  -- 'published' in the same call — must go through 'ai_reviewed' first.
  if p_translation_source = 'ai' and p_status = 'published' then
    raise exception 'translation_source=ai must be draft; publish only after human review (set ai_reviewed)';
  end if;

  if not exists (select 1 from public.standard_category where id = p_category_id) then
    raise exception 'standard_category_not_found' using errcode = 'P0002';
  end if;

  select id into v_admin_id from public.admin_user where auth_user_id = auth.uid();

  select t.updated_at into v_source_updated_at
  from public.standard_category_translation t
  where t.category_id = p_category_id and t.locale = v_source_locale;

  select to_jsonb(t) into v_before
  from public.standard_category_translation t
  where t.category_id = p_category_id and t.locale = p_locale;

  v_prev_source := v_before ->> 'translation_source';
  v_next_source := coalesce(
    p_translation_source,
    case when v_prev_source = 'ai' then 'ai_reviewed' else v_prev_source end,
    'human'
  );

  insert into public.standard_category_translation
    (category_id, locale, name, status, source_synced_at, updated_by, translation_source)
  values (
    p_category_id, p_locale, p_name, p_status,
    case when p_locale = v_source_locale then now() else coalesce(v_source_updated_at, now()) end,
    v_admin_id, v_next_source
  )
  on conflict (category_id, locale) do update set
    name = excluded.name,
    status = excluded.status,
    source_synced_at = excluded.source_synced_at,
    updated_by = excluded.updated_by,
    translation_source = excluded.translation_source;

  perform private.log_audit(
    p_action := 'standard_category.update',
    p_target_table := 'standard_category_translation',
    p_target_id := p_category_id::text || ':' || p_locale,
    p_before_summary := v_before,
    p_after_summary := jsonb_build_object('name', p_name, 'status', p_status, 'translation_source', v_next_source)
  );
end;
$$;

revoke all on function public.upsert_standard_category_translation(uuid, text, text, text, text) from public;
grant execute on function public.upsert_standard_category_translation(uuid, text, text, text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 3. audit_log.action CHECK — add 'standard_category.update'
-- ---------------------------------------------------------------------------
-- Standard category writes (create/update/move/delete, all direct .upsert()/
-- .update() calls from actions.ts per 20260829150000's original design
-- intent) have never called private.log_audit at all — this table has had
-- ZERO audit trail since it was created (an acknowledged pre-existing gap,
-- out of THIS migration's scope to fully close). This migration only adds
-- the one action string its own new RPC needs. Same introspect-drop-recreate
-- pattern used by every prior widening of this constraint (20260825160000 /
-- 20260827100000 / 20260829130000 / 20260906100000).

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
  -- I. Standard category translation AI-fill guard (this migration,
  --    admin-ai-translation-draft.screen-spec.md §3.3 Gap G-1)
  'standard_category.update',
  -- D. Audit log itself (§3.2-D)
  'audit.view', 'audit.export', 'audit.review'
));

-- =============================================================================
-- End of standard_category_translation AI-fill guard migration.
-- =============================================================================
