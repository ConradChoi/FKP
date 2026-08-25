# FKP v0.2 — Phase 3(Admin 콘솔) RBAC / 감사 / 접근통제 사전 검토

작성: privacy-security-officer · 2026-08-25
대상: `docs/01-plan/features/fkp-v0.2-platform-foundation.prd.md` §4.3 Epic 3, §4.3.1 권한관리 데이터 모델 초안(INV-1~8), §6 Phase 3(3-A~3-F), §8 OQ-15 / OQ-16
선행 문서: [`fkp-v0.2-privacy-review-oq4-tv4.md`](./fkp-v0.2-privacy-review-oq4-tv4.md) (Phase 1 게이트), `supabase/migrations/20260824120000_phase1_requests_pipeline.sql`
수신: backend-developer(3-B 스키마 설계 전 필독) · frontend-developer · qa-reviewer · project-manager

> **면책**: 본 문서는 실무 검토이며 법률 자문이 아닙니다. "변호사 검토 필요"로 표시한 항목은 배포 전 법률 검토를 권합니다. 그 외는 코드/설정/공개 법령에서 확인 가능한 사실관계에 기반합니다.

> **결정 위임 사항 2건은 본 문서에서 확정합니다.**
> - **OQ-15(최고관리자 2FA)** → **§6.5. 전 운영자 계정 TOTP MFA 필수. Phase 3-A에 포함.**
> - **OQ-16(viewer 연락처 마스킹)** → **§8.4. viewer는 연락처 원문 접근 불가(영구 마스킹, 해제 기능 없음).**

---

## 0. 요약 — Phase 3 착수(3-B 스키마 설계) 전 반드시 반영할 것

| # | 항목 | 심각도 | 게이트 |
|---|------|:------:|:---:|
| A | **Supabase `postgres` 역할은 BYPASSRLS를 가진다.** `security definer` 함수로 데이터를 반환하면 RLS는 평가되지 않는다 → 지금 설계대로 가면 INV-8의 "이중 방어"가 **1중 방어로 붕괴**한다. §1.2/§7의 역할 분리 원칙 적용 필수 | **치명적** | 스키마 설계 전 |
| B | `audit_log`는 **append-only**. `update`/`delete`를 RLS 정책 + GRANT 회수 + BEFORE 트리거 **3중**으로 차단(§3.5). GRANT 회수는 `service_role` 키가 유출돼도 유효한 유일한 방어선 | **치명적** | 3-F 전, 스키마에 반영 |
| C | **연락처 열람은 감사 로그와 물리적으로 결속**한다. 조회 함수 밖에서 `contact` 원문을 읽을 수 없게 GRANT를 구성(§7.3). "조회 API에 로그를 붙인다"는 방식은 누락이 발생한다 | **치명적** | 3-B 스키마 |
| D | INV-6은 **트리거 + advisory lock**으로 구현. CHECK 제약·앱 레벨 체크는 불충분(§4) | **주요** | 3-B |
| E | 전 운영자 계정 **TOTP MFA 필수**(OQ-15 결정). 근거: 안전성 확보조치 기준 제6조 외부접속 안전한 인증수단. RLS 정책에 `aal2` 조건 포함(§6.5) | **주요** | 3-A |
| F | viewer는 **연락처 원문 접근 불가**(OQ-16 결정). DB 레벨 강제(§8.4) | **주요** | 3-B |
| G | 내보내기: **사유 입력 필수 + 건수 상한 + 워터마크 + CSV 인젝션 방어**(§5). 사유 확인은 안전성 확보조치 기준 제8조②의 명문 요구 | **주요** | 3-C/3-E |
| H | `app/robots.ts`가 현재 `allow: '/'` 전면 허용 — **E3-R10 미충족**. `/admin` disallow 추가 필요 | **주요** | 3-A |
| I | 세션: JWT 30분 + 비활성 타임아웃 30분 + 세션 time-box 8시간. **비활성 자동 차단은 법적 요구사항**(제6조⑤)(§6.2) | **주요** | 3-A |
| J | 운영자 계정은 **삭제하지 않는다**. 상태 전이(withdrawn) + 감사로그 보관기간 만료 시 익명화(§2.4) | **주요** | 3-B |
| K | 초대는 Supabase `inviteUserByEmail`을 **그대로 쓰지 않고** 서버 라우트가 감싼다(원자성·고지·감사)(§6.4). 이 경로가 `service_role` 키의 첫 도입 지점 → Amplify Secrets 필수 | **주요** | 3-A/3-E |
| L | 최고관리자 부트스트랩 계정에 **대표 개인 Gmail을 쓰지 말 것**. 조직 도메인 메일박스 권고(§2.6) | 권고 | 부트스트랩 전 |

---

## 1. 설계 전제 — 먼저 바로잡아야 할 기술적 사실

### 1.1 Phase 1이 남긴 상태

`supabase/migrations/20260824120000_phase1_requests_pipeline.sql` 기준:

- `public.requests`, `public.failed_submissions`, `public.retention_jobs`, `private.request_meta` — 전부 `enable` + `force row level security`
- anon/authenticated에 대해 위 4개 테이블 **GRANT 전면 회수** + `alter default privileges`로 신규 테이블에도 기본 차단
- 현재 RLS 정책은 **전 명령 deny-all 플레이스홀더**. Phase 3가 교체 대상
- `requests.assignee_id uuid`는 FK 없이 선언되어 있음 → Phase 3에서 `admin_user(id)` FK 추가 예정(마이그레이션 헤더에 명시됨)
- `private.request_meta.internal_note` 컬럼이 이미 준비되어 있음 → **E3-R2의 내부 메모는 `public.requests`가 아니라 여기에 쓴다**. backend-developer가 놓치기 쉬움

### 1.2 [치명적] `security definer` 함수는 RLS를 우회한다

Phase 1 마이그레이션 §9의 주석은 "SECURITY DEFINER 함수가 FORCE RLS에도 불구하고 동작한다"고 적고 있고, **이는 사실입니다** — Supabase의 `postgres` 역할은 `BYPASSRLS` 속성을 가지며, `BYPASSRLS`는 `FORCE ROW LEVEL SECURITY`보다 우선합니다. Phase 1의 insert-only RPC 설계에는 문제가 없습니다.

**문제는 Phase 3입니다.** Admin 조회/수정을 같은 패턴(= `postgres` 소유 `security definer` RPC가 데이터를 반환)으로 만들면:

- RLS 정책은 **평가조차 되지 않습니다.**
- 실제로 작동하는 방어는 함수 본문의 `if not has_permission then raise` 한 줄뿐입니다.
- 즉 INV-8이 요구하는 "RLS + 애플리케이션 이중 방어"가 **함수 본문 단일 방어**가 됩니다. 그 한 줄에 버그가 있으면 전량 노출입니다.

**따라서 Phase 3의 대원칙:**

| 용도 | 실행 역할 | 이유 |
|------|-----------|------|
| **권한 *판정*** (`has_menu_permission`, `is_active_admin`, `is_super_admin`) | `security definer` (private 스키마) | 권한 테이블에 authenticated GRANT를 주지 않고도 판정 가능 + RLS 순환참조(R-6) 회피. **행 데이터를 반환하지 않으므로 우회 이슈 없음** |
| **감사 로그 기록** (`log_audit`) | `security definer` | append-only 강제. authenticated에 INSERT GRANT를 주지 않기 위함 |
| **연락처 원문 반환** (`get_request_contact`) | `security definer` | 감사 기록과 원자적으로 결속(§7.3). **단일 행·단일 컬럼만 반환**하도록 범위를 극단적으로 좁힌다 |
| **리드 목록/상세 조회, 상태·담당자 수정** | **`authenticated` 직접 접근 (RLS 평가됨)** | 여기서만 RLS가 실제 2차 방어로 동작한다 |
| 운영자 초대, 세션 강제 무효화, 파기 배치 | `service_role` 또는 `postgres` (서버 전용) | 브라우저·클라이언트에 절대 노출 금지 |

> **BYPASSRLS는 GRANT를 우회하지 않습니다.** 이 사실이 §3.5(감사로그 조작 방지)의 핵심 근거입니다. `service_role` 키가 유출되어도 `revoke update, delete on audit_log from service_role`은 여전히 유효합니다. RLS만으로는 막을 수 없습니다.

### 1.3 Admin 프론트의 DB 접근 경로

E1-R1("브라우저에서 Supabase에 직접 쓰지 않는다")을 **Phase 3에서도 유지**할 것을 권고합니다.

- Admin 화면 → Next.js 서버(RSC / Route Handler) → 사용자 access token으로 만든 Supabase 클라이언트(`authenticated`) → DB
- 브라우저에 Supabase URL/키를 노출하지 않음 → PostgREST를 직접 두드릴 수 있는 주체가 존재하지 않음
- 마스킹·직렬화·건수 제한을 **서버 단일 지점**에서 수행 가능
- 그럼에도 RLS는 유지 — 서버 코드 버그가 있어도 권한 없는 계정에는 0행이 반환되는 것이 INV-8의 실체

---

## 2. `admin_user` — 운영자 개인정보 취급 방침 (요청 1)

### 2.1 판단: 운영자 계정도 개인정보이며, 리드와 **법적 지위가 다릅니다**

| 구분 | 리드(정보주체) | 운영자 |
|------|---|---|
| 처리 근거 | 동의(§15①1) | 계약 이행 / 법령상 의무(§15①2·4) — 동의 불요 |
| 삭제 요구 | 원칙적으로 응해야 함 | **접속기록 보관 의무(제8조)와 충돌** → 즉시 삭제 불가 |
| 보관기간 | 12/24개월/30일 | **감사로그 보관기간과 동기화**(§2.4) |

운영자에게 "동의를 받는" 설계는 하지 마세요. 대신 **고지**가 필요합니다(§2.5).

### 2.2 `admin_user` 권고 컬럼

| 컬럼 | 비고 |
|------|------|
| `id uuid pk` | 내부 식별자. `requests.assignee_id`, `audit_log.actor_user_id`가 참조 |
| `auth_user_id uuid unique not null` | `auth.users(id)` FK, **`on delete restrict`**. Supabase 콘솔에서 실수로 Auth 사용자를 지워도 감사 추적이 끊기지 않게 |
| `display_name text not null` | 길이 상한 CHECK |
| `status text not null` | `invited` / `active` / `suspended` / `withdrawn`. CHECK 제약 |
| `invited_by uuid`, `invited_at timestamptz` | 초대 추적 |
| `activated_at`, `suspended_at`, `suspended_by`, `withdrawn_at`, `status_reason text` | 상태 전이 이력. 상세 이력은 `audit_log`가 SSOT이고 여기는 최신값 스냅샷 |
| `last_login_at timestamptz` | PRD 초안 유지 |
| `anonymized_at timestamptz` | §2.4 파기 이행 표시 |
| `created_at`, `updated_at` | |

**수집하지 말 것 (최소수집):**
- **이메일을 `admin_user`에 복제하지 마세요.** 이메일은 `auth.users`가 SSOT입니다. 복제하면 파기·정정 대상이 2곳이 되고 반드시 어긋납니다. 화면 표시용으로는 `security definer` 조회 함수로 `auth.users`에서 읽으세요. (`auth` 스키마는 PostgREST에 노출되지 않습니다.)
  - **유일한 예외**: `audit_log.actor_email_snapshot`(§3.3). 감사기록은 계정이 사라져도 "누가 했는지"를 보존해야 하므로 의도적 복제입니다.
- **전화번호·부서·직급·사번·생년월일 — 넣지 마세요.** 운영자 3명 규모에서 이 기능에 필요하지 않습니다. 카카오 알림톡 수신(OQ-14)이 실제로 구현될 때 별도 테이블 + 별도 고지로 추가하세요.
- **프로필 사진 — 넣지 마세요.**

### 2.3 `admin_user` RLS / GRANT 정책

| 명령 | GRANT (authenticated) | RLS 정책 방향 |
|------|---|---|
| SELECT | 허용 | `본인 행` **OR** `has_menu_permission('operator_management','read')`. 본인 행 조회는 권한과 무관하게 항상 허용(프로필/헤더 표시) |
| UPDATE | **컬럼 단위로 `display_name`만** | `본인 행` **OR** `has_menu_permission('operator_management','update')`. `using` + `with check` 양쪽 명시 |
| `status` / `auth_user_id` 변경 | **GRANT 없음** | 오직 `security definer` 함수(`admin_suspend_user` 등) 경유. 이 함수가 INV-6 검증 + 감사 기록 + 세션 무효화를 원자적으로 수행 |
| INSERT | **GRANT 없음** | 초대 함수 경유만(§6.4) |
| DELETE | **GRANT 없음, 정책도 만들지 않음** | §2.4 |

추가 정책 조건(전 정책 공통): `private.is_active_admin()` **AND** `private.is_aal2()`.
→ `suspended` 처리 즉시 access token 만료(최대 30분)를 기다리지 않고 **DB 레벨에서 차단**됩니다. INV-7("권한 회수가 지연 없이 반영")의 실질적 해법입니다.

### 2.4 탈퇴 / 비활성화 처리 방침 — **삭제하지 않는다**

**원칙: `admin_user` 행도 `auth.users` 행도 즉시 삭제하지 않습니다.** 이유는 접속기록 보관 의무(안전성 확보조치 기준 제8조①, 최소 1년)입니다. 계정을 지우면 그 기간 동안의 감사 로그에서 행위자를 특정할 수 없게 되어 **보관 의무를 형해화**합니다.

**퇴사/탈퇴 시 즉시(같은 트랜잭션 + 즉시 후속 조치):**

1. `status = 'withdrawn'`, `withdrawn_at`, `status_reason` 기록
2. `admin_user_role` 매핑 **전건 삭제** (감사 로그에 revoke 이벤트 기록)
3. `requests.assignee_id`가 이 사용자인 건 → 담당자 해제 또는 재배정(운영 결정). **FK를 `on delete restrict`로 두면 이 문제가 자동으로 드러납니다**
4. Supabase Auth 세션 전역 무효화(`auth.admin.signOut(userId, 'global')`) + 리프레시 토큰 폐기
5. 비밀번호 재설정 토큰·초대 토큰 무효화
6. INV-6 검증 통과 확인(마지막 super_admin이면 차단)

**보관기간 만료 시(= 감사로그 보관기간 2년 경과, §3.6과 동일 시점):**

7. `display_name` → `'퇴사운영자'` 등 고정 문자열로 치환, `anonymized_at` 기록
8. `auth.users` 행 삭제(또는 이메일을 `deleted+<uuid>@invalid`로 치환) — FK `restrict` 때문에 `admin_user` 행은 남으므로, `auth_user_id`를 nullable로 두고 이 시점에 NULL 처리하는 설계가 필요합니다. **backend-developer 설계 포인트**
9. `audit_log.actor_email_snapshot` / `actor_name_snapshot`도 동일 배치에서 마스킹 — 단, **감사 레코드 자체는 삭제하지 않습니다.** 보관기간이 만료된 감사 레코드는 §3.6 배치가 별도로 삭제합니다

**"본인이 스스로 탈퇴"는 기능으로 만들지 마세요.** 운영자 계정은 조직 자산입니다. 셀프 탈퇴는 INV-6 위반 경로를 하나 더 만들 뿐입니다. 본인이 할 수 있는 것은 표시명 변경과 비밀번호/MFA 재설정까지입니다.

### 2.5 운영자 개인정보 고지 (누락되기 쉬움)

초대 수락 화면에 **"운영자 개인정보 처리 안내"**를 표시하고 확인을 받으세요(동의가 아니라 고지 확인).
포함 항목: 처리 항목(이메일, 표시명, 접속기록·IP·User-Agent, 리드 처리 이력) / 목적(계정 관리, 접근통제, 법령상 접속기록 보관) / 보관기간(퇴사 후 2년) / 근거(계약 이행 및 법령상 의무) / 문의처.

또한 **`docs/legal/privacy-v1.0-*.md` §8 Security 문구를 Phase 3 배포 시 갱신**하세요. 현재 "access controls that restrict who can view your request data"라고만 되어 있습니다. Admin 도입 후에는 "권한 기반 접근통제 + 접근기록 보관"이 사실이 되므로, 처리방침 기재와 실제가 일치하도록 보강합니다(PIPA §30① 안전성 확보조치 항목).

### 2.6 부트스트랩 계정 관련 권고

대표가 Supabase 콘솔에서 최초 super_admin을 수동 생성하는 결정 자체는 적절합니다. 다만:

- **개인 Gmail(`@gmail.com`)을 쓰지 마세요.** Phase 1 리뷰에서 지적한 "운영자 개인 Google 계정 Sheets" 문제와 동일한 패턴입니다 — 승계 불가, 감사 불가, 계정 사고 시 통제 불가. `admin@findkoreanpartners.com` 등 **조직이 통제하는 메일박스**를 권고합니다. (변호사 검토 불요, 운영 결정)
- 부트스트랩 직후 **즉시 MFA 등록**하고 복구 코드를 오프라인 보관하세요. 활성 super_admin이 1명인 기간은 INV-6이 보호하지 못하는 유일한 리스크(= 그 1명의 MFA 기기 분실 = 완전 락아웃)입니다. **완화책: 부트스트랩 직후 두 번째 super_admin 계정을 만들어 두거나, "Supabase 콘솔 접근권을 가진 대표가 최후의 복구 경로"임을 운영 문서에 명시**하세요.
- `auth.users`에 부트스트랩 계정이 생겨도 `admin_user` 행이 없으면 Admin은 아무것도 못 합니다. **`admin_user` + super_admin 역할 매핑을 만드는 시드 마이그레이션**이 필요합니다(auth 사용자 이메일로 조회해 연결하는 방식). backend-developer 반영 항목.

---

## 3. `audit_log` 상세 설계 (E3-R8, 요청 2)

### 3.1 법적 근거와 목표 수준

| 근거 | 요구 내용 | 본 설계의 대응 |
|------|-----------|----------------|
| 안전성 확보조치 기준 **제2조** (접속기록 정의) | **계정, 접속일시, 접속지 정보, 처리한 정보주체 정보, 수행업무**를 전자적으로 기록 | §3.3 컬럼이 5개 항목에 1:1 대응 |
| **제8조①** | 접속기록 **1년 이상** 보관·관리 (5만명 이상 처리 또는 고유식별정보·민감정보 처리 시 2년 이상) | 우리는 1년 기준 대상이나 **2년 보관 권고**(§3.6) |
| **제8조②** | **월 1회 이상 점검**. 개인정보를 **다운로드한 것이 확인된 경우 그 사유를 확인** | §3.7 점검 프로세스 + §5 내보내기 사유 필수 입력 |
| **제8조③** | 접속기록이 **위·변조 및 도난·분실되지 않도록 안전하게 보관** | §3.5 3중 차단 + §3.8 외부 사본 |
| PIPA §29 / 시행령 §30 | 안전성 확보조치 의무 | 전반 |

> 우리 서비스는 5만명 미만이고 고유식별정보·민감정보를 처리하지 않으므로 **법정 최소는 1년**입니다. 그럼에도 2년을 권고하는 이유는 §3.6에 적었습니다.

### 3.2 반드시 기록해야 하는 행위 (액션 카탈로그)

`action` 컬럼은 `<domain>.<verb>` 문자열 + CHECK 제약을 권고합니다(enum 타입은 값 추가가 번거로움 — Phase 1과 동일 컨벤션).

**A. 인증 (3-A)**

| action | 필수 | 비고 |
|---|:---:|---|
| `auth.login_success` | O | 접속일시·접속지 정보의 기본 단위 |
| `auth.login_failed` | O | **실패도 기록.** 계정 잠금 판정 근거이자 침해 탐지의 핵심. 단 **비밀번호는 어떤 형태로도 기록 금지** |
| `auth.logout` | O | |
| `auth.session_expired` | 권고 | 자동 차단 동작 증빙 |
| `auth.mfa_enrolled` / `auth.mfa_reset` | O | MFA 재설정은 계정 탈취의 전형적 경로 |
| `auth.password_reset_requested` / `auth.password_changed` | O | |
| `auth.access_denied` | **O** | **권한 없는 접근 시도.** 누락하면 내부 오남용을 영원히 탐지할 수 없습니다. INV-3의 서버 재검증이 거부한 순간 기록 |

**B. 리드 개인정보 접근 (3-C) — PIPA "수행업무"의 본체**

| action | 필수 | 기록 시점 / 특이사항 |
|---|:---:|---|
| `lead.list` | **O** | 목록 조회. **행 단위가 아니라 조회 단위 1건.** `subject_ids`에 반환된 리드 id 배열, `query_filter`에 검색·필터 조건, `result_count`에 건수 |
| `lead.view` | **O** | 상세 조회 1건 |
| `lead.contact_reveal` | **O** | **연락처 원문 열람.** §7.3에 따라 조회 함수 내부에서 기록되므로 누락 불가 |
| `lead.update` | **O** | 변경 **컬럼명 목록**과 status/assignee 값만. **자유서술·연락처의 전후 원문은 기록 금지**(§3.4) |
| `lead.status_change` | O | `lead.update`와 분리하면 TTFR 지표 산출에도 재사용 가능 |
| `lead.assign` | O | |
| `lead.note_write` | **O** | `private.request_meta.internal_note`. 메모 **본문은 기록 금지**, 길이·변경사실만 |
| `lead.export` | **O** | §5. `export_reason` 필수 |
| `lead.export_denied` | O | 한도 초과·권한 부족 |

**C. 계정 / 권한 변경 (3-E)**

| action | 필수 |
|---|:---:|
| `admin_user.invite` / `invite_resend` / `invite_revoke` | O |
| `admin_user.activate` / `suspend` / `withdraw` | O |
| `admin_user.role_grant` / `role_revoke` | **O** |
| `admin_user.profile_update` | 권고 |
| `role.create` / `update` / `delete` | O |
| `menu.create` / `update` / `delete` | O |
| `role_menu_permission.change` | **O** — 변경 전/후 플래그 세트를 `before_summary`/`after_summary`에 |

**D. 감사 로그 자체 (3-F)**

| action | 필수 | 비고 |
|---|:---:|---|
| `audit.view` | **O** | **감사 로그를 누가 봤는지도 감사 대상.** 자기참조 재귀는 발생하지 않음(조회 1회 = 기록 1건) |
| `audit.export` | O | 감사 로그 내보내기는 §5와 동일 통제 적용 |
| `audit.review` | O | §3.7 월간 점검 이행 증빙 |

**E. 기록하지 않는 것 (의도적)**

- 대시보드 집계 조회(`dashboard.view`) — 개인정보 접근이 아니며, 로그 노이즈만 늘어 §3.7 점검을 무력화합니다. 단 **대시보드가 개별 리드 링크·연락처를 노출한다면 기록 대상으로 승격**.
- 메뉴 트리 조회(`my_menu_tree`) — 매 요청 발생, 개인정보 무관.
- 정적 자원·헬스체크.

### 3.3 `audit_log` 권고 컬럼

| 컬럼 | 대응 법령 항목 | 비고 |
|------|---|---|
| `id bigint generated always as identity` | — | **단조 증가 필수.** UUID를 쓰면 삭제로 인한 결번을 탐지할 수 없습니다 |
| `occurred_at timestamptz not null default now()` | **접속일시** | |
| `actor_user_id uuid` | **계정** | `admin_user(id)` FK, `on delete restrict`. 시스템/배치는 NULL |
| `actor_auth_uid uuid` | 계정 | `auth.uid()` 스냅샷 |
| `actor_email_snapshot text` | 계정 | 의도적 비정규화(§2.2). 보관기간 만료 시 마스킹 |
| `actor_name_snapshot text` | 계정 | 동일 |
| `actor_role_codes text[]` | — | **행위 시점의 역할 스냅샷.** 사후에 역할이 바뀌어도 "그때 무슨 권한으로 했나"가 남아야 함 |
| `actor_kind text` | — | `admin` / `system` / `anon`. 배치·RPC 구분 |
| `action text not null` | **수행업무** | §3.2 카탈로그 + CHECK |
| `target_table text`, `target_id text` | 수행업무 | |
| `subject_ids uuid[]` | **처리한 정보주체 정보** | 리드 id 배열. 상한(예: 200) 초과 시 NULL + `query_filter`/`result_count`로 대체 |
| `result_count integer` | 처리한 정보주체 정보 | |
| `query_filter jsonb` | 처리한 정보주체 정보 | 검색어·필터·정렬·페이지. **검색어에 이메일이 들어갈 수 있음** → §3.4 |
| `before_summary jsonb`, `after_summary jsonb` | 수행업무 | **마스킹된 요약.** §3.4 |
| `result text not null` | — | `success` / `denied` / `error` |
| `error_code text` | — | |
| `ip inet` | **접속지 정보** | **마스킹하지 않고 전체 저장.** §3.4 참고 |
| `user_agent text` | 접속지 정보 | 길이 상한 |
| `request_id text`, `session_id text` | — | 상관관계 추적. 서버 로그와 조인 |
| `export_reason text` | — | §5. `lead.export` 시 필수(부분 CHECK) |

인덱스: `(occurred_at desc)`, `(actor_user_id, occurred_at desc)`, `(action, occurred_at desc)`, `subject_ids`에 GIN(특정 리드의 접근 이력 역추적 — 정보주체 열람청구 대응에 실제로 필요합니다).

파티셔닝은 v1 불필요(월 20건 규모). 단 `occurred_at` 기준 range 파티셔닝으로 나중에 전환 가능하도록 인덱스/제약을 단순하게 유지하세요.

### 3.4 [중요] 감사 로그가 2차 개인정보 저장소가 되지 않게

가장 흔한 실패입니다. 리드를 12개월 후 익명화해도 감사 로그에 원문이 복사되어 있으면 **파기가 이행되지 않은 것**입니다.

| 항목 | 규칙 |
|------|------|
| `contact`(이메일) | **원문 저장 금지.** `lead.contact_reveal`도 "누가 어떤 리드의 연락처를 봤다"만 기록하고 값은 기록하지 않음 |
| `purpose` / `description` / `internal_note` | **원문·전후값 저장 금지.** 변경 사실 + 길이만 |
| `company_name_website` | 원문 저장 금지 |
| `before/after_summary` | **비개인정보 컬럼만**: `status`, `assignee_id`, `category`, `locale`, 권한 플래그, 역할 코드, 메뉴 코드 |
| `query_filter` | 검색어에 이메일·회사명이 들어올 수 있음 → **검색어는 해시 또는 마스킹 저장**(예: `q_hash`, `q_len`). "누가 무엇으로 검색했는지"의 감사 가치는 유지하면서 원문은 남기지 않음 |
| `ip` | **전체 저장.** Phase 1의 `consent_ip`를 `/24` 마스킹한 것과 상충하지 않습니다 — 그건 정보주체의 IP를 동의 입증 목적(선택적)으로 수집한 것이고, 이건 **개인정보취급자의 접속지 정보를 법령상 의무로 기록**하는 것이라 목적·근거·주체가 모두 다릅니다. 마스킹하면 오히려 제2조 요건 미충족 소지 |
| 비밀번호·토큰·JWT·키 | **어떤 형태로도 금지** |

### 3.5 조작 방지 — append-only를 3중으로 강제

| 층 | 조치 | 무엇을 막는가 |
|:--:|------|---------------|
| 1 | **GRANT**: `authenticated`/`anon`에 INSERT/UPDATE/DELETE 전면 미부여. `service_role`에 대해서도 **`revoke update, delete on public.audit_log from service_role`** | **`service_role` 키 유출.** BYPASSRLS는 RLS 정책을 우회하지만 **테이블 GRANT는 우회하지 못합니다.** 이 한 줄이 유일하게 유출 키를 막는 방어선입니다 |
| 2 | **RLS**: `enable` + `force`. `for select` 정책만 생성(`has_menu_permission('audit_log','read')`). **`for update` / `for delete` 정책은 아예 만들지 않음** → 정책 부재 = 전면 거부 | 정책 실수로 인한 노출 |
| 3 | **트리거**: `before update or delete on audit_log ... raise exception`. 단, 파기 배치만 예외 — `current_setting('fkp.audit_purge', true) = 'on'` 인 경우에만 통과. 이 GUC는 §3.6 파기 함수 내부에서만 `set local`로 설정 | **테이블 소유자(`postgres`)·BYPASSRLS 보유자.** 트리거는 BYPASSRLS로 우회되지 않습니다 → 이 층이 관리자 실수/내부자 조작까지 막는 유일한 층 |

부가 원칙:
- `updated_at` 컬럼을 **만들지 마세요.** 존재 자체가 "수정 가능"이라는 신호입니다.
- INSERT는 `private.log_audit(...)` **`security definer` 함수 전용**. authenticated에는 EXECUTE만 부여.
- `log_audit()`는 **절대 예외를 밖으로 던지지 않아야** 합니다(로깅 실패로 본 기능이 죽으면 안 됨). 단 **연락처 열람(`lead.contact_reveal`)과 내보내기(`lead.export`)만은 예외** — 로그 기록에 실패하면 **행위 자체를 실패시켜야** 합니다(감사 없는 개인정보 반출 금지). backend-developer가 반드시 구분해서 구현할 지점.
- (선택, 권고 수준) `prev_hash` / `row_hash` 해시 체인. 운영자 3명 규모에서 v1 필수는 아니나, 컬럼만 미리 확보해두면 나중에 무상 도입 가능.

### 3.6 감사 로그 보관기간 및 파기

| 대상 | 보관기간 | 근거 |
|------|---------|------|
| `audit_log` 전건 | **2년** (법정 최소 1년) | 제8조①. 2년을 권고하는 이유: ① 침해 인지가 통상 수개월 지연되며 1년치는 조사에 부족 ② 운영자 퇴사 후 분쟁 대응 ③ 5만명 요건에 근접해질 때 재설계 비용 회피. 반면 **3년 이상은 그 자체가 개인정보 과다보유**이므로 권고하지 않음 |
| `actor_email_snapshot` / `actor_name_snapshot` | 퇴사 후 2년 시점에 마스킹(레코드는 유지) | §2.4 |

**삭제 금지 규칙(명문화 필요):**
- 보관기간 내 삭제는 **어떤 사유로도 금지**. 정보주체의 삭제 요구가 있어도 감사 로그는 법령상 보관 의무 대상이므로 삭제하지 않습니다(리드 본체는 파기하되 로그의 `subject_ids`는 남습니다 — 이 시점에 해당 id는 이미 비식별 행을 가리키므로 문제되지 않습니다).
- 파기는 **`pg_cron` 배치(일 1회) + `security definer` 함수**로만. Phase 1의 `retention_jobs` 테이블을 재사용해 실행 증빙을 남기세요(`job_type`에 `audit_purge` 값 추가 필요 — CHECK 제약 변경).
- 리드가 하드 삭제(closed/spam, 30일)되면 `subject_ids`가 고아 참조가 됩니다. **이는 의도된 동작입니다** — 배열 컬럼이므로 FK가 없어 자연히 남습니다. "누가 언제 리드를 봤다"는 사실은 남고 그 리드의 개인정보는 사라집니다. 바람직한 상태입니다.

### 3.7 월 1회 점검 (제8조② — 기능이 아니라 프로세스)

이건 개발 산출물이 아니라 **운영 프로세스**이며, 없으면 법령 미충족입니다.

- Admin에 `감사로그` 메뉴(super_admin 전용) + 최소 필터: 기간 / 행위자 / 액션 / `result=denied` / `lead.export` / `lead.contact_reveal`
- **"이달의 점검" 뷰**: ① 거부된 접근 시도 ② 내보내기 전건과 사유 ③ 연락처 열람 상위 행위자 ④ 비업무시간 접속 — 4개만으로 충분합니다
- 점검 완료 시 `audit.review` 액션을 기록(점검자·점검기간·확인 소견). **점검했다는 증빙 자체가 필요합니다**
- 점검 주기·방법·사후조치 절차는 **내부관리계획 문서**에 기재해야 합니다(현재 프로젝트에 내부관리계획 문서가 없습니다 → §10 참고)

### 3.8 외부 사본 (제8조③, 권고)

Supabase 프로젝트 자체가 손상·삭제되면 감사 로그도 함께 사라집니다. 월 1회 감사 로그를 별도 스토리지(예: S3 + Object Lock/버전 관리)로 내보내는 절차를 권고합니다. v1 필수는 아니나, **Supabase 무료/단일 프로젝트 구성에서는 "안전하게 보관"의 실효성이 약하다**는 점을 인지하고 진행하세요.

---

## 4. INV-6 (Self-lockout 방지) 구현 방식 (E3-R9, 요청 3)

### 4.1 결론: **트리거 + advisory lock**. CHECK 제약과 앱 레벨 체크는 부적합

| 방식 | 판정 | 이유 |
|------|:---:|------|
| CHECK 제약 | **불가** | CHECK는 단일 행만 평가. "활성 super_admin이 전체에서 최소 1명"은 **집합 조건**이라 표현 불가 |
| UNIQUE / partial index | **불가** | "최소 1개 존재"는 인덱스로 강제할 수 없음(최대 1개는 가능) |
| 애플리케이션 레벨 체크만 | **불충분** | ① 경로가 여러 개(Admin UI, 직접 SQL, 배치, Supabase 콘솔)라 우회 가능 ② 동시성 미해결 ③ INV-8 위반(DB 방어 부재) |
| **트리거(권고)** | **채택** | BYPASSRLS·`service_role`·소유자 접근에서도 **트리거는 발동**합니다. DB가 최종 방어선이 되는 유일한 방법 |

### 4.2 권고 구현 (개념)

**보호 대상 3가지를 분리해서 다루세요.**

**(a) 활성 super_admin ≥ 1**

- **`constraint trigger` + `deferrable initially deferred`** 로 선언 → **트랜잭션 커밋 시점에 평가**됩니다. 이게 핵심입니다. "A의 역할을 빼고 B에게 준다"처럼 트랜잭션 중간에 일시적으로 0명이 되는 정상 작업을 막지 않으면서, 최종 상태만 검증합니다. 즉시 평가 트리거로 만들면 정당한 운영 작업이 막혀 결국 트리거를 끄게 됩니다.
- 부착 위치: `admin_user_role`의 INSERT/UPDATE/DELETE, `admin_user`의 UPDATE(`status`), `role`의 UPDATE/DELETE
- 본문 순서:
  1. `pg_advisory_xact_lock(<고정 정수 키>)` — **동시성 방어 필수.** 두 트랜잭션이 각각 다른 super_admin을 동시에 비활성화하면 둘 다 "아직 2명"으로 보고 통과해 0명이 됩니다. 이 락 없이는 트리거가 있어도 뚫립니다
  2. 활성 super_admin 수 집계 (`admin_user.status = 'active'` AND `admin_user_role` → `role.code = 'super_admin'`)
  3. 0이면 `raise exception ... errcode`(예: `P0001` + 식별 가능한 메시지 `last_super_admin_protected`) → 서버가 사용자 친화 메시지로 매핑

**(b) 시스템 역할 불변**

- `role`에 `is_system boolean not null default false`
- `before update or delete on role`: `old.is_system` 이면 DELETE 차단, `code` / `is_system` 변경 차단(`display_name`, `description` 수정은 허용)
- 초기 시드에서 `super_admin.is_system = true`

**(c) 본인 권한 자기박탈 금지 + super_admin 권한 매트릭스 우회 불가**

- **가장 중요한 단순화**: `private.has_menu_permission()`이 **첫 줄에서 `is_super_admin(auth.uid())`이면 무조건 true를 반환**하도록 설계하세요. super_admin은 `role_menu_permission` 매트릭스를 **참조하지 않습니다.**
  - 효과: 권한관리 화면에서 super_admin 행의 체크를 실수로/악의로 해제해도 **락아웃이 물리적으로 불가능**합니다. INV-6의 "본인의 권한관리 접근권을 스스로 제거할 수 없다"가 트리거 없이 구조적으로 보장됩니다.
  - INV-4(allow-list)와의 관계: super_admin은 **시스템 역할 예외**로 INV-4에 명시적 단서를 추가하세요(§9).
  - UI: 권한관리 매트릭스에서 super_admin 행은 **읽기 전용 + 전체 체크 표시**로 렌더링
- 추가 트리거: `admin_user_role`에서 **본인이 자신의 super_admin 역할을 제거하는 것** 차단 — `auth.uid()`가 NULL이 아니고 대상이 본인이며 대상 역할이 `is_system`이면 `raise`. (`auth.uid()`가 NULL인 배치·콘솔 컨텍스트에서는 이 체크를 건너뛰되, (a)의 카운트 검증은 그대로 적용)
- 마찬가지로 `admin_user.status`를 **본인이 `suspended`/`withdrawn`으로 바꾸는 것** 차단

### 4.3 테스트 요구 (qa-reviewer 공동, Phase 3 DoD)

1. super_admin 1명 상태에서 자기 역할 제거 → 차단
2. super_admin 1명 상태에서 자기 계정 비활성화 → 차단
3. super_admin 2명 상태에서 **동시에** 서로를 비활성화(별도 세션 2개) → 한쪽만 성공, 최소 1명 유지 (**advisory lock 검증. 이 테스트가 빠지면 (a)는 검증되지 않은 것입니다**)
4. `role` 테이블에서 `super_admin` 직접 DELETE 시도 → 차단
5. 권한 매트릭스에서 super_admin × 권한관리 메뉴 권한 해제 → **해제되더라도 접근이 유지됨**(§4.2-c 설계 확인)
6. `service_role` 키로 위 1~4 재시도 → **전부 동일하게 차단**(트리거가 BYPASSRLS를 무력화하는지 실증)

---

## 5. CSV/Excel 내보내기 통제 (E3-R11, OQ-13, 요청 4)

내보내기는 **개인정보가 우리 통제를 떠나는 유일한 지점**입니다. 되돌릴 수 없으므로 다른 기능과 다른 수준의 통제를 적용합니다.

### 5.1 권한 설계

| 통제 | 내용 |
|------|------|
| 플래그 | `role_menu_permission.export`를 사용. **`export`는 "개인정보 포함 반출"을 의미**한다고 정의 |
| 초기 배정 | **`super_admin`만 `export = true`.** `operator`/`viewer`는 false (PRD 초기 역할 세트와 일치) |
| 내보내기 범위 2종 | ① **통계용(비식별)** — `category`/`status`/`locale`/`budget`/`timeline`/월 단위 절삭 `created_at`. **`read` 권한만으로 허용**(개인정보 아님) ② **전체(개인정보 포함)** — `export` 필수 |
| 자유서술 컬럼 | `purpose`/`description`/`internal_note`는 **전체 내보내기에서도 기본 제외.** 포함하려면 별도 체크 + 사유에 필요성 명시. Phase 1 리뷰 §2.1에서 지적한 "통제 불가능한 개인정보 유입 경로"가 그대로 파일로 나갑니다 |
| 서버 강제 | INV-3에 따라 **내보내기 엔드포인트에서 권한 독립 재검증.** 메뉴에서 버튼을 숨기는 것은 통제가 아님 |
| MFA | `aal2` 필수(§6.5) |

### 5.2 필수 부가 통제

| # | 통제 | 근거 / 비고 |
|---|------|------|
| 1 | **사유 입력 필수** (10자 이상, 자유서술) | **안전성 확보조치 기준 제8조② "개인정보를 다운로드한 것이 확인된 경우 그 사유를 확인"의 직접 이행.** 사후에 확인하는 것보다 사전에 받는 편이 확실하고 비용이 낮습니다. `audit_log.export_reason`에 저장 |
| 2 | **건수 상한** | 1회 **1,000행**, 계정당 1일 **3회 / 3,000행**. 초과 시 차단 + `lead.export_denied` 기록. 월 20건 규모에서 이 한도는 정상 업무를 방해하지 않으면서 "전량 덤프"만 막습니다. 한도는 `role`이 아니라 **전역 상수**로 두고 super_admin도 예외 없음 |
| 3 | **감사 기록 결속** | `log_audit` 실패 시 **내보내기 자체를 실패**시킴(§3.5) |
| 4 | **워터마크** | 파일 첫 행(또는 별도 메타 시트)에 `export_id` / 내보낸 사람 / 시각 / 사유 / 대상 건수. **유출된 파일이 어디서 나갔는지 특정 가능**해집니다. 파일명에도 `export_id` 포함 |
| 5 | **파일 미보관** | 서버 응답으로 스트리밍만. Supabase Storage 버킷·디스크에 쓰지 않음. 부득이 사용 시 signed URL ≤ 5분 + 즉시 삭제 |
| 6 | **CSV 수식 인젝션 방어** | 셀 값이 `=`, `+`, `-`, `@`, 탭, CR로 시작하면 앞에 `'` 삽입. **자유서술 필드가 있으므로 실재하는 위험입니다**(공격자가 문의 내용에 `=HYPERLINK(...)`를 넣으면 운영자 PC에서 실행됨). qa-reviewer 검증 항목 |
| 7 | **내보내기 알림** | 내보내기 발생 시 대표(super_admin 전원)에게 인앱 알림. 운영자 3명 규모에서 가장 비용 대비 효과가 큰 탐지 통제 |
| 8 | **Excel 대신 CSV 우선** | xlsx 생성 라이브러리는 의존성·취약점 표면을 늘립니다. UTF-8 BOM + CSV로 충분(Excel에서 한글 정상 표시) |

### 5.3 처리방침 반영

내보내기 기능 자체는 내부 처리이므로 정보주체 고지 의무가 새로 생기지는 않습니다. 다만 처리방침의 안전성 확보조치 항목에 "개인정보 다운로드에 대한 사유 확인 및 기록"을 기재하면 §30① 이행이 명확해집니다.

---

## 6. Supabase Auth 세션 / 보안 설정 권고 (요청 5)

### 6.1 인가는 JWT 클레임에 넣지 말 것 (INV-7의 핵심)

Supabase의 access token 기본 만료는 1시간입니다. **권한을 JWT 커스텀 클레임에 담으면 권한 회수가 최대 만료시간만큼 지연**됩니다 — INV-7("권한 회수가 지연 없이 반영") 위반입니다.

권고:
- JWT는 **인증(누구인가) + `aal`만** 담는다
- 인가(무엇을 할 수 있는가)는 **매 요청 DB 조회**. 운영자 3명·월 20건 규모에서 성능 문제는 발생하지 않습니다
- 캐시가 필요해지면 **요청 스코프 메모이제이션까지만**(같은 요청 내 중복 호출 제거). 요청 간 캐시는 60초 이하, 권한 변경 시 무효화
- RLS 정책에 `private.is_active_admin()`을 포함 → **suspend 즉시 DB가 차단.** 토큰 만료를 기다리지 않습니다

### 6.2 세션 설정 권고 (Supabase Dashboard > Authentication > Sessions)

| 설정 | 권고값 | 근거 |
|------|--------|------|
| JWT expiry (access token) | **30분** | 기본 1시간에서 단축. User 화면은 Auth를 쓰지 않으므로 부작용 없음 |
| Refresh token rotation | **ON** | 탈취 토큰 재사용 탐지 |
| Reuse interval | 10초 (기본) | |
| **Inactivity timeout** | **30분** | **안전성 확보조치 기준 제6조 — "일정 시간 이상 업무처리를 하지 않는 경우 자동으로 접속 차단". 권고가 아니라 의무 이행 항목입니다** |
| Time-box user sessions (절대 만료) | **8시간** | 하루 업무 단위. 방치된 장기 세션 제거 |
| Single session per user | 검토 | 운영자 3명 규모에선 ON도 무리 없음. 다만 데스크톱/노트북 병행 사용 시 불편 → **v1은 OFF, 대신 §3.7 점검에서 다중 접속지 확인** |

프론트엔드는 비활성 타임아웃을 **서버 세션에만 의존하지 말고** 클라이언트에서도 유휴 감지 후 자동 로그아웃 + 화면 잠금을 구현하세요(어깨너머 노출 방지). 단 클라이언트 타이머는 편의일 뿐 통제는 서버 설정입니다(INV-3와 같은 사고방식).

### 6.3 비밀번호 정책 (Authentication > Policies)

| 항목 | 권고 |
|------|------|
| 최소 길이 | **12자** (Supabase 기본 6자 → 반드시 변경) |
| 문자 조합 | 영문 대소문자 + 숫자 + 특수문자 중 3종 이상. 다만 길이가 우선 — 16자 이상 패스프레이즈는 조합 요건을 완화해도 무방 |
| 유출 비밀번호 차단 | **HIBP(Leaked password protection) ON** — 플랜별 제공 여부 확인 필요. 미제공이면 초대 안내에 "타 서비스와 동일한 비밀번호 금지" 명시 |
| 주기적 강제 변경 | **도입하지 않음.** 최신 보안 가이드(NIST 등)와 상충하며 오히려 약한 비밀번호를 유발. 대신 유출 징후 시 강제 재설정 |
| 로그인 실패 잠금 | Supabase는 rate limit은 있으나 **계정 잠금은 제공하지 않음** → **앱/DB 레벨 구현 필요.** 5회 연속 실패 시 15분 잠금, `auth.login_failed` 기록. 잠금 상태는 `admin_user`가 아니라 별도 경량 테이블 권고(계정 상태와 혼동 방지) |
| 비밀번호 재설정 링크 만료 | 1시간 |

### 6.4 초대 흐름 — **Supabase invite를 그대로 쓰지 말고 감쌀 것**

**판단: Supabase Auth의 `inviteUserByEmail`을 기반으로 쓰되, 서버 라우트가 오케스트레이션하는 커스텀 흐름이 필요합니다.** 이유 4가지:

1. **원자성** — 초대 시점에 `auth.users` 생성 + `admin_user`(status=`invited`) 생성 + `admin_user_role` 매핑 + `audit_log` 기록이 함께 일어나야 합니다. Supabase 기본 초대만으로는 `auth.users`만 생기고 나머지가 누락되어 "Auth에는 있는데 Admin에는 없는 유령 계정"이 생깁니다
2. **고지** — 초대 수락 화면에서 운영자 개인정보 처리 안내(§2.5)를 표시해야 합니다
3. **언어·문구** — 기본 초대 메일은 영문 템플릿입니다. Admin은 한국어 단일(E3-R13)
4. **권한 검증** — 초대 API는 `has_menu_permission('operator_management','create')` 재검증 후에만 호출

권고 흐름:

```
super_admin이 Admin에서 이메일 + 표시명 + 역할 입력
  → 서버 라우트: 권한 재검증(+aal2)
  → Supabase Admin API로 초대 (service_role 키, 서버 전용)
  → admin_user(invited) + admin_user_role + audit_log('admin_user.invite') 기록
  → 초대 메일(한국어 템플릿) 수신
  → 수락 화면: 비밀번호 설정 → MFA(TOTP) 등록 강제 → 운영자 개인정보 처리 안내 확인
  → admin_user.status = 'active', audit_log('admin_user.activate')
```

세부 권고:
- 초대 링크 만료 **24시간**, 1회용. 만료 시 재발송(`invite_resend` 기록)
- 미수락 초대는 **7일 후 자동 만료 처리**(`status`를 유지하되 토큰 폐기) + 초대 취소 기능(`invite_revoke`)
- **MFA 등록을 완료해야 `active`가 되도록** 게이트(§6.5)
- `service_role` 키는 이 경로에서 처음 도입됩니다 → **Phase 1 리뷰 S-2 준수**: `NEXT_PUBLIC_` 금지, AWS Amplify **일반 환경변수가 아니라 Secrets(SSM Parameter Store)**, 빌드/에러 로그 출력 금지, `server-only` 모듈에서만 import, 초대·세션무효화·배치 외 용도 사용 금지. **qa-reviewer는 빌드 산출물(`.next/static`)에 키 문자열이 포함되지 않는지 grep으로 확인**할 것

### 6.5 OQ-15 결정 — **2FA(TOTP MFA)를 전 운영자 계정에 필수로 도입합니다**

**결정: 도입. Phase 3-A 범위에 포함.** PRD §4.3 E3-R15의 "SSO/2FA Won't"에서 **2FA만 예외로 승격**합니다.

**근거**

1. **법적 근거가 명확합니다.** 「개인정보의 안전성 확보조치 기준」 제6조는 개인정보취급자가 **정보통신망을 통해 외부에서 개인정보처리시스템에 접속하는 경우 안전한 인증수단(또는 안전한 접속수단)을 적용**하도록 정하고 있습니다. Admin 콘솔은 공개 인터넷의 `/admin` 경로이고(OQ-11에서 IP 제한도 비권장으로 결정됨), 운영자는 전원 외부에서 접속합니다. **ID/비밀번호 단독으로는 이 조항 충족이 어렵다는 것이 실무 해석**입니다. IP 제한을 하지 않기로 한 이상 대안이 없습니다.
2. **비용이 사실상 0입니다.** Supabase TOTP MFA는 전 플랜에서 무료로 제공되며 프로젝트에 기본 활성화되어 있습니다. 별도 벤더·비용·SMS 요금이 없습니다.
3. **운영 부담이 미미합니다.** 대상이 3명 이내이고, 등록은 1인당 1회 QR 스캔입니다.
4. **INV-8과 정확히 맞물립니다.** Supabase는 JWT에 `aal` 클레임을 제공하므로 **RLS 정책 조건에 `aal2`를 직접 넣을 수 있습니다.** 앱이 MFA 확인을 빠뜨려도 DB가 0행을 반환합니다. 앱 레벨 2FA에서는 얻을 수 없는 이중 방어입니다.

**적용 범위: super_admin만이 아니라 전 계정 필수.** 이유: viewer도 리드 개인정보에 접근합니다. 역할별로 나누면 "역할 변경 시 MFA 요건도 바뀌는" 경로가 생겨 오히려 구멍이 됩니다. 3명 규모에서는 **전원 필수가 더 단순하고 더 안전**합니다.

**구현 권고**
- Supabase Auth MFA enforcement 설정 사용(전체 사용자 강제)
- 초대 수락 시 MFA 등록 완료 전까지 `admin_user.status`를 `active`로 올리지 않음 → **미등록 계정은 RLS의 `is_active_admin()`에서 걸러짐**
- `private.is_aal2()` 헬퍼(= JWT `aal` 클레임 확인)를 **모든 리드/권한 관련 RLS 정책과 `security definer` 조회 함수에 포함**
- `auth.mfa_enrolled` / `auth.mfa_reset` 감사 기록(§3.2)
- **복구 경로 문서화(필수)**: MFA 기기 분실 시 ① 다른 super_admin이 해당 계정의 팩터 재설정(`admin_user.mfa_reset` 권한, 감사 기록) ② super_admin이 1명뿐이면 **대표의 Supabase 콘솔 접근이 최후 복구 경로**. §2.6과 함께 운영 문서에 남기세요. **이 경로를 문서화하지 않으면 MFA 도입이 곧 락아웃 리스크가 됩니다**
- (변호사 검토 불요 — 고시 문언에 근거한 실무 판단)

### 6.6 기타 Auth 설정

| 항목 | 권고 |
|------|------|
| 공개 회원가입 | **OFF 유지**(이미 완료·검증됨). Phase 3 배포 후 **재확인**을 DoD에 포함 — 대시보드 설정은 코드 리뷰로 보호되지 않으므로 회귀를 감지할 수 없습니다 |
| Email OTP / Magic Link | **비활성 권고.** 비밀번호+MFA로 통일. 인증 경로가 늘면 MFA 우회 경로가 생길 수 있음 |
| OAuth providers | 전부 비활성(SSO는 Won't) |
| Redirect URLs allow-list | 프로덕션·로컬 도메인만 명시 등록. 와일드카드 금지 |
| Email 발송 | 기본 Supabase SMTP는 rate limit이 낮고 도달률이 불안정 → 초대 실패가 조용히 발생할 수 있음. **커스텀 SMTP 설정 권고**, 그리고 발송 실패를 감지·기록할 것 |
| `/admin` robots | **`app/robots.ts`가 현재 `allow: '/'`로 전면 허용.** E3-R10 미충족 → `disallow: ['/admin', '/admin/']` 추가. 단 robots는 색인 방지일 뿐 접근통제가 아니므로 `noindex, nofollow` 메타/헤더도 Admin 레이아웃에 병행 |

---

## 7. INV-8 관점의 RLS 정책 설계 원칙 (요청 6)

### 7.1 Phase 1 원칙(R-1~R-12)은 전부 유지 + Phase 3 추가 원칙

| # | 원칙 | 지침 |
|---|------|------|
| **A-1** | **GRANT 최소화가 정책보다 앞선다** | Phase 1 R-2 연장. `authenticated`에 필요한 테이블·**컬럼**만 부여. `alter default privileges` 회수는 Phase 3 마이그레이션에서 **테이블별로 다시 명시**(Phase 1의 default privileges 문에 의존하지 말 것) |
| **A-2** | **판정 함수와 데이터 반환 함수를 분리** | §1.2. 권한 판정만 `security definer`. 목록/상세는 `authenticated` 직접 접근 |
| **A-3** | **모든 정책 조건은 3요소 곱** | `has_menu_permission(code, action)` **AND** `is_active_admin()` **AND** `is_aal2()`. 하나라도 빠지면 우회 경로가 생김 |
| **A-4** | **명령별 정책 분리, `using`+`with check` 양쪽 명시** | Phase 1 R-5 유지. `for all using (true)` 절대 금지 |
| **A-5** | **컬럼 단위 GRANT로 "수정 가능 범위"를 DB가 강제** | 정책은 행을, GRANT는 열을 통제. 둘 다 필요 |
| **A-6** | **DELETE는 GRANT 자체를 주지 않는다** | `requests`, `audit_log`, `admin_user` 전부. 파기는 배치 전용 |
| **A-7** | **순환 참조 회피** | Phase 1 R-6. `requests` 정책 → `private.has_menu_permission()`(security definer) → 권한 테이블. 권한 테이블에는 authenticated GRANT를 주지 않으므로 그 테이블의 RLS를 정책에서 다시 평가할 일이 없음 |
| **A-8** | **정책 헬퍼는 `stable` + `set search_path = ''`** | `volatile`이면 행마다 재평가되어 성능이 붕괴. `(select private.has_menu_permission(...))` 래핑으로 initplan 캐싱(Phase 1 R-9 연장) |
| **A-9** | **Realtime 비활성 유지** | Phase 1 R-8. Admin 테이블도 publication에 넣지 말 것 |
| **A-10** | **`anon`에 대한 기존 deny는 손대지 않는다** | Phase 3 마이그레이션이 Phase 1의 `requests_deny_*` 정책을 교체할 때, **`anon` 차단이 함께 풀리지 않도록** 정책의 `to` 절을 `to authenticated`로 명시(`to public`이면 anon도 대상에 포함됨) |

### 7.2 `requests` 역할별 정책 방향 (구체안)

| 역할 | SELECT | UPDATE | INSERT | DELETE | 연락처 원문 | export |
|---|---|---|---|---|:---:|:---:|
| `anon` | 거부(유지) | 거부 | **`submit_request` RPC만**(유지) | 거부 | X | X |
| `viewer` | 허용 (`lead_management.read`) | 거부 | 거부 | 거부 | **X (§8.4)** | X |
| `operator` | 허용 | **`status`, `assignee_id`만** | 거부 | 거부 | O (감사 기록) | X |
| `super_admin` | 허용 | 동일 | 거부 | 거부 | O (감사 기록) | O |

**핵심 설계 결정 3가지:**

1. **`authenticated`의 SELECT GRANT에서 `contact` 컬럼을 제외합니다.** 목록·상세 조회는 `contact` 없이 이루어지고, 원문은 §7.3의 전용 함수로만 얻습니다.
2. **목록에 보여줄 마스킹 연락처는 생성 컬럼으로.** `contact_masked text generated always as (마스킹식) stored` 를 `requests`에 추가하고 이 컬럼만 GRANT합니다. 마스킹 로직이 애플리케이션이 아니라 **DB에 고정**되므로 서버 코드 버그로 원문이 새지 않습니다. (마스킹 식은 `immutable`이어야 하므로 문자열 함수만 사용)
3. **리드의 개인정보 컬럼은 누구도 UPDATE할 수 없습니다.** `contact`, `purpose`, `description`, `company_name_website`에 UPDATE GRANT를 주지 않습니다. 운영자가 리드 내용을 임의 수정할 업무상 이유가 없고, 수정 가능하면 감사·증빙 가치가 훼손됩니다. 정보주체의 정정 요구는 별도 절차(수동)로 처리합니다.

`private.request_meta`(내부 메모):
- `authenticated`에 `select(request_id, internal_note)` + `update(internal_note)` GRANT
- RLS: `has_menu_permission('lead_management','read'/'update')` + 공통 3요소
- **`consent_ip` 컬럼은 `authenticated`에 GRANT하지 않음** — 운영자가 볼 업무상 이유가 없습니다. 동의 입증이 필요한 예외 상황에는 대표가 콘솔에서 확인
- `private` 스키마가 PostgREST Exposed schemas에 없으므로 서버는 RPC 또는 스키마 지정 접근이 필요 → backend-developer 설계 시 접근 방식 확정 필요(권고: `public`에 `security invoker` 뷰를 두지 말고, 메모 읽기/쓰기 전용 `security definer` 함수 2개 + 함수 내부 권한 검증 + 감사 기록)

### 7.3 연락처 원문 접근 — 감사와 물리적 결속

```
public.get_request_contact(p_request_id uuid) → text     [security definer, set search_path = '']
  1. is_active_admin() AND is_aal2() AND has_menu_permission('lead_management','read')  아니면 → audit(denied) 후 raise
  2. has_pii_access()  (= super_admin 또는 operator. viewer 제외 — §8.4)                아니면 → audit(denied) 후 raise
  3. log_audit('lead.contact_reveal', subject_ids := [p_request_id])   ← 실패 시 전체 실패
  4. contact 반환
```

이 구조의 가치:
- `contact` 컬럼에 GRANT가 없으므로 **이 함수를 거치지 않고 원문을 얻는 경로가 존재하지 않습니다.** "조회 API에 로그를 붙인다"는 방식은 새 API가 추가될 때마다 누락이 생깁니다
- 감사 로그의 완전성이 코드 리뷰가 아니라 **권한 구조로** 보장됩니다
- 목록 화면은 애초에 원문을 담지 않으므로, 목록 API 응답이 로그·캐시·에러 리포트로 새어도 개인정보 유출이 아닙니다
- 내보내기(§5)는 이 함수를 우회하는 유일한 대량 경로이므로 별도 통제를 둡니다

### 7.4 Phase 1 `submit_request` 패턴과의 일관성

| 관점 | Phase 1 (anon 쓰기) | Phase 3 (admin 읽기/수정) | 일관성 |
|---|---|---|---|
| GRANT 우선 | 테이블 GRANT 0, RPC EXECUTE만 | 테이블 GRANT를 **컬럼 단위 최소**로 | 동일 사상 |
| 좁은 통로 | `submit_request` 1개 | `get_request_contact` 1개(원문 한정) | 동일 사상 |
| RLS 역할 | 정책은 명시적 deny(방어적 문서화) | **정책이 실제 판정에 참여**(A-2) | 강화 |
| 브라우저 직접 접근 | 없음(서버 경유) | 없음(서버 경유) | 동일 |
| 키 | anon 키만 | 사용자 JWT 중심, `service_role`은 초대·배치 한정 | 확장 |

**결론: 패턴을 뒤집지 않고 확장합니다.** Phase 1이 "쓰기는 좁은 함수 하나로"였다면 Phase 3는 "읽기는 RLS로 넓게, **가장 민감한 한 컬럼만 좁은 함수로**"입니다. 전부를 RPC로 감싸면(§1.2) 오히려 방어가 약해집니다.

---

## 8. `role_menu_permission` 플래그의 통제 한계 검토 + OQ-16 결정 (요청 7)

### 8.1 5개 플래그로 통제되는 것 / 안 되는 것

| 통제 대상 | `read/create/update/delete/export`로 가능? | 판정 |
|---|:---:|---|
| 메뉴(화면) 단위 접근 여부 | O | 설계 목적 그대로 |
| 특정 화면에서 수정 가능 여부 | O | |
| 개인정보 반출 여부 | O (`export`) | §5에서 의미를 "개인정보 포함 반출"로 못박음 |
| **같은 화면 내 컬럼 단위 노출 범위** (연락처 마스킹) | **X** | 메뉴 단위 모델의 구조적 한계 |
| 행 단위 범위("내가 담당한 리드만") | X | PRD E3-R14에서 Won't로 명시 — 정합 |
| 자유서술 필드 노출 여부 | X | 동일 한계 |
| 대량 조회 vs 단건 조회 구분 | X | §5 건수 상한으로 보완 |

**판정: 메뉴 단위 RBAC만으로는 "개인정보 노출 범위"를 통제할 수 없습니다.** `read` 플래그는 이분법(다 보거나 못 보거나)이라, viewer에게 `read`를 주는 순간 연락처까지 열립니다. **보완 축이 반드시 필요합니다.**

### 8.2 보완 방식 3안 비교

| 안 | 내용 | 평가 |
|---|---|---|
| ① 플래그 확장 (`read_pii` 추가) | `role_menu_permission`에 6번째 플래그 | 매트릭스 UI가 복잡해지고, 메뉴마다 의미가 달라 혼란. **비권고** |
| ② **역할 속성으로 분리 (권고)** | `role`에 `can_access_pii boolean not null default false` | 메뉴 단위 모델을 오염시키지 않음. "이 역할은 개인정보 원문을 볼 수 있는가"는 메뉴가 아니라 **사람의 신분**에 붙는 속성이라 개념적으로도 정확. 판정 함수 `has_pii_access()` 하나로 캡슐화 |
| ③ 별도 메뉴 코드로 분리 | `lead_contact`라는 가상 메뉴 | 메뉴 트리가 UI와 어긋나 INV-2를 훼손. **비권고** |

**권고: ②.** `role.can_access_pii`를 추가하고, 초기값은 `super_admin=true`, `operator=true`, `viewer=false`. 이 플래그는 §7.3의 `get_request_contact`와 §5의 전체 내보내기에서 판정됩니다.

> **PRD §4.3.1 데이터 모델 초안 수정 요구**: `role` 엔티티에 `can_access_pii` 컬럼 추가. E3-R14(ABAC Won't)와 충돌하지 않습니다 — 속성 기반 정책 엔진이 아니라 역할에 붙은 단일 불리언입니다.

### 8.3 확장 여지를 열어두는 방법 (E3-R14 대비)

v1에서 구현하지 않되 스키마가 막지 않도록:
- `role_menu_permission`에 향후 `scope text default 'all'`(→ `own`) 컬럼을 넣을 자리를 남겨두기(v1은 컬럼 미생성, 설계 문서에만 기재)
- 권한 판정을 `private.has_menu_permission()` **단일 함수로 캡슐화** — 나중에 행 범위 개념이 추가돼도 호출부를 고치지 않아도 됩니다. **이것이 확장성 확보의 실질적 수단입니다**

### 8.4 OQ-16 결정 — **viewer는 리드 연락처 원문에 접근할 수 없습니다**

**결정: 마스킹 적용. 해제(reveal) 기능 없음.**

| 항목 | viewer | operator / super_admin |
|---|---|---|
| `contact`(이메일) | **`contact_masked` 생성 컬럼만** (`a***@example.com`) | 원문 (`get_request_contact` 경유, 감사 기록) |
| `company_name_website` | **원문 노출** | 원문 |
| `purpose` / `description` | **원문 노출** | 원문 |
| `internal_note` | 읽기 가능 / 쓰기 불가 | 읽기·쓰기 |
| 내보내기 | 불가 | super_admin만 |

**근거**
- viewer 역할의 목적은 "현황 파악·조회"이지 "리드에게 연락"이 아닙니다. **연락처 원문은 그 목적 달성에 필요하지 않습니다** → 최소권한 원칙. PRD가 viewer를 둔 이유(§4.3 User Story: "외부 인력이 합류해도 리드 개인정보 노출 범위를 통제")와 정확히 부합합니다.
- viewer는 외부·단기 인력이 배정될 가능성이 가장 높은 역할입니다. 통제 강도를 가장 높게 잡는 것이 합리적입니다.
- 마스킹은 **DB 레벨(GRANT + 생성 컬럼 + 함수 권한)에서 강제**합니다. 프론트 마스킹은 통제가 아닙니다(INV-3와 동일 논리).

**`company_name_website`와 자유서술을 마스킹하지 않는 이유(그리고 그 리스크의 처리)**
- 회사명·문의 내용을 가리면 viewer는 어떤 판단도 할 수 없어 역할 자체가 무의미해집니다.
- 다만 Phase 1 리뷰 §2.1에서 지적했듯 **자유서술 필드는 통제 불가능한 개인정보 유입 경로**입니다. 따라서 viewer의 리드 조회도 **`lead.list` / `lead.view`로 전건 감사 기록**되며, §3.7 월간 점검 대상입니다. "가리지 못하면 남긴다"가 이 설계의 원칙입니다.
- 자유서술에 개인정보를 적지 말라는 폼 안내 문구(Phase 1 ux-writer 항목)가 실제로 반영됐는지 배포 전 확인하세요.

**reveal(일시 해제) 기능을 만들지 않는 이유**: 사유 입력 + 감사로 해제를 허용하면 실질적으로 viewer = operator가 됩니다(운영 현장에서는 항상 해제하게 됩니다). 연락이 필요하면 **역할을 올리는 것이 올바른 경로**이며, 그 역할 변경은 `admin_user.role_grant`로 감사됩니다. 권한 승격이 남는 편이 임시 열람이 남는 편보다 통제 가능합니다.

---

## 9. INV-1~8 검토 결과 — PRD 초안에 대한 수정/보강 요구

| # | 원문 | 판정 | 수정·보강 요구 |
|:--:|------|:---:|---|
| INV-1 | `menu.code` 불변, 권한 체크는 code로 | 유지 | `code`에 UNIQUE + **불변 강제 트리거**(UPDATE 시 code 변경 차단). "불변"을 문서로만 두면 지켜지지 않습니다 |
| INV-2 | 메뉴 트리 DB SSOT, API 1회 호출 | 유지 | 권한 없는 메뉴는 **응답에서 제외**(존재를 숨김). 트리 조회 함수는 `security definer`, 감사 기록 대상 아님(§3.2-E) |
| INV-3 | 메뉴 숨김은 보안이 아님 | 유지 | **거부 시 `auth.access_denied` 감사 기록을 의무화**하는 문장 추가(§3.2-A). 거부만 하고 기록하지 않으면 탐지 불가 |
| INV-4 | 명시적 allow-list | **단서 추가** | "**단, 시스템 역할(`super_admin`)은 매트릭스를 참조하지 않고 전 권한을 가진다**"를 명시(§4.2-c). 이 예외가 INV-6을 구조적으로 보장합니다 |
| INV-5 | 다중 역할 = 합집합 | 유지 | 합집합 대상은 `role_menu_permission` 플래그. **`role.can_access_pii`도 합집합**(하나라도 true면 true) — 명시 필요 |
| INV-6 | 시스템 역할 불가침, 활성 최고관리자 ≥1 | **구현 방식 확정** | §4. **트리거 + advisory lock + deferrable constraint trigger**. 앱 레벨만으로는 불충족 |
| INV-7 | 권한 캐시 짧게 | **강화** | §6.1. "캐시를 짧게"가 아니라 **"권한을 JWT에 넣지 않는다 + RLS에 `is_active_admin()` 포함"**. 그래야 회수가 즉시 반영됩니다 |
| INV-8 | RLS + 앱 이중 방어 | **전제 수정** | §1.2. `security definer`로 데이터를 반환하면 RLS가 평가되지 않아 이중 방어가 성립하지 않습니다. **판정 함수와 데이터 함수의 분리**를 INV-8의 구현 조건으로 추가 |

**초기 역할 세트 보강** (PRD §4.3.1 표 갱신 요구)

| 역할 코드 | is_system | can_access_pii | export | 접근 범위 |
|---|:---:|:---:|:---:|---|
| `super_admin` | **true** | true | true | 전 메뉴(매트릭스 미참조) + 권한관리 + 내보내기 |
| `operator` | false | **true** | **false** | 대시보드, 요청관리(read/update), 콘텐츠관리 |
| `viewer` | false | **false** | false | 대시보드, 요청관리(read only, **연락처 마스킹**) |

---

## 10. 검토 중 발견한 추가 이슈

| # | 이슈 | 위치 | 위험도 | 권장 조치 |
|---|------|------|:---:|-----------|
| P3-1 | `app/robots.ts`가 `allow: '/'`로 전면 허용 — **E3-R10 미충족** | `app/robots.ts:11` | **주요** | `/admin` disallow 추가 + Admin 레이아웃에 `noindex, nofollow` 메타/`X-Robots-Tag`. 3-A에서 처리 |
| P3-2 | Phase 1 마이그레이션이 **아직 실제 적용되지 않았을 가능성** (`supabase/README.md` "Migrations were NOT applied") | `supabase/README.md:7-12` | **치명적**(사실이면) | Phase 3 착수 전 실제 DB 상태 확인 필수. 미적용 상태에서 Phase 3 마이그레이션을 얹으면 Phase 1의 GRANT 회수가 누락된 채로 Admin이 올라갑니다. **project-manager 확인 항목** |
| P3-3 | `requests.assignee_id`에 FK 없음 | Phase 1 마이그레이션 `:110` | 권고 | Phase 3에서 `admin_user(id)` FK 추가. **`on delete restrict`** 권고(§2.4-3) |
| P3-4 | `retention_jobs.job_type` CHECK가 `anonymize`/`hard_delete`만 허용 | Phase 1 마이그레이션 `:267` | 권고 | 감사로그 파기(§3.6)를 기록하려면 `audit_purge` 값 추가 필요 |
| P3-5 | `failed_submissions`(7일 보관) 파기 배치가 아직 없음 | Phase 1 마이그레이션 §4 주석 | **주요** | 마스킹돼 있지만 마스킹 이메일도 개인정보성이 남습니다. Phase 3에서 `pg_cron` 도입 시 **리드 파기 배치·감사로그 파기 배치와 함께 일괄 구축** |
| P3-6 | 리드 파기 배치(`pg_cron`) 자체가 미구현 | Phase 1 미이행 항목 | **주요** | Phase 1 리뷰에서 확정한 12/24개월·30일 정책이 **아직 아무것도 실행되지 않고 있습니다.** 처리방침에는 이미 파기를 약속하고 있으므로 **문서-실제 불일치 상태**입니다. Phase 3에서 반드시 해소(3-F와 함께) |
| P3-7 | 내부관리계획 문서 부재 | 프로젝트 전반 | **주요** | 안전성 확보조치 기준은 내부관리계획 수립을 요구하며, 접속기록 점검 주기·방법·사후조치를 여기에 정해야 합니다(§3.7). Phase 3 배포 전 최소 형태로 작성 권고. **변호사/전문가 검토 권고** |
| P3-8 | Admin 세션 쿠키 속성 | 3-A 구현 시 | **주요** | `HttpOnly`, `Secure`, `SameSite=Lax`(OAuth 미사용이므로 Lax로 충분). Supabase SSR 헬퍼 기본값을 **확인 후 채택**할 것 |
| P3-9 | Admin 화면의 오류·로그에 리드 개인정보 노출 | 3-C 구현 시 | **주요** | Phase 1 S-5 연장. Admin 서버 로그·에러 리포팅에 `contact`/자유서술이 실리지 않도록. 특히 Supabase 에러 객체를 그대로 로깅하면 쿼리 파라미터가 남습니다 |
| P3-10 | Admin UI 라이브러리(shadcn/ui) 도입에 따른 공급망 위험 | 3-A/3-E | 권고 | shadcn/ui는 코드 복사 방식이라 런타임 의존성 추가가 적지만, Radix 등 전이 의존성이 늘어납니다. **`npm audit` / lockfile 고정 / Dependabot을 Phase 3 DoD에 포함** |
| P3-11 | 리드 상세 화면의 브라우저 캐시 | 3-C | 권고 | Admin 응답에 `Cache-Control: no-store` — 공용 PC·브라우저 히스토리를 통한 개인정보 잔존 방지 |

---

## 11. Phase 3 진입 게이트 체크리스트

**backend-developer (3-B 스키마 설계 시 반영 — 필수)**
- [ ] §1.2 역할 분리: 판정 함수(`security definer`) vs 데이터 접근(`authenticated` + RLS)
- [ ] §2.2 `admin_user` 컬럼 (이메일 비복제, 최소수집), §2.3 RLS/GRANT, §2.4 삭제 금지·상태 전이
- [ ] §3.3 `audit_log` 컬럼(5개 법정 항목 대응), §3.4 마스킹 규칙, §3.5 **append-only 3중 차단**, §3.6 2년 보관 + 파기 배치
- [ ] §4.2 INV-6: deferrable constraint trigger + `pg_advisory_xact_lock` + `is_system` 보호 + super_admin 매트릭스 미참조
- [ ] §7.2 `requests` 컬럼 단위 GRANT (`contact` 제외, `contact_masked` 생성 컬럼 추가, UPDATE는 `status`/`assignee_id`만, DELETE GRANT 없음)
- [ ] §7.3 `get_request_contact` — 감사 기록과 원자 결속
- [ ] §7.2 `private.request_meta.internal_note` 접근 함수 (E3-R2 내부 메모는 여기)
- [ ] §8.2 `role.can_access_pii` 컬럼 추가
- [ ] §9 INV-1 code 불변 트리거, INV-4 시스템 역할 예외
- [ ] `admin_user` + super_admin 역할 시드 마이그레이션(부트스트랩 계정 연결)
- [ ] P3-3(FK), P3-4(job_type), P3-5/P3-6(pg_cron 파기 배치 일괄 구축)
- [ ] Phase 3 마이그레이션에서 `to authenticated` 명시 — Phase 1의 `anon` 차단이 함께 풀리지 않게(A-10)

**대표 / 운영 결정 — 확정 완료 (2026-08-25)**
- [x] 부트스트랩 계정 이메일 — **`jhc@ylia.io`(조직 도메인) 사용 확정**(§2.6)
- [x] Phase 1 마이그레이션 실제 적용 여부 — **적용 완료 확인됨**(2026-08-24, 대표가 Dashboard SQL Editor로 실행 + qa-reviewer가 라이브 RLS 검증까지 완료. `supabase/README.md`, 마이그레이션 파일 헤더의 "NOT applied" 문구는 정정함, P3-2 해소)
- [x] 감사 로그 보관기간 **2년 확정**(법정 최소 1년 대비 여유)
- [x] 내보내기 한도 **1회 1,000행 / 1일 3회·3,000행 확정**
- [x] MFA 필수화 확정(§6.5) — 대표 본인 계정 포함, 전 운영자 대상

**Supabase 대시보드 설정 (3-A 착수 시, 코드 불요)**
- [ ] JWT 30분 / Inactivity timeout 30분 / Time-box 8시간 / Refresh rotation ON
- [ ] 비밀번호 최소 12자 + 유출 비밀번호 차단
- [ ] MFA enforcement 활성
- [ ] 공개 회원가입 OFF **재확인**
- [ ] Email OTP / Magic Link / OAuth 비활성, Redirect URL allow-list
- [ ] 커스텀 SMTP
- [ ] Exposed schemas에 `private` 미포함 재확인

**frontend-developer**
- [ ] robots `/admin` disallow + `noindex` (P3-1)
- [ ] 유휴 자동 로그아웃(클라이언트 보조), `Cache-Control: no-store` (P3-11)
- [ ] 내보내기 사유 입력 UI(10자 이상 필수), 한도 초과 안내
- [ ] 권한관리 매트릭스에서 super_admin 행 읽기 전용 렌더링
- [ ] 초대 수락 화면: 비밀번호 → MFA 등록 → 운영자 개인정보 처리 안내 확인
- [ ] viewer 화면에서 연락처는 마스킹값만 렌더링(서버가 원문을 보내지 않는 것이 1차, UI는 2차)

**qa-reviewer (배포 전 공동 검증)**
- [ ] §4.3 INV-6 테스트 6종 — 특히 **동시성(3)** 과 **`service_role` 우회(6)**
- [ ] raw HTTP로 viewer 계정 JWT로 `contact` 직접 조회 시도 → 차단 확인
- [ ] `service_role` 키로 `audit_log` UPDATE/DELETE 시도 → 차단 확인(§3.5 층 1·3)
- [ ] 권한 없는 계정으로 URL 직접 입력 → 차단 + `auth.access_denied` 기록 확인
- [ ] MFA 미등록(aal1) 세션으로 리드 조회 → 0행 확인
- [ ] suspend 직후(토큰 만료 전) 접근 → 즉시 차단 확인(INV-7)
- [ ] CSV 수식 인젝션(`=HYPERLINK(...)`를 문의 내용에 넣고 내보내기) 방어 확인
- [ ] 빌드 산출물에 `service_role` 키 문자열 미포함 확인
- [ ] 감사 로그에 이메일 원문·자유서술 원문이 남지 않는지 실측(§3.4)

**privacy-security-officer (배포 전 최종 점검)**
- [ ] 감사 로그 실측 — 필수 액션 누락 여부(§3.2), 마스킹 준수(§3.4)
- [ ] 처리방침 §8 Security 문구 갱신 확인(§2.5)
- [ ] 파기 배치 실동작 및 `retention_jobs` 증빙 확인(P3-5/P3-6)
- [ ] 내부관리계획 초안 존재 여부(P3-7)

---

## 12. 참고

**법령·고시**
- 개인정보 보호법 §15(수집·이용), §21(파기), §26(위탁), §29(안전조치), §30(처리방침), §31(보호책임자)
- [개인정보의 안전성 확보조치 기준 (국가법령정보센터)](https://www.law.go.kr/admRulLsInfoP.do?chrClsCd=010202&admRulSeq=2100000229672) — 제2조(접속기록 정의), 제5조(접근 권한의 관리), 제6조(접근통제 — 외부 접속 시 안전한 인증수단, 일정시간 미사용 시 자동 접속차단), 제8조(접속기록의 보관 및 점검 — 1년/2년, 월 1회 점검, 다운로드 사유 확인, 위·변조 방지)
- [개인정보의 안전성 확보조치 기준 개정 시행(2025.10.31) — CELA](https://www.cela.kr/4/?bmode=view&idx=168696184) / [개정 안내서(2025.11.)](https://www.cela.kr/4/?bmode=view&idx=168843276) — 인터넷망 차단조치 제도 개선(일평균 100만명 이상 대상, 본 서비스 비해당). 점검 주기·방법의 내부관리계획 자율화 경향
- [개인정보처리시스템 접속기록 — IT 위키](https://itwiki.kr/w/%EA%B0%9C%EC%9D%B8%EC%A0%95%EB%B3%B4%EC%B2%98%EB%A6%AC%EC%8B%9C%EC%8A%A4%ED%85%9C_%EC%A0%91%EC%86%8D%EA%B8%B0%EB%A1%9D)
- [제6조 접근통제 해설 — 개인정보 안전성 확보조치 가이드](https://guide.jinbo.net/data-protection-security/3-%EA%B0%9C%EC%9D%B8%EC%A0%95%EB%B3%B4%EC%9D%98-%EC%95%88%EC%A0%84%EC%84%B1-%ED%99%95%EB%B3%B4%EC%A1%B0%EC%B9%98-%EA%B8%B0%EC%A4%80-%EC%9D%B4%ED%95%B4%ED%95%98%EA%B8%B0/%EC%A0%9C6%EC%A1%B0%EC%A0%91%EA%B7%BC%ED%86%B5%EC%A0%9C/)

**기술 근거**
- [Supabase Docs — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) / [Postgres RLS Footguns — Bytebase](https://www.bytebase.com/blog/postgres-row-level-security-footguns/) — Supabase `postgres` 역할의 BYPASSRLS, `security definer` 함수의 RLS 우회
- [PostgreSQL — Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) — BYPASSRLS > FORCE ROW LEVEL SECURITY
- [Supabase Docs — User sessions](https://supabase.com/docs/guides/auth/sessions) — JWT expiry, inactivity timeout, time-box
- [Supabase Docs — Multi-Factor Authentication](https://supabase.com/docs/guides/auth/auth-mfa) / [TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp) / [MFA via RLS Enforcement](https://supabase.com/blog/mfa-auth-via-rls) — `aal2` 클레임, 전 플랜 무료, RLS에서 강제

**참고한 리포지토리 파일**
`docs/01-plan/features/fkp-v0.2-platform-foundation.prd.md`, `docs/01-plan/features/fkp-v0.2-privacy-review-oq4-tv4.md`, `supabase/migrations/20260824120000_phase1_requests_pipeline.sql`, `supabase/README.md`, `app/robots.ts`, `lib/supabase/serverClient.ts`, `docs/legal/privacy-v1.0-en.md`
