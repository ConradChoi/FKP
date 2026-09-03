-- =============================================================================
-- Fix (2026-08-30, 대표 요청) — SEEPN supports 4 UI locales (ko/en/zh/ja), but
-- standard_category_translation.locale only allowed ('ko','en','ja'). Extends
-- the CHECK to include 'zh' (Simplified Chinese, matching SEEPN's actual
-- language lineup) without touching any other constraint or policy on the
-- table — same "look up the actual constraint name, don't guess it" pattern
-- already used in 20260829140000 for retention_jobs.job_type.
-- =============================================================================

do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.standard_category_translation'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%locale%';

  if v_conname is not null then
    execute format('alter table public.standard_category_translation drop constraint %I', v_conname);
  end if;

  alter table public.standard_category_translation
    add constraint standard_category_translation_locale_check
    check (locale in ('ko', 'en', 'zh', 'ja'));
end;
$$;
