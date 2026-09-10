# SEEPN 바이어 웹(P5a) — 개인정보/보안 사전검토

| 항목 | 내용 |
|---|---|
| 대상 | P5a — SEEPN 바이어 계정 시스템 + 파트너 공개 목록/상세 + 관심등록 + 운영자 문의 |
| 근거 문서 | `docs/01-plan/features/seepn-unified-platform-v1.0.prd.md` (D-3′, D-12, D-13, §3.1.4~3.1.6, §4.4 P5a DoD, §7 SP-11~14), `docs/02-design/features/seepn-buyer-web-p5a.screen-spec.md` (§0.3 GAP-1~6, §11 PSO-1~5) |
| 선행 검토 | `docs/03-security/partner-signup-privacy-review.md` (PR-1~PR-16, 이하 "파트너 검토"), `partner-supplier-app-ui-privacy-review.md`, `notice-board-privacy-review.md` |
| 작성자 | privacy-security-officer |
| 작성일 | 2026-09-10 |
| 게이트 | PRD §7.1 승인게이트 6 / §4.4 P5a DoD 1번 항목 — **backend-developer 착수 전 필수** |
| 이 문서가 하지 않는 것 | 법률 자문(변호사 검토 필요 항목은 명시), 마이그레이션 SQL 확정본 작성, 화면 UX 결정 |

---

## 0. 결론 요약

### 0.1 판정

> **backend-developer 착수 가능. 단 아래 §0.2의 14건은 스키마 첫 줄과 함께 반영되어야 하고, 그중 3건(BP-3 / BP-9 / BP-10)은 "가입 화면을 실사용자에게 여는 시점"의 절대 차단 조건이다.**

service-planner가 §0.3에서 발견한 GAP-1 / GAP-2는 **둘 다 사실로 확인됐고, 둘 다 설계 변경으로 해소해야 한다**(§2, §3). 다만 GAP-1은 "지금 위법한 노출이 일어나고 있다"는 성격이 아니라 **"우리가 있다고 말하는 통제가 실제로는 없다"**는 성격이다 — 그 구분을 §2.2에 명시했다.

동시에, service-planner가 확인해 준 좋은 소식이 하나 있다: **`partner_public` 뷰는 PR-1(담당자 연락처 마스킹) / B-9c′(사업자등록번호 검색 금지)를 이미 구조적으로 지키고 있다.** 마스킹이 아니라 **컬럼 자체가 뷰에 없다.** 이건 P5a에서 새로 만들 두 뷰에서도 그대로 유지되어야 한다(§2.3).

### 0.2 배포 전 필수 (blocking)

| ID | 이슈 | 위험도 | 게이트 |
|---|---|:---:|---|
| **BP-1** | `partner_public`이 anon에게 상세 전용 필드까지 전부 grant — 목록/상세 뷰 분리 필요 (GAP-1 / PSO-1 / DoD ①) | **주요** | 스키마 |
| **BP-2** | `partner_standard_category`에 공개 읽기 경로 부재 — 카테고리 필터 구현 불가 (GAP-2 / PSO-2) | **주요** | 스키마 |
| **BP-3** | Supabase Auth "Allow new users to sign up"을 바이어 가입을 위해 켜면 **파트너·관리자 축까지 동시에 열리고 PR-12 통제가 무력화**된다 | **치명적** | 배포 |
| **BP-4** | `auth_principal` 3번째 값 + **`audit_log.actor_kind` / `action` 화이트리스트 확장** — 안 하면 INQ-7 감사 기록이 런타임 예외로 실패하거나 바이어 행위가 `system`으로 오귀속된다 | **주요** | 스키마 |
| **BP-5** | `buyer_account` 최소수집 확정 — 전화번호·생년월일·회사명·직함 **수집 금지** | **주요** | 스키마 |
| **BP-6** | `seepn_inquiry` 본문 자유텍스트의 PII 유입 — 입력 경고 + **Admin 목록 본문 미리보기 금지** + 열람 감사 (INQ-4 / PSO-3 / DoD ⑤) | **주요** | 스키마+화면 |
| **BP-7** | 운영자가 문의를 파트너에게 전달할 때 **바이어 식별정보를 넘기면 제3자 제공**이다 — v1.0 운영 규칙 + `third_party_share` 자리만 확보 | **주요** | 스키마+운영 |
| **BP-8** | 문의 레이트리밋(INQ-6)을 얇은 서버 라우트에 두면 **RPC 직접 호출로 우회된다** — RPC 내부 카운트로 구현 | **주요** | 스키마 |
| **BP-9** | 동의를 받는 로케일에 **약관/처리방침 문서가 실제로 존재해야 한다.** "ko fallback + 번역 준비 중"으로 실서비스 가입을 열 수 없다 (screen-spec §3.2 임시처리) | **치명적** | 가입 오픈 |
| **BP-10** | SEEPN 바이어 전용 이용약관·개인정보처리방침 **신규 작성 필수** (PSO-4 / DoD ④). 파트너 문서·FKP 문서 어느 쪽도 대체 불가 | **주요** | 가입 오픈 |
| **BP-11** | 파트너 원문 자동번역(TR-4″-2)을 P5a에서 켜지 말 것 — 켜는 순간 **신규 국외이전이 발생**하고 미검토 상태다 | **주요** | 범위 경계 |
| **BP-12** | `capability_completeness_pct`(완성도순 정렬)를 공개면에 노출하려면 **파트너 동의 고지 갱신이 선행**한다 — 기본 권고는 P5a에서 제외 | **주요** | 스키마+PM |
| **BP-13** | 관심등록(bookmark)은 **바이어 탈퇴 시 즉시 하드 삭제**, 파트너에게는 **집계값만** 제공 (PSO-5) | **주요** | 스키마 |
| **BP-14** | 바이어 인증 서버 클라이언트를 `@supabase/ssr` 기본 쿠키 어댑터로 새로 짜지 말 것 — `/supplier`의 우회 패턴을 처음부터 복제 (GAP-6, 안정성) | **주요** | 구현 |

### 0.3 권고 (non-blocking)

BP-15 ~ BP-21. §10에 정리.

> **[2026-09-10 추가] BP-26 / BP-27 (위험도 권고, 배포 차단 아님)** — GAP-C1(문의 1~5건 다중 참조, `20260910180000`) 재검토에서 나왔다. **§5.3(h)**에 정리했다. 요지: **BP-26** 바이어 전체 레이트리밋이 "문의 건수" 기준이라 실질 파트너 도달량이 최대 5배 — 참조 수 합계 기준 보조 한도 권고, **BP-27** Admin 상세의 "파트너에게 식별정보 전달 금지" 배너에 다중 전달처(최대 5곳) 취지 반영 권고. **§5.3(h)의 결론: 이번 확장은 본문 열람 주체를 넓히지 않으며, 문의 대상 파트너 게이트는 오히려 강화됐다.**

> **[2026-09-10 추가] BP-22 ~ BP-24 (위험도 주요, P5a 차단 아님)** — D-14① 이행 과정(유출 대응 절차·내부관리계획 신규 작성)에서 발견됐다. **§12 ceo-advisor 섹션의 결정 ① 블록**에 표로 정리했다. 요지: **BP-22** 유출 통지 대상자 추출 함수 부재(P5a에서 사전 구현), **BP-23** 권한 변경 이력이 2년에 일괄 삭제되어 법정 3년 미달, **BP-24** 파기 배치의 pg_cron 등록 여부 미확인(처리방침은 이미 "매일 1회 자동 파기"를 공개 중).
>
> **[2026-09-10 추가] BP-25 (위험도 주요, 조치 완료)** — 변호사 검토 큐 항목을 파트너 처리방침에 추기하려다 발견했다. **`docs/legal/partner-{privacy,terms}-v1.0-2026-09-ko.md` 말미의 "변호사 검토 필요 항목" 절이 `/supplier/legal/{privacy,terms}` 페이지에 그대로 렌더되고 있었다** — `components/supplier/SupplierLegalPage.tsx`가 파일 전체를 읽어 `lib/legal/renderMarkdown.tsx`에 넘기며, 절을 잘라내는 로직이 없다. 즉 **"이 조항의 적법성을 아직 확신하지 못한다"는 내부 메모가 파트너에게 공개**되고 있었다. 두 문서에서 해당 절을 제거하고 **`docs/03-security/legal-review-queue.md`(내부 문서)로 이관**했다. 제거한 것은 **부칙 이후의 부속 메모**이므로 동의 대상인 본문(제1조~부칙)은 불변이고 버전 문자열도 올리지 않는다 — **다만 "발행 문서 제자리 수정 금지" 원칙의 예외 적용이므로 qa-reviewer 확인 항목**이다. 앞으로 `docs/legal/*.md`에는 **대외 공개 가능한 내용만** 넣는다(신규 작성할 `seepn-buyer-*` 문서 포함).

### 0.4 이 검토가 뒤집지 않는 것

- **D-3′ / D-12 / D-13의 제품 결정 전부.** 목록 비로그인·상세 로그인, 검색·정렬 도입, 관심등록·문의 3종 액션은 대표 확정 사항이며 본 검토는 그 **구현 방식**만 다룬다.
- **D-13②(최소 개수 게이트 없음).** 공개 파트너가 0곳이어도 화면을 여는 것은 개인정보 관점에서 아무 문제가 없다 — 오히려 노출 대상이 적을수록 안전하다.
- **service-planner의 OQ-B2 권고(접근통제 게이트).** §2.2에서 이를 **채택**한다.
- **service-planner의 OQ-B5 권고(연락처는 이메일만).** §5.1에서 **채택**한다.
- **service-planner의 OQ-B12 권고(비공개 전환된 파트너의 찜을 유지).** §7.2에서 개인정보 이슈 없음으로 **확인**한다.
- **`partner_set_public_listing`의 3계층 게이트.** PRD §4.3.1이 확인한 대로 이미 구현되어 있고, P5a는 **이 RPC를 우회하는 어떤 경로도 만들지 않는다.**

---

## 1. 이 검토가 근거로 삼은 코드 사실

service-planner의 GAP 목록을 그대로 믿지 않고 마이그레이션 원문을 직접 확인했다. backend-developer가 잘못 알기 쉬운 지점만 적는다.

| # | 확인한 사실 | 위치 |
|---|---|---|
| F-1 | `public.partner_public` 뷰의 SELECT 목록은 **29개 컬럼**이며, `grant select on public.partner_public to anon, authenticated;`가 실재한다 | `20260829140000_partner_schema.sql` §11 (뷰 정의 ~L1700, grant ~L1743) |
| F-2 | 그 뷰에 **담당자 연락처 계열 컬럼(`contact_*`, `contact_*_masked`)·`business_registration_number`·`representative_name`·첨부파일 정보가 하나도 없다.** 마스킹이 아니라 부재 — 뷰 주석이 "NO contact columns exist in this view AT ALL, by construction, not by masking"라고 명시 | 동 파일 §11 |
| F-3 | 뷰는 `security_invoker`를 설정하지 **않았다** → 소유자 권한으로 실행되며, **WHERE 절(공개 3계층 게이트)이 유일한 보안 경계**다. 이 성질 덕분에 뷰 본문에 판정 함수를 넣는 방식이 성립한다(§2.4) | 동 파일 §11 주석 |
| F-4 | `partner_public`에 `created_at` / `capability_completeness_pct`가 **없다**(GAP-3 사실 확인) | 동 파일 §11 |
| F-5 | `public.partner_standard_category`는 `revoke all ... from anon, authenticated` 후 `grant select ... to authenticated`만 있고, SELECT 정책은 `_self_select`(파트너 본인) / `_admin_select`(관리자) **2개뿐**이다. **anon 경로 0건, 바이어 경로 0건**(GAP-2 사실 확인) | `20260829150000_standard_category_schema.sql` §3 |
| F-6 | 반면 `standard_category` / `standard_category_translation`은 **이미 anon에게 열려 있다**(`is_active=true` / `status='published'`). 즉 **카테고리 마스터 트리 자체는 공개 자산이고, 부족한 것은 "파트너↔카테고리 연결"뿐**이다 | 동 파일 §1, §2 |
| F-7 | `private.is_active_admin()`은 `admin_user`만, `private.is_active_partner()`는 `partner_account`만 읽는다. **3번째 principal이 생겨도 이 두 함수는 오판정하지 않는다** — 파트너 검토 §2.3의 결론이 그대로 유효 | `20260825120000` §, `20260829130000` §5 |
| F-8 | `public.auth_principal.principal_kind`의 CHECK는 `in ('admin','partner')`로 **하드코딩**되어 있고, `admin_user`/`partner_account`가 복합 FK로 물려 있다 | `20260829130000_partner_auth_foundation.sql` §1 |
| F-9 | `public.audit_log.actor_kind` CHECK는 `in ('admin','partner','system','anon')`이고, `private.log_audit()`의 판정은 `admin → partner → **else 'system'**`이다. **바이어 행위는 지금 그대로 두면 `system`으로 기록된다** | 동 파일 §4, §5 |
| F-10 | `public.audit_log.action`은 **전체 목록을 나열하는 CHECK 화이트리스트**이며, 마이그레이션마다 전체를 재선언하는 관례다. **목록에 없는 action으로 `log_audit`을 부르면 CHECK 위반으로 예외가 난다** | `20260908100000_standard_category_translation_ai_guard.sql` L190~ (최신본) |
| F-11 | `public.partner`에는 `grant select on public.partner to authenticated`가 있으나, RLS 정책 4개가 전부 `is_active_partner()+owns_partner()` 또는 `is_active_admin()+is_aal2()+has_menu_permission`이므로 **바이어 세션은 0행**이다 | `20260829140000` §4 |
| F-12 | `content_item_public_select`는 `to anon, authenticated using (is_active = true)`이며 **`target_audience` 조건이 없다.** 즉 `target_audience='partner'` 공지는 지금도 anon이 REST로 읽을 수 있다(공지 검토가 "DISPLAY filter, not access-control axis"로 이미 확정한 사항) | `20260829130000` §6, `20260908110000_notice_board_core.sql` |
| F-13 | `partner_public`을 **런타임에 SELECT하는 앱 코드는 0건**이다. 유일한 참조는 `lib/supplier/publicListingDisclosure.ts`의 **주석과 파생 상수**(파트너에게 "무엇이 공개되는가"를 보여주는 문구) | `lib/supplier/publicListingDisclosure.ts` |
| F-14 | `middleware.ts`의 matcher는 `['/', '/admin/:path*', '/supplier/:path*']`이고, `/admin`·`/supplier` 분기에만 `Cache-Control: no-store`가 붙는다. `/seepn`은 어느 쪽에도 걸리지 않는다 | `middleware.ts` L137~162 |

> **F-13이 중요한 이유**: `partner_public`을 지금 **삭제하거나 재정의해도 런타임 회귀가 없다.** "이름은 `_public`인데 anon에게는 안 열려 있는 뷰"를 남겨두는 것이 오히려 함정이므로, §2.4는 **뷰를 남기지 말고 새 이름 2개로 교체**할 것을 권고한다.

---

## 2. BP-1 — GAP-1 / PSO-1: 목록·상세 뷰 분리

### 2.1 사실관계 (재확인 완료)

service-planner의 지적은 정확하다. 현재 상태에서 **anon 키만으로** 아래가 성립한다.

```
GET /rest/v1/partner_public?select=*        → 공개 대상 파트너 전체를 한 번에 덤프
GET /rest/v1/partner_public?id=eq.<uuid>    → 로그인 없이 상세 데이터 전량
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY`는 정의상 브라우저 번들에 실려 있으므로 "키를 모르니 괜찮다"는 방어는 성립하지 않는다.

### 2.2 [판정] 이것은 "위법한 노출"이 아니라 "없는 통제"다 — 그러나 고쳐야 한다

정직하게 구분한다. 두 가지를 섞으면 심각도를 잘못 잡는다.

| 관점 | 판정 | 근거 |
|---|---|---|
| **동의 범위를 넘는 공개인가** | **아니다** | `docs/legal/partner-privacy-v1.0-2026-09-ko.md` §7이 "공개되는 정보"로 회사소개·대표 제품/서비스·역량정보(제품/서비스 상세)를 **이미 명시**하고 있고, 파트너는 `public_listing` **선택 동의**로 이를 승낙한 뒤에만 뷰에 나타난다(3계층 게이트). 즉 지금 anon에게 보이는 필드 집합은 **파트너가 "공개"에 동의한 바로 그 집합**이다 |
| **제품 결정과 구현이 일치하는가** | **아니다** | D-3′와 P5a DoD가 "비로그인 상태로 상세 URL 직접 접근 시 차단"을 요구한다. 지금 구조로는 **Next.js 페이지 가드만이 통제**이고 REST로 우회된다. **"통제가 있다"고 문서에 적고 실제로는 없는 상태로 배포**하는 것이 문제다 |
| **수집·노출 최소화 원칙에 맞는가** | **아니다** | `company_intro_text`(≤5,000자)·`reference_projects`(jsonb)·`export_record`·`sample_terms`는 **자유서술 필드**이고, PR-14가 이미 "제3자 개인정보(클라이언트사 담당자명 등)가 들어올 수 있다"고 판정한 바로 그 유형이다. 입력 화면에 경고 캡션이 실제로 붙어 있음은 확인했으나(`CapabilityForm.tsx` L316, `BasicInfoForm.tsx` L344), **캡션은 예방 장치이지 보장이 아니다.** 파트너 200~500곳 규모에서 이 필드들이 **비로그인 대량 수집(스크래핑) 대상**이 되는 것은 목적 범위 밖이다 |

> **따라서 위험도 = 주요(배포 전 필수).** 치명적으로 올리지 않는 이유는 첫 번째 행(동의 범위 내) 때문이고, 권고로 내리지 않는 이유는 두 번째·세 번째 행 때문이다.

**OQ-B2 답변 — 접근통제 게이트로 확정한다.** service-planner 권고를 채택한다. 근거는 위 표의 3번째 행이다. "로그인 필요"를 UX 장치로만 두면 자유서술 필드가 비로그인 벌크 수집면으로 남고, 그건 파트너 동의 §7의 목적("해외 바이어가 귀사를 찾을 수 있도록")과 어긋난다.

> **지금 당장 확인할 것 (backend-developer 1순위)**: 위 상태는 P5a와 무관하게 **이미 프로덕션에 열려 있다.** `select count(*) from public.partner_public`을 실행해 현재 공개 대상 행 수를 확인하라. 0이면 실질 노출은 없었으므로 P5a 배포와 함께 정리하면 되고, 0이 아니면 BP-1을 **P5a와 분리해 먼저 반영**할 것을 권고한다.

### 2.3 PR-1 / B-9c′ 준수 여부 — 확인 결과 **합격**

과제 지시에 포함된 확인 항목이다. 결과는 좋다.

| 확인 항목 | 결과 |
|---|---|
| 담당자 이름/직함/이메일/전화가 `partner_public`에 있는가 | **없다.** `private.partner_contact`에만 존재하고, 마스킹 캐시(`contact_*_masked`)조차 뷰 SELECT 목록에 없다 |
| `business_registration_number`가 있는가 | **없다.** → B-9c′("공개 검색에서 사업자번호 제외")가 **필터가 아니라 구조로** 달성된다. 공개 검색은 `company_name_ko`/`company_name_en` 2개 컬럼만 대상으로 하면 되고, 실수로 포함할 컬럼 자체가 없다 |
| `representative_name`(개인사업자면 PII, PR-10)이 있는가 | **없다** |
| 첨부 파일(`partner_document`) 정보가 있는가 | **없다.** Storage RLS도 파트너 본인/관리자만 |
| `collection_source_detail` / `rejection_reason` / `verification_state` / `consent_deadline_at` 같은 내부 운영 필드가 있는가 | **없다** |

> **신규 뷰 2개는 이 성질을 반드시 승계해야 한다.** 아래 §2.4의 컬럼 배분표에 없는 컬럼은 **"아직 안 넣었다"가 아니라 "넣으면 안 된다"**로 읽을 것. 특히 `partner.*`를 `select p.*`로 받는 형태의 뷰를 절대 만들지 말 것 — 그 순간 `contact_*_masked` 3개와 `business_registration_number`가 공개면에 딸려 나간다.

### 2.4 [확정 설계] 3계층 게이트를 단 한 번만 쓰는 3-뷰 구조

**핵심 원칙: 공개 3계층 게이트(`public_listing_state='on'` AND `verified` AND 최신 `public_listing` 동의 granted AND 미탈퇴)를 두 뷰에 손으로 복제하지 말 것.** 복제하면 반드시 한쪽만 고치는 날이 온다. 게이트를 **비공개 스키마의 베이스 뷰 1개**에 두고, 공개 뷰 2개가 그것을 참조한다.

```
private.partner_public_base      -- 게이트 + 전체 컬럼. GRANT 없음(anon/authenticated 접근 불가)
   ├── public.partner_list_public    -- 목록 컬럼만. grant to anon, authenticated
   └── public.partner_detail_buyer   -- 전체 컬럼 + is_active_buyer() 조건. grant to authenticated만
```

**(1) `private.partner_public_base`** — 현재 `partner_public`의 WHERE 절을 **한 글자도 바꾸지 말고** 그대로 옮긴다(qa-reviewer가 2026-08-30에 넣은 `pa.status <> 'withdrawn'` 중복 방어선 포함). SELECT 목록도 현재 29개 컬럼 그대로 + `created_at`, `capability_completeness_pct`(GAP-3). GRANT는 **하지 않는다.**

**(2) `public.partner_list_public`** (비로그인 열람)

| 컬럼 | 쓰임 |
|---|---|
| `id` | 상세 링크, 찜 키 |
| `company_name_ko`, `company_name_en` | 카드 표시 + B-9a′ 회사명 검색 |
| `location_region` | 지역 필터 + 카드 배지 |
| `vertical` | 버티컬 필터 + 카드 배지 |
| `service_types` | 서비스유형 필터 + 카드 배지 |
| `supported_languages` | 대응언어 필터 + 카드 배지 |
| `overseas_experience` | 해외경험 필터 (boolean만) |
| `created_at` | 최신순 정렬 (GAP-3) |

```sql
grant select on public.partner_list_public to anon, authenticated;
```

**(3) `public.partner_detail_buyer`** (로그인 필요)

`private.partner_public_base`의 **전체 컬럼** + 아래 한 줄이 추가된다.

```sql
create or replace view public.partner_detail_buyer as
  select b.* from private.partner_public_base b
  where (select private.is_active_buyer());   -- 계층 0: 신규

revoke all on public.partner_detail_buyer from anon, authenticated;
grant select on public.partner_detail_buyer to authenticated;   -- anon에는 절대 grant 금지
```

```sql
drop view public.partner_public;   -- F-13: 런타임 참조 0건
```

### 2.5 왜 `grant to authenticated`만으로는 부족하고 `is_active_buyer()`가 필요한가

"로그인했으면 된다"로 끝내지 않는 이유는 **목적 제한(법 제15조)** 때문이다. 파트너가 `public_listing`에 동의할 때 처리방침 §7이 제시한 목적은 **"해외 바이어가 귀사를 찾을 수 있도록 하기 위함"**이다. `authenticated`에만 grant하면 **경쟁 파트너 계정이 경쟁사 디렉터리 전체를 벌크로 읽을 수 있고**, 이는 파트너가 동의한 목적이 아니다.

`private.is_active_buyer()`를 뷰 본문 조건으로 두면:
- anon → false → **0행** (grant 자체도 없으므로 이중 차단)
- 파트너 세션 → `buyer_account` 행 없음 → **0행**
- 관리자 세션 → **0행** (관리자는 `/admin/partners`라는 자기 경로가 이미 있다)
- 바이어 세션(active + 이메일 인증) → 정상

F-3에 따라 뷰는 소유자 권한으로 실행되지만 `auth.uid()`는 요청별 JWT 클레임에서 읽히므로 이 방식은 정상 동작한다. 함수는 `is_active_partner()`와 **동일 규격**으로 만들 것:

```sql
create or replace function private.is_active_buyer(p_auth_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.buyer_account ba
    join auth.users u on u.id = ba.auth_user_id
    where ba.auth_user_id = p_auth_uid
      and ba.status = 'active'
      and u.email_confirmed_at is not null
  );
$$;
```

> **금지 사항 (중요)**: 같은 목적을 **`public.partner`에 바이어용 RLS 정책을 추가**해서 달성하려 하지 말 것. `grant select on public.partner to authenticated`가 **테이블 전체 컬럼 대상**이므로(F-11), 바이어를 통과시키는 SELECT 정책을 하나라도 붙이는 순간 `business_registration_number`, `contact_name_masked`, `contact_email_masked`, `contact_phone_masked`, `verification_state`, `collection_source_detail`, `rejection_reason`이 **전부 바이어에게 열린다.** 뷰 경로만 쓸 것.

### 2.6 BP-12 — 완성도순 정렬은 공개면에 넣지 않는다 (기본 권고)

`capability_completeness_pct`는 개인정보가 아니지만, **파트너 동의 고지(`처리방침 §7` / `PUBLIC_LISTING_EXPOSED_FIELDS`) 목록에 없는 파생 평판 지표**다. 뷰에 넣으면 화면에 숫자를 안 띄워도 REST로 읽히므로 사실상 공개다.

| 선택지 | 판정 |
|---|---|
| A. P5a 정렬을 **최신순 / 회사명순 2종**으로 시작 | **권고.** GAP-4로 "검증우선"이 이미 빠져 정렬 옵션은 어차피 재정의 중이다. 완성도는 파트너에게 입력을 독려하는 **내부 지표(SS-7)**이지 바이어의 선택 기준이 아니다 |
| B. 완성도순을 넣는다 | 가능하되 **선행 조건 3건**: ① `partner-privacy-*-ko.md` §7 "공개되는 정보"에 항목 추가 ② `PUBLIC_LISTING_EXPOSED_FIELDS` 갱신 ③ 기존 공개 동의 파트너에게 변경 고지. 비용이 정렬 옵션 하나의 가치를 넘는다 |

**동일 논리의 예외 처리**: `created_at`(등록일)도 §7 목록에 없지만 **A안을 택하더라도 최신순 정렬에는 필요**하다. 등록일은 평판 신호가 아니라 중립 사실이고 위험이 낮으므로 **허용하되, `PUBLIC_LISTING_EXPOSED_FIELDS`에 "SEEPN 등록일" 한 줄을 추가**하라. → BP-20.

### 2.7 BP-20 — `publicListingDisclosure.ts`를 3버킷으로 재구성

지금 이 상수는 **"공개 / 비공개" 2버킷**이다(F-13). 뷰가 둘로 갈리면 파트너에게 하는 설명도 3버킷이어야 한다.

| 버킷 | 내용 |
|---|---|
| 누구나(비로그인) 볼 수 있는 정보 | 회사명(국/영문), 소재지(시/도), 버티컬, 서비스유형, 대응 언어, 해외거래 경험 유무, SEEPN 등록일 |
| **SEEPN 로그인 회원에게만** 보이는 정보 | 설립연도, 임직원 규모, 홈페이지, 해외거래 국가, 회사소개, 대표 제품/서비스, 보유 인증, 역량 상세(제품/서비스), 레퍼런스 프로젝트, 표준 카테고리 |
| 공개되지 않는 정보 | 담당자 이름·직함·이메일·전화번호, 대표자명, 사업자등록번호, 첨부한 증빙 문서 |

이 3버킷은 **파트너 처리방침 §7과 SUP-13 공개 전환 화면 양쪽에 동일하게** 반영되어야 한다. 파트너가 "공개"를 켤 때 **정확히 무엇이 어디까지 보이는지**가 동의의 내용이기 때문이다.
→ frontend-developer(SUP-13) + 법무 문서(§8) 동시 작업 항목.

---

## 3. BP-2 — GAP-2 / PSO-2: 카테고리 공개 읽기 경로

### 3.1 사실관계 (재확인 완료)

F-5/F-6 그대로다. **카테고리 마스터(`standard_category`, `standard_category_translation`)는 이미 anon 공개**이고, 없는 것은 **"어떤 파트너가 어떤 카테고리에 속하는가"라는 연결 정보**뿐이다. 따라서 신규 노출면은 생각보다 작다.

### 3.2 [확정 설계] `partner_category_public`

**§2.4의 베이스 뷰에 조인하는 것이 핵심**이다. 3계층 게이트를 여기에 다시 손으로 쓰면 "카테고리 필터에는 걸리는데 목록에는 안 나오는 파트너" 같은 드리프트가 생긴다.

```sql
create or replace view public.partner_category_public as
  select psc.partner_id, psc.standard_category_id
  from public.partner_standard_category psc
  join private.partner_public_base b on b.id = psc.partner_id;

grant select on public.partner_category_public to anon, authenticated;
```

| 검토 항목 | 판정 |
|---|---|
| 노출 컬럼 | `partner_id`, `standard_category_id` **2개만**. `created_at`(파트너가 언제 그 카테고리를 골랐는가)은 뺀다 — 쓰임이 없다 |
| 개인정보 해당성 | **없음.** 둘 다 uuid이고, `partner_id`는 이미 `partner_list_public`에 있으며 `standard_category_id`는 anon 공개 마스터의 PK다 |
| 3계층 게이트 승계 | 베이스 뷰 조인으로 **자동 승계.** 비공개/미검증/미동의/탈퇴 파트너의 카테고리 링크는 나타나지 않는다 |
| `exposed_to_fkp` 큐레이션과의 관계 | **무관.** 마이그레이션 주석이 명시하듯 이는 FKP 요청폼 드롭다운의 애플리케이션 필터이지 기밀성 축이 아니다. SEEPN 공개 목록은 큐레이션 여부와 상관없이 **파트너가 실제로 고른 카테고리**를 보여주는 것이 맞다 |
| anon에게 열어도 되는가 | **된다.** B-9′(카테고리 필터)가 비로그인 목록의 핵심 기능이고, 이 뷰가 없으면 그 기능이 성립하지 않는다 |

### 3.3 B-13(0건 카테고리) 카운트 노출 — 개인정보 이슈 없음

```sql
create or replace view public.partner_category_count_public as
  select standard_category_id, count(*)::integer as partner_count
  from public.partner_category_public group by standard_category_id;
grant select on public.partner_category_count_public to anon, authenticated;
```

| 우려 | 판정 |
|---|---|
| 소수 카운트(1~2건) + 지역 필터 조합으로 특정 회사가 식별되지 않는가 | **문제 없음.** 그 회사의 **상호가 이미 공개 목록에 있다.** 카운트는 증분 정보를 주지 않는다 |
| 카운트로 SEEPN의 공급 규모(사업 정보)가 노출되지 않는가 | 개인정보 이슈가 아니라 **경영 판단**이다. 총 건수 표시(B-16)를 대표가 이미 승인했으므로 일관된다 |

> **비고(개인정보 아님, 설계 참고)**: L1 롤업 카운트는 조상 폐포(ancestor closure)가 필요하다. §4.2 D-S4가 "L1은 배지, L2/L3는 숨김"을 정책으로 확정했으므로, L1 카운트를 **자기 노드 직접 연결 수**로 계산하면 거의 항상 0이 나온다. backend-developer는 재귀 CTE 또는 `path` 컬럼 기반 롤업을 쓸 것.

---

## 4. BP-4 — 3번째 principal_kind의 회귀 위험

### 4.1 파트너 검토 §2.3의 결론은 그대로 유효하다 (좋은 소식)

F-7대로 `is_active_admin()`은 `admin_user`만, `is_active_partner()`는 `partner_account`만, `owns_partner()`는 `partner_account` 조인만 본다. **`buyer` principal이 이 세 함수를 오판정시킬 경로는 없다.** DoD의 "PR-8 승계 회귀 테스트"는 반드시 하되, 결과는 통과가 예상된다.

`auth_principal`의 상호배타 구조도 그대로 3원 확장된다: CHECK를 `in ('admin','partner','buyer')`로 넓히고, `buyer_account`가 `(auth_user_id, principal_kind)` 복합 FK를 갖고 `principal_kind text not null default 'buyer' check (principal_kind = 'buyer')` 패턴을 그대로 복제하면, **한 Auth 사용자가 둘 이상이 되는 것은 애플리케이션 버그가 아니라 제약 위반**이 된다(service-planner §1.3의 서술이 정확하다).

### 4.2 [주요] 진짜 위험은 감사로그 쪽이다

F-9 / F-10이 진짜 문제다. **지금 상태로 바이어 기능을 만들면 두 가지가 조용히 깨진다.**

| # | 증상 | 원인 |
|---|---|---|
| 1 | 바이어 행위가 `actor_kind='system'`으로 기록된다 | `log_audit()`의 판정이 `admin → partner → else 'system'`. 바이어는 `else`로 떨어진다(F-9) |
| 2 | `seepn_inquiry.create` 같은 신규 action으로 `log_audit`을 부르면 **CHECK 위반 예외**가 난다 | `audit_log.action`이 전체 나열 화이트리스트다(F-10) |

증상 2가 특히 위험한 이유: `get_partner_contact()` 선례처럼 **"감사 실패 = 트랜잭션 롤백"** 구조를 문의 RPC에도 넣을 텐데, action이 화이트리스트에 없으면 **문의 생성 자체가 100% 실패**한다. 로컬에서 마이그레이션을 순서대로 적용하면 바로 드러나지만, 화이트리스트 확장을 별도 마이그레이션으로 미루면 배포 순서에 따라 프로덕션에서만 터진다.

**필수 조치 (파트너 검토 §2.6 패턴을 그대로 3원 확장)**

```sql
-- (a) actor_kind
alter table public.audit_log add constraint audit_log_actor_kind_check
  check (actor_kind in ('admin', 'partner', 'buyer', 'system', 'anon'));

-- (b) actor_buyer_account_id 컬럼 + FK + admin/partner actor와의 상호배타 CHECK
--     (기존 actor_partner_account_id 도입 시의 CHECK를 3원으로 확장)

-- (c) log_audit()의 v_actor_kind 판정에 buyer 분기 추가 (else 'system' 앞에)

-- (d) audit_log.action 화이트리스트 확장 — 전체 재선언 관례 준수
```

**신규 action 목록 (제안)**

| action | 발생 지점 | 감사 대상인 이유 |
|---|---|---|
| `buyer.signup` | `finalize_buyer_signup` | 계정 생성 사실 |
| `buyer.consent_grant` / `buyer.consent_revoke` | 마케팅 동의 토글 | 동의 이력 |
| `buyer.withdraw` | 탈퇴 | 파기 이행 증빙 |
| `seepn_inquiry.create` | `create_seepn_inquiry` | INQ-7 |
| `admin_seepn_inquiry.view` | Admin 문의 상세 열람 | INQ-7 — **본문에 PII가 들어올 수 있으므로 "누가 언제 읽었나"가 필요**(§5.4) |
| `admin_seepn_inquiry.contact_reveal` | 바이어 이메일 원문 열람 | PR-1과 동일 논리 |
| `admin_seepn_inquiry.status_change` / `.assign` | 상태 전이 / 담당자 배정 | 처리 이력 |

**감사하지 않을 것 (PR-15 승계)**
- 바이어의 목록/상세 **열람** — 로깅하면 감사로그가 폭증하고 보안 가치가 없다. 대신 **파트너 프로필 열람 통계가 필요하면 별도 비식별 집계**로(§7.3).
- 바이어의 **자기** 문의 내역·관심목록 조회 — 본인의 자기정보 접근.
- **찜 추가/해제** — 행위 자체가 `bookmark` 테이블에 남고, 감사 가치가 없다.

### 4.3 [확인] `authenticated` 전제 붕괴 재점검

파트너 검토 §2.4가 "authenticated = 관리자"라는 전제 붕괴를 치명적으로 짚었다. 3번째 principal에서 같은 점검을 했다. **신규 붕괴는 없다.**

| 대상 | 바이어 세션의 결과 | 확인 |
|---|---|---|
| `public.partner` (select/update grant 있음) | RLS 4정책 모두 불통과 → **0행 / update 거부** | F-11 |
| `public.partner_standard_category` (select/insert/delete grant 있음) | 정책 2개 모두 불통과 → **0행 / write 거부** | F-5 |
| `public.standard_category` (insert/update/delete grant 있음) | 관리자 정책만 존재 → **write 거부** | F-6 |
| `public.requests` / `private.*` / `audit_log` / `admin_user` / `role` / `menu` | grant 없음 또는 정책 불통과 | 파트너 검토 §2.4 결론 그대로 |
| `content_item` / `content_translation` / `standard_category*` 공개 정책 | **읽힌다 — 의도된 동작** (바이어도 블로그·FAQ·카테고리 라벨을 봐야 한다) | F-12 |

> **단 F-12 하나는 재확인 항목으로 남긴다** → BP-16(§10). `target_audience='partner'` 공지가 anon/바이어에게도 읽힌다는 사실은 공지 검토가 이미 "표시 필터일 뿐"으로 확정했지만, **P5a가 `seepn_user` 대상 공지의 첫 소비 화면을 만든다.** 운영자가 "대상=파트너"를 골랐으니 바이어는 못 본다고 오해할 가능성이 이때부터 실재한다.

---

## 5. BP-5 ~ BP-8 — `buyer_account` 및 `seepn_inquiry`

### 5.1 BP-5: `buyer_account` 최소수집 (DoD ④)

**판정: service-planner의 "이메일만" 권고(OQ-B5)를 채택한다.** 근거를 보강한다.

| 항목 | v1.0 | 판단 |
|---|:---:|---|
| 이메일 | **수집** | 로그인 ID. 추가 수집이 아니다 |
| 비밀번호 | **수집** | Supabase Auth가 해시 보관. **앱은 절대 평문을 로그·audit에 남기지 않는다** |
| `display_name` | **수집** | 회신 시 호칭 + BY-11 발신자 표시. **단 "이름 또는 회사명 중 편한 것" 안내를 유지하고 실명을 요구하지 않는다.** 실명 강제는 최소수집 위반 소지 |
| 전화번호 | **금지** | INQ-3의 취지와 정면 충돌. 회신 채널은 이메일 하나로 충분하다 |
| 생년월일 / 만 14세 확인 | **생년월일 금지, 확인만** | 만 14세 미만 가입 불가는 **약관 명시 + 가입 화면 체크**로 달성한다. 생년월일을 받으면 그 자체가 새 PII 수집면이 된다. **파트너(B2B 사업자)와 달리 SEEPN 바이어는 개인일 수 있으므로 이 조항은 파트너보다 더 필요하다** |
| 회사명 / 소속 / 직함 / 국가 | **금지** | "나중에 매칭에 쓰면 좋으니 지금 받자"는 전형적인 편의 수집이다. v1.0 바이어 계정의 목적은 **상세 열람 + 관심등록 + 문의**뿐이고 그중 어느 것도 소속을 필요로 하지 않는다. 필요해지는 시점(유료화·Dashboard)에 목적과 함께 받는다 |
| 로케일(`consent_locale` / UI 로케일) | **수집** | 동의 문서 판본 특정에 필요(§8.3) |
| 접속 IP / User-Agent | **별도 컬럼 금지** | 로그인 이벤트 `audit_log`에만. `buyer_account`에 복사하지 않는다 |

**계정 상태**: `pending_email` / `active` / `suspended` / `withdrawn` — `partner_account`와 동일 shape(service-planner §1.3 그대로). MFA 불요(일반 소비자 계정), 이는 파트너와 동일한 판단이다.

### 5.2 BP-3: [치명적] Supabase Auth 프로젝트 설정은 3개 축이 공유한다

screen-spec §3.4가 "Auth 프로젝트 설정은 파트너와 공유"라고만 적었는데, 그 함의를 명시해야 한다.

> **바이어 가입을 열기 위해 "Allow new users to sign up"을 켜지 말 것.**

켜면 무슨 일이 생기는가:

| 파급 | 설명 |
|---|---|
| PR-12 통제 무력화 | `check_business_registration_duplicate()`는 **`authenticated`에만 grant**되어 있고, "로그인+이메일 인증 후에만 호출 가능"이 열거 방지의 전부다. 누구나 자유 가입할 수 있으면 **누구나 사업자번호 열거 채널을 얻는다** |
| P1 DoD 회귀 | 파트너 검토 §8이 "Allow new users to sign up 여전히 OFF임을 배포 전 재확인"을 게이트로 걸어 뒀다. 바이어를 이유로 켜면 **파트너·관리자 축의 통제까지 동시에 되돌린다** |
| 무징후 실패 | 이 설정은 콘솔 토글이라 코드 리뷰·마이그레이션 diff에 흔적이 남지 않는다. **켠 사실을 아무도 모른 채 배포된다** |

**대신**: `POST /api/seepn/signup` 라우트가 `supabase.auth.admin.createUser()`(service_role) → `finalize_buyer_signup(...)` 순으로 호출하는 **파트너와 동일한 구조**를 쓴다. `finalize_buyer_signup`은 `service_role`에만 grant하고 `authenticated`/`anon`에는 **grant하지 않는다**(`finalize_partner_signup` 선례 그대로). RPC가 raise하면 라우트가 방금 만든 `auth.users` 행을 정리해야 하는 것도 동일하다(EDGE-B2).

### 5.3 BP-6: `seepn_inquiry` 본문의 PII (INQ-4 / PSO-3 / DoD ⑤)

**(a) INQ-3 설계 검증 — 맞다. 단 조건이 붙는다.**

"연락처를 폼에서 받지 않고 서버가 계정에서 가져온다"는 설계는 옳다. 다만 **다음 3가지가 함께 지켜져야** 실효가 있다.

1. **RPC 시그니처에 발신자 파라미터가 존재하지 않을 것.** `create_seepn_inquiry(p_partner_ids uuid[], p_body text)` **2개만.** "받되 무시한다"가 아니라 **받을 자리가 없어야** 한다(B-9c′를 컬럼 부재로 달성한 것과 같은 논리). *(2026-09-10 GAP-C1 갱신: 첫 파라미터가 `p_partner_id uuid` → `p_partner_ids uuid[]`(1~5건)로 일반화됐다. **파라미터 개수는 2개 그대로**이며 이 항목의 요건은 변하지 않았다 — §5.3(h) 참조.)*
2. **구조화 필드 파라미터 금지.** 카테고리·예산·납기가 들어오는 순간 그것은 Won't인 B-11이다(SP-13 경계). 이 경계는 **개인정보 관점에서도** 의미가 있다 — 예산·납기는 바이어사의 영업비밀이고, 받는 순간 보관·파기 기준을 새로 만들어야 한다.
3. **폼에 "회신은 {email}로 드립니다"를 읽기 전용으로 표시할 것.** 이게 본문에 전화번호를 적을 **동기 자체를 제거**하는 가장 효과적인 통제다. 캡션 경고보다 이쪽이 실효가 크다.

**(b) 본문의 저장 위치 — `public.seepn_inquiry`에 둔다 (`private` 분리하지 않는다)**

| 선택지 | 판정 |
|---|---|
| 본문을 `private.seepn_inquiry_body`로 분리 | **기각.** 본문은 문의의 **본질이자 처리 목적 자체**다. `private.partner_contact`(구조화된 5개 PII 컬럼)와 성격이 다르다. 분리하면 바이어 본인 조회(BY-12)와 Admin 상세 양쪽이 전부 RPC 경유가 되어 복잡도만 오르고 보호 이득이 없다 |
| `public.seepn_inquiry.body` + **GRANT 없음 + RLS + RPC** | **채택.** `requests.description`(자유서술, `public`에 존재)의 선례와 일관된다 |

**(c) 입력 단계 통제**

- 캡션: `CapabilityForm.tsx` L316의 문구를 **그대로 재사용** — "타인의 개인정보나 비밀유지 대상 정보를 입력하지 마세요." (같은 위험에 다른 문구를 쓰지 않는다)
- 길이: 20~2,000자(screen-spec §7.2 값 지지). 상한은 **대량 PII 붙여넣기 방지**로도 기능한다.
- 약관에 **바이어의 진술·보증 조항**(제출 내용에 제3자 개인정보가 포함되지 않음) — PR-14의 파트너 약관 조항을 바이어 약관에 대칭 적용(§8.2).

**(d) [주요] Admin 목록의 본문 미리보기 — 기본은 "노출하지 않는다"**

screen-spec §7.3/§8이 Admin 목록에 "본문 일부"를 보여주는 것으로 설계했다. **여기가 화면 설계로 새로 확정된 노출면**이고, 이 검토가 좁혀야 할 지점이다.

| 방식 | 판정 |
|---|---|
| 목록에 본문 미리보기 없음 (참조 파트너명(2026-09-10 이후 1~5건) + 바이어 표시명(마스킹) + 상태 + 생성일만) | **권고(기본값).** 목록은 한 화면에 N건이 동시에 뜬다 — 어깨너머 노출·스크린샷·화면 공유의 **노출 면적이 N배**다. 문의는 제목이 없으므로 "훑기"의 실익도 작다 |
| 미리보기가 운영상 꼭 필요하다면 | **조건부 허용**: 서버에서 이메일/전화번호 **패턴을 마스킹한 뒤** 앞 80자만 내려보낸다. `private.mask_email` / `private.mask_phone`가 이미 있으므로 패턴 스크럽 함수 1개를 추가하면 된다. **클라이언트에서 자르지 말 것** — 원문이 이미 브라우저에 도착한 뒤의 자르기는 마스킹이 아니다 |

**(e) 바이어 식별정보의 Admin 노출 — 2-RPC 구조**

> **`buyer_account`에 관리자용 SELECT 정책을 만들지 말 것.** 관리자가 바이어 데이터에 닿는 경로는 아래 2개 RPC뿐이어야 한다.

| RPC | 반환 | 권한 | 감사 |
|---|---|---|---|
| `admin_list_seepn_inquiries(...)` | `display_name`(`private.mask_name` 적용), 이메일(`private.mask_email` 적용), 참조 파트너명, 상태, 생성일 | `is_active_admin` + `is_aal2` + `has_menu_permission('lead_management','read')` | 목록 조회 자체는 `lead.list` 선례 준용 |
| `get_seepn_inquiry_contact(p_inquiry_id)` | 바이어 이메일·표시명 **원문** | 위 + **`has_pii_access()`** | `admin_seepn_inquiry.contact_reveal`. **`get_partner_contact()`를 그대로 복제** — 성공/거부 모두 기록하고, **감사 write 실패 시 예외로 원문 반환을 롤백**하는 부분이 이 패턴의 핵심이다 |

> **바이어 이메일을 `seepn_inquiry`에 스냅샷 컬럼으로 복사하지 말 것.** 복사하면 (a) 두 번째 PII 저장소가 생기고 (b) 탈퇴 시 파기가 두 곳에서 필요해진다. `auth.users` / `buyer_account`에서 **정의자 함수가 그때그때 조회**한다. 부수효과로 "탈퇴한 바이어에게는 회신할 수 없다"가 되는데, **그것이 올바른 동작**이다.

**(f) 보관·파기 (DoD ⑤)**

파트너 검토 §4 PR-9의 **"회사 단위는 남고 사람 단위는 지운다"** 원칙을 문의에 대칭 적용한다. §1.3 지표("운영자 문의 수 / 문의 → 매칭 전환")를 위해 **건수·전환 여부는 남아야** 하고, 본문·식별정보는 남을 이유가 없다.

| 대상 | 기준 |
|---|---|
| `body`(본문) | **`status='closed'` 후 12개월** 경과 시 파기(NULL 또는 `'[파기됨]'`). `requests` 리텐션 선례(12/24개월)와 정합 |
| 행 자체 (`id`, `buyer_account_id`, `status`, `created_at`, `closed_at`) + **참조 파트너 링크**(2026-09-10 이후 `seepn_inquiry_partner` 조인 테이블, 본문과 달리 파기 대상 아님) | **보존** — 지표 소스 |
| **바이어 탈퇴 시** | 미종결 문의를 **즉시 `closed` 전이 + 본문 즉시 파기.** 회신할 수단이 사라졌으므로 처리 목적이 소멸한다. `buyer_account_id`는 **NULL로 만들지 않는다**(감사 귀속 유지, `partner_account` 선례 동일) |
| 배치 | `retention_jobs.job_type`에 `seepn_inquiry_body_purge` 추가(기존 CHECK 재선언 관례 준수) |

**(g) BP-8: [주요] 레이트리밋의 위치 (INQ-6 / OQ-B9)**

> **얇은 서버 라우트에 두면 우회된다.** `create_seepn_inquiry`가 `authenticated`에 grant되는 순간, 바이어는 자기 JWT로 **PostgREST RPC를 직접 호출**할 수 있고 라우트를 거치지 않는다. `/supplier`의 사업자번호 중복확인(라우트 레이트리밋)과 **성격이 다르다** — 그쪽은 RPC가 조회 전용이라 남용 피해가 작았다.

**채택: RPC 내부 DB 카운트.**

```
create_seepn_inquiry() 진입 직후:
  - 같은 buyer_account_id, 최근 1시간  → 5건 초과면 raise 'rate_limited'
  - 같은 buyer_account_id, 최근 24시간 → 20건 초과면 raise 'rate_limited'
  - 같은 (buyer_account_id, 참조 partner_id 각각), 최근 24시간 → 3건 초과면 raise 'rate_limited'
```
(구체 수치는 운영 조정 가능. **위치가 DB 안이라는 점이 요건**이고 값은 아니다.)

> **2026-09-10 GAP-C1 갱신**: 문의 1건이 파트너를 1~5건 참조하게 되면서, 위 3개 한도의 **분모가 서로 달라졌다.** 1시간/24시간 한도는 여전히 **문의 건수**(`seepn_inquiry` 행 수) 기준이고, 세 번째 한도만 **참조 파트너별**로 각각 평가된다. 실질 "파트너 도달 횟수"의 하루 상한이 20 → 100(20건×5참조)으로 늘어난 셈이다. **파트너 1곳이 받을 수 있는 양은 3건/24시간으로 변함이 없고**, 파트너에게는 운영자를 거친 익명 요약만 전달되므로(§5.4) v1.0에서는 허용 가능하다고 판단한다. 다만 §5.3(h) 참조.

부수 요건: 화면은 에러 코드 `rate_limited`를 문구로 매핑하되 **"N시간 후"의 정확한 잔여시간을 계산해 노출하지 말 것** — 한도 구조를 노출하면 회피 스크립트를 쉽게 만든다. "잠시 후 다시 시도해주세요" 수준으로 충분하다.

**(h) [2026-09-10 추가] 다중 참조(1~5건) 확장의 재검토 결론 — 노출 범위는 넓어지지 않는다**

`20260910180000_seepn_inquiry_multi_partner.sql`(GAP-C1)이 `seepn_inquiry.partner_id`를 `public.seepn_inquiry_partner` 조인 테이블로 옮기고 `create_seepn_inquiry`를 `p_partner_ids uuid[]`(1~5)로 일반화했다. 이 절의 결론들이 깨지는지 재확인했고, **깨지지 않는다.**

| 재확인 항목 | 결과 |
|---|---|
| 본문 열람 주체가 넓어졌는가 | **아니다.** 파트너(공급기업 본인)에게 향하는 읽기 경로는 여전히 **0건**이다 — `seepn_inquiry`/`seepn_inquiry_partner` 둘 다 `force row level security` + 파트너용 SELECT 정책 부재이고, `/supplier` 코드에 두 테이블에 대한 참조가 없다. 본문은 **회사 운영자 전용**(`get_seepn_inquiry_detail`, `lead_management` 권한 + AAL2 + 호출마다 감사)이며 §5.4의 "익명 요약만 전달" 규칙이 그대로 유일한 파트너 전달 채널이다. 즉 "1건이 5곳에 노출"이 아니라 **"1건을 운영자가 1번 읽고, 익명 요약을 최대 5곳에 전달"**이다 |
| 문의 대상 파트너 검증 | **강화됐다.** P5a의 `exists (select 1 from public.partner where id = ...)`(행 존재)에서 `private.partner_public_base` 게이트(검증+공개+최신 동의 granted)로 바뀌었다. §2.4의 "게이트를 손으로 복제하지 말 것" 원칙과 일치하고, **비공개 파트너를 대상으로 한 문의 접수 경로가 닫혔다.** 일부만 무효여도 어느 id가 무효인지 알려주지 않고 `partner_not_found` 하나로 일괄 거절한다(비누출 자세 유지) |
| 감사(INQ-7) | `p_subject_ids`가 uuid **배열**로 바뀌었으나 `audit_log.subject_ids`는 원래 `uuid[]`이고 `log_audit()`의 200개 상한에 한참 못 미친다. `private.breach_notification_targets()`는 `audit_log.subject_ids`를 **읽지 않으므로**(살아있는 테이블 5종만 조회) 유출 통지 대상자 추출은 영향받지 않는다 |
| 보관·파기 | 본문 파기 대상·주기 불변. 조인 행은 `on delete cascade`(문의 삭제 시), `partner_id`는 `on delete restrict` — P5a의 컬럼 시절과 동일한 자세 |
| 법무 문서 | `docs/legal/seepn-buyer-privacy-v1.0-2026-09-ko.md` 제2조는 수집 항목을 "문의 대상 파트너"로 **건수 비특정** 서술하고, 제6조는 "식별정보 미전달 + 익명 요약만 전달"을 서술한다. **판본 개정 불요** |

**남는 권고 2건 (비차단)**

- **BP-26(권고)**: 바이어 전체 한도(1시간 5건 / 24시간 20건)가 "문의 건수" 기준이라 참조 파트너 수를 곱한 **실질 도달량이 최대 5배**가 된다. 파트너 1곳당 3건/24시간 상한이 개별 피해를 막으므로 v1.0 허용 가능하지만, 운영 중 **참조 파트너 수 합계 기준 24시간 한도**(예: 40 참조/일)를 추가 한도로 두는 쪽을 권고한다. 문의 건수 한도와 달리 "비교 후 한 번에 문의"를 페널티 주지 않으면서 무차별 살포만 걸러낸다.
- **BP-27(권고)**: Admin 문의 상세의 운영 가이드 배너(§5.4-4)는 참조 파트너가 여러 곳일 때 **전달처가 최대 5곳으로 늘어난다**는 점을 반영해 "각 파트너에게 전달할 때마다 익명 요약인지 확인" 취지를 한 줄 덧붙일 것을 권고한다(본문에 PII가 섞였을 때의 파급 범위가 그만큼 커지므로).

### 5.4 BP-7: [주요] 운영자 → 파트너 전달은 제3자 제공이다

PRD·화면정의서 어디에도 명시되지 않았지만, **B-18의 실제 운영 흐름에서 반드시 발생하는 일**이다. 운영자는 문의를 읽고 파트너에게 연락한다.

| 전달 내용 | 법적 성격 |
|---|---|
| "이런 요구사항의 문의가 들어왔다"는 **익명화된 니즈 요약** | 제3자 제공 아님 |
| 바이어의 **이름·이메일·소속·연락처** | **제3자 제공**(법 제17조) — 별도 동의 필요 |
| 문의 **본문 원문 그대로 전달** | 본문에 바이어가 자기 정보를 적었다면 실질적으로 위와 같다 |

**v1.0 확정 규칙 (파트너측 F-8의 대칭 적용)**

1. 운영자는 파트너에게 **바이어 식별정보를 전달하지 않는다.** 익명화된 니즈 요약만 전달한다.
2. 실제 연결이 필요해지면 **그 시점에 바이어에게 건별로 동의**를 받는다. 가입 시점에 미리 받지 않는다(법 제22조 — 선택 동의를 필수와 묶지 않기).
3. 스키마에는 **자리만** 만든다: `buyer_consent.consent_type`에 `third_party_share` 값을 포함하되 **v1.0에서는 쓰지 않는다.** (`partner_consent`가 정확히 이 모양이다)
4. Admin 문의 상세에 **"바이어 식별정보를 파트너에게 전달하지 마세요"** 운영 가이드 문구를 노출한다. `admin_seepn_inquiry.view` 감사(§4.2)와 함께, 이것이 v1.0의 실질적 통제다.

> **변호사 검토 필요**: 익명화 요약 전달의 허용 범위, 그리고 "바이어가 본문에 자기 연락처를 스스로 적은 경우 그것을 파트너에게 전달하는 것이 묵시적 동의로 인정되는지"(권고: 인정되지 않는다고 보고 설계할 것).

---

## 6. BP-13 / PSO-5 — 관심등록(bookmark) 보관 기준

### 6.1 이건 개인정보인가 — 그렇다

`(누가, 어떤 회사에, 언제 관심을 표시했나)`는 **식별된 정보주체에 연결된 행태정보**다. 파트너 데이터처럼 "사업의 자산"이라는 보유 근거도 없다.

### 6.2 [확정] 보관 기준

| 상황 | 처리 | 근거 |
|---|---|---|
| **바이어 탈퇴** | **즉시 하드 삭제** (`delete from buyer_bookmark where buyer_account_id = ...`) | 보유 목적(본인에게 관심목록을 보여주기)이 계정과 함께 **완전히** 소멸한다. `partner_withdraw`가 Match 행을 남긴 것과 다르다 — 그건 북극성 지표의 유일한 소스였지만 찜은 그렇지 않다 |
| **지표는 어떻게 하나** | 실시간 카운트로 충분(v1.0 규모). 누적 지표가 필요해지면 **비식별 집계 테이블에 미리 적립**하고 원본은 그대로 삭제 | 지표를 이유로 개인 단위 행을 남기는 것은 목적 외 보유다 |
| **찜한 파트너가 비공개 전환/미검증 전환** | **bookmark 유지** (OQ-B12 권고 지지). 화면에서만 "현재 비공개" 표시 + 진입 차단 | 개인정보 이슈 없음. 이미 그 회사를 알던 바이어에게 "지금 비공개다"를 알리는 것은 신규 노출이 아니다 |
| **파트너 행 자체** | `partner`는 하드 삭제되지 않으므로(PR-5) FK는 항상 유효. `on delete cascade`면 충분 | — |
| **바이어 계정 장기 미접속** | **12개월 미접속 시 안내 후 파기** 권고 — 파트너의 `draft` 방치 계정 기준(파트너 검토 §4 PR-5)과 같은 숫자를 쓴다 | 값 결정은 PM/대표. **다만 처리방침에 적은 숫자와 배치 동작이 어긋나면 그 자체가 위반**이다 → BP-18 |

### 6.3 [선제 지적] 파트너 대시보드의 "관심수"(SS-14 / P6)

PRD §4.3이 **"P5a의 관심등록이 생기면 SS-14(파트너 대시보드 '관심수')가 처음으로 보여줄 데이터를 갖게 된다"**고 적었다. P6에서 사고가 나기 전에 지금 못박는다.

> **파트너에게 제공되는 것은 집계 카운트뿐이다. 어떤 바이어가 찜했는지는 어떤 형태로도 제공하지 않는다** — 표시명·이메일·마스킹값·목록 길이의 시계열 그 무엇도.

- 구현 시: `buyer_bookmark`에 파트너용 RLS 정책을 만들지 말고, **집계 반환 정의자 함수**(`get_own_partner_bookmark_count()`)만 만든다.
- 카운트가 0~2건일 때 파트너가 "누가 봤는지" 추론 가능한 구간이 생기지만, 바이어를 식별할 다른 채널이 없으므로 v1.0에서는 문제되지 않는다. **다만 카운트를 시간대별로 쪼개 보여주지 말 것**(그 순간 추론 가능성이 생긴다).
- 이 요건을 **P6 착수 시 다시 찾지 않아도 되게** 지금 스키마 주석에 남길 것.

---

## 7. BP-14 — 바이어 인증 클라이언트 구현 지시 (GAP-6, 안정성)

> **성격 고지**: 이 항목은 개인정보 이슈가 아니라 **안정성 이슈**다. 그럼에도 정식 검토 문서에 남기는 이유는, `/supplier` 로그인이 이 문제로 **약 2일간 프로덕션에서 완전히 깨졌던 실사고**가 있었고, 바이어 인증은 그 코드를 **그대로 복제하는 작업**이기 때문이다. 같은 실수를 두 번 하지 않게 하는 것이 이 문단의 전부다.

### 7.1 반드시 복제할 것

`lib/supabase/supplierServerAuthClient.ts`의 WORKAROUND 3단계를 **처음부터** 적용한다. "일단 `@supabase/ssr` 기본 쿠키 어댑터로 짜고 문제 생기면 고친다"는 접근을 **금지**한다.

| # | 요구 | 이유 |
|---|---|---|
| 1 | 세션 쿠키를 **직접 base64url + JSON 디코드**한다 | `@supabase/ssr` 0.12.5의 쿠키 스토리지 어댑터가 `setItem`에서 `key.endsWith(...)`를 문자열 검사 없이 호출해 이 배포 번들에서 `TypeError: b.endsWith is not a function`을 던진다 |
| 2 | `createClient()`의 **`global.headers.Authorization`에 access token을 생성 시점에 주입**한다 | 이후 모든 `.from()` / `.rpc()` 호출이 GoTrueClient 내부 세션 상태와 **무관하게** bearer 토큰을 싣는다 → RLS 스코핑이 세션 상태 신뢰성과 분리된다 |
| 3 | 토큰 검증은 **`getUser(accessToken)` 명시적 JWT 오버로드**로만 한다. `setSession()` 호출 금지, 인자 없는 `getUser()`/`getSession()` 금지 | `setSession()`이 성공을 반환한 직후 `getUser()`가 "Auth session missing!"을 반환하는 read-after-write 갭이 이 배포에서 재현됐다(3회 재시도로도 해소되지 않음, 로컬 재현 불가). `getUser(jwt)`는 auth-js 내부적으로 `initializePromise`/`_useSession`/storage를 전부 건너뛰고 `/auth/v1/user`로 **stateless 네트워크 호출**만 하는 유일한 진입점이다 |

### 7.2 반드시 피할 것 — `'use client'` 상수 함정

> **`SEEPN_BUYER_AUTH_COOKIE_NAME`을 `buyerBrowserClient.ts`(= `'use client'` 파일)에 같이 두지 말 것.**

`lib/supabase/buyerAuthCookieName.ts`처럼 **`'use client'` 지시자가 없는 별도 모듈**을 만들고, 브라우저 클라이언트와 서버 클라이언트가 **둘 다 그 모듈에서 import**한다. `'use client'` 파일의 평범한 문자열 상수를 서버 코드가 import하면 **빌드 에러도 경고도 없이 빈 문자열이 된다** — `/supplier`에서 정확히 이 일이 일어나 모든 서버측 쿠키 조회가 `cookies().get('')`이 되어 있었다. `middleware.ts`가 그때 유일하게 살아남은 이유는 **자기 로컬 상수를 따로 정의**했기 때문이므로, `/seepn` 분기에서도 **쿠키명을 로컬 상수로 직접 적을 것**(중복이 아니라 의도된 방어다).

### 7.3 그 외 구현 요건

| 항목 | 요건 |
|---|---|
| 쿠키명 | `sb-buyer-auth` — `sb-supplier-auth`, `/admin` 기본명과 3원 분리(D-S2) |
| `requireBuyerSession()` | `lib/supplier/session.ts`의 구조 복제. **매 요청 자기 `buyer_account` 행 재조회** → 행 없음 / `withdrawn` / `suspended`면 즉시 `/seepn/login`. 미들웨어의 "세션 있나" 판정을 신뢰하지 않는다 |
| 키 | **anon 키만** 사용. `service_role`은 `POST /api/seepn/signup` 등 **가입/탈퇴 라우트에만** 쓴다 |
| 토큰 로깅 | 디코드한 `access_token`/`refresh_token`을 **로그·감사·에러 리포트에 절대 남기지 말 것.** 디버깅이 필요하면 `length`/`present` 불리언만(Amplify env 진단 때 쓴 방법과 동일) |
| 신규 서버 전용 env var | 추가하게 되면 **`next.config.js`의 `env` 블록에 등록**할 것. AWS Amplify는 `NEXT_PUBLIC_` 접두어가 없는 콘솔 env var를 SSR 런타임에 전달하지 못하며, 이 프로젝트에서 **두 번 재현**됐다 |

> **보안 관점 부연 (오해 방지)**: 이 우회 패턴은 보안 수준을 낮추지 않는다. 쿠키를 우리가 디코드한다는 것이 **토큰을 우리가 신뢰한다는 뜻이 아니다** — 유효성 판정은 여전히 `getUser(accessToken)`의 Supabase Auth 서버 왕복이고, 데이터 접근 권한은 여전히 그 JWT + RLS가 결정한다. 로컬 디코드는 **"어떤 토큰을 검증에 보낼지"를 고르는 데만** 쓰인다.

### 7.4 BP-15: `Cache-Control` 범위 (권고)

F-14대로 `/seepn`은 지금 어느 분기에도 걸리지 않는다. **경로별로 나눈다** — 목록에까지 `no-store`를 걸면 공개 캐시 이점을 통째로 버린다.

| 경로 | 헤더 |
|---|---|
| `/seepn/my/*`, `/seepn/partners/[id]/inquiry`, `/seepn/login`, `/seepn/signup*`, `/seepn/reset-password` | **`no-store`** — 바이어 본인 데이터 및 인증 화면 |
| `/seepn/partners/[id]` (상세) | **`private, no-store`** 권고 — 로그인 게이트 뒤의 데이터를 공유 캐시에 남기지 않는다 |
| `/seepn/partners` (목록) | 캐시 허용. **단 찜 상태(로그인 사용자별)를 서버 렌더에 섞지 말 것** — 섞으면 캐시 오염으로 **다른 사람의 찜 상태가 보인다.** 찜 상태는 클라이언트에서 별도 조회 |

---

## 8. BP-9 / BP-10 / PSO-4 — 바이어 전용 약관·개인정보처리방침

### 8.1 [판정] 신규 작성 필수. 기존 문서 재사용 범위는 "구조"까지다

| 기존 문서 | 재사용 가능성 |
|---|---|
| `docs/legal/partner-privacy-v1.0-2026-09-ko.md` | **구조는 거의 그대로 쓴다**(18개 절 체계). **§8 위탁 표 / §9 국외이전 표 / §13 안전성 확보조치 / §14~16(보호책임자·구제·안내)은 사실상 그대로 승계** — 동일 회사·동일 인프라이므로 다시 쓸 이유가 없고, 오히려 두 문서가 달라지면 그게 문제다 |
| 같은 문서의 §2 수집항목 / §3 목적 / §4 동의구분 / §5 보유기간 / §6 제3자제공 / §7 공개노출 / §11 수집출처 고지 | **재사용 불가.** 전부 다르다. 특히 §7(공개 노출)은 바이어에게 **해당 자체가 없고**, §11(PR-13 수집출처)은 바이어가 전부 본인 등록이므로 **불필요**하다 |
| `docs/legal/partner-terms-v1.0-2026-09-ko.md` | **재사용 불가.** 사업자 대상 계약 조항(정보 정확성 책임, 자격 정지, 공개 노출 정보의 이용 범위)이 바이어에게 대부분 무의미하다 |
| `docs/legal/{privacy,terms}-v1.0-{en,ja}.md` (FKP 바이어용) | **재사용 불가.** 계정 없는 **1회성 요청 제출** 대상이며 한국어 문서가 아니다. 보관기간·권리행사·탈퇴 개념이 통째로 없다. 참고 가치는 §5 공유 대상 표 정도 |

**결론: `docs/legal/seepn-buyer-{terms,privacy}-v1.0-2026-09-{ko,en,ja}.md` 신규 작성.** service-planner의 D-S6 판단이 맞다.

### 8.2 바이어용 문서에 반드시 들어갈 것 (초안 체크리스트)

**개인정보처리방침**

- 수집 항목: **이메일, 비밀번호(해시), 표시명, 로케일, 접속기록·IP·User-Agent(감사로그)**, 관심등록 내역, 문의 내용 — §5.1 표를 넘지 않을 것
- 처리 목적: 회원관리 / 파트너 정보 열람 제공 / 관심목록 제공 / **문의 접수 및 회신** / 부정이용 방지
- 보유기간: **§5.3(f) + §6.2 표를 그대로.** 문서와 배치 동작이 어긋나면 그 자체가 위반이다
- **제3자 제공**: "v1.0에서는 제공하지 않습니다. 파트너와의 실제 연결이 필요한 경우 그 건별로 제공받는 자·항목·목적·보유기간을 명시해 사전에 별도 동의를 받은 후에만 제공합니다" — §5.4 규칙의 문서화
- 위탁 / 국외이전: **파트너 문서 §8·§9 표를 승계**(§9 참조)
- 정보주체 권리: 열람·정정·삭제·처리정지·동의철회 + **탈퇴 시 관심등록 즉시 삭제 안내**
- **만 14세 미만 가입 불가** 및 그 확인 방법
- 파기 절차·방법 / 안전성 확보조치 / 보호책임자 / 권익침해 구제
- 문서 버전·시행일 (`seepn-buyer-privacy-v1.0-2026-09` 명명 규칙 승계)

**이용약관** — 아래 4개는 **개인정보·보안 관점에서 반드시 필요**하다.

| # | 조항 | 왜 필요한가 |
|---|---|---|
| 1 | **공개된 파트너 정보의 이용 범위 제한** — 자동수집(스크래핑)·대량 다운로드·재배포·제3자 제공·영업 목적 무단 이용 금지 | 파트너가 `public_listing`에 동의한 목적은 **"해외 바이어가 귀사를 찾을 수 있도록"**이다. §2.4의 뷰 분리가 기술적 통제라면 **이 조항이 그 목적 제한을 유지하는 유일한 계약적 장치**다. 둘 중 하나만으로는 부족하다 |
| 2 | **제출 내용의 진술·보증** — 문의 본문에 제3자의 개인정보·비밀유지 대상 정보를 포함하지 않는다 | PR-14의 파트너 약관 조항을 대칭 적용. §5.3(c) 캡션의 계약적 뒷받침 |
| 3 | **만 14세 미만 가입 불가** | §5.1. 생년월일을 받지 않는 대신 약관+체크로 처리하므로 조항이 실체다 |
| 4 | 계정 정지·해지 사유 (레이트리밋 반복 위반, 스크래핑, 타인 사칭) | §5.3(g)·`buyer_account.status='suspended'`의 근거 |

> **변호사 검토 필요**: 위 1번 조항의 집행 가능성과 문언, 책임 제한, 준거법·관할(해외 바이어가 가입하는 서비스이므로), 그리고 만 14세 미만 확인을 체크박스로 갈음하는 방식의 적정성.

### 8.3 BP-9: [치명적] 동의 로케일 = 문서가 실재하는 로케일

screen-spec §3.2가 **"문서 자체가 없으면 ko 기본 fallback + '정식 번역 준비 중' 안내"**를 임시 처리로 적어 뒀다. 개발 중에는 괜찮지만 **실서비스 가입 화면에서는 안 된다.**

- 법 제22조는 정보주체가 **동의 내용을 명확히 인지할 수 있는 방법**으로 동의를 받도록 한다. 영어 UI로 가입시키면서 한국어 문서만 링크하는 것은 그 요건을 만족한다고 보기 어렵다.
- 법 제30조(처리방침 수립·공개)도 마찬가지다.

> **확정 규칙: P5a 배포 시 켜는 로케일 = 약관·처리방침 문서가 실제로 존재하는 로케일.** OQ-B3의 답을 이 방향으로 정한다 — **최초 배포를 ko 1개로 좁혀도 구조상 아무 문제가 없다**(로케일 인프라는 이미 3개국어 대응). 문서 3개를 못 맞추면 UI 3개를 켜지 않으면 된다. 반대는 성립하지 않는다.

**바인딩**: `lib/legal/buyerConsentVersions.ts`를 신설하고 `partnerConsentVersions.ts`의 규약을 그대로 따른다 — 버전 문자열 하나가 **실재하는 파일 하나에 1:1 대응**하고, 발행된 문서는 절대 제자리 수정하지 않으며, 동의 기록(`buyer_consent.document_version` + `consent_locale`)이 **바이어가 실제로 본 그 판본**을 특정한다. 마케팅 동의도 **별도 문서를 만들지 말고 처리방침 판본을 가리키는** `partnerConsentVersions.ts`의 판단을 승계한다.

**동의 항목 구분 (법 제22조)**

| 항목 | 구분 | 비고 |
|---|:---:|---|
| SEEPN 이용약관 | **필수** | 계약 성립 |
| 개인정보 수집·이용 | **필수** | 서비스 제공에 필수 |
| 만 14세 이상 확인 | **필수(확인)** | 동의가 아니라 확인. 생년월일 미수집 |
| 마케팅 정보 수신 | **선택, 기본 OFF** | 미체크로 가입이 완료되어야 한다 |
| `third_party_share` | **v1.0 미사용** | 값 자리만 확보(§5.4) |

`finalize_buyer_signup`은 `finalize_partner_signup`과 동일하게 **`terms`+`privacy`가 granted가 아니면 raise**하고, 선택 동의 미체크는 가입을 막지 않아야 한다.

---

## 9. 국외이전 판정

### 9.1 [판정] P5a가 만드는 신규 국외이전은 **없다**

| 확인 항목 | 결과 |
|---|---|
| 저장 위치 | Supabase DB/Auth/Storage **대한민국(서울) 리전** — 파트너 문서 §9와 동일, P5a가 바꾸지 않는다 |
| 호스팅 | AWS Amplify — 기존과 동일 |
| P5a가 추가하는 해외 수탁자 | **없다.** 신규 테이블 3종(`buyer_account`/`seepn_inquiry`/`buyer_bookmark`)은 전부 기존 Supabase 프로젝트 안에 생긴다 |
| 자동번역 API 호출 | **없다** — TR-4″-2 선행조건 4건 중 3건이 미해소이므로 사용자 생성 콘텐츠 자동번역은 켜지지 않는다 |
| 분석/마케팅 SDK 추가 | P5a 범위에 없음. **추가하려면 별도 검토**(GA4 등은 그 자체가 국외이전 논점) |

### 9.2 그래도 문서에는 실려야 한다

> **"신규 이전이 없다"는 "고지가 불필요하다"가 아니다.**

Supabase Inc. / AWS / Google은 **해외 본사 법인**이고, 시스템 유지·보수 목적의 해외 원격 접근 가능성 때문에 파트너 문서 §9가 법 제28조의8 제1항 제3호(처리방침 공개로 동의 갈음) 방식의 표를 이미 싣고 있다. **바이어 문서에도 동일한 표가 실려야 한다** — 정보주체가 바뀌었을 뿐 이전 구조는 같다.

> **변호사 검토 필요 (파트너 문서에서 이미 열려 있는 항목의 승계)**: 서울 리전 저장 + 해외 법인 수탁자 구조가 제28조의8의 국외 이전에 해당하는지, 그리고 표 형식 공개로 동의를 갈음하는 것이 적절한지. **바이어 문서에서 새로 답할 필요는 없고, 파트너 문서의 결론을 그대로 따르면 된다.**

### 9.3 BP-11: [주요] 경계 하나 — 자동번역을 P5a에서 켜지 말 것

PRD §4.3.1이 **"P5a 착수는 TR-4″-2 재검토를 자동으로 트리거한다"**고 명시했다. 파트너 프로필 원문 대부분이 ko인데 바이어에게 en/ja로 보여줘야 하므로 이 논점은 P5a 설계 중 반드시 다시 열린다. 개인정보 관점의 답을 미리 못박는다.

> **자동번역을 켜는 순간 신규 국외이전이 발생한다.** 번역 API 제공자는 대개 해외 소재이고, 번역 대상인 `company_intro_text`/`reference_projects`는 **PR-14가 이미 "제3자 개인정보가 들어올 수 있다"고 판정한 필드**다. 즉 미검증 자유텍스트를 해외 API로 송신하는 구조가 된다.

- **P5a 범위에서 자동번역은 켜지 않는다.** 화면은 screen-spec §6.2대로 **원문 + "원문: {locale} · 번역 미제공"** 표기로 간다.
- 켜려면 TR-4″-2b의 남은 선행조건 3건(전용 번역 스키마 / **국외이전 정식 검토** / 파트너 본인 검수 경로)이 먼저 해소되어야 하며, **국외이전 검토는 이 문서가 아니라 별도 검토 대상**이다.
- 이 경계를 넘는 요구가 나오면 그것은 P5a 범위 확대이므로 **product-manager 결정 + privacy-security-officer 재검토**를 거친다.

---

## 10. 권고 사항 (non-blocking)

| ID | 항목 | 위험도 | 권장 조치 |
|---|---|:---:|---|
| **BP-15** | `/seepn` 경로의 `Cache-Control` 범위 | 권고 | §7.4 표대로. **목록에 찜 상태를 서버 렌더로 섞지 않는 것**이 핵심 |
| **BP-16** | `target_audience='partner'` 공지가 anon/바이어에게도 REST로 읽힌다(F-12) | 권고 | 공지 검토가 이미 "표시 필터"로 확정한 사항이라 **결정을 뒤집지 않는다.** 다만 P5a가 `seepn_user` 공지의 첫 소비 화면을 만드는 시점이므로, Admin 공지 작성 화면의 **"공지 본문은 대상과 무관하게 로그인 없이도 읽힐 수 있습니다"** 경고가 실제로 노출되는지 재확인 |
| **BP-17** | 이메일 열거 — EDGE-B1 중립 메시지, 로그인 실패 중립 메시지, `check_login_lockout()`의 반환값이 계정 존재 여부를 흘리지 않는지 | 권고 | `/supplier` EDGE-1 처리를 그대로 승계. **`check_login_lockout`을 바이어 로그인에도 쓸지, 쓴다면 그 반환이 "이 이메일이 존재한다"는 신호가 되는지**를 backend-developer가 확인 |
| **BP-18** | 바이어 계정 장기 미접속 파기 기준 | 권고 | 12개월 미접속 시 안내 → 30일 후 파기 권고(파트너와 같은 숫자). **값은 PM/대표 결정이되, 처리방침 문구와 배치 동작이 반드시 일치해야 한다** |
| **BP-19** | **2026-09-11 시행 개정 개인정보 보호법** — 유출 가능성 인지 시 **72시간 내 통지**, '유출등'에 위조·변조·훼손 포함, CPO 지정·변경 시 이사회 의결·신고, 일정 규모 이상 ISMS-P 의무화, 중대·반복 위반 과징금 상한 강화 | 권고 | **P5a 배포일이 시행일 이후**이므로 신규 문서는 처음부터 개정 기준으로 쓴다. PR-16이 예고한 항목이 실제 시행되므로: ① `buyer_account`/`auth.users`에서 **통지 대상자 목록을 1개 쿼리로 추출 가능**한 구조 유지 ② 유출 대응 절차 문서화 ③ CPO 지정 상태 확인. **시행령 세부 기준과 우리 규모의 ISMS-P 해당 여부는 변호사 검토 필요** |
| **BP-20** | `PUBLIC_LISTING_EXPOSED_FIELDS`를 3버킷으로 재구성(§2.7) + 파트너 처리방침 §7 동기화 | 권고 | 뷰 분리(BP-1)와 **같은 PR에서** 처리. 따로 하면 반드시 잊는다 |
| **BP-21** | 문의 본문 중복 제출(EDGE-B8)에서 **본문이 전송 실패 후 브라우저에 남는 경우**(OQ-B13 로컬 임시 보관) | 권고 | 임시 보관을 채택한다면 **`sessionStorage`(탭 종료 시 소멸)**를 쓰고 `localStorage`는 쓰지 말 것. 공용 PC에서 다음 사용자에게 남는다. 제출 성공 시 즉시 삭제 |

---

## 11. P5a DoD 추가 게이트 (PRD §4.4에 병합 요청)

기존 P5a DoD의 5개 확인 항목은 유효하다. 아래를 **추가**한다.

**뷰·권한**
- [ ] anon 키로 `/rest/v1/partner_detail_buyer` 호출 시 **0행 또는 권한오류**
- [ ] **파트너 세션**으로 `partner_detail_buyer` 조회 시 **0행** (§2.5 목적 제한)
- [ ] anon 키로 `partner_list_public` 조회 시 **§2.4 표의 컬럼만** 반환되고 `company_intro_text`/`reference_projects`/`business_registration_number`/`contact_*`가 **컬럼 자체로 존재하지 않음**
- [ ] `public.partner_public` 뷰가 **더 이상 존재하지 않음**(또는 anon grant가 회수됨)
- [ ] `public_listing` 동의를 철회한 파트너가 **두 뷰 모두에서 즉시 사라짐**, `partner_category_public`에서도 사라짐
- [ ] 바이어 세션으로 `public.partner` / `partner_standard_category` 직접 SELECT 시 **0행**, INSERT/UPDATE 시 **거부**

**principal / 감사**
- [ ] 같은 `auth_user_id`로 `buyer_account`와 `partner_account`를 동시에 만들려 하면 **FK 위반으로 실패**
- [ ] 바이어 세션 토큰으로 `/admin/leads` REST 직접 호출 시 **거부** (screen-spec §1.3 권고 채택)
- [ ] 바이어 행위가 `audit_log`에 **`actor_kind='buyer'` + `actor_buyer_account_id`**로 기록됨 (`'system'`이 아님)
- [ ] `seepn_inquiry.*` / `admin_seepn_inquiry.*` action이 **화이트리스트에 있어 예외 없이 기록**됨
- [ ] `get_seepn_inquiry_contact()` 호출이 감사에 남고, **감사 실패 시 원문이 반환되지 않음**
- [ ] 기존 `private.is_active_admin()` / `is_active_partner()`가 바이어를 참으로 판정하지 않음 (PR-8 회귀)

**문의 / 관심등록**
- [ ] `create_seepn_inquiry`가 **발신자 연락처 파라미터를 갖지 않음**(시그니처 검증), 구조화 필드 파라미터도 없음
- [ ] 레이트리밋이 **RPC를 직접 호출해도** 동작함 (라우트 우회 테스트)
- [ ] Admin 문의 **목록에 본문 원문이 노출되지 않음**(또는 서버측 패턴 마스킹 적용)
- [ ] 바이어 탈퇴 시 **관심등록이 하드 삭제**되고, **미종결 문의가 종결 + 본문 파기**됨
- [ ] 바이어 탈퇴 시 Supabase Auth **모든 리프레시 토큰 무효화**(`auth.admin.signOut(user_id, 'global')`) — 파트너 PR-9 절차 승계

**설정 / 문서**
- [ ] Supabase Auth **"Allow new users to sign up"이 여전히 OFF**임을 배포 전 재확인 (BP-3)
- [ ] 가입 화면에서 켜져 있는 **모든 로케일**에 약관·처리방침 문서가 실재하고, 링크가 그 판본을 가리킴 (BP-9)
- [ ] `buyer_consent.document_version` + `consent_locale`이 **바이어가 실제로 본 판본**으로 기록됨
- [ ] 파트너 원문 **자동번역이 켜져 있지 않음** (BP-11)
- [ ] `PUBLIC_LISTING_EXPOSED_FIELDS` 3버킷 갱신 + 파트너 처리방침 §7 동기화 (BP-20)

---

## 12. 핸드오프

### backend-developer — 착수 전 반드시 아는 것

1. **뷰는 3개다**(§2.4). `private.partner_public_base`(게이트 1회) → `public.partner_list_public`(anon) + `public.partner_detail_buyer`(`is_active_buyer()`). **3계층 게이트를 두 번 쓰지 말 것.** `select p.*` 형태의 뷰 금지.
2. **`public.partner`에 바이어 RLS 정책을 추가하지 말 것**(§2.5). 테이블 전체 컬럼 grant 때문에 사업자번호·마스킹 연락처가 딸려 나간다.
3. **`audit_log.actor_kind` + `action` 화이트리스트를 같은 마이그레이션에서 확장**할 것(§4.2). 안 하면 문의 생성이 100% 실패한다.
4. **`create_seepn_inquiry(p_partner_id, p_body)` — 파라미터 2개**(§5.3). 발신자·구조화 필드 파라미터를 만들지 말 것.
5. **레이트리밋은 RPC 내부 DB 카운트**(§5.3(g)). 라우트에 두면 우회된다.
6. **`finalize_buyer_signup`은 `service_role`에만 grant**하고, Auth 공개 가입 설정은 **건드리지 않는다**(§5.2).
7. **`buyer_account`에 관리자 SELECT 정책을 만들지 말 것**(§5.3(e)). 마스킹 목록 RPC + 감사 reveal RPC 2개만.
8. **인증 클라이언트는 `/supplier` 우회 패턴을 처음부터 복제**하고, 쿠키명 상수는 **`'use client'`가 없는 별도 모듈**에 둔다(§7). 신규 서버 env var는 `next.config.js` `env` 블록에.
9. **탈퇴 시 bookmark는 하드 삭제, 미종결 문의는 종결+본문 파기**(§5.3(f), §6.2).
10. 확인 요청: **지금 프로덕션의 `select count(*) from public.partner_public`** (§2.2 말미).

### frontend-developer / ui-ux-designer

- BY-11 폼에 **"회신은 {email}로 드립니다"** 읽기 전용 표시 + `CapabilityForm.tsx` L316과 **동일 문구**의 입력 경고(§5.3(c)).
- BY-08 목록에 **찜 상태를 서버 렌더로 섞지 말 것**(§7.4).
- SUP-13 공개 전환 화면의 공개 필드 설명을 **3버킷으로 교체**(§2.7).
- Admin 문의 목록에 **본문 미리보기를 넣지 말 것**(§5.3(d)), 상세에 **"바이어 식별정보를 파트너에게 전달하지 마세요"** 가이드 노출(§5.4).

### qa-reviewer

§11 체크리스트 전체. **1순위 3건**: ① anon 키로 상세 뷰 직접 호출 ② 파트너 세션으로 상세 뷰 호출 ③ 레이트리밋 RPC 직접 호출 우회. 셋 다 **UI를 거치지 않는 경로**로 검증할 것 — GAP-1이 바로 그 이유로 생긴 문제다. EDGE-B13(3원 쿠키 동시 로그인)도 유지.

### product-manager

- **OQ-B2 → 접근통제로 확정**(§2.2), **OQ-B5 → 이메일만으로 확정**(§5.1), **OQ-B12 → 유지로 확인**(§6.2).
- **OQ-B3(로케일)에 개인정보 제약이 걸렸다**: 켤 로케일 수 = 완성된 법무 문서 수(§8.3). 문서 3개를 못 맞추면 UI 1개로 시작하면 된다.
- **OQ-B1 관련 신규 제약**: 완성도순 정렬은 파트너 동의 고지 갱신이 선행한다(§2.6). 기본 권고는 **최신순/회사명순 2종으로 시작**.
- **신규 결정 요청 1건 (§5.4)**: 운영자가 문의를 파트너에게 전달할 때의 규칙. 이 검토의 권고는 "익명 요약만 전달, 식별정보는 건별 동의 후"이며, 이는 **운영 SOP로 문서화되어야** 실효가 있다.
- BP-18(미접속 파기 기간)은 값 결정 사항.

### ceo-advisor (에스컬레이션)

> **[2026-09-10 처리 완료] 아래 에스컬레이션 3건에 대해 ceo-advisor가 결정하고 대표가 확인했다(PRD §1.2 D-14).** 원 질의·권고는 이력 보존을 위해 아래에 그대로 남기고, 각 항목 끝에 **"→ ceo-advisor 승인"** 블록으로 결정을 병기한다. **결정 ④(바이어 계정 파기 기준)는 원래 PM 결정 사항(BP-18)이었으나 같은 자리에서 함께 확정됐다.**

1. **2026-09-11 개정법이 P5a 배포 전에 시행된다**(§10 BP-19). 유출 가능성 인지 시 72시간 통지, '유출등'에 훼손 포함, CPO 이사회 의결·신고, 일정 규모 이상 ISMS-P 의무화. **P5a로 개인 소비자 계정이 처음 생기는 시점**이므로, 정보주체 수가 파트너(사업자)에서 일반 이용자로 확장된다는 점에서 이 시점이 CPO 지정·내부관리계획·유출 대응 절차를 정비할 적기다. **변호사 검토 필요.**

> **→ ceo-advisor 승인 (2026-09-10, D-14①) — Go. 개정법은 P5a 지연 사유가 아니다.**
>
> - **CPO 이사회 의결·ISMS-P는 규모 미해당으로 판단**하고 진행한다(확정 판단이 아니라 진행 전제이며, 해당 여부 자체는 변호사 검토 큐로 넘긴다 — §14-2/§14-3).
> - **배포 전 필수는 "유출 대응 절차" 1페이지 하나뿐.** 확인 결과 유출 대응 절차 문서도 **내부관리계획 문서도 존재하지 않았고**(대표 확인 완료), 이번에 **둘 다 신규 작성**했다.
>   - `docs/03-security/data-breach-response-procedure-v1.0.md` — 인지 → 판단 주체(대표) → **72시간 기산점(= "최초 인지 시각"이며 대표에게 보고된 시각이 아니다)** → 봉쇄 → 통지 대상자 추출 → 통지 문안 템플릿 → 개인정보보호위/KISA 신고 경로.
>   - `docs/03-security/internal-management-plan-v1.0.md` — CPO 지정, 취급자 범위, 접근권한 관리, 접근 통제, 암호화, 접속기록 보관·점검, 물리적 조치, 교육, 점검 대장.
> - **CPO 지정 상태는 확인 완료** — 최종훈 대표이사 겸임이 파트너 처리방침 §1·§14에 이미 공개되어 있다. 신규 지정 행위는 불필요하다.
> - **두 문서를 쓰면서 나온 신규 발견 3건.** P5a 차단 사유는 아니지만 별도 처리가 필요하다.
>
> | ID | 발견 | 위험도 | 조치 |
> |---|---|:---:|---|
> | **BP-22** | **통지 대상자를 뽑는 쿼리·함수가 하나도 준비되어 있지 않다.** 필요한 쿼리는 `auth`/`private` 스키마를 읽으므로 PostgREST로는 불가능하고 Dashboard SQL Editor(대표 계정) 또는 `service_role`로만 실행된다. 게다가 S-2(키 유출) 시나리오에서는 **키 회전과 대상자 추출의 선후 관계**가 문제가 된다 | **주요** | 유출 대응 절차 §5-1에 쿼리 5종(관리자/파트너 계정/파트너 담당자/바이어/FKP 요청자)을 확정 기재. **P5a에서 `private.breach_notification_targets()` 정의자 함수로 사전 구현**하고 `service_role`에만 grant, 호출 자체를 감사 → backend-developer |
> | **BP-23** | `private.purge_expired_audit_log()`가 `occurred_at < now() - interval '2 years'`로 **action 구분 없이 일괄 삭제**한다. 그런데 **접근 권한의 부여·변경·말소 내역은 최소 3년** 보관이 요구된다 → `admin_user.role_grant`/`role_revoke` 기록이 2년에 사라진다 | **주요** | **[임시 조치 완료 및 프로덕션 반영 완료 — 2026-09-10]** 권한 관련 action은 purge 대상에서 제외, 무기한 보존으로 전환(`supabase/migrations/20260910150000_audit_log_permission_retention_hold.sql`). QA 리뷰에서 최초 제외 목록(`admin_user.role_grant`/`role_revoke`, `role.create`/`update`/`delete`)이 실제로는 코드베이스에서 한 번도 기록되지 않는 예비 문자열뿐이었고, 관리자에게 실제로 role을 부여하는 유일한 경로가 남기는 `admin_access_request.approve`가 빠져 있던 결함을 발견 → 제외 목록에 `admin_access_request.approve` 추가로 수정. **대표가 Supabase Dashboard SQL Editor에서 직접 실행, `pg_get_functiondef`로 두 exclusion 문자열 포함 여부(`true`/`true`) 확인 완료.** 정확한 보관기간은 M-2 법무 회신 대기 중 |
> | **BP-24** | 파기 배치 `private.run_daily_retention_batches()`의 **pg_cron 실제 등록 여부가 미확인**이다 — cron 등록은 마이그레이션이 아니라 Dashboard 수동 단계였다. 반면 파트너 처리방침 §5·§12는 **"매일 1회 자동 파기"를 이미 공개**하고 있다 | **주요** | **[해소 — 2026-09-10]** 대표가 `select * from cron.job where jobname = 'fkp-daily-retention-batches'` 및 `cron.job_run_details`로 직접 확인: `active = true`, 최근 실행 `status = 'succeeded'`. pg_cron 등록·실행 모두 정상 확인됨 |

2. **§5.4(바이어 정보를 파트너에게 전달)는 기술 문제가 아니라 운영 규율 문제다.** 매칭을 빨리 성사시키려는 압력이 정확히 이 선을 넘게 만든다. 운영 SOP + Admin 화면 가이드 + 감사로그 3중으로 막아 두되, **대표가 "이건 넘지 않는 선"으로 못박아 주는 것이 가장 효과적**이다.

> **→ ceo-advisor 승인 (2026-09-10, D-14②) — §5.4의 권고를 그대로 채택했고, 한 가지는 더 엄격해졌다.**
>
> - **바이어의 이름·이메일·연락처·소속은 어떤 이유로도 파트너에게 전달하지 않는다.** 익명 요약만 전달한다.
> - **가입 시 포괄 동의는 반려.** `third_party_share`를 가입 동의 화면에 올리지 않는다(§8.3 동의 항목 표 그대로 — v1.0 미사용, 값 자리만 확보).
> - **예외가 필요한 건은 운영자가 임의 판단하지 않고 대표 승인을 거친다.** 본 검토는 "건별 동의"까지만 요구했으나 **대표 승인 게이트가 한 단계 더 얹혔다.**
> - 월 10건을 초과하면 자동화(건별 동의 UI)를 재검토한다.
> - **backend-developer 영향**: `seepn_inquiry` / Admin 문의 화면에 **"바이어 식별정보를 파트너에게 전달 금지"** 가이드를 **상시 노출**(§5.4 4번), `buyer_consent.consent_type`에 `third_party_share` **값 자리만** 확보.
> - **익명 요약 전달의 허용 범위**(어디까지 요약해야 익명인가)는 변호사 검토 큐 14번으로 넘긴다.

3. **약관의 스크래핑 금지 조항(§8.2 표 1번)은 파트너에게 한 약속을 지키는 유일한 계약적 장치다.** 뷰 분리(기술)와 약관(계약) 둘 다 있어야 "우리가 검증했고 함부로 유통되지 않는다"는 SEEPN의 약속이 성립한다.

> **→ ceo-advisor 승인 (2026-09-10, D-14③) — 조항 유지. 다만 같은 자리에서 로케일 범위가 함께 확정됐다.**
>
> - **P5a는 한국어(ko) 단일 로케일로 연다. en/ja 가입은 열지 않는다.** 근거: 파트너 원문 자동번역이 아직 없어 영·일 UI를 열어도 상세 내용이 한국어라 실질 가치가 없고, 해외 바이어는 이미 FKP 폼으로 수용 중이다.
> - **이로써 BP-9(치명적)의 이행 부담이 실질적으로 해소된다** — §8.3의 확정 규칙("켜는 로케일 = 약관·처리방침이 실재하는 로케일")이 **ko 1개**로 좁혀졌으므로, 가입 오픈 전에 필요한 법무 문서는 **`seepn-buyer-{terms,privacy}-v1.0-2026-09-ko.md` 2건뿐**이다. **BP-10(신규 작성 필수)은 그대로 유효**하며, 이 2건이 없으면 여전히 가입을 열 수 없다.
> - en/ja는 TR-4″-2b 선행조건(자동번역)이 해소되는 시점에 **법무 문서 en/ja와 함께** 재검토한다. **문서 없이 UI만 먼저 켜는 것은 그때도 금지**다(§8.3의 "반대는 성립하지 않는다").
> - **frontend-developer 영향**: 로케일 인프라는 3개국어 대응 가능하게 설계하되 **실제 활성화는 ko만**(화면정의서 §1.6).
> - 스크래핑 금지 조항 자체는 `seepn-buyer-terms-v1.0-2026-09-ko.md`에 반영하고, **집행 가능성·문언은 변호사 검토 큐 13번**으로 넘긴다.

4. **[추가 확정 — 원래는 PM 결정 사항이었던 BP-18] 바이어 계정 장기 미접속 파기 기준**

원 권고(§6.2 / §10 BP-18): "12개월 미접속 시 안내 → 30일 후 파기(파트너와 같은 숫자). **값은 PM/대표 결정이되, 처리방침에 적은 숫자와 배치 동작이 어긋나면 그 자체가 위반**이다."

> **→ ceo-advisor 승인 (2026-09-10, D-14④) — 권고안 그대로 확정. 12개월 미접속 → 안내 → 30일 후 파기.**
>
> - **`buyer_account.last_login_at` 컬럼이 필수**가 된다(`partner_account`와 동일 shape). 안내 발송 사실도 기록해야 "안내 후 30일"을 입증할 수 있으므로 **안내 발송 시각 컬럼 또는 전용 감사 action**이 필요하다 → backend-developer.
> - 파기 배치는 `retention_jobs.job_type`에 신규 값(예: `buyer_account_dormant_purge`)을 추가하되 **기존 CHECK 전체 재선언 관례**를 지킬 것.
> - **이 숫자는 바이어 개인정보처리방침 §5(보유기간)에 그대로 적힌다.** 배치가 없거나 주기가 다르면 문서가 거짓이 된다 — **BP-24(pg_cron 등록 미확인)와 직접 연결**되므로, **배치 등록 확인 없이 이 문구를 처리방침에 쓰지 말 것.**

> **→ 위 D-14④는 같은 날 대표 재결정으로 대체되었다 (2026-09-10, 이하 "휴면 재결정"). 원 결정은 위에 그대로 보존한다.**
>
> - **유예기간 30일 → 6개월.** 휴면 기준(마지막 로그인 후 12개월)은 변경 없다.
> - **처리 방식 변경**: 자동 탈퇴 시 `private.purge_dormant_buyer_accounts()`는 **`buyer_account.status`만 `withdrawn`으로 전환**하고, **`buyer_bookmark` 삭제와 `seepn_inquiry` 강제종결·본문 파기는 하지 않는다.** 이용자 자발 탈퇴(`public.buyer_withdraw()`)와 **의도적으로 다른** 처리이며, 회사 주도 처리라 재로그인·이의 제기에 대비해 데이터를 보존하는 것이 목적이다 → backend-developer(별도 작업으로 진행 중).
> - 위 세 번째 bullet의 원칙("문서 문구 = 배치 동작")은 그대로 유효하며, 이에 따라 처리방침 §5·§10·§12와 약관 제9조 제4항·제10조 제4항·제12조 제4항·제5항을 함께 제자리 수정했다(`legal-review-queue.md` 버전이력 1.4).
> - **법적 판단은 미해소** — 안내 메일 미발송 상태에서의 일방 해지 가능 여부(P-19 ①②)에 더해, **해지 후 데이터를 기간 상한 없이 보존하는 것과 법 제21조 제1항 파기 의무의 양립 여부(P-19 ③ 신규)**가 변호사 검토 큐에 남아 있다. **배치를 실제로 켜기 전에 회신이 필요하다.**

---

## 13. 참고

**코드 (본 검토가 직접 확인한 것)**
- `supabase/migrations/20260829140000_partner_schema.sql` §4, §5, §11 (partner GRANT/RLS, private.partner_contact, partner_public 뷰)
- `supabase/migrations/20260829150000_standard_category_schema.sql` §1~§3 (카테고리 마스터 공개 정책, partner_standard_category 권한)
- `supabase/migrations/20260829130000_partner_auth_foundation.sql` §1, §4, §5, §6 (auth_principal, audit_log 확장, 판정 함수, 공개 콘텐츠 정책)
- `supabase/migrations/20260908100000_standard_category_translation_ai_guard.sql` L190~ (audit_log.action 최신 화이트리스트)
- `supabase/migrations/20260908110000_notice_board_core.sql`, `20260909100000_notice_target_audience_lock.sql` (target_audience)
- `lib/supabase/supplierServerAuthClient.ts`, `lib/supabase/supplierAuthCookieName.ts`, `lib/supplier/session.ts`, `middleware.ts`
- `lib/supplier/publicListingDisclosure.ts`, `lib/legal/partnerConsentVersions.ts`
- `app/supplier/profile/{capability/CapabilityForm.tsx,basic/BasicInfoForm.tsx}` (PR-14 경고 캡션 실재 확인)

**문서**
- `docs/03-security/partner-signup-privacy-review.md` (PR-1~PR-16, §2 3원 분리 원칙, §4 보관·파기, §6 문서 체크리스트)
- `docs/03-security/notice-board-privacy-review.md` §3~§5 (target_audience가 접근통제 축이 아닌 이유)
- `docs/legal/partner-privacy-v1.0-2026-09-ko.md` §7(공개 노출), §8(위탁), §9(국외이전)

**법령·자료** (조문·시행일은 확인용이며 **변호사 검토 필요**)
- 개인정보 보호법 제15조(수집·이용), 제16조(최소수집), 제17조(제3자 제공), 제20조(수집출처 고지), 제21조(파기), 제22조(동의를 받는 방법), 제28조의8(국외 이전), 제29조(안전조치), 제30조(처리방침)
- [2026년 개정 개인정보 보호법 — 9월 11일 시행 대응 가이드](https://datalaw.kr/guides/pipa-2026-amendment/) — 유출 가능성 72시간 통지, '유출등' 범위 확대, CPO 이사회 의결·신고, ISMS-P 의무화, 과징금 상한
- [2026년 개인정보 보호법 개정 핵심과 기업 대응](https://exosp.com/blog/2026-personal-information-protection-act)
- [CPO의 이사회 보고 의무 — 9월 11일 개정법 정리](https://www.catchsecu.com/archives/24854)
- [개인정보 국외 이전 운영 등에 관한 규정 (국가법령정보센터)](https://www.law.go.kr/LSW/admRulLsInfoP.do?admRulSeq=2100000230332)
- [개인정보 보호법 제28조의8 (CaseNote)](https://casenote.kr/%EB%B2%95%EB%A0%B9/%EA%B0%9C%EC%9D%B8%EC%A0%95%EB%B3%B4_%EB%B3%B4%ED%98%B8%EB%B2%95/%EC%A0%9C28%EC%A1%B0%EC%9D%988)
- [개인정보의 안전성 확보조치 기준 (국가법령정보센터)](https://www.law.go.kr/admRulLsInfoP.do?chrClsCd=010202&admRulSeq=2100000229672)

---

## Version History

| Version | Date | Changes | Author |
|---|---|---|---|
| 1.2 | 2026-09-10 | **D-14④(휴면 12개월/30일 파기) 대체 결정 병기 — §12 결정 ④ 아래에 "휴면 재결정" 블록 추가(원 결정은 보존).** 유예기간 30일→6개월, 자동 탈퇴 시 `buyer_account.status`만 `withdrawn`으로 바꾸고 `buyer_bookmark`·`seepn_inquiry`는 손대지 않는 방식으로 변경. BP-18의 원칙("처리방침 숫자 = 배치 동작")에 따라 바이어 법무 문서 2건을 제자리 수정했고(`legal-review-queue.md` 1.4), **법적 판단(안내 미발송 상태의 일방 해지 + 해지 후 무기한 보존과 법 제21조)은 P-19·T-9에 미해소로 남아 배치 가동 전 회신이 필요하다** | privacy-security-officer |
| 1.1 | 2026-09-10 | **ceo-advisor 결정 4건 인라인 반영(PRD D-14).** §12 에스컬레이션 3건에 각각 "→ ceo-advisor 승인" 블록 병기(원 질의·권고는 보존) + 결정 ④(바이어 12개월/30일 파기, 구 BP-18) 추가. D-14① 이행으로 `data-breach-response-procedure-v1.0.md` / `internal-management-plan-v1.0.md` 신규 작성(둘 다 기존 미존재 확인). 그 과정에서 **BP-22(통지 대상자 추출 함수 부재) / BP-23(권한 변경 이력 2년 purge — 법정 3년 미달) / BP-24(파기 배치 pg_cron 등록 미확인)** 3건 신규 발견, §0.3·§12에 기재. D-14③으로 BP-9의 이행 범위가 ko 1개 로케일로 축소(BP-10은 유효) | privacy-security-officer |
| 1.0 | 2026-09-10 | 최초 작성. PRD D-3′/D-12/D-13 + screen-spec §11 PSO-1~5 + §4.4 P5a DoD ①~⑤ 기준. 마이그레이션 원문 대조로 F-1~F-14 확인 — GAP-1/GAP-2 사실 확정, `partner_public`의 PR-1/B-9c′ 준수는 **합격** 확인, GAP-3·audit_log 화이트리스트·`log_audit` else 분기 등 추가 발견. 배포 전 필수 14건(BP-1~14, 치명적 2건) + 권고 7건(BP-15~21). 3-뷰 분리 설계, `partner_category_public`, `seepn_inquiry` 처리 기준, bookmark 보관 기준, 바이어 법무 문서 판정, 국외이전 판정, 인증 클라이언트 구현 지시 확정. P5a DoD 추가 게이트 28항목 | privacy-security-officer |
