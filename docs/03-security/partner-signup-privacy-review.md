# SEEPN Unified Platform v1.0 — Korean Partner 자가등록 개인정보/보안 사전검토

작성: privacy-security-officer · 2026-08-29
대상: [`seepn-unified-platform-v1.0.prd.md`](../01-plan/features/seepn-unified-platform-v1.0.prd.md) §3.0 / §3.2.1(SS-1~SS-14) / §3.2.2 / §3.2.3(PC-1~PC-7) / §3.2.5(PR-1~PR-9)
선행 문서: [`fkp-v0.2-privacy-review-phase3-rbac.md`](../01-plan/features/fkp-v0.2-privacy-review-phase3-rbac.md), [`fkp-v0.2-privacy-review-oq4-tv4.md`](../01-plan/features/fkp-v0.2-privacy-review-oq4-tv4.md)
근거 코드: `supabase/migrations/20260824120000_phase1_requests_pipeline.sql`, `20260825120000_phase3_admin_rbac.sql`, `20260825130000_phase3_admin_access_request.sql`, `20260827100000_phase5_content_management_schema.sql`, `lib/legal/consentVersions.ts`
수신: **backend-developer(스키마 설계 착수 전 필독)** · service-planner · frontend-developer · qa-reviewer · project-manager · ceo-advisor(§7.3 에스컬레이션)

> **면책**: 본 문서는 실무 검토이며 법률 자문이 아닙니다. "**변호사 검토 필요**"로 표시한 항목은 대외 오픈 전 법률 검토를 권합니다. 그 외는 코드/설정/공개 법령에서 확인 가능한 사실관계에 기반합니다.

> **본 문서에서 확정하는 위임 결정 3건**
> - **PR-8 (파트너 계정 ↔ Admin 계정 분리 방식)** → **§2.2. 단일 Auth 풀 공유 + `auth_principal` 상호배타 레지스트리로 DB 레벨 강제.** 물리 분리(별도 Supabase 프로젝트)는 D-1과 충돌하므로 채택하지 않습니다.
> - **OQ-8 (파트너 데이터 보관/파기 기준)** → **§4 PR-5.** 회사정보는 회원 탈퇴 시까지, 담당자 PII·증빙파일은 목적 달성 시점 기준 별도 단축 기준.
> - **SS-12 재가입 제한 30일** → **§4 PR-9. v1.0에서는 도입하지 않습니다.** 도입 시 필요한 최소 구조는 §4 PR-9에 남겨둡니다.

---

## 0. 결론 요약 — 스키마 설계 착수 전 반드시 반영할 것

| # | 항목 | 심각도 | 게이트 |
|---|------|:------:|:---:|
| **A** | **`private.is_active_admin()`은 파트너를 관리자로 오인하지 않는다(검증 완료, §2.3).** 그러나 PR-8이 놓친 진짜 위험은 함수가 아니라 **"authenticated = 관리자"라는 기존 코드베이스 전체의 암묵적 전제가 붕괴**하는 것이다. 회귀 점검표 §2.4를 스키마 설계와 동시에 처리해야 한다 | **치명적** | 스키마 설계 전 |
| **B** | **`auth.users`는 프로젝트당 1개다. 파트너/관리자 Auth 풀의 물리적 분리는 불가능하다.** 대신 `public.auth_principal(auth_user_id PK, principal_kind)` 레지스트리 + 복합 FK로 **한 Auth 사용자가 관리자이면서 동시에 파트너일 수 없음**을 트리거 없이 선언적으로 강제한다 (§2.2) | **치명적** | 스키마 설계 전 |
| **C** | **`private.log_audit()`가 파트너 행위를 `actor_kind='system'`으로 오기록한다.** `audit_log.actor_kind` CHECK에 `'partner'`가 없고, `action` CHECK 목록에 `partner.*`가 없으며, `actor_user_id` FK가 `admin_user`만 가리킨다. **파트너 계정이 생기는 순간 감사로그의 행위자 귀속이 깨진다** (§2.6) | **치명적** | 스키마 설계에 포함 |
| **D** | **공개 노출(SS-9/PC-6)을 boolean 컬럼 하나로 두지 말 것.** 공개 읽기 경로는 `partner_public` 뷰 단일 창구로 좁히고, 뷰 술어에 **유효 동의 레코드 존재(EXISTS)** 를 넣어 "플래그를 잘못 켜도 공개되지 않는" 구조로 만든다 (§3.3) | **치명적** | 스키마 설계 |
| **E** | **`admin_entry` 레코드에 보관 상한이 없다.** PC-6은 "동의 없으면 공개 금지"만 정했지 "동의 없이 무기한 보관"을 막지 않는다 — 이건 공개 여부와 무관하게 수집·보유 자체의 적법성 문제다. `consent_deadline_at`(권고 90일) + 자동 파기 배치 필수 (§3.5, PR-11) | **치명적** | 스키마 설계 |
| **F** | **사업자등록증 파일: private 버킷 + 경로에 원본 파일명 금지 + SVG/HTML 업로드 차단 + 서명URL 만료 120~300초 + 발급 감사기록 선행.** 서명 URL은 발급 후 RLS를 우회하므로 TTL과 발급 시점 감사가 유일한 통제다 (§4 PR-2) | **주요** | 스키마 설계(P1), 구현(P1) |
| **G** | **법인 / 개인사업자 구분 필드(`business_entity_type`)가 필수다.** 개인사업자의 사업자등록번호·대표자명은 개인정보로 취급되며, 법인은 그렇지 않다. 이 구분이 없으면 파기·열람권·마스킹 정책을 행 단위로 적용할 수 없다 (§5 PR-10) | **주요** | 스키마 설계 |
| **H** | **SS-5(사업자등록번호 중복 검증)는 비로그인 상태에서 제공하면 등록 기업 열거(enumeration) 취약점이 된다.** 로그인 후 프로필 입력 단계로 이동 + 중립 메시지 + 레이트리밋 (§5 PR-12) | **주요** | service-planner, 스키마(RPC 권한) |
| **I** | **PR-3(파트너용 약관/처리방침)은 스키마 블로커가 아니라 "파트너 가입 오픈" 블로커다.** 단, **동의 항목의 필수/선택 분리 목록(§6.2)** 은 스키마보다 먼저 확정되어야 한다 — 이것만 정해지면 문서 본문은 병행 작성 가능 | **주요** | §6 |
| **J** | 공개 콘텐츠 RLS가 `for select to anon`으로 되어 있어 **로그인한 파트너에게 블로그/FAQ/카테고리 번역이 빈 값으로 보인다.** 개발자가 이걸 "관리자 정책을 느슨하게" 고치면 사고다. 올바른 수정 방향을 §2.4-(5)에 명시 | **주요** | P1 구현 |
| **K** | 파트너 계정 도입은 Supabase Auth의 **"Allow new users to sign up" 설정**을 건드린다. 이 설정은 관리자 계정과 같은 프로젝트에 걸린 전역 스위치다. **켜지 말고 서버 라우트(service_role) 경유 가입**을 권고 (§2.8) | **주요** | 스키마/구현 |
| **L** | 파트너 콘솔과 Admin 콘솔이 **같은 호스트를 쓰면 Supabase 세션 쿠키가 서로를 덮어쓴다.** 호스트 분리 또는 `storageKey` 분리 필수 (§2.7) | **주요** | 아키텍처 |
| **M** | PRD 내부 모순: §4.1/§4.2/§5/§8이 여전히 "파트너 계정 = P6 / Won't(v1.0)"라고 적혀 있어 D-4와 충돌. P1 DoD도 PR-1~PR-6만 게이트로 잡고 PR-7~PR-9를 누락 (§9) | 권고 | PM 문서 수정 |

**판정: 스키마 설계 착수 가능.** 단 §7.2의 **선결 답변 3건(Q-1, Q-2, Q-3)** 은 테이블 형태를 바꾸므로 backend-developer가 첫 줄을 쓰기 전에 답이 있어야 합니다. 나머지는 본 문서의 권고안을 그대로 채택하면 됩니다.

---

## 1. 이 검토가 근거로 삼은 코드 사실 (backend-developer가 잘못 알기 쉬운 것)

| # | 사실 | 확인 위치 |
|---|------|-----------|
| F-1 | `private.is_active_admin(uuid)`는 `admin_user`에 **행이 존재하고 `status='active'`** 일 때만 true. auth.users 존재만으로는 절대 true가 되지 않는다 | `20260825120000` §8 (474~487행) |
| F-2 | 모든 Admin RLS 정책은 `is_active_admin() AND is_aal2() AND has_menu_permission(...)` **3중 AND**. `is_aal2()`는 TOTP MFA를 마친 세션에서만 true | 같은 파일 §11~§13 |
| F-3 | Supabase Auth 공개 가입은 **OFF**이며, 관리자 계정은 `admin_access_request` → super_admin 승인 → 서버 라우트가 `service_role`로 `inviteUserByEmail` 하는 경로로만 생성된다 | `20260825130000` 헤더 9~15행, `app/api/admin/access-requests/[id]/approve/route.ts` |
| F-4 | `requests.contact`는 authenticated에게 **SELECT GRANT 자체가 없고**, `contact_masked`(generated) 만 노출. 원문은 `public.get_request_contact()` 에서만 나오며 **감사로그 write 실패 시 원문 반환도 롤백**된다 | `20260825120000` §11 (1205~1353행) |
| F-5 | `audit_log`는 GRANT 회수 + RLS + BEFORE 트리거 3중 append-only. `actor_kind` CHECK는 `('admin','system','anon')`, `action`은 고정 CHECK 목록 | 같은 파일 §6 (312~416행) |
| F-6 | 민감 컬럼은 `private` 스키마로 분리하는 선례가 있다(`private.request_meta.consent_ip`, `internal_note`). `private`는 PostgREST Exposed Schema가 **아니다** | `20260824120000` §1/§3 |
| F-7 | 동의 버전 문자열은 `lib/legal/consentVersions.ts`가 `docs/legal/<doc>-<version>-<locale>.md` 파일과 1:1 바인딩. 문구가 바뀌면 새 파일 + 새 버전 문자열 | `lib/legal/consentVersions.ts` |
| F-8 | 제3자 제공 동의는 **인테이크 시점에 받지 않고** 실제 매칭 시점에 개별로 받는다(컬럼만 선반영). 바이어 측에서 이미 확정된 원칙 | `20260824120000` 127~132행 |
| F-9 | 리텐션 배치는 `pg_cron` 1일 1회 `private.run_daily_retention_batches()`. `retention_jobs.job_type` CHECK 확장으로 신규 배치를 붙이는 선례가 있다 | `20260825120000` §14~§15 |

---

## 2. [최우선] PR-7 / PR-8 → 구체적 스키마 설계 지침

### 2.1 먼저 사실관계: "물리적 분리"는 선택지가 아니다

Supabase 프로젝트는 `auth.users` 스키마를 **프로젝트당 1개**만 가집니다. D-1(Core DB = FKP Supabase 1개)이 확정된 이상 파트너와 관리자는 **같은 `auth.users` 테이블을 공유할 수밖에 없습니다.** 분리하려면 별도 Supabase 프로젝트를 하나 더 만들어야 하고, 그러면 파트너 계정과 Partner/Capability 데이터가 서로 다른 DB에 놓여 `owner_account_id` FK(PC-3)가 성립하지 않습니다. **채택하지 않습니다.**

따라서 PR-8의 질문("물리적으로 분리 vs 한 풀 공유 + 판정 함수 엄격 구분")에 대한 답은 **"한 풀을 공유하되, 애플리케이션 계층이 아니라 DB 제약으로 상호배타를 강제한다"** 입니다. "판정 함수에서 잘 구분하면 된다"는 수준으로는 부족합니다 — 함수는 사람이 고칠 수 있고, 제약은 못 고칩니다.

### 2.2 [확정] 권고 구조 — `auth_principal` 상호배타 레지스트리

```
-- 신규. 이 프로젝트의 모든 로그인 주체를 정확히 하나의 종류로 못박는다.
create table public.auth_principal (
  auth_user_id   uuid primary key references auth.users (id) on delete restrict,
  principal_kind text not null check (principal_kind in ('admin', 'partner')),
  created_at     timestamptz not null default now(),
  -- 아래 UNIQUE가 복합 FK의 참조 대상이 된다. PK(auth_user_id) 때문에
  -- 한 auth 사용자는 정확히 하나의 kind만 가질 수 있다.
  unique (auth_user_id, principal_kind)
);
```

- **기존 `admin_user`**: `principal_kind text not null default 'admin' check (principal_kind = 'admin')` 컬럼 추가 +
  `foreign key (auth_user_id, principal_kind) references public.auth_principal (auth_user_id, principal_kind) on delete restrict`
- **신규 `partner_account`**: 동일하게 `principal_kind ... check (= 'partner')` + 같은 복합 FK

이 구조의 성질:

| 성질 | 결과 |
|------|------|
| 한 auth 사용자가 admin + partner 동시 보유 | **불가능.** `auth_principal.auth_user_id`가 PK이므로 kind는 행당 1개, 복합 FK가 각 테이블의 kind를 고정 |
| 경쟁 조건(동시 삽입) | **없음.** 트리거+SELECT 방식과 달리 PK/FK는 커밋 시점까지 원자적으로 보장 |
| `service_role` 키 유출 시 | FK/CHECK는 **BYPASSRLS로 우회되지 않는다.** RLS만으로 막는 것보다 강함 (Phase 3 §1.2와 같은 논리) |
| 마이그레이션 비용 | 기존 `admin_user` 행 3개에 대해 `auth_principal` 백필 1회 |

> `admin_user.auth_user_id`는 현재 nullable입니다(탈퇴 익명화 대비, `20260825120000` 154~157행). `partner_account`도 같은 이유로 nullable로 두되, 복합 FK는 NULL일 때 검사되지 않으므로(MATCH SIMPLE) 문제 없습니다.

**`partner_account` 최소 컬럼 권고** (필드 정의는 backend-developer 소관, 아래는 개인정보/보안 관점의 제약만):

```
public.partner_account (
  id uuid pk,
  auth_user_id uuid unique references auth.users(id) on delete restrict,  -- nullable
  principal_kind text not null default 'partner' check (principal_kind='partner'),
  status text not null default 'pending_email'
    check (status in ('pending_email','active','suspended','withdrawn')),
  -- 이메일 컬럼 없음: auth.users가 SSOT (admin_user 선례를 그대로 따른다)
  display_name text not null,          -- 담당자 실명이 아니라 표시명. 실명은 private로.
  last_login_at timestamptz,
  withdrawn_at timestamptz, anonymized_at timestamptz,
  created_at, updated_at
)
alter table public.partner_account enable row level security;
alter table public.partner_account force row level security;
revoke all on public.partner_account from anon, authenticated;
```

- **이메일 컬럼을 만들지 마십시오.** `admin_user`가 의도적으로 그렇게 되어 있고(`20260825120000` 159~162행), 로그인 이메일을 두 곳에 두면 파기 시 누락이 생깁니다.
- `display_name`에 담당자 실명을 담지 마십시오. 실명/직함/전화는 §4 PR-1의 `private.partner_contact`로 갑니다.

### 2.3 PR-8의 우려 검증 결과 — `is_active_admin()`은 안전하다

`private.is_active_admin()`은 `admin_user`에 `status='active'`인 행이 있는지만 봅니다. `partner_account`는 별개 테이블이므로 **파트너 계정이 관리자로 판정될 경로가 없습니다.** `is_super_admin` / `has_pii_access` / `has_menu_permission`도 전부 `admin_user`를 조인 시작점으로 삼고 있어 동일합니다. **PR-8이 지목한 함수 자체의 오판정 위험은 없습니다 — 회귀 검토의 결론은 "함수는 그대로 재사용"입니다.**

문제는 다른 데 있습니다. 아래 §2.4가 실제 회귀 범위입니다.

### 2.4 [치명적] 진짜 회귀 위험 — "authenticated = 관리자" 전제의 붕괴

현재 코드베이스에서 `authenticated` 역할을 가진 세션은 **오직 관리자 3명뿐**입니다(F-3). 이 사실이 여러 GRANT를 "실질적으로 안전"하게 만들어 왔습니다. 파트너 계정이 생기면 이 전제가 사라집니다. 점검 결과:

| # | 대상 | 판정 | 조치 |
|---|------|:----:|------|
| (1) | `grant select on public.requests(컬럼목록) to authenticated` | **안전** — `requests_admin_select` 정책이 3중 AND. 파트너는 0행 | 없음. 단 qa-reviewer가 **파트너 세션으로 `requests` SELECT 0행**을 P1 DoD 테스트로 증명할 것 (PRD DoD의 "anon 키 차단"만으로는 부족) |
| (2) | `grant select on public.admin_user / role / admin_user_role / menu / role_menu_permission / audit_log to authenticated` | **안전** — 전부 `is_active_admin()` 선행 조건 | 없음 (테스트는 (1)과 동일) |
| (3) | `grant execute on function private.log_audit(...) to authenticated` | **주요 위험** — `private`가 Exposed Schema가 아니라는 **단 한 겹**에만 의존. 이 GRANT는 RLS 정책에서 호출되지 않으므로(정책은 `is_active_admin` 등만 호출) 실효 필요성이 낮다 | **`revoke execute on function private.log_audit(...) from authenticated`** 권고. 감사로그 위조/오염 경로를 원천 제거 |
| (4) | `grant execute on public.log_auth_event(...) to anon, authenticated` | 기존부터 존재하는 감사로그 오염 벡터(고정 액션 8종으로 제한되어 있음). 파트너 도입으로 호출량이 늘어남 | 액션 화이트리스트 유지 + **API 라우트 레벨 IP 레이트리밋**. 파트너용 액션을 여기에 추가하지 말 것(§2.6의 별도 RPC 사용) |
| (5) | `content_item / content_translation / content_category_translation`의 공개 읽기 정책이 **`for select to anon`** (`20260827100000` 281·351·126행) | **주요(기능 파손)** — 로그인한 파트너 세션은 `anon`이 아니므로 블로그/FAQ/번역이 **빈 배열**로 보인다. 개발자가 급히 "admin 정책의 조건을 풀어서" 고치면 그게 사고 | **공개 술어를 유지한 채 대상만 넓힌다**: `for select to anon, authenticated using (status='published' and ...)`. `content_category`(61행)는 이미 `anon, authenticated`라 선례도 있음. **관리자 정책은 절대 손대지 말 것** |
| (6) | `alter default privileges`로 신규 테이블 기본 차단(Phase 1) | 유효 | 신규 파트너 테이블도 `revoke all ... from anon, authenticated` 명시적으로 재확인 |
| (7) | `private.login_lockout` (이메일 키 잠금) | 파트너 로그인이 같은 테이블을 쓰면 서로 다른 이메일이므로 충돌은 없으나, **파트너 대량 가입 시 테이블 증가** | 재사용 가능. 단 파트너 로그인 라우트에도 IP 레이트리밋 적용 |
| (8) | `public.submit_access_request()`가 anon에 열려 있음 | 파트너가 관리자 가입요청 큐에 진입 시도 가능(승인 없이는 무의미) | 변경 불필요. 다만 파트너 콘솔 UI에서 이 경로가 노출되지 않도록 |

> **qa-reviewer 필수 테스트(신규)**: "파트너 계정으로 로그인한 세션"을 하나 만들어 `requests`, `admin_user`, `audit_log`, `role`, `menu`, `admin_access_request`, `private.*` 전부에 대해 SELECT/UPDATE 시도 → **전부 0행 또는 권한오류**임을 증명. 이것이 PR-7의 "바이어용 anon 경로와 권한이 절대 섞이면 안 됨"에 대한 실제 검증 수단입니다.

### 2.5 신규 판정 함수 규격 (기존 패턴 그대로 복제)

```
private.is_active_partner(p_auth_uid uuid default auth.uid()) returns boolean
  -- security definer, set search_path = '', stable, boolean만 반환(§1.2 원칙)
  -- 조건: partner_account 행 존재 AND status = 'active'
  --       AND auth.users.email_confirmed_at is not null   <- SS-1 이메일 인증 강제
private.current_partner_id(p_auth_uid uuid default auth.uid()) returns uuid
  -- 소유권(PC-3) 판정용. partner_account.id 반환, 없으면 null
private.owns_partner(p_partner_id uuid, p_auth_uid uuid default auth.uid()) returns boolean
```

**설계 규칙(Phase 3 §1.2 승계, 반드시 지킬 것):**
1. 판정 함수는 **boolean 또는 자기 자신에 대한 uuid만 반환**한다. 절대 행 데이터를 반환하지 않는다.
2. 파트너용 RLS 정책은 `is_active_partner() AND owns_partner(id)` 형태로, **관리자 조건과 OR로 합치지 말고 별도 정책으로 분리**한다. 한 정책 안에서 `(관리자 조건) or (파트너 조건)`을 쓰면 나중에 한쪽을 고칠 때 다른 쪽이 조용히 넓어진다.
3. **파트너 경로에 `is_aal2()`를 요구하지 않는다.** MFA는 관리자 전용 요구사항이며, 파트너에 강제하면 가입 전환율이 무너집니다. 반대로 **관리자 경로에서 `is_aal2()`를 빼는 일은 절대 없어야 합니다** — 파트너 도입을 이유로 이 조건을 완화하자는 제안이 나오면 그건 거절 대상입니다.
4. 파트너가 쓰기 가능한 컬럼은 **컬럼 단위 GRANT**로 좁힌다(`requests`의 `grant update (status, assignee_id)` 선례). `verification_state`, `intake_source`, `owner_account_id`, 공개노출 상태는 **파트너에게 GRANT 없음** — 전부 SECURITY DEFINER RPC 경유.

### 2.6 [치명적] `audit_log` 확장 — 지금 안 하면 감사 귀속이 깨진다

`private.log_audit()`(642~729행)은 `auth.uid()`로 `admin_user`를 찾고, **못 찾으면 `actor_kind := 'system'`** 으로 기록합니다. 파트너 계정이 생기면 **모든 파트너 행위가 "시스템이 한 일"로 기록**됩니다. 감사로그가 append-only라 나중에 고칠 수도 없습니다.

필요한 마이그레이션(전부 P1 스키마에 포함):

```
-- 1) actor_kind CHECK 확장
alter table public.audit_log drop constraint <기존 actor_kind check>;
alter table public.audit_log add constraint audit_log_actor_kind_check
  check (actor_kind in ('admin','partner','system','anon'));

-- 2) 파트너 행위자 FK 추가 (admin_user FK와 배타)
alter table public.audit_log
  add column actor_partner_account_id uuid references public.partner_account(id) on delete restrict;
alter table public.audit_log add constraint chk_audit_actor_exclusive check (
  not (actor_user_id is not null and actor_partner_account_id is not null)
);

-- 3) action CHECK 목록 확장 (기존 목록은 고정 CHECK라 새 문자열이 들어가면 INSERT 실패한다)
--    최소 세트:
--    partner.signup, partner.email_verified, partner.login_success, partner.login_failed,
--    partner.password_changed, partner.withdraw,
--    partner.profile_update, partner.submit_for_review,
--    partner.consent_grant, partner.consent_revoke,
--    partner.public_listing_on, partner.public_listing_off,
--    partner.document_upload, partner.document_delete,
--    admin_partner.list, admin_partner.view, admin_partner.contact_reveal,
--    admin_partner.document_reveal, admin_partner.update, admin_partner.verify,
--    admin_partner.reject, admin_partner.suspend_listing,
--    admin_partner.admin_entry_create, admin_partner.consent_evidence_write,
--    admin_partner.export, admin_partner.export_denied

-- 4) private.log_audit() 본문 수정: admin_user 미발견 시 partner_account 조회 →
--    발견 시 actor_kind='partner', actor_partner_account_id 세팅.
--    actor_email_snapshot은 파트너에도 동일하게 남긴다(익명화 후 귀속 보존 목적).
```

> **`chk_audit_export_reason` 패턴 승계**: `admin_partner.export`도 `export_reason` 10자 이상을 CHECK로 강제하십시오. 파트너 목록 CSV(A1-R10)는 담당자 PII 다발 반출입니다.

### 2.7 [주요] 세션 쿠키 네임스페이스 — 같은 호스트에 두면 서로를 덮어쓴다

supabase-js는 프로젝트 ref 기반의 단일 스토리지 키(`sb-<ref>-auth-token`)를 씁니다. 파트너 콘솔과 Admin 콘솔이 **같은 호스트**에 있으면:

- 관리자가 같은 브라우저에서 파트너 계정으로 로그인 → **관리자 세션이 조용히 교체됨**
- "쿠키가 있으니 관리자겠지"라고 가정한 라우팅/미들웨어가 오작동 (현재 `app/admin/(protected)/layout.tsx`는 `get_my_admin_context()`로 재확인하므로 **보안 사고는 아니지만**, 무한 리다이렉트/오해 소지)

**권고(둘 중 하나 필수)**
1. **호스트 분리** — 파트너 콘솔은 `seepn.me`, Admin은 현행 도메인. D-3 구조상 자연스러움. **권고안.**
2. 부득이 같은 호스트면 각 앱의 supabase 클라이언트에 **서로 다른 `auth.storageKey`** 지정 + 쿠키 `path` 분리.

추가로 **Admin 라우트는 파트너 세션을 명시적으로 거부**해야 합니다(현재는 `is_active_admin=false`로 자연 차단되지만, `auth.access_denied` 감사기록을 남기도록 보강 권고).

### 2.8 [주요] Supabase Auth 설정 파급 — 공개 가입을 켜지 마십시오

`20260825120000` 헤더 45~48행은 **"Allow new users to sign up = OFF"** 를 Phase 3 체크리스트 항목으로 못박고 있습니다. SS-1(이메일+비밀번호 회원가입)을 구현하려고 이 스위치를 켜면:

- 누구나 `auth.users` 행을 만들 수 있게 되고, `authenticated` 역할 획득자 수가 무제한이 됩니다.
- 위 §2.4의 모든 GRANT가 "불특정 다수"에게 노출된 상태로 재평가되어야 합니다(현재 판정상 데이터 유출은 없지만, 앞으로 추가되는 모든 테이블이 실수 한 번에 노출되는 환경이 됩니다).
- 가입 스팸/이메일 폭탄의 발송 주체가 우리 프로젝트가 됩니다.

**권고: 공개 가입은 OFF 유지. 파트너 가입도 서버 라우트 경유로 구현합니다.**

```
POST /api/partner/signup   (Next.js Route Handler, service_role)
  1. 입력 검증(이메일 형식, 비밀번호 정책) + 허니팟 + IP 레이트리밋
     (lib/forms/rateLimit.ts, submit_access_request의 허니팟 패턴 재사용)
  2. 동의 체크 검증 — 필수 동의 미체크면 400 (§6.2)
  3. supabase.auth.admin.createUser({ email, password, email_confirm:false })
  4. public.finalize_partner_signup(p_auth_user_id, p_consents jsonb) RPC 호출
     → auth_principal + partner_account + partner_consent 를 **한 트랜잭션**으로 생성
     → 실패 시 3번에서 만든 auth 사용자를 정리(admin.deleteUser)하거나
       고아 계정으로 로그 남김 (approve 라우트의 finalize 실패 처리 선례 참고)
  5. 인증 메일 발송
```

이 구조는 `admin_access_request` 승인 라우트(§F-3)와 동일한 검증된 패턴이며, `service_role` 키의 두 번째 사용처가 됩니다 — **Amplify 환경변수는 반드시 Secrets(암호화)로 관리**하고, 빌드 로그/클라이언트 번들에 `SUPABASE_SERVICE_ROLE_KEY`가 유출되지 않는지 P1 배포 전 확인하십시오(`NEXT_PUBLIC_` 접두어 금지).

**Auth 설정 상호작용 주의**
- 세션 만료 30분(관리자 기준, `20260825120000` 헤더 51~52행)은 **프로젝트 전역**입니다. 파트너에게도 30분 무활동 로그아웃이 걸립니다. 파트너 프로필 작성은 길어질 수 있으므로 **SS-6의 "부분 저장 후 이어쓰기"가 UX 기능이 아니라 보안 설정의 필연적 요구사항**입니다 — service-planner에게 전달 필요.
- 비밀번호 최소 12자 + 유출 비밀번호 차단도 전역이므로 파트너에게도 적용됩니다. **완화 요청이 오면 거절 대상**(안전성 확보조치 기준 제5조 비밀번호 작성규칙).
- 이메일 인증 토큰 유효기간은 기본값(보통 24시간) 이하로 유지, 비밀번호 재설정 토큰은 **1시간 이하** 권고.
- 비밀번호 재설정/가입 응답은 **계정 존재 여부를 노출하지 않는 중립 메시지**로 통일(이메일 열거 방지).

---

## 3. PC-6 / PC-7 — `admin_entry` 동의 확보 근거를 어떻게 기록할 것인가

### 3.1 법적 위치 정리

`admin_entry`로 들어오는 담당자 이름/직함/이메일/전화는 **정보주체 본인이 아닌 경로로 수집한 개인정보**입니다. 여기서 필요한 것은 두 가지이고, PC-7은 이 중 하나만 다루고 있습니다.

| 의무 | 내용 | PC-6/PC-7 반영 여부 |
|------|------|:---:|
| 수집·이용의 적법근거 (법 제15조) | 동의 또는 다른 법정 근거. D-6이 "대면/유선 확인"을 전제하므로 **동의**가 근거 | PC-7이 부분 반영 |
| 동의 사실의 입증책임 (법 제16조·제22조 취지) | 다툼이 생기면 **우리가** 동의를 받았음을 증명해야 함 | PC-7이 "기록한다"고만 함 → **필드 규격 필요** |
| 수집 출처 고지 (법 제20조) | 정보주체가 요구하면 **수집 출처·처리 목적·열람권 존재**를 알려야 함 | **PC-6/PC-7 어디에도 없음 → 신규 요건 PR-13** |
| 보유기간 제한 (법 제21조) | 동의를 못 받으면 그 개인정보는 근거 없는 보유 상태 | **없음 → 신규 요건 PR-11 (§3.5)** |

> **변호사 검토 필요**: "유선으로 구두 동의를 받고 운영자가 기록"이라는 형태가 법 제22조의 동의 방식으로 충분한지(특히 선택 동의·제3자 제공 동의를 구두로 받는 것), 그리고 제20조 고지를 사후 이메일로 하는 것이 적절한지는 대외 오픈 전 법률 검토 대상입니다. 아래 구조는 "증명 가능성을 최대화하는 실무 구조"이지 적법성 보증이 아닙니다.

### 3.2 [권고 구조] 동의는 컬럼이 아니라 **별도 append-only 테이블**로

파트너 행에 `consent_yn boolean` + `consent_note text`를 다는 방식은 안 됩니다. 이유: (a) 동의는 항목별(약관/개인정보/공개노출/제3자제공)로 따로 존재하고, (b) 버전이 바뀌면 재동의가 필요하며, (c) 철회 이력이 남아야 하고, (d) 나중에 수정되면 증거로서의 가치가 0이 됩니다.

```
public.partner_consent (
  id uuid pk,
  partner_id uuid not null references public.partner(id) on delete restrict,

  consent_type text not null check (consent_type in (
    'terms',              -- 필수: 파트너 이용약관
    'privacy',            -- 필수: 개인정보 수집·이용
    'public_listing',     -- 선택: SEEPN 공개 노출 (SS-9 / PC-6의 게이트)
    'third_party_share',  -- 선택: 매칭 시 바이어에게 담당자 정보 제공 (매칭 시점 수집)
    'marketing'           -- 선택
  )),
  granted boolean not null,

  document_version text,        -- 'partner-terms-v1.0-2026-09' 등. lib/legal 바인딩(F-7)
  consent_locale text not null default 'ko' check (consent_locale in ('ko','en','ja')),

  -- 어떻게 받았는가 (PC-7의 핵심)
  method text not null check (method in ('online_self','phone','in_person','email','paper')),
  collected_at timestamptz not null,   -- 정보주체가 실제로 동의한 시각
  recorded_at  timestamptz not null default now(),  -- 시스템에 입력된 시각 (다를 수 있다)

  -- admin_entry 전용: 누가 확인했고 누가 동의했는가
  recorded_by_admin_id uuid references public.admin_user(id) on delete restrict,
  consenter_name  text,      -- 동의한 담당자 성명
  consenter_title text,      -- 직함 (권한 있는 담당자인지 판단 근거)

  -- 증빙
  evidence_kind text not null default 'none'
    check (evidence_kind in ('none','call_log','signed_form','email_thread','recording')),
  evidence_ref  text,        -- Storage object path 또는 메시지 ID. 원문 아님.

  -- 철회
  revoked_at timestamptz,
  revoked_reason text,
  revoked_by text check (revoked_by in ('subject','admin','system')),

  created_at timestamptz not null default now()
);
```

**append-only 강제**: `audit_log`와 같은 3중 방어를 그대로 복제하십시오 — GRANT 회수 + UPDATE/DELETE 정책 부재 + BEFORE UPDATE/DELETE 트리거. 단 **철회는 UPDATE가 아니라 새 행(`granted=false`)으로 기록**하는 것이 더 깔끔합니다(그러면 트리거가 예외 없이 단순해짐). `revoked_at` 컬럼을 쓸지 새 행으로 할지는 backend-developer 재량이되, **둘 중 하나만** 쓰십시오.

**PII 분리**: `consenter_name`, `consenter_title`, `evidence_ref`, (수집 시 IP가 있다면) `consent_ip`는 **`private.partner_consent_meta`로 분리**하는 것을 권고합니다 — `private.request_meta` 선례(F-6)와 동일. 운영자 목록 화면에서 "동의 있음/없음"만 보면 되고 동의자 실명까지 항상 보일 이유가 없습니다.

### 3.3 [치명적] PC-6 강제는 boolean이 아니라 **읽기 경로 자체를 좁혀서** 한다

PC-6("동의 없으면 공개 불가")을 `partner.is_public boolean`으로 구현하면, 그 컬럼을 켜는 코드 경로가 하나만 잘못돼도 미동의 PII가 인터넷에 노출됩니다. 되돌릴 수 없는 사고입니다.

**권고 3층 구조:**

```
1층 — 상태 컬럼: partner.public_listing_state text
        check (public_listing_state in ('off','on','suspended'))
        default 'off'
      → 파트너/관리자 모두에게 UPDATE GRANT 없음. RPC 경유만.

2층 — 쓰기 게이트: public.partner_set_public_listing(p_partner_id uuid, p_on boolean)
      SECURITY DEFINER. 'on'으로 바꾸려면 전부 만족해야 함:
        (a) verification_state = 'verified'
        (b) 유효한 public_listing 동의 존재 (granted=true AND revoked_at is null
            AND document_version = 현행 버전)
        (c) 호출자가 소유자 파트너 본인(owns_partner) 이거나,
            admin_entry 레코드에 대해 method in ('phone','in_person') 증빙이 있는 동의를
            근거로 관리자가 대신 켜는 경우
        (d) 사업자등록증 증빙 존재 (§4 PR-2 / §9의 §3.2.2 모순 해소)
      'off'/'suspended'로 바꾸는 것은 관리자 단독 가능 (A1-R9의 "공개 중단만 일방 가능")
      모든 호출을 partner.public_listing_on/off, admin_partner.suspend_listing 으로 감사기록.

3층 — 읽기 게이트: public.partner_public (뷰, security_invoker 또는 definer 중 택1)
      SEEPN 공개 페이지(P5)와 anon이 접근할 수 있는 **유일한** 파트너 데이터 창구.
      where p.public_listing_state = 'on'
        and p.verification_state = 'verified'
        and p.withdrawn_at is null
        and exists (유효한 public_listing 동의)      <-- 2층과 중복. 의도된 중복이다.
      담당자 이름/이메일/전화는 이 뷰에 **컬럼 자체가 존재하지 않는다.**
```

3층의 `exists(동의)`는 2층과 논리적으로 중복이지만, **이 중복이 방어선입니다.** 2층 함수에 버그가 생겨 `state='on'`이 잘못 세팅돼도 동의 행이 없으면 공개되지 않습니다. `partner` 원본 테이블에는 **anon GRANT를 절대 주지 마십시오** — anon은 `partner_public`만 봅니다.

### 3.4 `admin_entry` 필수 입력 규격 (A1-R2 "동의 확보 근거 입력이 필수 필드")

관리자가 `intake_source='admin_entry'`로 파트너를 생성할 때, **다음이 없으면 저장 자체를 거부**하는 것을 권고합니다(RPC 내 검증 + CHECK 제약 병행):

| 필수 입력 | 이유 |
|---|---|
| `method` (phone / in_person 중 택1) | "어떻게 확인했는가" 없이는 증명 불가 |
| `collected_at` (미래 시각 불가, 현재로부터 N일 이내) | 사후 소급 입력 방지 |
| `consenter_name` + `consenter_title` | **"권한 있는 담당자"였는지**가 L-3(사칭 리스크)의 핵심 |
| `recorded_by_admin_id` (`auth.uid()`에서 자동, 입력값 신뢰 금지) | 책임 소재 |
| `collection_source_detail` (전시회/명함/소개자 등, 자유서술) | 법 제20조 수집출처 고지 대응 (PR-13) |
| 동의 항목 체크: `terms`, `privacy` 필수 / `public_listing` 별도 | 필수·선택 분리(법 제22조) |

> **결정 권고**: `admin_entry` 생성 시 **`public_listing` 동의는 기본 미체크(off)** 로 두고, 운영자가 "구두로 공개 동의도 받았다"고 체크하려면 `evidence_kind`를 `none`이 아닌 값으로 입력하게 강제하십시오. 이 한 가지가 PC-6의 실효성을 좌우합니다.

### 3.5 [치명적, 신규 PR-11] 동의 확보 기한과 자동 파기

PC-6은 "동의 전까지 공개 불가"만 정합니다. 그러나 **동의 없이 수집·보유하고 있는 상태 자체**가 적법근거 없는 처리입니다. 공개하지 않아도 위법 소지가 있습니다.

```
partner.consent_deadline_at timestamptz
  -- intake_source='admin_entry' 이고 필수 동의(terms/privacy)가 아직 없는 행에만 세팅
  -- 권고 기본값: created_at + 90일
```
- 배치(§F-9의 `run_daily_retention_batches`에 함수 1개 추가, `retention_jobs.job_type`에 `'partner_unconsented_purge'` 추가): 기한 경과 & 필수 동의 없음 → **담당자 PII(private.partner_contact) 및 증빙파일 하드 삭제**, 회사 공개정보(상호/사업자번호/카테고리)는 `business_entity_type='corporation'`인 경우에 한해 아웃리치 대상 목록으로 보존 가능.
- 기한 D-14 시점에 운영자 대시보드 경고(A1-R12와 같은 자리).

이 구조가 있으면 "예외 경로를 열어두되 감사 가능하게"(PC-7)를 넘어서 **"예외 경로가 방치되면 자동으로 소멸"** 까지 됩니다. OQ-4의 잔여 리스크에 대한 실질적 해답입니다.

---

## 4. PR-1 ~ PR-9 검증 결과

| ID | 타당성 | 판정 요지 |
|----|:---:|---|
| PR-1 | **타당, 보강 필요** | `requests.contact` 패턴 재사용은 옳음. 단 파트너는 PII 필드가 5개(이름/직함/이메일/전화/대표자명)라 컬럼 GRANT 방식보다 **`private` 테이블 분리**가 맞다 (아래) |
| PR-2 | **타당, 구체성 부족** | 구체 정책을 아래에 확정 |
| PR-3 | **타당, 게이트 재분류** | 스키마 블로커 아님. §6 참조 |
| PR-4 | **타당, 불충분** | 공개 통제만 있고 **보유 통제가 없음** → PR-11(§3.5)로 보강 |
| PR-5 | **타당, 결정 위임 수용** | 아래에서 확정 |
| PR-6 | **타당** | `field_agent`는 `role` 테이블에 행 추가로 끝. `can_access_pii=false`, `lead_management` 권한 0, `partner_management` 권한도 주지 말 것 |
| PR-7 | **타당, 우려 지점 이동** | §2 참조. "권한이 섞이는" 사고는 함수가 아니라 GRANT 전제 붕괴에서 발생 |
| PR-8 | **타당하나 결론은 반대** | 함수 오판정 위험은 **없음**(§2.3). 대신 §2.2의 상호배타 제약과 §2.6의 감사로그 확장이 진짜 필요분 |
| PR-9 | **타당, 범위 확정 필요** | 아래에서 확정 |

### PR-1 — 담당자 연락처 (구체안)

**결론: `requests`의 컬럼 GRANT 방식이 아니라 `private.request_meta` 방식(테이블 분리)을 쓰십시오.**

```
private.partner_contact (
  partner_id uuid pk references public.partner(id) on delete cascade,
  contact_name text not null,
  contact_title text,
  contact_email text not null,
  contact_phone text,
  representative_name text,     -- 대표자명 (개인사업자면 개인정보, §5 PR-10)
  updated_at timestamptz not null default now()
);
alter table private.partner_contact enable row level security;
alter table private.partner_contact force row level security;
revoke all on private.partner_contact from anon, authenticated;
```
- `public.partner`에는 **마스킹된 표시값만** generated column으로 둔다:
  - 이메일: `requests.contact_masked` 표현식 그대로 복제 (1205~1212행)
  - 전화: 뒤 4자리만 노출하는 IMMUTABLE 표현식 (`regexp_replace` 기반). `generated always as ... stored`는 IMMUTABLE 함수만 허용되므로 주의.
  - 이름: 가운데 글자 마스킹(`홍*동`).
  - **주의**: generated column은 원본 컬럼이 같은 테이블에 있어야 합니다. 원문을 `private`에 두면 generated 불가 → **마스킹 값도 `private.partner_contact`에 generated로 만들고, 관리자 목록용 조회는 `public.list_partners()` 정의자 함수가 마스킹 값만 조인해 반환**하거나, 마스킹 값만 `public.partner`에 일반 컬럼으로 두고 RPC가 동기화하는 방식 중 택1. 전자를 권고.
- 원문 열람: `public.get_partner_contact(p_partner_id uuid)` — **`get_request_contact`를 그대로 복제**하십시오. 특히 **감사기록 write 실패 시 예외를 던져 원문 반환을 롤백**하는 부분(1335~1338행)이 이 패턴의 핵심입니다.
- 권한: `is_active_admin AND is_aal2 AND has_menu_permission('partner_management','read') AND has_pii_access`. `viewer` 역할은 영구 마스킹(OQ-16 결정 승계).
- **파트너 본인**은 자기 `partner_contact`를 읽고 쓸 수 있어야 합니다 — 별도 정책/RPC로 분리하고, 이 경로는 감사기록 대상이 아닙니다(본인의 자기정보 접근).

### PR-2 — 사업자등록증·증빙 파일 (Storage 정책 확정)

| 항목 | 확정 정책 |
|---|---|
| 버킷 | `partner-doc` **단일 private 버킷**(`public = false`). 공개 버킷 생성 금지 |
| 경로 | `p/{partner_id}/{doc_type}/{uuid}.{ext}` — **원본 파일명을 경로에 넣지 말 것**(`(주)○○_사업자등록증.pdf` 자체가 정보 유출). 원본 파일명은 DB 컬럼에 저장 |
| 허용 타입 | `application/pdf`, `image/jpeg`, `image/png` **화이트리스트**. **`image/svg+xml`, `text/html`, `application/xml` 반드시 차단**(저장형 XSS). 확장자와 매직바이트 둘 다 검사 |
| 크기 | 파일당 ≤ 10MB, 파트너당 총량 상한(권고 50MB) |
| 응답 헤더 | `Content-Disposition: attachment` 강제. 브라우저 인라인 렌더 금지 |
| Storage RLS | `storage.objects`에 4개 정책: (1) 파트너 INSERT/SELECT — `(storage.foldername(name))[2] = private.current_partner_id()::text` (2) 관리자 SELECT — `is_active_admin AND is_aal2 AND has_menu_permission('partner_management','read')` (3) UPDATE 정책 없음(교체는 삭제+신규) (4) DELETE는 RPC 경유. **anon 정책 없음** |
| 서명 URL TTL | 관리자 열람 **120초**, 파트너 본인 재열람 **300초**. `getPublicUrl` 사용 금지. 발급된 URL을 DB/로그/이메일에 저장 금지 |
| 발급 감사 | 서명 URL 발급은 SQL이 아닌 Storage API 호출이므로 `get_request_contact` 같은 원자성이 불가능. **차선책: 서버 라우트가 (1) 권한 확인 → (2) `admin_partner.document_reveal` 감사기록 RPC 호출 → (3) 감사 성공을 확인한 뒤에만 `createSignedUrl`.** 순서를 뒤집지 말 것 |
| 업로드 감사 | `partner.document_upload` — 파일 해시(sha256), 크기, MIME만 기록. **파일 내용/원본 파일명은 감사로그에 넣지 말 것**(§3.4 "감사로그가 2차 개인정보 저장소가 되지 않게" 승계) |
| **보관기간** | **권고: `verification_state='verified'` 확정 후 90일 내 원본 파일 하드 삭제.** 검증 결과(검증자·검증일시·사업자번호 일치 여부)만 DB에 남긴다. 사업자등록증 원본은 **검증이라는 목적을 달성한 순간 보유 근거가 약해지는** 대표적 데이터다. `partner_document.purge_after timestamptz` + 일일 배치(`job_type='partner_doc_purge'`) |
| 탈퇴 시 | 즉시 전량 삭제(§PR-9) |

> **주의**: 개인사업자의 사업자등록증에는 대표자 성명·사업장 주소(자택인 경우 많음)가 포함됩니다. 위 "검증 후 삭제"를 채택하면 이 리스크가 구조적으로 사라집니다. 반대로 "장기 보관"을 택하면 암호화·접근통제 요구가 올라갑니다(안전성 확보조치 기준 제7조). **삭제 쪽을 강하게 권고합니다.**
> **주민등록번호가 포함된 서류(신분증 사본 등)는 어떤 경우에도 업로드받지 마십시오** — 법 제24조의2에 따라 법령 근거 없는 주민등록번호 처리는 원칙적 금지입니다. 업로드 안내 문구에 명시하고, 관리자 화면에도 "주민번호가 보이면 반려" 가이드를 넣으십시오.

### PR-5 / OQ-8 — 보관·파기 기준 (확정)

`requests`의 12/24개월/30일과는 **다른 기준**이 맞습니다. 파트너 데이터는 회원정보이고, 보유 근거가 "동의 + 회원 지위 유지"이기 때문입니다.

| 대상 | 보관기간 | 근거/비고 |
|---|---|---|
| `partner_account` (계정) | **탈퇴 시까지**. 탈퇴 시 §PR-9 절차 | 회원 지위 존속 = 보유 근거 |
| 회사 정보 (상호/사업자번호/카테고리/역량) — **법인** | 탈퇴 후에도 보유 가능 | 법인 정보는 개인정보가 아님. 단 공개는 즉시 중단 |
| 회사 정보 — **개인사업자** | **탈퇴 시 파기 또는 익명화** | 사업자번호·대표자명이 개인정보로 취급됨(§5 PR-10) |
| `private.partner_contact` (담당자 PII) | **탈퇴 즉시 파기** | 목적 소멸 |
| 증빙 파일 | 검증 후 90일 / 탈퇴 시 즉시 | PR-2 |
| `verification_state='rejected'` 건 | **90일** 후 담당자 PII·파일 파기, 반려 사유·통계만 보존 | 재제출 대비 기간. 무기한 보관 금지 |
| 가입 후 미제출(`draft`) 방치 계정 | **12개월 미접속 시** 안내 후 파기 (권고) | 근거 없는 장기 보유 방지 |
| `admin_entry` 미동의 건 | **90일**(PR-11, §3.5) | 신규 |
| `partner_consent` (동의 증빙) | 탈퇴 후 **3년** 권고 | 동의 사실의 입증 필요. 단 이 목적에 필요한 최소 항목만(동의 유형/시각/버전/방법), 담당자 실명은 이 기간 동안 `private`에 격리 보관. **변호사 검토 필요**(적정 기간) |
| `audit_log` | 현행 2년 유지 | 안전성 확보조치 기준 제8조. 파트너 도입으로 변경 없음 |

> **연동 확인**: 파트너 회사가 어떤 Requirement에 추천됐는지(Match)는 `requests`의 리텐션 배치와 상호작용합니다. `requests`가 12/24개월 뒤 익명화될 때 Match 행이 고아가 되지 않도록 FK를 `on delete restrict`로 두고, Match 쪽에도 별도 익명화 규칙을 P4에서 정의하십시오.

### PR-9 / SS-12 — 탈퇴 처리 (확정)

**즉시(트랜잭션 내)**
1. `partner_account.status='withdrawn'`, `withdrawn_at=now()`
2. `partner.public_listing_state='off'` + `public_listing` 동의 철회 행 기록 → `partner_public` 뷰에서 즉시 소멸
3. Supabase Auth: 해당 사용자의 **모든 리프레시 토큰 무효화**(`auth.admin.signOut(user_id, 'global')`). 이걸 안 하면 최대 30분간 유효 세션이 남습니다
4. 증빙 파일 전량 삭제
5. `partner.withdraw` 감사기록

**지연(배치)**
6. `private.partner_contact` 행 삭제(권고: 즉시. 분쟁 대비가 필요하면 최대 30일)
7. `auth.users` 행은 **즉시 삭제하지 않는다** — `admin_user`와 동일하게 `on delete restrict`로 묶여 있고, 감사로그 귀속이 깨집니다. `partner_account.auth_user_id`를 NULL로 만든 뒤 Auth 사용자 삭제는 감사 보관기간 경과 후(§2.4 admin_user 선례 그대로)
8. 개인사업자 파트너의 회사정보 익명화

**Match 이력 보존 범위(PR-9의 핵심 질문)**
- **보존한다**: `match` 행, `partner_id`, 선정/제외 태그, Outcome 전이 시각, 회사명(법인) — **북극성 지표(§1.3)의 유일한 소스**이며 삭제하면 사업 검증이 불가능해집니다.
- **파기한다**: 그 Match에 붙은 **담당자 개인 식별정보**(누구에게 연락했는지의 이름/이메일/전화), 컨택 기록(M-R10)의 개인 식별 부분.
- 즉 **"회사 단위 이력은 남고, 사람 단위 정보는 지운다"**. 이 원칙을 P4 Match 스키마 설계 시 미리 반영해야 하므로, **Match 테이블은 처음부터 담당자 PII를 자기 컬럼으로 복사해 갖지 말고 `partner_contact`를 참조만** 하십시오.

**재가입 제한 30일 → v1.0 미도입 (확정)**
- 재가입 제한을 하려면 탈퇴자의 식별자(이메일/사업자번호)를 파기하지 않고 30일 보관해야 합니다. **"탈퇴 시 즉시 파기" 원칙에 대한 예외를 만드는 것이고, 그 예외의 목적(어뷰징 방지)이 현재 검증되지 않았습니다.** 최소수집 원칙 위반 소지가 있습니다.
- 어뷰징 방지 목적은 이미 **PC-4(사업자번호 중복 검증)** 와 **검증 큐(A1-R5)** 가 담당합니다.
- 향후 도입이 필요해지면: 이메일/사업자번호 **원문이 아니라 서버 사이드 pepper를 쓴 HMAC-SHA256 해시만** `private.withdrawn_partner_block(hash, expires_at)`에 30일 보관 + 자동 삭제. 이 구조를 처리방침에 명시. **지금은 만들지 마십시오.**

---

## 5. 신규 추가 요건 (PR-10 ~ PR-16)

| ID | 요건 | 위험도 | 권장 조치 |
|----|------|:---:|---|
| **PR-10** | **법인 / 개인사업자 구분** — 개인사업자의 사업자등록번호·대표자명은 개인정보로 취급됨(법인은 아님). 이 구분 없이는 파기·마스킹·열람권 대응을 행 단위로 적용할 수 없다 | **주요** | `partner.business_entity_type text not null check in ('corporation','sole_proprietor')` **필수 입력**. 파기 배치·공개 뷰·마스킹 규칙이 이 값에 분기. **변호사 검토 필요**(개인사업자 상호/사업자번호의 공개 노출 범위) |
| **PR-11** | **`admin_entry` 미동의 레코드의 보유 상한** | **치명적** | §3.5. `consent_deadline_at` + 자동 파기 배치 |
| **PR-12** | **사업자번호 중복 검증(SS-5)의 열거 취약점** — 비로그인 상태에서 "이미 등록됨"을 알려주면 누구나 "어느 회사가 SEEPN에 등록했는지"를 조회할 수 있다. 사업자번호는 공개 조회가 가능하므로 대량 열거가 쉽다 | **주요** | (1) 중복 검증 RPC를 `anon`에 **GRANT하지 말 것**. 로그인+이메일 인증 후에만 호출 가능 (2) 응답은 "이 사업자번호는 등록할 수 없습니다. 고객센터로 문의해 주세요" 중립 메시지 — 어느 회사인지·상태는 노출 금지 (3) 계정당 호출 레이트리밋 (4) 화면 흐름 변경 필요 → **service-planner(SP-3)에 전달** |
| **PR-13** | **수집 출처 고지(법 제20조) 대응 필드 부재** — `admin_entry`로 수집한 경우 정보주체가 요구하면 수집 출처를 알려야 한다 | **주요** | `partner.collection_source_detail text`(admin_entry 시 필수) + 파트너용 처리방침에 "본인이 직접 등록하지 않은 정보의 수집 출처 안내 절차" 조항 |
| **PR-14** | **자유서술 필드에 제3자 개인정보가 들어온다** — 회사소개·레퍼런스 프로젝트(§3.2.2 C: "대표 레퍼런스 프로젝트, 클라이언트 산업 + 산출물")에 **클라이언트사 담당자명이 그대로 적힐 가능성**이 높다. 바이어용 처리방침은 이미 같은 경고를 하고 있다(`docs/legal/privacy-v1.0-en.md` §2) | **주요** | (1) 입력 폼에 "타인의 개인정보·비밀유지 대상 정보를 입력하지 마십시오" 경고 (2) 파트너 약관에 **파트너의 진술·보증 조항**(입력 정보에 제3자 개인정보가 포함되지 않음) (3) 검증 큐(A1-R5) 체크리스트에 항목 추가 |
| **PR-15** | **파트너 계정 자체의 접근 로그** — 파트너는 본인 정보만 보므로 "개인정보취급자 접속기록"(안전성 확보조치 기준 제8조) 대상은 아니다. 그러나 계정 탈취 탐지를 위한 최소 보안 이벤트 기록은 필요 | 권고 | §2.6의 `partner.login_success/failed/password_changed/consent_*` 액션으로 충분. **파트너 프로필 조회 자체를 매번 로깅하지 말 것**(감사로그 폭증 + 무의미) |
| **PR-16** | **유출 통지 프로세스** — 2026년 개정 개인정보보호법이 **유출 "가능성" 인지 시 72시간 내 통지**를 도입한 것으로 보도되고 있다(시행일·세부 기준은 시행령 확인 필요) | 권고 | P1 범위 밖이지만, 파트너 PII가 쌓이기 시작하면 통지 대상자 목록을 뽑을 수 있어야 한다 → `partner_account`/`partner_contact`에서 **연락 가능한 정보주체 목록을 1개 쿼리로 추출 가능**하도록 구조 유지. **변호사 검토 필요**(시행일·적용 기준) |

---

## 6. PR-3 판정 — 파트너용 약관/처리방침은 스키마 블로커인가

### 6.1 판정: **스키마 블로커가 아니다. "파트너 가입 오픈" 블로커다.**

- 문서 **본문**이 없어도 테이블은 설계할 수 있습니다. 기존 코드베이스가 이미 **"문서 버전 문자열 ↔ 파일" 바인딩**(F-7) 구조를 갖고 있어서, 스키마는 `document_version text`만 있으면 되고 그 값이 무엇이 될지는 나중에 정해도 됩니다.
- 반대로 **실제 파트너 1명이라도 가입 화면을 보는 순간**부터는 문서가 없으면 법 제30조(처리방침 수립·공개) 위반 상태입니다. 로컬 개발/시딩 데이터로 테스트하는 동안은 문제되지 않습니다.

**따라서: 스키마 설계와 문서 작성은 병행 가능. 단 아래 §6.2는 스키마보다 먼저 확정.**

### 6.2 [선결] 스키마에 미리 반영해야 하는 것 — 동의 항목의 필수/선택 분리

법 제22조상 **선택 동의 항목을 필수 동의와 묶어 받으면 위법**이고, 선택 동의를 거부해도 서비스 이용이 가능해야 합니다. 이 분류는 `partner_consent.consent_type`의 값 집합을 결정하므로 스키마 선행 사항입니다.

| 동의 항목 | 구분 | 근거 |
|---|:---:|---|
| 파트너 이용약관 | **필수** | 계약 성립 |
| 개인정보 수집·이용 (담당자 성명·직함·이메일·전화, 사업자정보) | **필수** | 서비스 제공에 필수 |
| **SEEPN 공개 노출**(SS-9) | **선택** | 공개 노출 없이도 운영자 매칭은 가능하므로 분리 가능. **기본 OFF** |
| **제3자 제공**(매칭 시 바이어에게 담당자 정보 제공) | **선택 + 시점 분리** | **가입 시점에 받지 말 것.** 바이어 측에서 이미 확정된 원칙(F-8)을 그대로 승계 — 실제 매칭이 발생할 때 건별로 받는다. 컬럼/consent_type만 미리 만들어 둔다 |
| 마케팅·뉴스레터 | **선택** | 기본 OFF |
| 만 14세 미만 확인 | **불필요** | B2B 사업자 대상. 단 약관에 "만 14세 미만 가입 불가" 명시 권고 |

**스키마 반영 사항 정리 (backend-developer 체크리스트)**
```
partner_consent.consent_type   ← 위 5종 (third_party_share 포함, v1.0 미사용)
partner_consent.document_version ← lib/legal/partnerConsentVersions.ts 와 1:1 바인딩
partner_consent.consent_locale  ← 'ko' 기본 (파트너 문서는 ko 필수)
필수 동의 미존재 시 partner_account.status='active' 로 전이 불가 (RPC 가드)
선택 동의 미체크가 가입/프로필 저장을 막지 않을 것 (법 제22조)
```

### 6.3 파트너용 문서에 반드시 들어가야 할 항목 (초안 작성 시 체크리스트)

바이어용(`docs/legal/privacy-v1.0-*.md`)과 **대상·목적·보관기간이 전부 다르므로 재사용 불가**입니다. 신규 작성 시:

- 수집 항목: 회원(이메일·비밀번호) / 담당자(성명·직함·이메일·전화) / 사업자(상호·사업자등록번호·대표자명·소재지) / 증빙파일 / 접속기록·IP
- 처리 목적: 회원관리, 파트너 검증, 바이어 매칭, 공개 노출(선택 동의 시), 문의 응대
- 보관기간: **§4 PR-5 표를 그대로** (문서와 실제 배치 동작이 어긋나면 그 자체가 위반)
- 제3자 제공: "실제 매칭 시 건별 동의 후 제공" 명시 + 제공 항목·목적·보유기간
- 처리 위탁: Supabase(DB/Auth/Storage, 서울 리전), AWS(호스팅), Google(Analytics) — 바이어 문서 §5 표 재사용 가능
- 정보주체 권리: 열람·정정·삭제·처리정지·동의철회 + **공개 노출 즉시 중단(SS-9 토글) 안내**
- **본인이 직접 등록하지 않은 경우의 수집 출처 안내 절차** (PR-13, 법 제20조)
- 파기 절차·방법, 안전성 확보조치, 개인정보 보호책임자, 권익침해 구제 경로
- 문서 버전·시행일 (기존 명명 규칙 `partner-privacy-v1.0-2026-XX` 승계)

> **변호사 검토 필요**: 파트너 약관의 책임 제한, 파트너가 입력한 정보의 정확성 책임, 공개 노출된 정보의 이용 범위(바이어의 재사용 제한), 계약 해지·자격 정지 조항.

---

## 7. 스키마 설계를 지금 시작해도 되는가

### 7.1 판정: **시작해도 된다.**

본 문서 §2.2(Auth 분리), §3.2~§3.3(동의/공개 게이트), §4 PR-1(PII 분리), §4 PR-5(보관기간)까지 확정되었으므로 테이블 형태를 좌우하는 결정은 대부분 답이 나왔습니다.

### 7.2 [선결] 첫 줄을 쓰기 전에 답이 필요한 질문 3건

| ID | 질문 | 누가 답하나 | 왜 선행인가 |
|----|------|---|---|
| **Q-1** | **파트너 콘솔의 호스트를 `seepn.me`로 분리하는가?** | 대표 / ceo-advisor | 같은 호스트면 세션 쿠키 충돌 처리(§2.7)가 추가되고, 파트너용 Next.js 앱의 배치(모노레포 전환 시점 P8과 충돌)가 달라진다. **아키텍처 결정이지 스키마 결정은 아니지만, 파트너 인증 라우트 설계가 여기 종속** |
| **Q-2** | **사업자등록증 원본을 "검증 후 90일 내 삭제"로 확정하는가, 장기 보관하는가?** | 대표 / PM | 삭제면 `partner_document.purge_after` + 배치 1개로 끝. 장기 보관이면 암호화·접근통제·처리방침 문구가 전부 달라진다. **privacy-security-officer 권고는 삭제** |
| **Q-3** | **`partner_consent` 보관기간(탈퇴 후 3년 권고)을 확정하는가?** | 대표 + **변호사** | 동의 증빙의 보관 근거와 기간. 이 값이 파기 배치와 처리방침 문구를 동시에 결정 |

> Q-1은 스키마와 무관하므로 **backend-developer는 Q-2/Q-3 답을 기다리지 말고 착수해도 됩니다** — 둘 다 "컬럼 1개 + 배치 함수 1개"의 값 문제이지 테이블 구조 문제가 아닙니다. 다만 **컬럼 자리는 지금 만들어 두십시오.**

### 7.3 ceo-advisor 에스컬레이션 (법적/평판 리스크)

1. **`admin_entry` 예외 경로는 "예외"로 유지되어야 실효가 있습니다.** 오프라인 인력의 편의를 이유로 이 경로가 주 경로가 되는 순간, D-6이 "회피"로 해결했다고 선언한 리스크가 그대로 돌아옵니다. **A1-R12(intake_source 비율 모니터링)를 Should가 아니라 Must로 올리고, `admin_entry` 비율 임계치(권고 20%)를 넘으면 대표에게 알림**을 권고합니다.
2. **개인사업자 파트너의 공개 노출**은 사실상 개인정보의 인터넷 공개입니다(상호=성명인 경우 많음). PR-10의 구분 필드가 없으면 이 리스크를 인지조차 못 합니다.
3. 2026년 개정 개인정보보호법이 **대표자를 최종 책임자로 명시**하고 과징금을 강화하는 방향으로 통과된 것으로 보도되고 있습니다(시행일·시행령 확인 필요). 파트너 PII가 30~50곳 규모로 쌓이기 시작하는 P1 시점이 **CPO 지정·내부관리계획 문서화**를 시작할 적기입니다. **변호사 검토 필요.**

---

## 8. P1 DoD 추가 게이트 (기존 §4.4에 병합 요청)

기존 P1 DoD는 PR-1~PR-6만 게이트로 잡고 있습니다. 아래를 추가하십시오.

- [ ] `auth_principal` 상호배타 제약이 동작함을 테스트로 증명 — 같은 `auth_user_id`로 `admin_user`와 `partner_account`를 동시에 만들려 하면 **FK 위반으로 실패**
- [ ] **파트너 세션**으로 `requests` / `admin_user` / `audit_log` / `role` / `menu` / `admin_access_request` 접근 시 전부 0행 또는 권한오류 (§2.4)
- [ ] 관리자 세션으로 `partner_account` / `private.partner_contact` 직접 SELECT 시 원문 PII가 나오지 않음(마스킹 또는 차단), 원문은 `get_partner_contact()`로만
- [ ] `get_partner_contact()` 호출이 `audit_log`에 남고, **감사기록 실패 시 원문이 반환되지 않음**을 증명
- [ ] 파트너 행위가 `audit_log`에 `actor_kind='partner'` + `actor_partner_account_id`로 기록됨 (§2.6)
- [ ] `public_listing` 동의 행이 없는 파트너는 `partner_public` 뷰에 **나타나지 않음** — `public_listing_state`를 직접 `'on'`으로 UPDATE 시도해도 (a) GRANT가 없어 실패하고 (b) 설령 서비스롤로 강제 세팅해도 뷰에 안 나옴 (§3.3)
- [ ] `admin_entry` 생성 시 동의 근거 필수 필드 누락하면 저장 실패 (§3.4)
- [ ] `consent_deadline_at` 경과 미동의 레코드가 배치로 파기됨 (§3.5)
- [ ] Storage: anon으로 `partner-doc` 객체 접근 불가 / 다른 파트너의 경로 접근 불가 / SVG 업로드 거부 / 서명 URL TTL ≤ 300초
- [ ] 로그인한 파트너에게 블로그·FAQ 공개 콘텐츠가 정상 노출됨 (§2.4-(5) 수정 확인)
- [ ] Supabase Auth "Allow new users to sign up" **여전히 OFF**임을 배포 전 재확인
- [ ] `SUPABASE_SERVICE_ROLE_KEY`가 Amplify Secrets로 관리되고 클라이언트 번들·빌드 로그에 노출되지 않음
- [ ] 파트너용 약관/처리방침 문서 게시 + `partnerConsentVersions.ts` 바인딩 (가입 오픈 전)

---

## 9. PRD 문서 결함 (product-manager 수정 요청)

| # | 위치 | 문제 |
|---|------|------|
| 1 | §4.1 P6 "Partner 자가등록 계정 시스템 (풀버전) — MVP ✖", §4.2 "MVP에서 명시적으로 빼는 것: 파트너 계정(P6)", §5 "Partner 풀 자가등록 계정 시스템 — Won't", §8 요약표 "v1.0 제외: 풀 계정 시스템" | **전부 D-4/§3.2.1과 정면 충돌.** backend-developer가 §4~§8만 읽으면 파트너 계정을 안 만든다 |
| 2 | §4.4 P1 DoD | 사전검토 게이트가 "PR-1~PR-6"으로 되어 있어 **PR-7/PR-8/PR-9가 빠져 있다**. §8로 교체 요청 |
| 3 | §4.1 P3 "경량 파트너 등록 신청 폼" | §3.2.1에서 **폐기**됐는데 로드맵에 남아 있음. SP-6(경량 신청폼 3단계 구성)도 함께 삭제 대상 |
| 4 | §3.2.2 증빙 "사업자등록증 파일 — 필수(대행입력 시 선택)" | **거꾸로다.** 사칭 리스크가 가장 큰 `admin_entry`에서 증빙을 면제하고 있다. → "입력 시점에는 선택 가능하되 **공개 노출 및 verified 전이의 필수 조건**"으로 수정 (§3.3 2층 조건 (d)) |
| 5 | §4.3 "P5를 P4 뒤로 — PC-6/OQ-4 법적 리스크가 선결되어야" | 본 문서로 선결 조건이 정리됨. P5 착수 시 §3.3의 3층 구조가 구현 요구사항임을 명시 |

---

## 10. 참고

**코드/문서**
- `supabase/migrations/20260824120000_phase1_requests_pipeline.sql` (private 스키마 분리, 동의 컬럼, 리텐션)
- `supabase/migrations/20260825120000_phase3_admin_rbac.sql` (RBAC, audit_log, contact reveal, MFA/AAL2)
- `supabase/migrations/20260825130000_phase3_admin_access_request.sql` (service_role 초대 경로)
- `supabase/migrations/20260827100000_phase5_content_management_schema.sql` (§2.4-(5) 공개 정책)
- `docs/01-plan/features/fkp-v0.2-privacy-review-phase3-rbac.md` (§1.2 definer 원칙, §3 감사로그, §5 내보내기, §6 Auth 설정, §8.4 OQ-16)
- `docs/legal/privacy-v1.0-{en,ja}.md`, `docs/legal/terms-v1.0-{en,ja}.md`, `lib/legal/consentVersions.ts`

**법령 (조문 번호는 확인용이며 최신 개정 반영 여부는 별도 확인 필요)**
- 개인정보 보호법 제15조(수집·이용), 제16조(최소수집·입증책임), 제20조(정보주체 이외로부터 수집한 개인정보의 수집 출처 등 고지), 제21조(파기), 제22조(동의를 받는 방법), 제24조의2(주민등록번호 처리 제한), 제29조(안전조치의무), 제30조(개인정보 처리방침)
- [개인정보의 안전성 확보조치 기준 (국가법령정보센터)](https://www.law.go.kr/admRulLsInfoP.do?chrClsCd=010202&admRulSeq=2100000229672) — 제5조(접근권한), 제6조(접근통제), 제7조(암호화), 제8조(접속기록 보관·점검)
- [개정 안전성 확보조치 기준 2025.10.31 시행 (Kim & Chang)](https://www.kimchang.com/ko/insights/detail.kc?sch_section=4&idx=33291) — 접속기록 보관 대상 확대, 접근권한 차등부여
- [접속기록 보관기간(1년/2년) 및 2026.10.30 월1회 점검의무 삭제](https://intothesec.com/149)
- [2026. 2. 12. 국회 통과 개인정보보호법 개정안 주요 내용 (법률신문)](https://www.lawtimes.co.kr/news/articleView.html?idxno=217245) — 대표자 최종책임 명시, CPO 이사회 의결, 유출 가능성 72시간 통지, ISMS-P 의무화(2027.7.1), 과징금 강화. **시행일·시행령 확인 및 변호사 검토 필요**
- [개인정보 처리방침 작성지침 개정 2026.4.24 (법률신문)](https://www.lawtimes.co.kr/news/articleView.html?idxno=220711) — 수탁자 조건부 유형화, 변경사항 안내 방식 이원화, 생성형 AI 부록
- [개인사업자 사업자등록번호의 개인정보 해당성](https://www.lawmeca.com/17108-%EC%82%AC%EC%97%85%EC%9E%90-%EB%93%B1%EB%A1%9D%EB%B2%88%ED%98%B8%EB%8F%84-%EA%B0%9C%EC%9D%B8%EC%A0%95%EB%B3%B4%EC%9D%B8%EC%A7%80%EC%9D%98%EC%97%AC%EB%B6%80/) — 법인은 비해당, 개인사업자는 해당 가능 (PR-10 근거)
- [탈퇴 회원 개인정보 파기 및 분리보관 (표준 개인정보 보호지침)](https://www.law.go.kr/LSW/admRulLsInfoP.do?chrClsCd=&admRulSeq=2100000192028)

---

## Version History

| Version | Date | Changes | Author |
|---|---|---|---|
| 1.0 | 2026-08-29 | 최초 작성 — PR-1~PR-9/PC-6/PC-7 검증, PR-7/PR-8을 `auth_principal` 상호배타 스키마 지침으로 확정, admin_entry 동의 증빙 구조(`partner_consent`) 설계, 공개노출 3층 게이트, PR-10~PR-16 신규 요건, PR-3 게이트 재분류, P1 DoD 추가 게이트, PRD 결함 5건 | privacy-security-officer |
