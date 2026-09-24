-- =============================================================================
-- 탈퇴 사유 직접 입력(reason_text) 12개월 자동 파기 (privacy-security-officer 검토 R1, 2026-09-24)
--
-- 선택한 사유(reason_code)와 월 단위 시각(created_month)은 익명 통계로 계속 보관하고, 자유서술
-- 원문(reason_text)만 12개월이 지나면 NULL로 파기한다(문의 본문 12개월과 같은 기준).
-- created_month가 월 단위라서 "12개월 이내 파기"를 보장하도록 경계를 `<=`로 잡았다: 2025-09에
-- 받은 사유는 2026-09-01 배치에서 파기되므로 어떤 경우에도 12개월을 넘겨 보관하지 않는다
-- (대신 최대 약 1개월 일찍 파기될 수 있다).
--
-- Diff base for run_daily_retention_batches: 20260910100000 §13 (latest full definition — verified
-- no later-filenamed migration redefines it). All 11 existing blocks reproduced verbatim; only the
-- withdrawal-text block is new. retention_jobs.job_type CHECK widened by one value.
--
-- Not yet executed against Supabase — paste into the SQL Editor manually.
-- =============================================================================

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
      'seepn_withdrawal_text_purge'
    ));
end;
$$;


create or replace function private.purge_expired_seepn_withdrawal_text()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.seepn_withdrawal_feedback
  set reason_text = null
  where reason_text is not null
    and created_month <= (date_trunc('month', now() at time zone 'Asia/Seoul')::date - interval '12 months')::date;
  get diagnostics v_count = row_count;

  insert into public.retention_jobs (job_type, target_condition, anonymized_count, notes)
  values (
    'seepn_withdrawal_text_purge',
    'reason_text is not null and created_month <= current month - 12 months',
    v_count,
    'Free-text withdrawal reason only; reason_code and created_month survive as anonymous statistics.'
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
end;
$$;
