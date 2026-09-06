# Human Matching (`/admin/leads/[id]` 매칭 탭) — P4 사전 개인정보/보안 검토

작성: privacy-security-officer · 2026-09-06
대상: [`human-matching.screen-spec.md`](../02-design/features/human-matching.screen-spec.md) §0(G-6/G-7/G-8) · §2(개념 데이터 모델) · §9(엣지케이스 6/9/10) · §10(감사로그) · §11(SP-M1~SP-M3)
기준선(baseline): [`partner-signup-privacy-review.md`](./partner-signup-privacy-review.md) — **PR-1(PII 분리), PR-5(보관기간표), PR-9(탈퇴 시 Match 보존 범위), PR-14(자유서술 필드 PII 유입)는 이 문서에서 다시 열지 않고 그대로 승계한다.** 본 문서는 그 원칙을 Match 데이터에 적용한 것이다.
근거 코드(전부 직접 Read 확인): `supabase/migrations/20260824120000_phase1_requests_pipeline.sql`, `20260825120000_phase3_admin_rbac.sql`, `20260825160000_phase3_permission_management_crud.sql`, `20260829120000_admin_lead_hide.sql`, `20260829140000_partner_schema.sql`, `20260829160000_partner_category_menu_seed.sql`, `20260904100000_supplier_app_privacy_fixes.sql`
수신: **backend-developer(P4 스키마 첫 줄 쓰기 전 필독)** · service-planner · frontend-developer · qa-reviewer · project-manager · ceo-advisor(§5 HM-B5 에스컬레이션)

> ### service-planner에게 — screen-spec §11 갱신 요청
> **본 문서가 `human-matching.screen-spec.md` §11의 SP-M1 / SP-M2 / SP-M3에 대한 결론이다.** 본 문서는 screen-spec을 **직접 수정하지 않았다.** 아래를 반영해 주기 바란다.
>
> | screen-spec 위치 | 갱신 내용 |
> |---|---|
> | §11 SP-M1 행 | "→ **결정 완료**: `human-matching-privacy-review.md` §2 (스냅샷 + `on delete set null` + 전이 경고, restrict/cascade 모두 불채택)" |
> | §11 SP-M2 행 | "→ **결정 완료**: 같은 문서 §3 (필드 계층별 이원 보관기간 — 구조화 필드 무기한, 자유서술 4종은 Requirement 리텐션과 동시 파기)" |
> | §11 SP-M3 행 | "→ **결정 완료**: 같은 문서 §4 (`partner_management:read` 번들링 채택, 축소 권한 체계 신설 없음)" |
> | §0 G-6 / G-7 / G-8 | 심각도 열을 "해소 방안 확정 — 구현 게이트로 이관"으로 조정하고, 본 문서를 링크 |
> | §2.1 / §2.2 / §9-엣지케이스 9 | §2의 결정(스냅샷 필드 목록, `requirement_created_at` 스냅샷 필수, 고아 match UI 표시)이 화면 동작을 바꾸므로 본문 반영 필요 |
> | §6.1 / §6.2 | §4-(3)의 "권한 없음 vs 결과 없음 구분 표시" 상태 추가 |
>
> **SP-M4(judge_status 리셋) / SP-M5(Gap 해소 vs 일정)는 본 문서의 스코프가 아니다.** screen-spec이 명시한 대로 각각 product-manager / project-manager 소관이며, 본 문서는 두 항목에 대해 어떤 판단도 내리지 않았다.

> **면책**: 본 문서는 실무 검토이며 법률 자문이 아닙니다. "**변호사 검토 필요**"로 표시한 항목은 실제 매칭 운영 개시 전 법률 검토를 권합니다. 그 외는 실제 마이그레이션 SQL과 공개 법령에서 확인 가능한 사실관계에 기반합니다.

---

## 0. 결론 요약

### 0.1 위임받은 결정 3건

| ID | 결정 | 한 줄 요약 |
|---|---|---|
| **SP-M1** (G-6) | **§2** | `match.requirement_id`를 **nullable FK + `on delete set null`**, 여기에 **비-PII 구조 필드만** 스냅샷. `closed` 전이는 **차단하지 않고 경고만**. 후보 (a)의 restrict/on_hold 제한은 **불채택**(리텐션 배치를 조용히 죽이고, 스팸 리드 PII를 12개월 보유하게 만든다) |
| **SP-M2** (G-8) | **§3** | **"보관기간 없음"은 채택하지 않는다.** Match는 PII를 새로 만든다(자유서술 4종 + 행위자 식별자). 필드 계층을 나눠 **구조화 필드=무기한(5년 주기 재검토), 자유서술 4종=연결 Requirement의 리텐션 이벤트와 동시 파기, 고아 match=최초 확정+24개월** |
| **SP-M3** (G-7) | **§4** | **기존 `partner_management:read`를 매칭 담당 role에 부여(번들링)한다.** 축소 권한 체계·가상 메뉴 코드 신설은 INV-2/기존 RBAC 2축 설계와 충돌하므로 불채택. 단 `read`만, `create/update/delete/export`는 주지 않는다 |

### 0.2 배포/착수 전 반드시 해소 (blocking)

| ID | 항목 | 위험도 | 게이트 시점 |
|---|---|:---:|---|
| **HM-B1** | SP-M1 결정(§2)대로 FK 정책·스냅샷 필드 목록을 확정하지 않고 `match` DDL을 쓰면, cascade면 북극성 지표 소스가 소멸하고 restrict면 **리텐션 배치 전체(12/24개월 익명화 포함)가 조용히 실패**한다 | **치명적** | 스키마 설계 착수 전 |
| **HM-B2** | 스냅샷에 `what_looking_for`/`purpose`/`description`/`company_name_website`/`contact`를 넣으면, 12/24개월 익명화 배치를 **구조적으로 우회하는 그림자 사본**이 생긴다(법 제21조 위반 소지) | **치명적** | 스키마 설계 |
| **HM-B3** | `operator`에게 `partner_management:read`가 없으면 **매칭 탭이 통째로 죽는다**(연락처만이 아니라 후보 검색 결과가 0행). 현재 시드는 super_admin에게만 부여돼 있다 | **주요** | P4 배포 전 체크리스트 |
| **HM-B4** | `audit_log.action`은 **고정 CHECK 목록**이다. screen-spec §10의 신규 액션 5종을 CHECK에 추가하지 않으면 `private.log_audit()` INSERT가 실패하고 **판정 저장 RPC 전체가 롤백**된다 | **치명적** | match 스키마 마이그레이션과 동일 파일 |
| **HM-B5** | **Top3를 바이어에게 전달하는 행위 자체가 제3자 제공이다.** 파트너 측 `third_party_share` 동의는 v1.0 미사용이고, 바이어측 `requests.third_party_*` 컬럼도 미사용이다. 현재 구조로 실매칭을 돌리면 **파트너 동의 없는 제3자 제공** | **치명적(운영)** | 첫 실매칭 전. **변호사 검토 필요** |
| **HM-B6** | 자유서술 4종의 파기 트리거/배치를 §3대로 만들지 않으면, 리드 본문은 익명화되는데 **그 리드에 대한 메모는 영구 존속**한다(문서-실동작 불일치, 법 제30조) | **주요** | P4 구현 |

### 0.3 개선 권고 (non-blocking)

HM-R1 ~ HM-R8 — §6.

### 0.4 이 문서가 **뒤집지 않는** 것 (재확인)

| 확인 항목 | 결과 |
|---|---|
| screen-spec §10 "메모 본문은 감사로그에 넣지 않는다" | **옳다. 그대로 유지.** `audit_log`가 2차 PII 저장소가 되는 것을 막는 기존 컨벤션과 정확히 일치 |
| screen-spec §10 "연락처 열람은 기존 `admin_partner.contact_reveal` 재사용, 신규 액션 불필요" | **옳다.** `get_partner_contact()`는 성공·거부 모두 감사하고 **감사 write 실패 시 원문 반환을 롤백**한다. 매칭 탭이 이 함수를 그대로 호출하는 한 추가 통제가 필요 없다 |
| screen-spec §3 "자유 태그 불허, 고정 vocabulary" | **개인정보 관점에서도 옳다.** 자유 태그는 PII 유입 경로가 하나 더 늘어나는 것이다. 태그를 구조화 라벨로 묶어두는 설계가 §3의 파기 규칙(자유서술만 파기, 태그는 존속)을 성립시킨다 |
| screen-spec §9-6/§9-10 "이미 기록된 Outcome 이력은 삭제하지 않고 보존" | **옳다.** 판정 번복·파트너 상태 변경은 소급 삭제 대상이 아니다(감사 목적). 단 §3의 자유서술 파기 규칙은 이와 별개로 적용된다 |
| screen-spec §2.1 유니크 제약을 `(requirement_id, partner_id)`로 두는 것 | **문제 없음.** 단 §2 결정으로 `requirement_id`가 nullable이 되면 **NULL은 유니크 제약에서 서로 충돌하지 않으므로**, 고아 match가 여러 건 쌓여도 제약 위반이 나지 않는다(의도된 동작. backend-developer 인지 필요) |

---

## 1. 이 검토가 근거로 삼은 코드 사실

추측을 배제하기 위해 SP-M1/M3의 전제를 전부 실제 SQL에서 확인했다. 아래는 backend-developer가 잘못 알기 쉬운 것들이다.

| # | 확인한 사실 | 위치 |
|---|---|---|
| **F-M1** | `closed` 하드삭제의 실제 주체는 **`private.run_requests_retention_batch()`** 이고, 문장은 `delete from public.requests where status = 'closed' and retention_expires_at < now()` **단 하나**다. 스케줄러는 `private.run_daily_retention_batches()` ← pg_cron job `fkp-daily-retention-batches`, `'0 18 * * *'`(UTC 18시 = KST 03시) | `20260825120000` 1699~1776행, 1786~1852행 |
| **F-M2** | 30일 시계는 컬럼 `requests.retention_expires_at`이고, 트리거 `trg_requests_set_retention` → `public.compute_retention_expires_at(status, ts)`가 유지한다. `closed` = **상태 변경 시각 + 30일**, `matched` = +24개월, 그 외(`new`/`reviewing`/`matching`/`on_hold`) = +12개월. **상태가 바뀔 때마다 재계산**되므로 `closed`에서 벗어나면 시계가 12개월로 리셋되고, 다시 `closed`가 되면 30일이 새로 시작된다 | `20260824120000` 309~355행 |
| **F-M3** | 현재 이 하드삭제에 딸린 cascade 대상은 **`private.request_meta` 하나뿐**(`on delete cascade`). 다른 참조 테이블은 존재하지 않는다 — 즉 `match`가 이 삭제 경로에 붙는 **최초의 외부 참조**가 된다 | `20260824120000` 176~177행, `20260825120000` 1713행 주석 |
| **F-M4** | **하드삭제 블록과 12/24개월 익명화 블록이 같은 함수·같은 트랜잭션에 있다.** 호출부는 `begin ... exception when others then raise warning` 으로 감싸져 있다. 따라서 restrict FK 위반이 나면 **하드삭제만 막히는 것이 아니라 그날의 익명화까지 통째로 롤백되고, 남는 것은 warning 한 줄뿐이다.** `retention_jobs`에 행조차 안 남으므로 **조용한 실패**가 된다 | `20260825120000` 1710~1772행, 1795~1799행 |
| **F-M5** | 익명화 경로는 행을 지우지 않는다. 본문·연락처를 sentinel 값(`'[anonymized]'`, `anonymized+<id>@invalid`)으로 치환하고 `created_at`을 월 단위로 절삭하며 `private.request_meta.internal_note`/`consent_ip`를 NULL로 만든다. **`matched` 리드의 행은 24개월 뒤에도 남는다** — 즉 정상 종결된 매칭에서는 FK 고아 문제가 애초에 발생하지 않는다 | `20260825120000` 1730~1753행 |
| **F-M6** | 상태 전이의 유일한 진입점은 `public.update_lead_status(uuid, text)`이며 **상태 머신이 없다**(6개 값 화이트리스트만 검사, 임의 전이 허용). 즉 "closed 전이 시 가드"를 넣을 자리는 이 함수 한 곳뿐이다 | `20260825160000` 94~131행 |
| **F-M7** | `public.hide_closed_lead()`는 `hidden_at`만 세팅하는 **화면 숨김**이고 행 삭제가 아니다. 하드삭제와 혼동하면 안 된다 | `20260829120000` 5행, 21~55행 |
| **F-M8** | **`public.partner`의 관리자 SELECT 정책 자체가 `has_menu_permission('partner_management','read')`를 요구한다.** 즉 `partner_management:read`가 없는 운영자에게는 연락처가 아니라 **후보 검색 결과 전체가 0행**이다. `get_partner_contact()`는 그 위에 `is_active_admin AND is_aal2 AND partner_management:read AND has_pii_access` 4중 검사를 한다 | `20260829140000` 365~371행, 597~670행 |
| **F-M9** | `audit_log.action`은 고정 CHECK 목록이며, 매 마이그레이션이 **기존 목록 전체를 다시 나열하는 방식**으로 확장해 왔다(`role.create`, `lead.status_change`, `admin_partner.contact_reveal` 등). 목록에 없는 문자열을 넣으면 INSERT가 실패한다 | `20260825160000` 300~318행, `20260829130000` 283~330행 |
| **F-M10** | **역할(role) 카탈로그는 마이그레이션 시드로만 만들어진다**(`super_admin`/`operator`/`viewer` 3종). 런타임 CRUD RPC는 `public.set_role_menu_permission(role_id, menu_id, action, boolean)` **하나뿐**이다 — 즉 "역할 신설 = 마이그레이션", "메뉴×액션 부여 = `/admin/permissions/matrix` 화면"이라는 분업이 이미 확립돼 있다 | `20260825120000` 1864~1869행, `20260825160000` 186~264행 |
| **F-M11** | `partner_management` / `standard_category_management` 메뉴는 **super_admin에게만** 시드돼 있고, 파일 주석이 "operator/viewer에게 줄지는 사람이 결정하도록 일부러 비워뒀다"고 명시한다(INV-4 default deny) | `20260829160000` 21~47행 |
| **F-M12** | `partner_withdraw()`는 `public.partner` 행을 **지우지 않는다**. `private.partner_contact`만 즉시 삭제하고, 개인사업자면 회사정보를 `'[purged]'`로 익명화한다. 함수 주석이 "company-level match rows are kept, only person-level contact PII is purged"를 명시 | `20260904100000` 288~327행 |
| **F-M13** | `partner_consent.consent_type`의 `third_party_share`는 **v1.0 미사용**이고, `get_own_partner_consents()`도 의도적으로 제외한다. 바이어측 `requests.third_party_consent`/`third_party_consented_at`/`third_party_recipient`도 **컬럼만 있고 사용되지 않는다** | `20260904100000` 121~124행, `20260824120000` 127~132행 |

---

## 2. [SP-M1 / G-6 / HM-B1] `closed` 30일 하드삭제 vs Match 장기보존

### 2.1 결정

**후보 (b)를 기본으로 채택하되, (a)는 "차단"이 아니라 "경고"로 축소해 병행한다.** 정확한 규격은 아래 5개 항목이다.

#### (1) FK 정책 — `on delete set null`

```
match.requirement_id                        uuid null references public.requests(id) on delete set null
match_shortlist_confirmation.requirement_id uuid null references public.requests(id) on delete set null
match.partner_id                            uuid not null references public.partner(id) on delete restrict
```

- `cascade` 불채택: 북극성 지표(Match-to-Meeting Rate, Time to Shortlist)의 **유일한 소스가 소멸**하고, 감사 대상 행위(누가 무엇을 근거로 추천했는가)의 기록이 사라진다.
- `restrict` 불채택: **F-M4가 결정적이다.** restrict는 "삭제를 막는다"가 아니라 **"그날의 리텐션 배치 전체를 조용히 죽인다"** — 하드삭제와 12/24개월 익명화가 같은 트랜잭션이므로, Match가 하나라도 걸린 순간부터 **다른 모든 리드의 익명화가 매일 롤백**되고 남는 것은 warning 한 줄뿐이다. 이건 매칭 기능의 버그가 아니라 **개인정보 파기 의무의 전면 중단**이며, 발견까지 몇 달이 걸릴 수 있는 유형의 사고다.
- `match.partner_id`는 restrict가 안전하다 — F-M12대로 파트너 행은 탈퇴해도 삭제되지 않으므로 배치를 막을 일이 없고, 기준선 PR-5 §"연동 확인"의 기존 지시와도 일치한다.

#### (2) 스냅샷 — 넣어야 할 것과 **절대 넣으면 안 되는 것** (HM-B2)

`requirement_id`가 NULL이 되어도 Match가 집계 가능한 데이터로 살아남으려면 스냅샷이 필요하다. 그러나 **스냅샷 범위를 통제하지 않으면 리텐션 정책 자체가 무력화된다.**

| 구분 | 필드 | 판정 |
|---|---|:---:|
| **스냅샷 허용** (비-PII 구조 필드) | `category`(FKP 5종 코드), `vertical`(G-3 해소 후), `country`(G-2 해소 후), `locale`, `english_speaking`, `requirement_created_at`(**월 단위 절삭 권장**), `requirement_status_at_snapshot` | **채택** |
| **스냅샷 금지** (치명적) | `what_looking_for`, `purpose`, `description`, `company_name_website`, `contact`, `private.request_meta.internal_note`, `consent_ip` | **금지** |

금지 사유: 이 7개 필드는 **12/24개월 익명화 배치의 파기 대상 그 자체**다(F-M5). Match에 복사해 두는 순간 배치는 원본만 지우고 사본은 남기게 되며, 그 결과 "12개월 후 파기한다"는 처리방침 문구가 거짓이 된다(법 제21조 파기 의무, 제30조 처리방침 준수). **매칭 판단의 근거를 남기고 싶다면 그것은 원문 복사가 아니라 §3.4.2가 요구한 구조화 태그로 남기는 것이다** — screen-spec §3이 이미 그렇게 설계했다.

> `requirement_id`(uuid) 자체는 그대로 보존해도 된다. 원본 행이 삭제된 뒤의 uuid는 어떤 개인도 식별하지 못한다. **다만 `on delete set null`을 쓰면 uuid도 사라지므로**, 추적용 식별자가 필요하면 `requirement_ref_id uuid`(FK 아님, 값 복사)를 별도로 두라. 이것은 PII가 아니다.

#### (3) `requirement_created_at` 스냅샷은 선택이 아니라 필수

screen-spec §2.2/§6.3의 Time to Shortlist는 `min(confirmed_at) − requests.created_at`으로 정의돼 있다. **원본이 하드삭제되면 이 지표는 계산 자체가 불가능해진다.** 따라서 `match_shortlist_confirmation`에 `requirement_created_at`(월 단위 절삭)을 확정 시점에 **반드시 함께 기록**해야 한다. 이건 개인정보 이슈가 아니라 **북극성 지표가 조용히 계산 불가가 되는 것을 막는 장치**이며, screen-spec §2.2 본문 반영이 필요하다.

#### (4) `closed` 전이는 차단하지 않는다 — 경고 + 감사기록만

`update_lead_status()`(F-M6)에 다음을 추가한다. **하드 차단(exception)은 넣지 않는다.**

```
- p_status = 'closed' 이고 해당 requirement에 match가 1건 이상이면:
    · 정상 수행하되 log_audit의 p_after_summary에 {"status":"closed", "match_count": N} 을 포함
- 프론트(개요 탭 상태변경 폼): 위 조건이면 확인 모달
    "이 요청에는 매칭 후보 N건이 있습니다. 종료하면 30일 뒤 요청 원문이 삭제되고,
     매칭 이력은 식별정보가 제거된 스냅샷으로만 남습니다. 계속하시겠습니까?"
```

후보 (a)의 "Match가 있으면 `on_hold`까지만 허용"을 **불채택하는 이유**:

1. **최소보유 원칙 역행.** `on_hold`의 리텐션은 12개월이다(F-M2). 스팸·오등록·요청 철회 리드에 후보를 한 명이라도 담아본 순간 그 리드의 연락처를 **30일이 아니라 12개월** 보유하게 된다. 파기를 편의로 미루는 구조는 그 자체가 위반 소지다.
2. **"진짜 삭제는 별도 명시적 액션"은 삭제를 사람의 기억에 의존시킨다.** 자동 파기 배치를 두는 이유가 정확히 그 반대다.
3. 기술적으로도 (a)는 `match` 존재 여부를 상태 전이 RPC가 조회해야 해서 결합도가 올라가는데, 얻는 것은 "운영자가 실수로 종료하는 것을 막는" 편의뿐이다. 그 편의는 확인 모달로 충분하다.

#### (5) 하드삭제 시 자유서술 동시 파기 (→ §3과 연결)

`on delete set null`만 걸면 메모는 그대로 남는다. `public.requests`에 **BEFORE DELETE 트리거**를 추가해, 삭제되는 requirement에 연결된 match의 자유서술 4종을 같은 트랜잭션에서 NULL 처리한다. 상세는 §3.3.

### 2.2 화면·문서 영향

| 영향 대상 | 내용 |
|---|---|
| screen-spec §2.1 | `requirement_id`를 nullable + `on delete set null`로, 스냅샷 필드 6종 추가, 금지 필드 목록 주석 |
| screen-spec §2.2 | `requirement_created_at` 스냅샷 필드 추가(Time to Shortlist 생존 조건) |
| screen-spec §9 엣지케이스 9 | "closed 30일 하드삭제가 적용되면 이 예외가 무의미해진다"는 우려는 **해소됨**. 재작성 필요: 원본 삭제 후에도 Match 행은 남지만 **리드 상세 화면이 사라지므로 매칭 탭 경로로는 접근할 수 없다** → 고아 match의 열람 정책 필요(HM-R3) |
| `app/admin/(protected)/leads/[id]/StatusAssigneeForm.tsx` | (4)의 확인 모달 |
| `update_lead_status()` | (4)의 감사 요약 필드 추가 |
| PRD §3.4 / §3.4.2 | "데이터가 Moat"의 실체가 **원문이 아니라 구조화 라벨 + 비식별 스냅샷**이라는 점 명시 권고 |

---

## 3. [SP-M2 / G-8 / HM-B6] Match·Outcome 데이터의 보관·파기 기준

### 3.1 먼저 사실 판정 — Match는 새로운 PII를 만드는가

screen-spec §2의 개념 모델을 필드 단위로 검토한 결과, **"파트너를 참조만 하므로 새 PII가 없다"는 전제는 절반만 맞다.**

| 계층 | 필드 | PII 판정 |
|---|---|---|
| 참조 | `partner_id`, `requirement_id` | **새 PII 아님.** 기준선 PR-1대로 담당자 원문은 `private.partner_contact`에만 있고 Match는 그것을 복사하지 않는다(PR-9의 "Match 테이블은 담당자 PII를 자기 컬럼으로 복사해 갖지 말 것"을 screen-spec이 정확히 지켰다). 단 `partner_id`는 **개인사업자**의 경우 개인정보로 연결되는 식별자다(PR-10) |
| 구조화 | `judge_status`, `selection_tags`, `exclusion_tags`, `is_confirmed_top3`, `confirmed_rank`, `current_outcome_state`, `outcome_state`, `transitioned_at`, `meeting_date` | **개인정보 아님.** 고정 vocabulary와 상태값·시각뿐이라 그 자체로 개인을 식별하지 않는다 |
| **자유서술 4종** | `selection_memo`, `exclusion_memo`, `meeting_note`, `match_outcome_event.note` | **PII가 새로 생긴다.** "김OO 대리와 통화, 다음 주 재연락" 같은 기재는 실무에서 반드시 발생한다. 기준선 **PR-14**가 이미 확인한 "통제 불가능한 개인정보 유입 경로"가 Match에 4개 더 열리는 것 |
| **행위자 식별자** | `added_by_admin_id`, `judged_by_admin_id`, `confirmed_by_admin_id`, `recorded_by_admin_id` + 각 시각 | **개인정보다**(운영자 본인의). 성격상 개인정보취급자의 처리 이력이며, `audit_log`(2년 보관)와 달리 **match 테이블에는 무기한 남는다** |
| 거래정보 | `quote_amount`, `deal_amount`, `deal_flag` | 개인정보 아님. 다만 파트너의 **영업비밀**(HM-R6) |

**결론: Match에 "보관기간 없음"을 통째로 적용하는 것은 채택할 수 없다.** 동시에, 구조화 필드에 12/24개월 같은 상한을 거는 것도 틀렸다 — 개인정보가 아닌 사업 데이터에 파기 의무를 스스로 만들어 북극성 지표를 파괴하는 셈이다. **필드 계층을 나누는 것이 정답이다.**

### 3.2 확정 보관·파기 기준 (기준선 PR-5 표에 이어붙일 것)

| 대상 | 보관기간 | 근거 |
|---|---|---|
| `match` 구조화 필드 + 비-PII 스냅샷 + `partner_id` | **상한 없음(무기한).** 단 **5년마다 보존 필요성 재검토**를 내부관리계획에 기재 | 개인 식별성이 없는 사업 실적 데이터. PRD §1.3 북극성·§3.4.2 Moat의 유일한 소스 |
| `match_shortlist_confirmation` 전체 | **상한 없음** | 위와 동일(`confirmed_by_admin_id`는 아래 행위자 규칙 적용) |
| `match_outcome_event`의 상태·시각 | **상한 없음** | 위와 동일 |
| **자유서술 4종** (`selection_memo`, `exclusion_memo`, `meeting_note`, outcome `note`) | **연결 Requirement의 리텐션 이벤트와 동시에 파기(NULL).** ① `closed` 하드삭제 시 같은 트랜잭션에서, ② 12/24개월 익명화 시 같은 배치에서 | 리드 본문은 지우면서 그 리드에 대한 메모만 남기는 것은 정책 불일치이고, PR-14 유입분이 무기한 존속하게 된다 |
| **고아 match**(`requirement_id is null`)의 자유서술 | **최초 확정일(없으면 `created_at`) + 24개월** 백스톱 | ①②를 못 탄 잔여분 회수 |
| 행위자 식별자 4종 | match 행과 함께 유지. 별도 파기 배치 없음. 해당 `admin_user`가 탈퇴·익명화되면 기존 `admin_user` 규칙을 따름(FK `on delete restrict` 유지) | 감사 귀속 보존. 기준선의 `admin_user` 처리 선례 승계 |
| `match_contact_log` (M-R10, 후속 스코프) | 착수 시 **12개월** 상한. 개인 식별 부분(누구와 통화했는지)은 PR-9의 "회사 단위는 남기고 사람 단위는 지운다" 규칙 적용 | PR-9 |
| Match 관련 `audit_log` | **현행 2년 유지**(변경 없음) | 안전성 확보조치 기준 제8조 |

> **왜 구조화 필드에 상한을 두지 않아도 되는가**: 파기 의무(법 제21조)는 **개인정보**에 붙는다. 위 규칙이 실제로 동작해서 자유서술과 원문 스냅샷이 남지 않는다면, 남는 것은 "어떤 카테고리의 요청에 어떤 회사가 어떤 태그로 추천됐고 미팅까지 갔는가"라는 **법인 단위 사업 통계**다. 통계 목적의 보존이라는 점에서 법 제28조의2(가명정보의 통계작성·과학적 연구 목적 처리)의 취지와도 정합하지만, **v1.0에서는 이 데이터를 "가명정보"로 선언하지 않고 "개인정보 아닌 사업 데이터"로 취급하는 편이 단순하다**(가명정보로 선언하면 처리기간 지정·분리보관·결합 제한 등 별도 의무가 따라붙는다). **이 결론은 위 자유서술 파기 규칙이 실제로 구현될 때만 성립한다** — 구현되지 않으면 Match 전체가 개인정보 파일이 된다. **변호사 검토 필요**(개인사업자 파트너가 다수인 경우 `partner_id` 집합 자체의 식별성 판단).

### 3.3 구현 규격 (backend-developer)

```
1) public.requests BEFORE DELETE 트리거 (신규)
   update public.match set
     selection_memo = null, exclusion_memo = null, meeting_note = null,
     requirement_detached_at = now()
   where requirement_id = old.id;
   update public.match_outcome_event set note = null
   where match_id in (select id from public.match where requirement_id = old.id);
   -- BEFORE DELETE 여야 한다. on delete set null 이 먼저 적용되면 대상을 찾을 수 없다.

2) private.run_requests_retention_batch() 에 블록 추가 (익명화 케이스)
   -- v_anonymized_ids 에 대해 위와 동일한 4종 NULL 처리
   -- (requirement_detached_at 은 세팅하지 않는다 — 원본 행은 살아있다)

3) 신규 배치 private.purge_orphan_match_freetext()  (고아 백스톱)
   -- requirement_detached_at is not null 이거나 requirement_id is null 이고
   -- 기준시각 + 24개월 경과한 match 의 4종 NULL 처리
   -- retention_jobs.job_type CHECK 에 'match_freetext_purge' 추가
   -- private.run_daily_retention_batches() 에 독립 exception 블록으로 추가
      (기존 3개 배치와 동일한 fault-isolation 패턴 — 절대 같은 블록에 합치지 말 것)

4) 컬럼 추가: match.requirement_detached_at timestamptz
```

> **주의**: (3)을 `run_requests_retention_batch()` 안에 넣지 말 것. F-M4의 교훈이 그대로 적용된다 — 배치를 한 트랜잭션에 몰수록 하나의 실패가 전부를 죽인다.

### 3.4 처리방침 반영 (HM-R5)

`docs/legal/privacy-v1.0-{en,ja}.md`의 보유기간 항목에는 현재 매칭 이력이 없다. 바이어에게 "12개월 후 파기"라고 고지해 놓고 그 리드에 대한 운영자 메모가 남아 있으면 **고지 위반**이다. 위 §3.2 확정 후 다음 문구를 추가해야 한다(정확한 번역은 ux-writer/변호사).

> 매칭 이력: 요청 정보의 보유기간이 경과하면 요청 본문·연락처와 함께 해당 매칭에 기록된 자유서술 메모를 파기하며, 개인을 식별할 수 없는 매칭 통계(추천 카테고리, 선정·제외 사유 라벨, 진행 단계)만 서비스 개선 목적으로 보존합니다.

---

## 4. [SP-M3 / G-7 / HM-B3] 매칭 담당 role의 `partner_management:read`

### 4.1 결정: **기존 `partner_management:read`를 번들링한다. 축소 권한 체계는 만들지 않는다.**

#### 근거 1 — 문제의 크기가 screen-spec의 서술보다 크다

screen-spec §6.2/§10은 이 Gap을 "연락처 원문을 못 본다"로 적고 있으나, **F-M8이 보여주듯 `public.partner`의 관리자 SELECT 정책 자체가 `partner_management:read`를 요구한다.** 즉 이 권한이 없는 운영자에게는:

- (a) 후보 검색 패널의 결과가 **항상 0행** — 담을 후보가 없다
- (b) 담은 후보 목록의 회사명·검증상태 조인도 실패
- (c) 연락처는 그 다음 문제

**"연락처만 열어주는 축소 권한"으로는 이 탭이 동작하지 않는다.** 매칭 업무는 본질적으로 파트너 데이터 조회 업무이고, 권한 모델은 그 사실을 반영해야 한다.

#### 근거 2 — 축소 권한 체계는 이 프로젝트가 이미 기각한 설계다

기존 RBAC 리뷰 §8.2는 PII 통제 방식 3안을 비교해 **② 역할 속성(`role.can_access_pii`)** 을 채택하고, **③ 가상 메뉴 코드 분리(`lead_contact` 같은)를 "메뉴 트리가 UI와 어긋나 INV-2를 훼손"한다는 이유로 기각**했다. "매칭 탭 전용 파트너 축소 권한"은 정확히 ③과 같은 형태다. 여기에 더해 축소 권한을 만들면 `public.partner`·`partner_capability`·`partner_standard_category`의 SELECT 정책을 전부 새 조건으로 복제해야 하고, 그 순간 **파트너 데이터 접근 경로가 2개가 되어** 한쪽을 고칠 때 다른 쪽이 조용히 넓어진다.

#### 근거 3 — 번들링이 곧 PII 확대는 아니다

이 프로젝트의 RBAC는 **2축**이다.

```
축 1 (공유): menu × action        → "이 화면을 쓸 수 있는가"
축 2 (사람): role.can_access_pii  → "개인정보 원문을 볼 수 있는가"
```

`partner_management:read`를 줘도 `get_partner_contact()`는 `has_pii_access()`에서 다시 막힌다(F-M8, 4중 검사). **즉 "매칭은 하되 연락처 원문은 못 보는 사람"은 축소 메뉴 권한이 아니라 `can_access_pii=false`인 역할로 이미 표현 가능하다.** 새 축을 만들 이유가 없다.

### 4.2 구체 지시

| # | 지시 | 비고 |
|---|---|---|
| 1 | `operator` 역할에 `partner_management` **`can_read = true`만** 부여 | `create`/`update`/`delete`는 매칭 업무에 불필요(파트너 프로필을 고칠 일이 없다). **`export`는 특히 금지** — 담당자 PII 다발 반출이며 기준선의 export 정책 대상 |
| 2 | 부여 방법은 **마이그레이션 시드가 아니라 `/admin/permissions/matrix` 화면**(`set_role_menu_permission`)에서 super_admin이 수행 | F-M10/F-M11. 20260829160000이 "누구에게 줄지는 사람이 결정한다"는 INV-4 default-deny 원칙을 이미 남겼다. 시드로 박으면 그 결정 기록(감사 `role_menu_permission.change`)이 사라진다 |
| 3 | **단, P4 배포 전 체크리스트에 이 부여를 명시한다**(HM-B3) | 안 그러면 "권한을 안 줘서 기능이 죽었는데 원인을 모르는" 사고가 난다. 권한 모델의 유연성과 배포 안정성을 동시에 얻는 방법은 "시드가 아니라 체크리스트"다 |
| 4 | `viewer`에게는 **주지 않는다** | 매칭은 조회 전용 업무가 아니다. viewer는 `lead_management:read`가 있어 매칭 탭 자체에는 들어올 수 있으므로, **화면이 "권한 없음"과 "결과 없음"을 구분 표시**해야 한다(§4.3) |
| 5 | 새 역할(`matching_operator` 등)은 **지금 만들지 않는다** | 필요해지는 시점은 "매칭만 하는 외주 인력"이 실제로 붙을 때다. 그때 마이그레이션으로 신설하고 matrix에서 `lead_management(read/create/update)` + `partner_management(read)`만, `can_access_pii=false`로 시작하면 된다. 역할 신설에 런타임 CRUD가 없다는 점(F-M10)이 오히려 안전장치다 |

### 4.3 화면 요구 (screen-spec §6.1/§6.2 반영 요청)

매칭 탭 진입 시 프론트가 `get_my_admin_context()`의 메뉴 권한으로 `partner_management:read` 보유 여부를 판정해:

- **미보유**: 검색 패널을 "빈 결과"가 아니라 **"파트너 조회 권한이 없어 후보를 검색할 수 없습니다. 관리자에게 `공급사(파트너) 관리` 읽기 권한을 요청하세요"** 로 표시
- **보유 + `can_access_pii=false`**: 검색·판정·Top3는 정상, 연락처는 마스킹 고정 + 기존 문구("viewer 역할은 원문 열람 불가") 재사용

INV-3("메뉴 숨김은 보안이 아니다")과 충돌하지 않는다 — 이건 통제가 아니라 **오진단 방지용 안내**이며, 실제 차단은 DB 정책이 한다.

### 4.4 잔여 리스크 (수용, 재검토 트리거 명시)

`partner_management:read`에는 **행 단위 범위 제한이 없다**(전체 파트너 목록 열람). E3-R14가 ABAC를 Won't로 두었으므로 MVP 30~50곳 규모에서는 수용한다. **재검토 트리거: 등록 파트너 300곳 초과 또는 외주 매칭 인력 투입.** 그 시점에 RBAC 리뷰 §8.3이 자리를 남겨둔 `role_menu_permission.scope`를 실제로 도입한다.

---

## 5. 스코프 밖이지만 P4 착수 전 처리해야 할 것

### HM-B4 (치명적) — `audit_log.action` CHECK 확장 누락 시 판정 저장이 통째로 실패

screen-spec §10이 정의한 신규 액션 5종(`match.candidate_add`, `match.candidate_remove`, `match.judge`, `match.shortlist_confirm`, `match.outcome_transition`)은 **F-M9의 고정 CHECK 목록에 없다.** 지금 그대로 구현하면 `private.log_audit()`의 INSERT가 CHECK 위반으로 실패하고, 감사와 본작업이 한 트랜잭션이므로 **판정 저장 자체가 롤백**된다. `match` 스키마 마이그레이션과 **같은 파일에서** 기존 선례(introspection 후 전체 목록 재작성) 그대로 확장할 것. screen-spec §10은 액션 설계가 정확하므로 내용 변경은 없고, 누락된 것은 CHECK 확장 단계뿐이다.

### HM-B5 (치명적·운영) — Top3 전달 = 제3자 제공. 현재 동의 근거가 없다

- F-M13: 파트너측 `third_party_share` 동의는 **v1.0 미사용**, 바이어측 `requests.third_party_*` 컬럼도 **미사용**이다. 두 리뷰 모두 "제3자 제공 동의는 인테이크가 아니라 **실제 매칭 시점에 건별로** 받는다"고 확정해 놓았는데, **그 "매칭 시점"이 바로 이 화면이고, 이 화면에는 동의를 받는 장치가 없다.**
- P4 화면 자체에는 전달 기능이 없으므로 코드 blocking은 아니다. 그러나 **운영자가 Top3 확정 후 바이어에게 파트너 담당자 연락처를 이메일로 보내는 순간 제3자 제공이 성립**하고, 파트너 동의 없이 그렇게 하면 위반이다.
- **최소 조치(P4 스키마에 지금 자리를 만들 것)**:
  - `match.third_party_share_consent_at timestamptz` / `third_party_share_consent_method text check in ('online_self','phone','in_person','email')` / `third_party_share_recorded_by_admin_id` — 운영자가 **파트너에게 개별 동의를 받은 사실**을 기록. RPC·화면은 후속.
  - Top3 확정 완료 모달에 경고: "확정된 파트너의 담당자 연락처를 바이어에게 전달하려면 **파트너 개별 동의**가 필요합니다. 동의 없이 전달하지 마세요."
- **ceo-advisor 에스컬레이션 + 변호사 검토 필요**: 실제 소개 프로세스(누가 누구에게 무엇을 보내는가)를 확정하고, 그것이 제3자 제공인지 위탁인지 판단해야 한다. 첫 실매칭 전에 답이 필요하다.

---

## 6. 개선 권고 (non-blocking)

| ID | 내용 |
|---|---|
| **HM-R1** | 메모 입력란 4곳에 인라인 안내: "제3자의 개인정보(담당자 실명·연락처)나 타사 비밀정보를 적지 마세요. 판단 근거는 태그로 남겨주세요." PR-14 승계. 500자 제한(§6.2)은 유지 |
| **HM-R2** | screen-spec §10의 "메모 본문은 감사에 넣지 않는다"를 **RPC 구현 시 재확인**. `p_after_summary`에 태그 배열만 넣고 memo를 실수로 포함하지 않도록 qa 체크 항목화 |
| **HM-R3** | **고아 match(`requirement_id is null`)의 열람 정책**을 service-planner가 정의할 것. 리드 상세가 사라지므로 매칭 탭 경로로는 접근 불가 → 권고: v1.0에서는 **UI를 만들지 않고 집계 쿼리로만 소비**(신규 화면은 새 PII 노출면을 만든다) |
| **HM-R4** | §4.3의 "권한 없음 vs 결과 없음" 구분 표시 |
| **HM-R5** | §3.4의 처리방침 보유기간 문구 추가(문서-실동작 일치, 법 제30조) |
| **HM-R6** | `quote_amount`/`deal_amount`는 파트너 영업비밀이며, 메뉴 단위 RBAC로는 컬럼 통제가 불가능하다(RBAC 리뷰 §8.1). v1.0은 **운영 가이드로 흡수**("확정된 금액만 입력, 추정치·협상 중 금액은 적지 않는다"). 컬럼 단위 통제는 도입하지 않는다 |
| **HM-R7** | **개정 개인정보 보호법이 2026-09-11 시행**(유출 "가능성" 인지 시 72시간 통지, 위조·변조·훼손 추가). Match가 새 PII 저장소가 되지 않도록 유지하는 것(=§2의 스냅샷 금지 목록, §3의 자유서술 파기)이 곧 **통지 대상자 추출을 단순하게 유지하는 수단**이다. Match에 PII를 복사하지 않으면 통지 대상은 `requests`/`partner_contact` 두 곳에서만 뽑으면 된다 |
| **HM-R8** | qa-reviewer 필수 테스트 — §7 |

---

## 7. P4 DoD 추가 게이트 (screen-spec §4.4 / PRD P4 DoD에 병합 요청)

- [ ] `closed` 리드가 30일 경과 후 하드삭제될 때 **배치가 예외 없이 완주**하고, 같은 실행에서 다른 리드의 12/24개월 익명화도 정상 수행됨(F-M4 회귀 방지 — restrict를 실수로 넣었는지 잡는 유일한 테스트)
- [ ] 하드삭제 후 `match` 행이 남고 `requirement_id`가 NULL이며, **자유서술 4종이 전부 NULL**임
- [ ] 하드삭제 후에도 `match_shortlist_confirmation.requirement_created_at`으로 **Time to Shortlist가 계산 가능**함
- [ ] `match` 어느 컬럼에도 `what_looking_for`/`purpose`/`description`/`company_name_website`/`contact` 값이 복사되어 있지 않음(스키마 전수 확인)
- [ ] 12/24개월 익명화가 발생한 리드의 match 자유서술도 같은 배치에서 NULL 처리됨
- [ ] `partner_management:read`가 **없는** operator 세션에서 매칭 탭 진입 시 후보 검색 0행 + "권한 없음" 안내가 뜸(빈 결과 문구가 아님)
- [ ] `partner_management:read`는 있고 `can_access_pii=false`인 세션에서 연락처 원문 열람이 거부되고 `admin_partner.contact_reveal` **denied**가 감사로그에 남음
- [ ] `match.*` 신규 액션 5종이 `audit_log`에 실제로 INSERT됨(CHECK 확장 확인 — 안 하면 판정 저장이 전부 실패)
- [ ] 판정 저장 감사기록에 **메모 본문이 들어 있지 않음**
- [ ] `retention_jobs`에 `match_freetext_purge` 실행 증적이 남음
- [ ] Top3 확정 모달에 제3자 제공 경고 문구가 노출됨(HM-B5)

---

## 8. 변호사 검토 필요 항목

1. **§3.2 구조화 필드 무기한 보존**의 적법성 — 특히 개인사업자 파트너 비중이 높아질 경우 `partner_id` 집합 자체의 식별성 판단, 그리고 이를 가명정보(법 제28조의2)로 선언하지 않고 "개인정보 아닌 사업 데이터"로 취급하는 것의 타당성.
2. **HM-B5 제3자 제공** — 운영자가 바이어에게 파트너 담당자 연락처를 전달하는 행위의 법적 성격(제3자 제공 vs 위탁), 필요한 동의 항목·고지 사항, 구두 동의 기록의 증명력.
3. **§2-(4) `closed` 전이 비차단** 결정이 파기 의무와 기록 보존 의무 사이에서 적절한 균형인지.
4. 2026-09-11 시행 개정법의 **유출 통지 72시간** 기준이 본 서비스 규모에 적용되는 방식(시행령 확인 포함).

---

## 9. 참고

**코드**
- `supabase/migrations/20260824120000_phase1_requests_pipeline.sql` §7(리텐션 트리거), §3(`private.request_meta`)
- `supabase/migrations/20260825120000_phase3_admin_rbac.sql` §14~§15(리텐션 배치·pg_cron), §16(role/menu 시드)
- `supabase/migrations/20260825160000_phase3_permission_management_crud.sql`(`update_lead_status`, `set_role_menu_permission`, `audit_log.action` CHECK)
- `supabase/migrations/20260829140000_partner_schema.sql` §4(partner RLS), §6(`get_partner_contact`)
- `supabase/migrations/20260829160000_partner_category_menu_seed.sql`(메뉴 시드 범위 주석)
- `supabase/migrations/20260904100000_supplier_app_privacy_fixes.sql`(`partner_withdraw` step 8, `third_party_share` 제외 주석)

**문서**
- [`human-matching.screen-spec.md`](../02-design/features/human-matching.screen-spec.md)
- [`partner-signup-privacy-review.md`](./partner-signup-privacy-review.md) — PR-1/PR-5/PR-9/PR-14
- [`partner-supplier-app-ui-privacy-review.md`](./partner-supplier-app-ui-privacy-review.md)
- [`fkp-v0.2-privacy-review-phase3-rbac.md`](../01-plan/features/fkp-v0.2-privacy-review-phase3-rbac.md) §8.1~§8.4(RBAC 2축 설계·③안 기각), §9(INV-2/INV-3)
- [`seepn-unified-platform-v1.0.prd.md`](../01-plan/features/seepn-unified-platform-v1.0.prd.md) §1.3(북극성), §3.4/§3.4.2

**법령 (조문 번호는 확인용이며 최신 개정 반영 여부는 별도 확인 필요)**
- 개인정보 보호법 제15조·제17조(제3자 제공)·제20조·제21조(파기)·제22조·제28조의2(가명정보)·제29조·제30조
- [개인정보 보호법 제28조의2 — 국가법령정보센터](https://www.law.go.kr/LSW//lsSideInfoP.do?lsiSeq=270351&joNo=0028&joBrNo=03&docCls=jo&urlMode=lsScJoRltInfoR)
- [가명정보의 처리 등 — 찾기쉬운 생활법령정보](https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=1257&ccfNo=2&cciNo=4&cnpClsNo=1)
- [2026년 개정 개인정보 보호법 — 2026.9.11 시행, 유출 72시간 통지](https://datalaw.kr/guides/pipa-2026-amendment/)
- [개인정보 보호법 시행령 개정안 입법예고(2026.6.2~7.13) — 법률신문](https://www.lawtimes.co.kr/news/articleView.html?idxno=221600)
- [개인정보 유출시의 조치방안 — 찾기쉬운 생활법령정보](https://www.easylaw.go.kr/CSP/CnpClsMain.laf?csmSeq=1257&ccfNo=3&cciNo=2&cnpClsNo=3)

---

## Version History

| Version | Date | Changes | Author |
|---|---|---|---|
| 1.0 | 2026-09-06 | 최초 작성 — SP-M1(FK `on delete set null` + 비-PII 스냅샷 + 전이 경고, restrict가 리텐션 배치 전체를 죽인다는 코드 근거 F-M4 확인), SP-M2(필드 계층별 이원 보관기간, 자유서술 4종을 Requirement 리텐션과 동조 파기), SP-M3(`partner_management:read` 번들링 채택 — 후보 검색 자체가 이 권한을 요구한다는 F-M8 확인) 확정. blocking 6건(HM-B1~B6)·권고 8건(HM-R1~R8)·DoD 게이트 11항 제시. SP-M4/SP-M5는 스코프 제외 | privacy-security-officer |
