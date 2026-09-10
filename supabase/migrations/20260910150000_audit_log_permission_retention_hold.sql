-- =============================================================================
-- Audit log retention hold for permission-related actions (BP-23 / M-2)
--
-- 배경:
--   phase3_admin_rbac.sql §15의 private.purge_expired_audit_log()는
--   `delete from public.audit_log where occurred_at < now() - interval
--   '2 years'`로 action 구분 없이 일괄 삭제하고, 이 함수는
--   fkp-daily-retention-batches pg_cron job을 통해 매일 자동 실행되고
--   있다(2026-09-10 대표 확인: active=true, 최근 실행 status='succeeded').
--
--   반면 「개인정보의 안전성 확보조치 기준」은 접근 권한의 부여·변경·
--   말소 내역을 최소 3년 보관하도록 요구한다. 즉 admin_user.role_grant
--   / admin_user.role_revoke 같은 권한 관련 기록이 다른 일반 action과
--   섞여 2년 만에 지워지고 있었다. 이 문제는 이미
--   docs/03-security/seepn-buyer-web-p5a-privacy-review.md의 BP-23,
--   docs/03-security/legal-review-queue.md의 M-2로 기록되어 있다.
--
--   "정확히 몇 년을 보관해야 하는가"와 "어느 action까지 '권한 부여·
--   변경·말소'에 해당하는가"는 이미 외부 변호사 자문(M-2)에 큐잉되어
--   아직 회신을 받지 못했다. 그 숫자 자체가 회신 대기 중인 값이므로
--   여기서 "3년" 같은 특정 기간을 하드코딩하지 않는다. 대신 권한 관련
--   action을 이 2년 purge 대상에서 완전히 제외하여, 법무 회신이 올
--   때까지 무기한 보존한다 — 데이터를 더 지우는 실수는 되돌릴 수
--   없지만, 더 오래 보존하는 실수는 나중에 언제든 원하는 기간으로
--   좁혀 다시 지우면 되므로 안전한 방향이다.
--
-- 제외 대상 action과 판단 근거 (public.audit_log.action CHECK 제약,
-- phase3_admin_rbac.sql 카테고리 C 기준):
--
--   [2026-09-10 QA 리뷰 재검증 및 수정] 최초 버전은 아래 5개
--   (admin_user.role_grant/role_revoke, role.create/update/delete)를
--   제외 목록에 넣었으나, 배포 전 QA 리뷰에서 `grep -rn "p_action := '"
--   supabase/migrations/*.sql`로 전수 확인한 결과 이 5개는
--   private.log_audit(p_action := ...)로 실제 기록되는 곳이 코드베이스
--   전체에 단 한 군데도 없는, audit_log.action CHECK 제약에만 존재하는
--   예비(reserved) 문자열임이 밝혀졌다. 즉 최초 버전은 "한 번도 안
--   쓰이는 문자열"만 보호하고 있었고, 정작 관리자에게 실제로 role을
--   부여하는 유일한 런타임 경로인
--   public.finalize_admin_access_approval()
--   (20260829170000_fix_admin_invite_auth_principal.sql)이 남기는
--   기록 — p_action := 'admin_access_request.approve' — 은 제외
--   목록에 없어 그대로 2년 뒤 삭제 대상에 남아 있었다. 이 마이그레이션이
--   막으려던 원래 문제(관리자 권한부여 이력이 2년 만에 사라지는 것)가
--   전혀 해결되지 않는 치명적 결함이었으므로, 아래와 같이
--   `admin_access_request.approve`를 제외 목록에 추가했다. 기존 5개
--   문자열은 CHECK 제약상 유효하고 미래에 실제로 쓰일 수도 있으므로
--   목록에서 제거하지 않고 그대로 둔다(더 넓게 보존하는 방향은 항상
--   안전하다).
--
--   - admin_user.role_grant / admin_user.role_revoke
--       관리자 계정에 대한 role 자체의 부여·말소. 요건 문구
--       ("접근 권한의 부여·변경·말소")에 가장 직접적으로 해당한다
--       → 반드시 제외. (단, 위 재검증 결과 현재 코드베이스 어디서도
--       실제로 기록되지 않는 예비 문자열 — CHECK 제약에만 존재. 실제
--       role 부여는 admin_access_request.approve로 기록된다. 관리자
--       role을 부여가 아닌 방식으로 실제 회수(revoke)하는 별도
--       런타임 경로도 `grep -rn "delete from public.admin_user_role"
--       supabase/migrations/*.sql`로 확인했으나 찾지 못했다 — 현재
--       admin_user_role에 대한 delete/update는
--       trg_admin_user_role_protect_self(self-lockout 방지) 트리거만
--       존재하고, 실제 revoke는 admin_user 전체를 suspend/withdraw하는
--       방식으로만 이루어진다. 별도 revoke 경로가 생기면 그때 이
--       목록에 실제 action 문자열을 추가해야 한다.)
--   - role.create / role.update / role.delete
--       role이 실제로 무엇에 접근 가능한지(그 role의 정의) 자체를
--       바꾸는 행위다. role_grant 기록만 오래 보관하고 그 role이
--       당시 무엇을 의미했는지의 이력(role.update/delete)이 2년에
--       지워지면, role_grant 보관 자체가 무의미해진다 → 같은 범주로
--       보고 제외. (단, 위와 동일하게 현재 코드베이스에서 실제로
--       기록되는 곳이 없는 예비 문자열이다.)
--   - role_menu_permission.change
--       role별로 어떤 메뉴(=기능)에 접근 가능한지를 바꾸는 행위 그
--       자체다. role.update와 동일한 이유로 "권한 변경"의 핵심에
--       해당한다 → 제외. 이 action은
--       20260825160000_phase3_permission_management_crud.sql에서
--       실제로 매번 기록되는 것을 grep으로 확인했다.
--   - admin_access_request.approve [2026-09-10 추가]
--       관리자에게 실제로 role을 부여하는 유일한 런타임 경로인
--       public.finalize_admin_access_approval()
--       (20260829170000_fix_admin_invite_auth_principal.sql)이
--       insert into public.admin_user_role ...로 실제 권한을 부여하며
--       남기는 기록. 위 5개와 달리 이 action은 매번 실제로 기록되는
--       살아있는 경로이므로, "접근 권한의 부여" 요건을 충족시키려면
--       반드시 제외해야 한다 → 제외.
--   - (제외하지 않음) admin_access_request.reject
--       요청을 거부만 할 뿐 실제 admin_user_role을 바꾸지 않는다
--       (20260825130000_phase3_admin_access_request.sql 확인). 즉
--       "권한의 부여·변경·말소"에 해당하지 않으므로 이번 제외 대상에
--       포함하지 않는다 — QA 리뷰어와 판단 일치.
--   - (제외하지 않음) admin_user.invite / invite_resend / invite_revoke
--     / activate / suspend / withdraw / profile_update
--       계정의 존재·활성 상태·프로필을 바꾸는 행위이지, 그 계정이
--       "무엇에 접근 가능한지"를 바꾸는 행위가 아니다("계정 상태
--       변경"이지 "권한 변경"은 아님). 범위를 필요 이상으로 넓히면
--       나중에 법무 회신과 어긋날 수 있으므로 이번 제외 대상에
--       포함하지 않는다.
--   - (제외하지 않음) menu.create / menu.update / menu.delete
--       메뉴(리소스) 자체의 존재를 바꾸는 행위이지, "누가 그 메뉴에
--       접근 가능한지"를 바꾸는 행위(=role_menu_permission.change)와는
--       다르다. 이번 제외 대상에 포함하지 않는다 — 필요하면 법무
--       회신 이후 재검토.
--
-- 이 마이그레이션은 DELETE의 WHERE 절만 좁히며, §3.5/§3.6
-- (phase3_admin_rbac.sql §6/§15)의 append-only 보호 장치 — 특히
-- `set local fkp.audit_purge = 'on'` escape hatch와
-- trg_audit_log_append_only 트리거 — 는 그대로 유지한다. 함수 시그니처
-- (이름·인자 없음·리턴 integer)도 바꾸지 않으므로
-- private.run_daily_retention_batches() 등 기존 호출부는 수정할 필요가
-- 없다.
-- =============================================================================

create or replace function private.purge_expired_audit_log()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  -- §3.5 layer 3 escape hatch: ONLY this function, and only for the
  -- duration of this transaction (`set local`), may delete audit_log rows.
  set local fkp.audit_purge = 'on';

  delete from public.audit_log
  where occurred_at < now() - interval '2 years'
    -- BP-23 / M-2: 권한 관련 action은 최소 3년(정확한 기간은 법무
    -- 회신 대기 중) 보관 요건 대상이므로 이 2년 배치에서 제외하고
    -- 무기한 보존한다. 위 마이그레이션 헤더 코멘트 참조.
    and action not in (
      'admin_user.role_grant',
      'admin_user.role_revoke',
      'role.create',
      'role.update',
      'role.delete',
      'role_menu_permission.change',
      'admin_access_request.approve'
    );
  get diagnostics v_deleted = row_count;

  insert into public.retention_jobs (job_type, target_condition, deleted_count, notes)
  values (
    'audit_purge',
    'occurred_at < now() - interval ''2 years'' and action not in '
    '(admin_user.role_grant, admin_user.role_revoke, role.create, role.update, '
    'role.delete, role_menu_permission.change, admin_access_request.approve)',
    v_deleted,
    'BP-23/M-2 (2026-09-10 임시 조치, 같은 날 QA 리뷰 수정 반영): 권한 관련 '
    'action(admin_user.role_grant/role_revoke, role.create/update/delete, '
    'role_menu_permission.change, admin_access_request.approve)은 이 배치에서 '
    '제외하고 무기한 보존으로 전환했다. admin_access_request.approve는 관리자에게 '
    '실제로 role을 부여하는 유일한 런타임 경로(finalize_admin_access_approval)가 '
    '남기는 기록이며, 나머지 5개는 audit_log.action CHECK 제약에만 존재하고 아직 '
    '실제로 기록되지 않는 예비 문자열이다(2026-09-10 QA 리뷰에서 발견 및 수정). '
    '「개인정보의 안전성 확보조치 기준」상 접근 권한의 부여·변경·말소 내역 최소 3년 '
    '보관 요건과의 정확한 정합(정확한 보관 연한, 정확한 action 범위)은 외부 변호사 '
    '자문(legal-review-queue.md M-2) 회신 대기 중이며, 회신 후 이 함수를 다시 좁혀 '
    '재정의할 예정이다.'
  );

  return v_deleted;
end;
$$;

comment on function private.purge_expired_audit_log is
  '§3.6: deletes audit_log rows older than the 2-year retention window, '
  'EXCEPT permission-related actions (admin_user.role_grant/role_revoke, '
  'role.create/update/delete, role_menu_permission.change, '
  'admin_access_request.approve), which are held INDEFINITELY pending '
  'external legal review (M-2, docs/03-security/legal-review-queue.md) of '
  'the statutory >= 3-year retention requirement for 접근 권한의 부여·변경·말소 '
  '내역 (see BP-23, docs/03-security/seepn-buyer-web-p5a-privacy-review.md). '
  'admin_access_request.approve is the only one of these actions actually '
  'recorded today (by finalize_admin_access_approval when it inserts into '
  'admin_user_role) — the other 5 are reserved strings in the audit_log.action '
  'CHECK constraint with no current caller (verified 2026-09-10 by grepping '
  'all p_action assignment call sites); they remain in the exclusion list in '
  'case they become live later. admin_access_request.reject is deliberately '
  'NOT excluded because it only rejects the request without mutating '
  'admin_user_role. Do not hardcode a specific retention period for the '
  'excluded actions until the legal reply arrives — narrow the exclusion '
  'again at that point if needed. This is the sole legitimate caller of the '
  '`fkp.audit_purge` GUC escape hatch in trg_audit_log_append_only (§10/§6). '
  'Deletion here remains deliberate and lawful for non-excluded actions — '
  '§3.6 forbids EARLY deletion within the retention window for any reason, '
  'but does not forbid deletion once the window has elapsed.';
