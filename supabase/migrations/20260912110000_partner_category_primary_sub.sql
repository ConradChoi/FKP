-- =============================================================================
-- supabase/migrations/20260912110000_partner_category_primary_sub.sql
--
-- 파트너 표준 카테고리 선택 UX 개선 — 무제한 다중선택 -> 주 1개(필수) + 서브
-- 최대 2개(선택), 총 3개 상한. Design Ref: docs/02-design/features/
-- partner-standard-category-picker-redesign.screen-spec.md §5(데이터 모델),
-- §9(마이그레이션 정책), §11 OQ-1~OQ-4(2026-09-12 대표 확정).
--
-- 대표 확정 사항 반영(2026-09-12):
--   - OQ-1: Admin 대행입력도 이번에 동일 데이터 계약(role/최대3/RPC)을 쓴다.
--     -> §4 admin_set_partner_standard_categories 신설.
--   - OQ-2: 바이어 공개 목록 필터에 role 기반 토글을 다음 단계에서 붙일 수
--     있도록 partner_category_public 뷰에 role 컬럼을 노출한다. (토글 UI 자체는
--     frontend-developer 몫 — 이 마이그레이션은 데이터만 노출)
--   - OQ-3/OQ-4: 백필 기준은 created_at 오름차순, 4개 이상 초과분은
--     role=null로 영구 보존(삭제하지 않음).
--
-- 범위 밖(이번 마이그레이션이 하지 않는 것):
--   - Admin CapabilityTab.tsx / PartnerFilters.tsx / CategoryPicker.tsx 등
--     프론트엔드 컴포넌트 변경 — 다른 에이전트가 병렬로 작업 중.
--   - partner_category_public 뷰의 WHERE/JOIN 게이트 변경 — SELECT 목록에
--     role 컬럼만 추가한다(§8 D-8 "전체 그대로 노출" 원칙 유지, role 자체는
--     이제 노출되지만 필터링 로직은 이 마이그레이션이 만들지 않음).
-- =============================================================================


-- =============================================================================
-- §1. public.partner_standard_category — role 컬럼 추가
-- =============================================================================

alter table public.partner_standard_category
  add column if not exists role text check (role is null or role in ('primary', 'sub'));

comment on column public.partner_standard_category.role is
  '파트너 표준 카테고리 UX 개선(2026-09-12, 대표 요청, screen-spec §5.1). '
  'null은 마이그레이션 백필 시 3개 초과분(레거시 오버플로우)에만 존재 — RPC를 '
  '통한 신규 쓰기(partner_set_standard_categories / '
  'admin_set_partner_standard_categories)는 항상 primary/sub만 쓰므로 배포 '
  '이후 null 행이 새로 생기지 않는다. 파트너/바이어용 UI는 role이 null인 행을 '
  '조회/표시하지 않는다(Admin 전용 정리 대상, §9 참고). 기존 무제한-다중선택 '
  '시절 직접 insert 경로(예: 프론트가 아직 새 RPC로 전환되지 않은 과도기)가 '
  'role을 지정하지 않고 insert하면 null로 남는다 — 이는 데이터 정합성 위반이 '
  '아니라 "레거시 취급"으로 흡수된다(아래 §2/§3 제약이 role=null 행에는 적용되지 '
  '않기 때문).';


-- =============================================================================
-- §2. 기존 데이터 백필 (screen-spec §9, OQ-3/OQ-4 대표 확정)
--     — 제약(§3의 partial unique index / trigger)을 걸기 전에 먼저 수행한다.
--     created_at 오름차순 1번째=primary, 2~3번째=sub, 4번째 이후는 role=null로
--     그대로 둔다(삭제하지 않음). created_at 동률 시 standard_category_id로
--     타이브레이크(안정적 정렬을 위한 임의 기준 — 이 프로젝트엔 "파트너가 어떤
--     선택을 더 중요하게 여겼는지"를 나타내는 기존 신호가 없다는 점은
--     screen-spec §9 마지막 행에서 이미 논의됨).
-- =============================================================================

with ranked as (
  select
    partner_id,
    standard_category_id,
    row_number() over (
      partition by partner_id
      order by created_at asc, standard_category_id asc
    ) as rn
  from public.partner_standard_category
)
update public.partner_standard_category psc
set role = case
  when r.rn = 1 then 'primary'
  when r.rn in (2, 3) then 'sub'
  else null
end
from ranked r
where r.partner_id = psc.partner_id
  and r.standard_category_id = psc.standard_category_id;


-- =============================================================================
-- §3. 개수 제약 — 주 1개(부분 유니크 인덱스) + 서브 2개(트리거)
-- =============================================================================

-- 파트너당 주 카테고리 1개만 허용. 백필 직후 실행되므로, 백필 로직이 파트너당
-- 정확히 하나의 rn=1 행만 'primary'로 표시하는 한 이 인덱스 생성은 항상 성공한다.
create unique index if not exists idx_partner_standard_category_one_primary
  on public.partner_standard_category (partner_id) where role = 'primary';

-- 서브 카테고리 최대 2개 — 유니크 인덱스로 표현 불가하므로 트리거로 방어.
-- 기존 private.protect_standard_category_referenced()(20260829150000 §4)와
-- 동일한 "친절한 사전 체크" 스타일. BEFORE INSERT에서만 걸어도 충분한 이유:
-- 이 테이블엔 UPDATE grant/policy가 없다(같은 파일 §3 코멘트, "changing a
-- category selection is delete-old-row + insert-new-row, not UPDATE") — role
-- 스왑도 delete+insert이지 UPDATE가 아니므로 BEFORE INSERT 트리거만으로
-- 모든 쓰기 경로를 커버한다.
create or replace function private.protect_partner_category_role_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub_count integer;
begin
  if new.role = 'sub' then
    select count(*) into v_sub_count
    from public.partner_standard_category
    where partner_id = new.partner_id and role = 'sub';
    if v_sub_count >= 2 then
      raise exception 'sub_category_limit_exceeded: partner % already has 2 sub categories', new.partner_id
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

comment on function private.protect_partner_category_role_limits is
  '파트너 표준 카테고리 UX 개선(screen-spec §5.1). 정상 경로에서는 절대 걸리지
  않는 2차 방어선 — partner_set_standard_categories()/
  admin_set_partner_standard_categories() 양쪽 모두
  private.validate_partner_category_selection()로 "서브 최대 2개"를 이미
  애플리케이션 레벨에서 검증한 뒤 delete+insert를 수행하기 때문. 혹시 모를 직접
  insert 경로(예: 프론트가 아직 새 RPC로 전환되지 않았거나, Admin이 예전
  diff-insert 액션을 그대로 쓰는 과도기)에 대한 방어용.';

drop trigger if exists trg_partner_category_role_limits on public.partner_standard_category;
create trigger trg_partner_category_role_limits
  before insert on public.partner_standard_category
  for each row execute function private.protect_partner_category_role_limits();


-- =============================================================================
-- §4. 공용 검증 로직 + 원자적 교체 RPC 2종
--     (파트너 자기입력 / Admin 대행입력 — 동일 검증, 서로 다른 소유권 모델이라
--     RPC 자체는 분리, screen-spec §5.3)
-- =============================================================================

-- private.validate_partner_category_selection: 두 RPC가 공유하는 순수 검증
-- 함수. 성공 시 아무것도 반환하지 않고, 실패 시 예외를 던진다(테이블을 건드리지
-- 않는 STABLE 함수 — 트랜잭션 안에서 여러 번 불러도 안전).
--
-- "0개 선택(전체 해제)" 예외 처리에 대한 설계 판단(작업 지시의 "p_primary_id는
-- 필수(null이면 예외)"를 문자 그대로 절대적으로 구현하면, 마지막 남은 카테고리
-- 칩까지 해제해 0개로 되돌아가는 정상 플로우(screen-spec §4 규칙3 "서브도
-- 0개면 0개 선택 상태로 복귀", EDGE-9, §9 "카테고리 0개 선택"행)를 이 RPC로는
-- 영원히 만들 수 없게 된다 — 매 클릭이 이 RPC 1회 호출과 1:1 대응하는 설계(D-3,
-- 플로우차트 §2)이므로 "전체 해제"도 이 RPC를 통해서만 가능해야 한다. 따라서
-- "주 카테고리 필수" 규칙은 "서브가 하나라도 있으면 주도 반드시 있어야 한다"로
-- 해석해 구현했다 — p_primary_id가 null이면서 p_sub_ids도 비어있는 경우(=완전
-- 해제)만 예외적으로 허용하고, 그 외 모든 null-primary 조합은 그대로 거부한다.
-- "제출 시점에 주 카테고리 1개가 없으면 막는다"는 실제 요구사항은 §5(제출
-- 완성도 게이트, private.partner_profile_submission_gaps)에서 별도로
-- 강제되므로 이 RPC 레벨의 완화가 그 요구사항을 약화시키지 않는다.
create or replace function private.validate_partner_category_selection(
  p_primary_id uuid,
  p_sub_ids uuid[]
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_sub_ids uuid[] := coalesce(p_sub_ids, '{}');
  v_sub_count integer := coalesce(array_length(v_sub_ids, 1), 0);
  v_distinct_sub_count integer;
  v_active_primary_count integer;
  v_active_sub_count integer;
begin
  -- 완전 해제(위 코멘트 참고) — primary도 sub도 전혀 없는 경우만 허용.
  if p_primary_id is null and v_sub_count = 0 then
    return;
  end if;

  if p_primary_id is null then
    raise exception 'sub_category_requires_primary' using errcode = 'P0001';
  end if;

  if v_sub_count > 2 then
    raise exception 'too_many_sub_categories' using errcode = 'P0001';
  end if;

  if v_sub_count > 0 then
    select count(distinct s) into v_distinct_sub_count from unnest(v_sub_ids) as s;
    if v_distinct_sub_count <> v_sub_count then
      raise exception 'duplicate_sub_category' using errcode = 'P0001';
    end if;
  end if;

  if p_primary_id = any(v_sub_ids) then
    raise exception 'duplicate_category_role' using errcode = 'P0001';
  end if;

  select count(*) into v_active_primary_count
  from public.standard_category
  where id = p_primary_id and is_active = true;
  if v_active_primary_count = 0 then
    raise exception 'invalid_primary_category' using errcode = 'P0002';
  end if;

  if v_sub_count > 0 then
    select count(*) into v_active_sub_count
    from public.standard_category
    where id = any(v_sub_ids) and is_active = true;
    if v_active_sub_count <> v_sub_count then
      raise exception 'invalid_sub_category' using errcode = 'P0002';
    end if;
  end if;
end;
$$;

comment on function private.validate_partner_category_selection is
  'screen-spec §5.3 권고 — partner_set_standard_categories()와
  admin_set_partner_standard_categories() 양쪽이 공유하는 단일 검증 로직
  (로직 이중 구현 방지). STABLE, 테이블을 변경하지 않는다. "완전 해제" 예외
  처리는 이 함수 자신의 코멘트(위 정의부 코멘트) 참고.';


-- 파트너 자기입력 RPC — 기존 partner_submit_for_review() 등과 동일한
-- owner_account_id 조회 패턴(20260829140000 §6 참고).
create or replace function public.partner_set_standard_categories(
  p_primary_id uuid,
  p_sub_ids uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_partner_id uuid;
  v_sub_ids uuid[] := coalesce(p_sub_ids, '{}');
begin
  if not private.is_active_partner(v_auth_uid) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  select id into v_partner_id from public.partner where owner_account_id = private.current_partner_id(v_auth_uid);
  if v_partner_id is null then
    raise exception 'partner_not_found' using errcode = 'P0002';
  end if;

  perform private.validate_partner_category_selection(p_primary_id, v_sub_ids);

  -- 전체 교체(role이 null인 레거시 오버플로우 행은 건드리지 않는다, §9) —
  -- 단 이번에 새로 선택한 카테고리가 레거시 오버플로우 중 하나라면(PK가
  -- (partner_id, standard_category_id)이므로) 그 행도 함께 지워야 아래
  -- insert가 23505(PK 위반)로 영구 실패하지 않는다(privacy-security-officer
  -- P-A, 2026-09-12 배포 전 발견 — 카테고리를 4개 이상 갖고 있던 파트너가
  -- 5번째 오버플로우 카테고리를 재선택하면 이 조건이 없을 때 저장이 조용히
  -- 실패해서 그 카테고리를 영원히 선택할 수 없게 된다).
  delete from public.partner_standard_category
  where partner_id = v_partner_id
    and (role is not null
         or standard_category_id = p_primary_id
         or standard_category_id = any(v_sub_ids));

  if p_primary_id is not null then
    insert into public.partner_standard_category (partner_id, standard_category_id, role)
    values (v_partner_id, p_primary_id, 'primary');
  end if;

  if array_length(v_sub_ids, 1) > 0 then
    insert into public.partner_standard_category (partner_id, standard_category_id, role)
    select v_partner_id, sub_id, 'sub' from unnest(v_sub_ids) as sub_id;
  end if;

  -- PSO-1(screen-spec §12): owner_account_id 조회로 호출자 소유 파트너만
  -- 대상이 되므로 타 파트너 조작 불가. 기존 self-service 쓰기와 동일하게
  -- 'partner.profile_update' 액션을 재사용(audit_log CHECK 제약에 새 액션 코드
  -- 추가 불필요 — 카테고리 선택도 프로필 갱신의 일종).
  perform private.log_audit(
    p_action := 'partner.profile_update',
    p_target_table := 'partner_standard_category',
    p_target_id := v_partner_id::text
  );
end;
$$;

comment on function public.partner_set_standard_categories is
  'screen-spec §5.2/D-3 — 표준 카테고리 선택을 "최종 상태 전체"로 한 번에
  원자적으로 반영하는 RPC. 기존 클라이언트 diff(insert/delete 개별 호출) 패턴을
  대체한다. p_primary_id가 필수이나, p_primary_id=null AND p_sub_ids=''{}''인
  "완전 해제" 호출만 예외적으로 허용된다(private.validate_partner_category_
  selection의 코멘트 참고) — screen-spec EDGE-9/§9 "카테고리 0개 선택" 상태로
  되돌아가는 정상 플로우를 막지 않기 위함.';

revoke all on function public.partner_set_standard_categories(uuid, uuid[]) from public;
grant execute on function public.partner_set_standard_categories(uuid, uuid[]) to authenticated;


-- Admin 대행입력 RPC — 기존 updatePartnerCategoriesAction()(diff 기반
-- insert/delete)을 대체한다. 소유권 모델이 파트너용과 다르므로(임의
-- p_partner_id를 받음) 파트너용 RPC를 재사용하지 않고 별도로 둔다
-- (screen-spec §5.3). 권한 체크는 admin_set_partner_featured()
-- (20260911100000)와 동일 패턴.
create or replace function public.admin_set_partner_standard_categories(
  p_partner_id uuid,
  p_primary_id uuid,
  p_sub_ids uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub_ids uuid[] := coalesce(p_sub_ids, '{}');
  v_before jsonb;
begin
  if not (
    private.is_active_admin() and private.is_aal2()
    and private.has_menu_permission('partner_management', 'update')
  ) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  if not exists (select 1 from public.partner where id = p_partner_id) then
    raise exception 'partner_not_found' using errcode = 'P0002';
  end if;

  perform private.validate_partner_category_selection(p_primary_id, v_sub_ids);

  select jsonb_agg(jsonb_build_object('standard_category_id', standard_category_id, 'role', role))
  into v_before
  from public.partner_standard_category
  where partner_id = p_partner_id and role is not null;

  -- P-A(privacy-security-officer, 2026-09-12): 재선택 대상이 레거시
  -- 오버플로우 행이면 PK 충돌 방지를 위해 함께 지운다 — 파트너용 RPC와
  -- 동일한 이유.
  delete from public.partner_standard_category
  where partner_id = p_partner_id
    and (role is not null
         or standard_category_id = p_primary_id
         or standard_category_id = any(v_sub_ids));

  if p_primary_id is not null then
    insert into public.partner_standard_category (partner_id, standard_category_id, role)
    values (p_partner_id, p_primary_id, 'primary');
  end if;

  if array_length(v_sub_ids, 1) > 0 then
    insert into public.partner_standard_category (partner_id, standard_category_id, role)
    select p_partner_id, sub_id, 'sub' from unnest(v_sub_ids) as sub_id;
  end if;

  -- PSO-2(screen-spec §12): has_menu_permission('partner_management','update')
  -- 체크를 빠뜨리지 않음 + M-R12류 관례를 따라 누가/언제/무엇을 바꿨는지
  -- 감사로그에 남긴다. 기존 'admin_partner.update' 액션 코드를 재사용
  -- (20260829180000 §... 에서 이미 admin RPC의 일반 프로필 갱신에 쓰이던 코드 —
  -- audit_log CHECK 제약에 새 코드 추가 불필요).
  perform private.log_audit(
    p_action := 'admin_partner.update',
    p_target_table := 'partner_standard_category',
    p_target_id := p_partner_id::text,
    p_subject_ids := array[p_partner_id],
    p_before_summary := v_before,
    p_after_summary := jsonb_build_object('primary_id', p_primary_id, 'sub_ids', v_sub_ids)
  );
end;
$$;

comment on function public.admin_set_partner_standard_categories is
  'screen-spec §5.3/§7/OQ-1 — Admin 대행입력용 원자적 교체 RPC. partner_set_
  standard_categories()와 동일한 private.validate_partner_category_selection()
  검증을 공유하되, 임의 p_partner_id를 받으므로 has_menu_permission(
  ''partner_management'', ''update'') 권한 체크 + private.log_audit() 감사로그를
  추가로 요구한다. frontend-developer가 CapabilityTab.tsx의 기존
  updatePartnerCategoriesAction()(diff 기반 insert/delete)을 이 RPC 호출로
  교체할 예정 — 이 마이그레이션은 RPC만 제공하고 그 호출부 교체는 하지 않는다.';

revoke all on function public.admin_set_partner_standard_categories(uuid, uuid, uuid[]) from public;
grant execute on function public.admin_set_partner_standard_categories(uuid, uuid, uuid[]) to authenticated;


-- =============================================================================
-- §5. partner_category_public 뷰 — role 컬럼 노출 (OQ-2 대표 확정)
--     WHERE/JOIN 게이트는 그대로 유지(D-8) — SELECT 목록에 role만 추가한다.
--     "주력분야만 보기" 토글 자체(components/seepn/PartnerFilters.tsx)는
--     frontend-developer 몫 — 이 마이그레이션은 데이터만 노출한다.
-- =============================================================================

create or replace view public.partner_category_public as
select psc.partner_id, psc.standard_category_id, psc.role
from public.partner_standard_category psc
join private.partner_public_base b on b.id = psc.partner_id;

comment on view public.partner_category_public is
  'Privacy review §3.2 + screen-spec §8/OQ-2(2026-09-12 대표 확정, role 토글용
  컬럼 노출). 여전히 private.partner_public_base와의 JOIN으로만 게이트되므로
  (WHERE 절 직접 작성 아님) 3-layer 공개 게이트는 그대로 상속된다 — role 컬럼
  추가는 이 게이트에 영향 없음. role은 null(레거시 오버플로우)일 수 있음 — 바이어
  쪽 "주력분야만 보기" 필터는 role=''primary''만 매칭해야 하고, 기존 "전체(주+서브)
  노출" 동작은 role 무관하게 계속 유지된다(D-8). PSO-3(screen-spec §12): 이
  뷰는 컬럼을 명시적으로 나열하는 방식(select *가 아님)을 유지 — 향후 컬럼 추가
  시 이 방식을 깨지 말 것. Not personal data(§3.2 판정, role도 동일 판정 승계).';

grant select on public.partner_category_public to anon, authenticated;


-- =============================================================================
-- §6. 제출 완성도 게이트 — 주 카테고리 1개 필수(screen-spec §6/D-6)
--     기존 verified 파트너는 소급 무효화하지 않는다 — 이 함수는
--     partner_submit_for_review()가 verification_state가 draft/rejected일
--     때만 호출하므로(20260829140000 §9, "if v_partner.verification_state not
--     in ('draft', 'rejected') then raise exception"), 이미 verified인
--     파트너는 재제출 절차를 다시 타지 않는 한 이 신규 게이트의 영향을 받지
--     않는다 — 함수 자체를 수정하는 것만으로 D-6 요구사항이 자동으로
--     충족된다(별도의 "verified는 건너뛴다" 분기가 필요 없음).
-- =============================================================================

-- 버그 수정(이 마이그레이션에서 발견, 범위 밖이지만 이 함수를 다시 정의하는
-- 김에 같이 고친다 — 원본 20260829140000판은 그대로 두고 여기서
-- create or replace로 대체): 원본은 `v_gaps := v_gaps || 'literal'` 형태를
-- 썼는데, PostgreSQL에서 array(text[]) || unknown-타입 문자열 리터럴은
-- anyarray/anyarray 오버로드로 해석되어 리터럴을 배열 리터럴로 파싱하려다
-- "malformed array literal" 에러를 던진다(vanilla PostgreSQL 15에서
-- 재현됨 — plpgsql/search_path와 무관한 일반 SQL 동작). 즉 이 함수는
-- business_entity_type 등 어느 한 필드라도 비어 있으면(=거의 모든 신규
-- draft 파트너) 무조건 예외를 던져 제출 체크리스트 자체가 동작하지
-- 않았을 것이다 — 이번 작업(§6, k14 회귀 테스트)이 이 함수를 처음
-- 실제로 호출해보면서 발견됨. array_append(v_gaps, 'literal')로 명시적
-- 함수 호출을 사용해 오버로드 모호성을 없앤다(동작은 동일).
create or replace function private.partner_profile_submission_gaps(p_partner public.partner)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  v_gaps text[] := '{}';
begin
  if p_partner.business_entity_type is null then v_gaps := array_append(v_gaps, 'business_entity_type'); end if;
  if p_partner.company_name_ko is null then v_gaps := array_append(v_gaps, 'company_name_ko'); end if;
  if p_partner.business_registration_number is null then v_gaps := array_append(v_gaps, 'business_registration_number'); end if;
  if coalesce(array_length(p_partner.supported_languages, 1), 0) = 0 then v_gaps := array_append(v_gaps, 'supported_languages'); end if;
  if p_partner.overseas_experience is null then v_gaps := array_append(v_gaps, 'overseas_experience'); end if;
  if p_partner.company_intro_text is null then v_gaps := array_append(v_gaps, 'company_intro_text'); end if;
  if jsonb_array_length(p_partner.representative_offerings) = 0 then v_gaps := array_append(v_gaps, 'representative_offerings'); end if;
  if p_partner.vertical is null then v_gaps := array_append(v_gaps, 'vertical'); end if;

  if p_partner.vertical = 'product' then
    if p_partner.moq is null then v_gaps := array_append(v_gaps, 'moq'); end if;
    if p_partner.lead_time_days is null then v_gaps := array_append(v_gaps, 'lead_time_days'); end if;
    if p_partner.oem_odm_type is null then v_gaps := array_append(v_gaps, 'oem_odm_type'); end if;
  elsif p_partner.vertical = 'service' then
    if coalesce(array_length(p_partner.service_types, 1), 0) = 0 then v_gaps := array_append(v_gaps, 'service_types'); end if;
    if p_partner.project_min_size is null then v_gaps := array_append(v_gaps, 'project_min_size'); end if;
    if p_partner.pricing_model is null then v_gaps := array_append(v_gaps, 'pricing_model'); end if;
    if p_partner.standard_lead_time is null then v_gaps := array_append(v_gaps, 'standard_lead_time'); end if;
    if jsonb_array_length(p_partner.reference_projects) = 0 then v_gaps := array_append(v_gaps, 'reference_projects'); end if;
  end if;

  if not exists (select 1 from public.partner_document d where d.partner_id = p_partner.id and d.doc_type = 'business_registration_cert') then
    v_gaps := array_append(v_gaps, 'business_registration_cert_document');
  end if;

  if not exists (select 1 from private.partner_contact c where c.partner_id = p_partner.id) then
    v_gaps := array_append(v_gaps, 'contact');
  end if;

  -- 신규(screen-spec §6/D-6, 2026-09-12): 주 카테고리 1개 필수.
  if not exists (
    select 1 from public.partner_standard_category psc
    where psc.partner_id = p_partner.id and psc.role = 'primary'
  ) then
    v_gaps := array_append(v_gaps, 'standard_category_primary');
  end if;

  return v_gaps;
end;
$$;

comment on function private.partner_profile_submission_gaps is
  'SS-7 ("미입력 항목 안내") / SS-8 gate. This is where "필수" from PRD §3.2.2 '
  'is actually enforced (header note 1) — NOT NULL at the table level would '
  'break SS-6 partial-save. Also enforces the PRD 결함 #4 correction '
  '(privacy review §9 item 4): the business-registration certificate is '
  'required at SUBMISSION, not merely at public-listing time. '
  '2026-09-12 추가(screen-spec §6/D-6): standard_category_primary gap — 주
  카테고리(role=''primary'') 1개가 없으면 제출 불가. 이 함수는 partner_submit_
  for_review()가 verification_state가 draft/rejected일 때만 호출하므로 이미
  verified인 기존 파트너는 소급 영향을 받지 않는다(재제출 시점부터만 적용).';


-- =============================================================================
-- §7. QA 지적사항 수정 — 직접 INSERT/DELETE 경로 차단(쓰기는 RPC 전용)
-- =============================================================================
-- qa-reviewer 지적: 20260829150000 §3(217-233행 부근)의
-- `grant ... insert, delete on public.partner_standard_category to
-- authenticated`와 partner_standard_category_self_insert/_self_delete RLS
-- 정책은 role 값이나 개수를 전혀 검증하지 않는다. §3의 partial unique
-- index/trigger는 role='primary'/'sub' 행에만 적용되므로, 파트너가 자기
-- 세션으로 role=null을 직접 insert하면(모달/RPC를 거치지 않고) 아무 제약 없이
-- 무제한으로 role=null 행을 쌓을 수 있었다 — 위 §1 코멘트("배포 이후 null 행이
-- 새로 생기지 않는다")가 DB 레벨에서 전혀 강제되지 않는 결함.
--
-- 20260829150000은 이미 배포됐을 수 있으므로 원본 파일을 직접 고치지 않고,
-- 이 신규 마이그레이션에서 revoke/drop policy로 덮어쓴다(20260910180000이
-- 20260910100000의 산출물을 나중에 drop한 것과 동일한 원칙).
--
-- 이제부터 이 테이블에 대한 쓰기(INSERT/DELETE)는 오직 §4의
-- partner_set_standard_categories()/admin_set_partner_standard_categories()
-- SECURITY DEFINER RPC를 통해서만 가능하다 — 이 두 RPC는 함수 소유자(테이블
-- 소유자와 동일한 마이그레이션/superuser 역할) 권한으로 실행되므로 아래
-- revoke/drop과 무관하게 계속 정상 동작한다(20260911100000의
-- public.partner_featured_pick / admin_set_partner_featured, 20260910180000의
-- public.seepn_inquiry_partner / create_seepn_inquiry와 동일한 "쓰기는
-- SECURITY DEFINER RPC 전용" 패턴 — k1/k2/k7/k11/k14 회귀 테스트가 이 RPC
-- 경로는 계속 정상 동작함을 이미 검증한다).
--
-- SELECT grant/정책은 그대로 둔다 — 바이어 공개 필터(partner_category_public
-- 경유)나 파트너 본인 조회(예: CapabilityForm.tsx, capability/page.tsx)는
-- 계속 직접 select를 쓴다.

-- 파트너 자기입력 경로: 직접 insert/delete 차단.
revoke insert, delete on public.partner_standard_category from authenticated;

drop policy if exists partner_standard_category_self_insert on public.partner_standard_category;
drop policy if exists partner_standard_category_self_delete on public.partner_standard_category;

-- Admin 대행입력 경로도 마찬가지 — CapabilityTab.tsx의 기존 diff 기반
-- updatePartnerCategoriesAction()은 이미 setPartnerStandardCategoriesAction()
-- (app/admin/(protected)/partners/[id]/actions.ts)으로 교체되어
-- admin_set_partner_standard_categories() RPC만 호출한다(grep으로 확인 —
-- app 트리 전체에서 이 테이블에 대한 직접 insert/delete 호출은 더 이상 없고,
-- 남은 참조는 전부 select 전용). 따라서 Admin용 직접 insert/delete RLS
-- 정책도 더 이상 필요한 경로가 없다.
drop policy if exists partner_standard_category_admin_insert on public.partner_standard_category;
drop policy if exists partner_standard_category_admin_delete on public.partner_standard_category;


-- =============================================================================
-- End of migration.
-- =============================================================================
