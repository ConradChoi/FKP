# 공지사항(Notice) 게시판 — 개인정보/보안 검토

작성: privacy-security-officer · 2026-09-08
대상: [`notice-board-v1.0.prd.md`](../01-plan/features/notice-board-v1.0.prd.md) §9(NS-1~NS-5) · §7.2 · §7.6 · [`notice-board.screen-spec.md`](../02-design/features/notice-board.screen-spec.md) §2 · §3.9 · §4.2 · §4.3 · [`notice-board.ui-spec.md`](../02-design/features/notice-board.ui-spec.md) §2.2 · §2.3 · §3.3 · §3.7
기준선(baseline): [`partner-supplier-app-ui-privacy-review.md`](./partner-supplier-app-ui-privacy-review.md) — **UI-B4(업로드 서버 경유 + 매직바이트), PR-2(Storage RLS 경로 규약)를 그대로 승계**한다. 본 문서는 그 원칙을 "정반대 성격(공개 읽기)의 새 버킷"에 적용한 것이다.
근거 코드(전부 직접 Read 확인): `supabase/migrations/20260827100000_phase5_content_management_schema.sql`(§5·§6·§7), `20260829140000_partner_schema.sql`(§8b Storage RLS), `20260904100000_supplier_app_privacy_fixes.sql`(§4a 버킷 제약), `20260825120000_phase3_admin_rbac.sql`(감사 보관 2년), `lib/supabase/{serverClient,serverAuthClient,supplierBrowserClient,adminClient}.ts`, `lib/content/{getPublishedContent,renderMarkdown}.tsx`, `lib/forms/fileSignature.ts`
수신: **backend-developer(마이그레이션 첫 줄 쓰기 전 필독)** · frontend-developer · ui-ux-designer(§1 회신) · service-planner · qa-reviewer · project-manager · product-manager

> **면책**: 본 문서는 실무 검토이며 법률 자문이 아니다. "**변호사 검토 필요**"로 표시한 항목은 실제 운영 개시 전 법률 검토를 권한다. 그 외는 마이그레이션 SQL·애플리케이션 코드·공개 법령에서 확인 가능한 사실관계에 기반한다.

---

## 0. 결론 요약

### 0.1 검토 등급 판정 — "경량 확인"에서 승격

PRD §9는 "정식 리뷰 대상 아님, 경량 확인 5건"으로 예상했다. 그 판단은 **NS-4/NS-5를 조건부 승격 대상으로 남겨뒀고, NS-5의 조건이 충족되었다**(D-N0-6으로 이미지 업로드 확정 → 익명 읽기 버킷 신설 확정). 여기에 코드 확인에서 PRD가 전제하지 않았던 사실 2건이 추가로 나왔다(§0.3). 따라서 **NS-1/NS-2/NS-3은 경량 확인으로 종결하고, NS-5는 정식 검토로 처리**한다. NS-4(HTML 저장)는 아직 조건 미충족 — frontend-developer가 마크다운 유지(C-2 권고)를 확정하면 열지 않는다.

**새로운 개인정보 수집은 없다.** 공지는 브로드캐스트 콘텐츠이고, `target_audience`는 정보주체 속성이 아니다. 개인정보처리방침·이용약관 개정은 이 기능 자체로는 불필요하다(§6.3).

### 0.2 배포 전 반드시 해소 (blocking)

| ID | 항목 | 위험도 | 게이트 |
|---|---|:---:|---|
| **NB-B1** | 새 이미지 버킷에 대해 `storage.objects`의 **anon/authenticated SELECT 정책을 만들면 안 된다.** `public=true` 버킷은 URL 직접 읽기에 RLS를 타지 않으므로 SELECT 정책은 읽기 허용이 아니라 **목록(list) 허용**이 된다 → 파일명 무작위화(NB-B2)가 통째로 무효화되고 전체 이미지가 열거된다 | **치명적** | 버킷 마이그레이션 |
| **NB-B2** | 업로드 파일명은 **서버 생성 UUID**여야 한다. 원본 파일명 사용 금지(`사업자등록증_OO주식회사.png` 같은 이름 자체가 정보 노출이고, 공개 버킷에서 추측 가능한 URL이 된다). 확장자는 **탐지된 MIME에서 파생**(선언 MIME/원본 확장자 신뢰 금지) | **치명적** | 업로드 라우트 |
| **NB-B3** | G-1을 **`content_item`/`content_translation`에 `to authenticated` SELECT 정책을 추가해서 풀면 안 된다.** 현재 admin 정책은 `has_menu_permission('content_management','read')`로 게이트돼 있는데, 넓은 `authenticated` 정책은 그 옆에 OR로 붙어 **모든 로그인 파트너·`content_management` 없는 관리자에게 PostgREST 직접 읽기를 연다**(술어를 느슨하게 쓰면 draft까지). 확정 설계(anon 키 서버 클라이언트)가 맞다 — §4.1 | **치명적** | 백엔드 착수 전 |
| **NB-B4** | 업로드는 **서버 라우트 경유**(`app/api/partner/documents/route.ts` 선례), **`service_role` 사용 금지**. 관리자 본인 JWT로 Storage에 쓰게 해서 `storage.objects` RLS가 실제 통제선이 되게 한다. service_role을 쓰면 권한 검사가 애플리케이션 코드에만 존재하게 된다 | **치명적** | 업로드 라우트 |
| **NB-B5** | `target_audience` **CHECK 2종 + 기본값 없음**을 `create_content_item` 시그니처 변경(G-3)과 **같은 마이그레이션**에 넣는다. CHECK가 없으면 NULL 대상 공지가 생성 가능해지고, 이후 seepn.me 착수 시 NULL 행 일괄 백필 과정에서 **잘못된 대상 노출**이 발생한다 — §5 | **주요** | WS-1 마이그레이션 |
| **NB-B6** | 대상 필터는 **DB 레벨 양성 매칭(`.eq('target_audience','partner')`)만** 쓴다. JS 부정 필터(`!== 'seepn_user'`) 금지 — NULL을 통과시켜 유출된다. 추가로 `getPublishedContentList('notice', …)`가 **대상 무관 전량을 반환하는 우회 경로**로 남으므로 차단해야 한다 — §4.2 | **주요** | 조회 함수 구현 |
| **NB-B7** | **발행(draft → published) 시점에 확인창 1회**를 추가한다. NS-1/NS-5 상시 캡션은 유지하되(§1 톤 판단 동의), "되돌릴 수 없는 순간"에 대한 차단형 확인이 하나도 없다 — §1.2 | **주요** | WS-1 |
| **NB-B8** | NS-1 캡션은 **에디터 카드가 아니라 본문 필드에 결속**한다. ui-spec §2.5는 캡션을 에디터 카드 레이아웃 안에 그렸는데, WS-1은 에디터 없이(plain textarea) 먼저 배포된다 → **NS-1 경고가 WS-1에 누락된 채로 나간다** — §1.3 | **주요** | WS-1 |
| **NB-B9** | **업로드 이미지의 실제 삭제 경로**가 있어야 한다. 현재 설계는 본문에서 지워도 파일이 공개 URL에 영구 잔존하는데(W-N11), ui-spec §2.3은 "화면에 알릴 필요 없음"이라고 했다. 개인정보가 담긴 이미지를 잘못 올렸을 때 **복구 수단이 없는 상태로 배포하면 안 된다** — §2.6 | **주요** | WS-3 |
| **NB-B10** | 업로드 시 **EXIF 등 메타데이터 제거**. 위치정보(GPS)는 편집 화면 미리보기에 보이지 않으므로 **어떤 경고 문구로도 잡히지 않는 유일한 유형**이다 — §2.5 | **주요** | WS-3 |

### 0.3 PRD가 전제하지 않았던 사실 2건 (검토 중 발견)

| # | 사실 | 영향 |
|---|---|---|
| **F-1** | **anon 키가 브라우저 번들에 포함돼 있다.** `lib/supabase/supplierBrowserClient.ts`가 `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 읽는다(Amplify 환경변수 전파 버그 우회의 부수 결과, `serverClient.ts` 주석에 경위 기록됨). 즉 누구나 번들에서 키를 꺼내 `GET /rest/v1/content_item?select=*,content_translation(*)`로 **published 공지 전량(partner + seepn_user)을 직접 열거**할 수 있다 | NS-1의 "사실상 공개 데이터"는 이론적 표현이 아니라 **실제로 열거 가능**하다는 뜻이다. §1의 경고 강도 판단 근거이자, "로그인해야 보이니까 괜찮다"는 오해를 코드 주석으로 막아야 하는 이유(NB-R7) |
| **F-2** | **`upsert_content_translation`이 `before_summary := to_jsonb(t)`로 본문 전체를 감사로그에 복제**한다(`20260827100000...sql:504`). `audit_log` 보관기간은 **2년**(`20260825120000...sql:1659`) | 개인정보가 섞인 공지를 수정·삭제해도 **원본 본문이 `audit_log`에 2년 남는다.** 파기 대응 절차에 반드시 포함해야 한다 — §6.2. (이번 기능이 만든 문제가 아니라 기존 content 경로의 성질이지만, 공지는 운영자 자유서술이고 NS-1이 "개인정보 유입 가능"을 전제하므로 이번에 처음 실효적 위험이 된다) |

### 0.4 이 문서가 **뒤집지 않는** 것

| 확인 항목 | 결과 |
|---|---|
| ui-ux-designer의 "NS-1/NS-5는 박스 없는 상시 캡션" 결정 | **옳다. 유지.** 경고 피로 논거가 정확하고, 보안 완화가 아니다 — §1.1 |
| ui-ux-designer의 "N-R6은 박스형, 행 단위는 아이콘" 3중 차등 | **옳다. 유지.** 대상 오발행 경고는 개인정보 이슈가 아니라 운영 이슈이며, 차등 자체가 §1.1과 같은 원리다 |
| D-N0-8(비공개 공지 불필요) / W-N8 | **옳다.** 현재 RLS 구조상 "비공개 공지"는 구현할 수 없다 — 만들려면 별도 테이블 + 별도 RLS가 필요하고, 그건 §7.4가 이미 기각한 안이다. 지금 안 만드는 것이 맞다 |
| `partner-doc` 재사용 금지 판정 | **옳다.** 두 버킷은 목적·읽기 권한·보관기간·파기 의무가 전부 반대다. 같은 버킷에 두면 `partner-doc`의 파기 크론이 공지 이미지를 지우거나(본문 깨짐), 반대로 공지용 공개 정책이 파트너 문서에 새는 사고가 난다 |
| `/supplier/notices`에 이메일 미인증 파트너 접근 허용(screen-spec §4.1) | **문제 없다.** 공지는 anon도 읽을 수 있는 데이터라 더 가둘 보안상 이유가 없다 |
| 새 권한 코드를 만들지 않고 `content_management`로 게이트(N-R11) | **옳다.** 최소권한 위반이 아니다 — 공지 작성 권한은 기존 콘텐츠 작성 권한과 동일한 위험 프로필이다 |

---

## 1. 확인요청 ① — NS-1 / NS-5 경고 톤 판단

### 1.1 "박스 없는 상시 캡션" 자체는 옳다 — 격상 요청 안 함

ui-spec §2.2가 든 근거(상시 반복 노출을 박스로 만들면 화면이 경고로 뒤덮여 오히려 무시된다)는 **경고 설계 원칙으로 정확하다.** 특히 `seepn_user` 공지의 3열 편집 그리드에서 카드마다 박스 2개(NS-1 + NS-5)가 반복되면 실제로 읽히지 않는다. 시각 무게를 올리는 것은 잘못된 지렛대다.

**따라서 §2.2/§3.7의 캡션 결정은 그대로 승인한다.** 다만 아래 세 가지를 조건으로 붙인다.

### 1.2 그런데 "차단형 확인"이 하나도 없다 — NB-B7

캡션은 **고지(notice)** 통제이지 **확인(confirmation)** 통제가 아니다. 우리가 막으려는 실패 유형은 지식 부족이 아니라 **순간적 부주의**이고, 캡션은 매번 같은 자리에 있기 때문에 가장 빨리 습관화된다(그게 §1.1에서 박스를 반대한 이유와 정확히 같은 현상이다). 현재 설계에는 되돌릴 수 없는 순간에 손을 멈추게 하는 지점이 **한 곳도 없다.**

> **권장 조치(NB-B7)**: **발행(status: draft → published) 전환 시점에만** 확인창을 1회 넣는다. 저장 시점이 아니다.
>
> - 기존 `window.confirm` 패턴 재사용(screen-spec §3.5가 대상 변경에 이미 쓰기로 한 것과 동일 급, 신규 컴포넌트 불필요).
> - 문구(의미 고정, 최종 카피는 ux-writer): **"게시하면 이 공지의 제목·요약·본문·이미지는 로그인 없이 인터넷 누구나 조회할 수 있습니다. 특정 파트너의 상호·담당자·연락처·심사 결과나 개인정보가 담긴 이미지가 들어 있지 않은지 확인하셨습니까?"**
> - 빈도: 월 0~1건 발행 규모(§8.2)이므로 **경고 피로가 발생할 수 없는 빈도**다. 이것이 캡션과 확인창을 다르게 취급할 수 있는 근거다 — 캡션은 매 카드·매 세션, 확인창은 월 1회.
> - `seepn_user` 공지의 경우 이 확인창은 **N-R6 경고(아무도 못 본다)와 함께 뜨는 것이 아니라 별개**다. 두 문구를 한 창에 합치지 말 것 — "아무도 못 본다"와 "누구나 볼 수 있다"가 한 화면에 있으면 서로를 상쇄해 둘 다 안 읽힌다. `seepn_user`는 **소비 화면이 없을 뿐 데이터는 anon에게 열려 있다**(F-1)는 점이 정확히 이 혼동의 위험 지점이다.

### 1.3 NS-1 캡션이 WS-1 배포에서 누락될 구조다 — NB-B8

ui-spec §2.5의 레이아웃은 NS-1/NS-5 캡션을 **"에디터 카드 아래"** 로 그렸다. 그런데 배포 순서상 **WS-1은 에디터 없이(기존 plain textarea) 먼저 나간다**(screen-spec §3.3/§5.4). 이 스펙을 문자 그대로 구현하면 에디터가 없는 WS-1에는 캡션을 붙일 자리가 정의돼 있지 않다.

> **권장 조치(NB-B8)**: NS-1 캡션의 결속 대상을 **"에디터 카드"가 아니라 "본문 입력 필드(무엇이 됐든)"** 로 스펙에 다시 쓴다. WS-1 = textarea 아래, WS-3 = 에디터 카드 아래. NS-5 캡션은 이미지 기능과 함께 오는 것이므로 WS-3에만 있으면 맞다.
> service-planner/ui-ux-designer: 이 한 줄만 문서에 반영해 주면 된다.

### 1.4 캡션 문구 자체 — 한 군데 수정 요청

screen-spec §3.9 NS-1 문구는 "**로그인 여부와 무관하게 인터넷에서 누구나 볼 수 있는 공개 데이터입니다**"로 되어 있다. F-1을 확인한 결과 이 문장은 **과장이 아니라 정확하다.** 그대로 유지한다.

ui-spec §5.3 NS-5 문구("업로드한 이미지는 로그인 없이 인터넷 누구나 볼 수 있습니다…")도 정확하다. 다만 **한 문장 추가**를 요청한다 — 현재 문구는 "공개된다"만 말하고 **"되돌릴 수 없다"** 를 말하지 않는다(NB-B9와 짝):

> 추가 권장: "**본문에서 지워도 업로드된 파일 자체는 남습니다.**"

이 한 문장이 없으면 운영자는 "잘못 올렸으면 지우면 되지"라고 합리적으로 오해하며, 그 오해가 곧 미조치 상태의 개인정보 노출이 된다.

### 1.5 정리 — ui-ux-designer 회신

| 질문 | 답 |
|---|---|
| 박스 없는 캡션으로 충분한가? | **충분하다. 격상 요청 없음.** §2.2의 논거를 그대로 인정한다 |
| 경고 강도를 더 높여야 하나? | **시각 무게가 아니라 통제 유형을 하나 추가한다** — 발행 시점 확인창 1회(NB-B7). 캡션은 건드리지 않는다 |
| 운영자가 못 보고 개인정보를 넣을 위험이 실재하나? | **실재한다.** 다만 가장 큰 위험은 본문 텍스트가 아니라 **① 이미지(삭제 불가, NB-B9) ② EXIF 위치정보(화면에 안 보임, NB-B10)** 다 — 둘 다 경고 문구로는 원리적으로 막을 수 없어 기술적 통제가 필요하다 |

---

## 2. 확인요청 ② — 새 공개 이미지 버킷 설계

### 2.1 버킷 정의 (backend-developer 확정용)

```sql
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('content-image', 'content-image', true,
        array['image/jpeg', 'image/png'],   -- webp는 §2.4 참고
        2097152)                            -- 2MB
on conflict (id) do nothing;
```

- `public = true`는 **읽기 전용 성질**이다. 쓰기는 여전히 `storage.objects` RLS가 통제한다.
- 버킷 레벨 `allowed_mime_types`/`file_size_limit`는 `partner-doc` §4a와 같은 **방어 심화(defense-in-depth)일 뿐**이다. 선언 Content-Type은 위조 가능하므로 실제 통제는 §2.4의 서버측 매직바이트 검사다. 이 위계를 마이그레이션 주석에 그대로 남길 것(선례 문장이 이미 있다).

### 2.2 쓰기 권한 — Storage RLS (NB-B1, NB-B4)

```sql
-- 쓰기: content_management create 보유 관리자만. 다른 버킷에 새지 않도록 case-guard.
create policy content_image_admin_insert on storage.objects
  for insert to authenticated
  with check (
    case when bucket_id = 'content-image'
      then (select private.is_active_admin())
       and (select private.is_aal2())
       and (select private.has_menu_permission('content_management', 'create'))
      else false
    end
  );

create policy content_image_admin_delete on storage.objects
  for delete to authenticated
  using (
    case when bucket_id = 'content-image'
      then (select private.is_active_admin())
       and (select private.is_aal2())
       and (select private.has_menu_permission('content_management', 'delete'))
      else false
    end
  );
```

| 항목 | 결정 | 근거 |
|---|---|---|
| **SELECT 정책** | **만들지 않는다(NB-B1)** | `public=true`면 URL 직접 읽기는 RLS를 타지 않는다. 여기에 SELECT 정책을 추가하면 **읽기가 아니라 목록 API(`/storage/v1/object/list/content-image`)가 열린다** — NB-B2의 파일명 무작위화를 통째로 무효화한다. "공개 버킷이니 anon select 정책을 하나 만들어야겠다"는 것이 이 설계에서 가장 하기 쉬운 실수다 |
| **UPDATE 정책** | **만들지 않는다** | 파일은 불변, 교체는 삭제+신규. `partner_document`가 이미 같은 스탠스다(UPDATE grant 자체가 없음) |
| `case when ... else false` 가드 | **필수** | `partner_doc_owner_rw`가 이미 이 패턴을 쓰는 이유와 동일(qa-reviewer가 2026-08-30에 잡은 항목). 반대 방향도 확인했다 — 기존 `partner-doc` 정책들도 전부 case-guard/명시적 `bucket_id =` 조건이라 **새 버킷이 기존 정책을 상속받지 않는다** |
| `service_role` 사용 | **금지(NB-B4)** | service_role은 RLS를 통째로 우회한다. 위 정책들이 실제로 동작하려면 업로드가 **관리자 본인 JWT**(`getSupabaseAuthServerClient()`)로 실행돼야 한다. `lib/supabase/adminClient.ts`를 이 경로에 쓰지 말 것 |
| 업로드 진입점 | **서버 라우트 핸들러**(예: `app/api/admin/content-image/route.ts`) | UI-B4 선례(`app/api/partner/documents/route.ts`) 승계. 브라우저 → Storage 직접 업로드는 매직바이트 검사·파일명 재생성·EXIF 제거를 전부 우회시킨다 |

### 2.3 파일명·경로 (NB-B2)

```
content-image/{content_item_id}/{uuid}.{ext}
                                 ^^^^ 서버 생성 randomUUID, 원본 파일명 절대 미사용
                                      ^^^ 탐지된 MIME에서 파생 (extensionForDocumentMimeType 선례)
```

- **원본 파일명 사용 금지 이유 3가지**: ① 파일명 자체가 정보다(`사업자등록증_OO주식회사.png`가 공개 URL에 그대로 박힌다), ② 공개 버킷 + 추측 가능한 이름 = 목록 권한 없이도 열거 가능, ③ 경로 조작(`../`)·유니코드 정규화 문제의 근원을 없앤다.
- `{content_item_id}` 폴더는 PM 요구(삭제·추적 용이)대로 유지해도 좋다. 공지는 어차피 공개 콘텐츠라 "이 이미지가 어느 공지 것인지"가 드러나도 문제없다. 단 **폴더 세그먼트가 접근 통제 역할을 하지 않는다**는 점을 주석으로 남길 것(`partner-doc`은 폴더가 곧 소유권 경계지만, 여기는 아니다 — 두 버킷을 헷갈리면 안 된다).

### 2.4 허용/차단 형식 (SVG 외에 추가로 막을 것)

| 형식 | 판정 | 근거 |
|---|:---:|---|
| jpeg / png | **허용** | 매직바이트 탐지기(`lib/forms/fileSignature.ts`)가 이미 지원 |
| **webp** | **v1.0에서는 제외 권고** | **`detectDocumentMimeType`이 webp를 모른다**(PDF/JPEG/PNG만). webp를 허용하려면 RIFF 시그니처 검사를 추가해야 한다 — 바이트 0~3 `52 49 46 46`(RIFF) **및** 바이트 8~11 `57 45 42 50`(WEBP). 앞 4바이트만 보면 RIFF 컨테이너인 다른 포맷(wav/avi)이 통과한다. 굳이 필요하지 않으면 jpeg/png 2종으로 시작하는 편이 안전하고, 늘리는 건 쉽다(§7.6 "보수적으로 시작" 원칙과 동일) |
| **SVG / SVGZ** | **차단** | 스크립트 삽입 벡터. `.svgz`(gzip SVG)와 `image/svg+xml` 변종까지 막으려면 **거부 목록이 아니라 허용 목록**이어야 한다 |
| HTML / XHTML / XML | **차단** | 위와 같은 이유. 허용 목록이면 자동으로 막힌다 |
| GIF | **차단(v1.0)** | 보안 이슈라기보다 불필요 + 애니메이션 GIF는 용량 상한을 쉽게 넘긴다 |
| HEIC / TIFF / BMP / ICO / AVIF | **차단** | 허용 목록 밖. 특히 **HEIC는 EXIF/GPS를 가장 풍부하게 담는 형식**이라 아이폰 사진 직행 경로를 미리 끊는 효과가 있다 |

> **원칙: 허용 목록(allowlist)만 쓴다.** "SVG만 막는다"는 거부 목록 사고는 변종을 반드시 빠뜨린다.

**추가 확인 사항 2건**
- 업로드 시 Storage에 저장하는 `contentType`은 **탐지된 MIME으로 명시 설정**한다. 클라이언트가 보낸 Content-Type을 그대로 저장하면 허용 목록을 통과한 파일이 `text/html`로 서빙될 수 있다.
- 공개 객체는 `*.supabase.co` 오리진에서 서빙되므로, 설령 HTML/SVG가 저장·실행되더라도 **우리 앱 오리진의 세션에는 접근하지 못한다**(피해가 0이라는 뜻은 아니다 — 해당 오리진의 Storage/Auth 컨텍스트는 영향권이다). `X-Content-Type-Options: nosniff` 적용 여부는 Supabase 측 동작이라 **backend-developer가 실제 응답 헤더로 1회 확인**할 것(추정하지 말 것).

### 2.5 EXIF 등 메타데이터 제거 — 필요하다 (NB-B10)

**필요하다. 그리고 이것이 §2에서 가장 중요한 항목이다.**

이유는 위험의 크기가 아니라 **통제 불가능성**이다. 본문 텍스트에 개인정보를 쓰는 것은 캡션·확인창·QA·사후 열람으로 잡을 여지가 있다. 반면 EXIF는 **편집 화면에도, 발행된 화면에도, 검토자 눈에도 전혀 보이지 않는다.** 작성자가 대표 1인이고 현장 사진·스크린샷을 직접 올리는 운영 형태에서, 휴대폰 촬영 사진의 GPS 좌표(파트너 공장 방문지, 자택 겸 사무실 등)·촬영 일시·기기 정보가 그대로 공개 URL에 실린다.

| 구현안 | 판정 |
|---|---|
| `sharp` 등으로 재인코딩 | 메타데이터가 기본적으로 전부 제거돼 가장 확실하지만, **네이티브 의존성이라 Amplify Lambda 번들에서 문제를 일으키기 쉽다**. 프로젝트의 "불필요한 런타임 의존성 억제" 관례와도 어긋난다 |
| **바이트 레벨 스트립(권장)** | jpeg는 `APPn` 세그먼트(특히 APP1=Exif, APP13=IPTC) 제거, png는 `eXIf`/`tEXt`/`iTXt`/`zTXt` 청크 제거. **새 의존성 0, 포맷 2종이면 짧은 Buffer 처리로 끝난다.** 이미 같은 라우트에서 Buffer를 읽고 매직바이트를 검사하고 있으므로 붙일 자리도 이미 있다 |

> **구현 주의**: EXIF를 제거하면 `Orientation` 태그도 사라져 **일부 휴대폰 사진이 눕거나 뒤집혀 표시된다.** 재인코딩 없이 스트립만 할 경우, Orientation을 읽어 실제 픽셀을 회전시키거나(비용 큼), "회전된 이미지는 회전해서 다시 올려달라"는 안내로 처리한다(월 0~1건 규모에서는 후자로 충분). 이 트레이드오프를 모른 채 구현하면 "이미지가 눕는다"는 버그 리포트가 먼저 오고 EXIF 제거가 롤백되기 쉽다.

### 2.6 삭제·보관기간 — W-N11 재검토 (NB-B9)

PM의 "고아 파일 자동 GC는 과투자, 수동으로 충분" 판정에 **동의한다.** 월 0~1건 규모에서 자동 GC는 명백한 과투자이고, `partner-doc`과 달리 법정 보관기한도 없다.

**그러나 "자동 정리 불필요"와 "삭제 수단 부재"는 다른 문제다.** 현재 설계에는 잘못 올린 이미지를 실제로 지우는 경로가 아무 데도 정의돼 있지 않고, ui-spec §2.3은 "본문에서만 제거, 버킷 원본은 남는다 — 화면에 이 사실을 알릴 필요는 없음"이라고 명시했다. **이 한 줄에는 동의하지 않는다.**

- 운영자는 본문에서 이미지를 지우면 없어졌다고 합리적으로 믿는다. 실제로는 공개 URL에 영구 잔존한다.
- 개인정보가 담긴 이미지였다면 이 상태는 **미조치 상태의 노출**이며, 파기 의무(법 제21조) 대응이 불가능한 구조다.
- 2026-09-11 시행 개정법에서 유출 통지·신고 체계가 강화된 점을 감안하면(§6.1), 사고 인지 후 **실제로 지울 수단이 없는 것**은 대응 절차상 공백이다.

> **권장 조치(NB-B9) — WS-3 배포 게이트**
> 1. **삭제 경로 확보(택1)**: (a) 관리자 UI에서 해당 공지의 업로드 이미지 목록을 보고 삭제(권장, `content_image_admin_delete` 정책이 이미 이걸 전제한다), 또는 (b) 최소한 **운영 문서에 Supabase 대시보드 수동 삭제 절차를 명문화**하고 담당·연락 경로를 적어둔다. (b)만으로도 배포는 가능하다 — "절차가 문서로 존재할 것"이 게이트다.
> 2. **고지 추가**: §1.4의 한 문장("본문에서 지워도 업로드된 파일 자체는 남습니다")을 NS-5 캡션에 포함.
> 3. **보관기간 문서화**: 공지 이미지는 개인정보를 담지 않는 것이 전제이므로 **별도 보관기간을 두지 않는다**(= 콘텐츠 자산과 동일 취급). 이 판단 자체는 맞으며, `partner-doc`의 파기 크론을 붙이지 않는 결정도 맞다. 다만 **"개인정보가 없어야 하므로 보관기간이 없다"는 전제가 NS-5 통제에 의존한다**는 점을 처리방침이 아니라 내부 문서(본 문서)에 남긴다.

---

## 3. 확인요청 ③ — 파트너 전용 읽기 경로 (G-1)

### 3.1 결론: 확정 설계는 기존 RLS 원칙과 충돌하지 않는다 — 오히려 가장 좁은 선택이다

코드로 확인한 사실:

| 확인 | 결과 |
|---|---|
| `content_item_public_select` / `content_translation_public_select` | 둘 다 `for select **to anon**`. 술어는 `is_active` / `status='published' AND 상위 item is_active`. **content_type도 target_audience도 보지 않는다** |
| `lib/supabase/serverClient.ts` | anon 키 + `persistSession:false` + 쿠키 어댑터 없음 → PostgREST 롤이 **항상 `anon`** |
| 로그인 파트너의 롤 | `authenticated` → 위 public 정책에 해당 없음, admin 정책은 `is_active_admin()`에서 탈락 → **0행**. G-1 확인 |

즉 `/supplier/notices`가 `getSupabaseServerClient()`로 조회한다는 screen-spec §2/§4.2의 결정은 **새 권한을 하나도 만들지 않는다.** 이미 anon에게 열려 있는 데이터를 anon 롤로 읽을 뿐이다. **최소권한 원칙에 부합하는, 사용 가능한 선택지 중 가장 좁은 안이다.**

### 3.2 반대로, 하면 안 되는 해법 (NB-B3)

"로그인한 파트너가 자기 세션으로 못 읽는다"는 G-1 서술을 읽고 **`to authenticated` SELECT 정책을 추가하는 것**이 가장 자연스러워 보이는 해법이며, 그래서 가장 위험하다.

- 그 정책은 기존 admin 정책과 **OR로 결합**된다 → `content_management` 권한이 없는 관리자, 모든 로그인 파트너가 PostgREST로 `content_item`/`content_translation`을 직접 조회 가능해진다.
- 술어에 `status='published'`를 빠뜨리면 **draft 공지(=아직 공개하면 안 되는 약관 개정 예고)까지 노출**된다.
- `authenticated` 롤에는 이미 `insert/update/delete` grant가 부여돼 있고(`grant insert, update, delete on public.content_item to authenticated`) 쓰기를 막는 것은 **오직 RLS 정책뿐**이다. 이 테이블의 정책을 건드릴 때는 읽기/쓰기를 분리해서 생각해야 한다.

> **backend-developer에게**: G-1의 해법은 "RLS를 여는 것"이 아니라 "**anon 클라이언트로 읽는 것**"이다. 마이그레이션에서 `content_*` 테이블의 RLS 정책은 **한 줄도 바뀌지 않아야 한다**(PRD §7.2 "RLS 변경 없음"이 옳다).

### 3.3 대신 이 설계가 만드는 부작용 하나

`/supplier/notices`는 `requireSupplierSession()`으로 로그인을 요구하지만, 실제 데이터 조회는 **인증되지 않은 클라이언트**로 한다. 즉 **로그인 게이트는 접근 통제가 아니라 UX 배치일 뿐이다.** 이 사실이 코드에 드러나 있지 않으면, 나중에 누군가 "어차피 로그인해야 보이니까 여기에 파트너별 안내를 써도 되겠다"고 판단하는 경로가 열린다 — 그게 정확히 NS-1이 막으려는 사고다.

> **권장 조치(NB-R7)**: 신규 조회 함수(`getPublishedNoticesForPartner` 등) 파일 상단에 다음 취지의 주석을 남긴다.
> ```
> // 이 함수는 anon 롤로 조회한다(로그인 파트너는 authenticated 롤이라 public RLS에
> // 걸리지 않기 때문 — PRD G-1). 따라서 /supplier/notices의 로그인 게이트는 접근
> // 통제가 아니라 배치일 뿐이며, 이 경로로 읽히는 데이터는 전부 인터넷 공개 데이터다
> // (NS-1). 공지 본문에 파트너 개별 식별정보를 넣어도 되는 근거가 되지 않는다.
> ```

---

## 4. 대상(`target_audience`)별 노출 분리의 정확성

### 4.1 잘못된 대상에게 노출되는 경로 — 전수 점검

| # | 경로 | 판정 |
|---|---|:---:|
| 1 | `/supplier/notices` 목록 — `.eq('target_audience','partner')` | ✅ 안전. `seepn_user` 제외 |
| 2 | `/supplier/notices/[slug]` 상세 — 같은 필터 + `notFound()` | ✅ 안전(N-E8). **단 반드시 신규 조회 함수를 써야 한다** — 기존 `getPublishedContentBySlug`는 `target_audience`를 보지 않는다 |
| 3 | 프로필 홈 미리보기 위젯 — 같은 함수 `limit 1` | ✅ 안전(screen-spec §4.4가 함수 재사용을 명시) |
| 4 | **`getPublishedContentList('notice', 'ko')` 직접 호출** | ❌ **대상 무관 전량 반환**. §4.2 |
| 5 | Admin 목록 — 클라이언트 필터 | ⚠️ Admin은 `content_management` 보유자만이므로 유출 아님. 단 NULL 행 가시성 문제 있음(§5) |
| 6 | **PostgREST 직접 호출(anon 키)** | ❌ **모든 published 공지가 대상 무관 조회 가능**(F-1). 애플리케이션 필터로 막을 수 없는 구조적 사실 |

**#6이 이 기능의 성격을 규정한다.** `target_audience`는 접근 통제가 아니라 **표시 필터**라는 PRD §7.2/§9 NS-1의 서술은 정확하다. 애플리케이션 필터가 지키는 것은 "기밀"이 아니라 **"파트너 화면에 엉뚱한 대상의 공지가 뜨지 않는다"는 제품 정합성**이다. 이 구분을 흐리면 나중에 "필터가 있으니 seepn_user 공지에는 내부 정보를 써도 된다"는 판단이 나온다.

> **Phase 1(seepn.me) 대비 결론**: 지금 설계의 분리는 **정확하다**. seepn.me가 생겨도 같은 방식(`.eq('target_audience','seepn_user')`)으로 대칭 구현하면 되고, 그때도 **RLS를 여는 것이 해법이 아니다.** 다만 seepn.me 시점에 "정말 비공개인 대상별 공지"가 요구되면 그건 지금 스키마의 확장이 아니라 **별도 테이블 + 별도 RLS**여야 한다(§7.4가 기각한 안이 그때 다시 열린다) — 이 점만 Phase 1 담당자에게 인계할 것.

### 4.2 구현 계약 (NB-B6)

| 규칙 | 이유 |
|---|---|
| **DB 레벨 양성 매칭만**: `.eq('target_audience','partner')` | Postgres에서 `NULL = 'partner'`는 NULL → 제외. **fail-closed**다 |
| **JS 부정 필터 금지**: `rows.filter(r => r.targetAudience !== 'seepn_user')` | JS에서 `null !== 'seepn_user'`는 **true** → NULL 행이 파트너 화면에 노출된다. `.neq()`(DB)는 안전하지만 JS 부정은 위험하므로, **혼동 방지를 위해 부정 자체를 금지**한다 |
| **`audience` 파라미터에 기본값을 두지 않는다** | 시그니처가 `(audience, locale)`이므로 인자를 빠뜨리면 타입 에러로 잡힌다. 기본값이 있으면 조용히 통과한다 |
| **`getPublishedContentList`에 `'notice'` 차단 가드** | `'notice'`가 `ArticleContentType`에 추가되는 순간 `getPublishedContentList('notice', locale)`이 **타입상 합법이면서 대상 무관 전량을 반환**한다. 런타임 가드(빈 배열 반환 + 주석)로 막거나, 공개 사이트용 타입에서 `'notice'`를 분리한다. **가장 저비용은 런타임 가드 3줄** |

### 4.3 부수 발견 — 로케일 폴백 (보안 아님, 정합성)

`lib/content/getPublishedContent.ts`의 `pickTranslation`은 폴백 로케일이 **`'en'`으로 하드코딩**돼 있다(`rows.find(r => r.locale === 'en')`). 공지의 원문은 `ko`이므로(§3.1), 이 함수를 공지에 그대로 재사용하면 ko 원문 대신 en 번역으로 폴백하는 동작이 생긴다. 신규 공지 조회 함수는 **폴백 기준을 `ko`로** 두어야 한다(§6.6이 Phase 1에 대해 말한 것과 같은 지적이지만, Phase 0의 `partner` 경로에도 동일하게 적용된다).

---

## 5. `target_audience` 미지정(NULL) 위험 — NB-B5

### 5.1 위험 방향의 정정

먼저 사실관계: **NULL은 유출을 만들지 않는다.** 모든 조회가 `.eq()` 양성 매칭이면 NULL 행은 `partner`에도 `seepn_user`에도 뜨지 않는다(fail-closed). 실제 위험은 반대다.

1. **조용한 미발행**: 발행했는데 어느 화면에도 안 뜬다. "7일 전 사전 공지" 의무를 이행했다고 믿었는데 이행되지 않은 상태 — P-N1의 실패 모드 그 자체다.
2. **미래의 오분류**: seepn.me 착수 시 NULL 행을 일괄 백필하면서 잘못된 대상으로 분류될 수 있다. **이때는 진짜 오노출이 된다.**
3. **Admin에서 안 보임**: `SegmentedControl`에서 `partner`/`seepn_user` 어느 쪽으로 필터해도 NULL 행은 사라지고 "전체"에서만 보인다. 운영자가 필터를 걸어둔 채 훑으면 존재를 인지하지 못한다.

### 5.2 단일 차단 지점 = DB CHECK

```sql
alter table public.content_item
  add constraint chk_content_item_target_audience_values
    check (target_audience is null or target_audience in ('seepn_user', 'partner'));

alter table public.content_item
  add constraint chk_content_item_notice_requires_audience
    check (content_type <> 'notice' or target_audience is not null);
```

**두 개 다 필요하다.** 두 번째만 있으면 `'partners'` 같은 오타 값이 통과하고(그 값은 어느 필터에도 안 걸려 §5.1-1 상태가 된다), 첫 번째만 있으면 NULL이 통과한다.

이 CHECK가 있으면 NULL/오타 공지는 **애초에 생성될 수 없으므로** §5.1의 세 위험이 전부 소멸한다. 따라서 아래 조건이 게이트다.

| 조건 | 이유 |
|---|---|
| CHECK 2종을 **`create_content_item` 시그니처 변경(G-3)과 같은 마이그레이션**에 넣는다 | G-3은 `p_target_audience` 추가 시 오버로드 함정을 경고한다. 만약 `p_target_audience text default null`로 추가하면 **기존 4-인자 호출부가 조용히 NULL 대상 공지를 만든다.** CHECK가 같은 파일에 있으면 그 호출은 DB에서 거부되어 fail-closed로 끝난다. 순서가 어긋나면 그 사이에 만들어진 행이 남는다 |
| `p_target_audience`에 **SQL 기본값을 주지 않는다** | 기본값은 §7.2가 이미 반대한 항목. 호출부 2곳(`createArticleAction`/`createFaqAction`)을 동시 갱신하는 편이 안전하다 |
| **서버 액션에서 재검증** | UI의 "미선택 시 추가 버튼 비활성화"는 통제가 아니다. `createArticleAction`/`updateArticleItemAction`이 2값 허용 목록으로 검증하고, D-N3 잠금 조건(번역 존재 시 변경 불가)도 서버에서 재확인한다(screen-spec §3.5가 이미 요구) |
| **(권고, NB-R9)** Admin 행에 `대상 미지정` 배지를 error 톤으로 | CHECK가 있으면 발생할 수 없지만, 마이그레이션 이전에 생성된 잔여 행·향후 회귀에 대한 방어. 비용 거의 0 |

---

## 6. NS-1 / NS-2 / NS-3 경량 확인 결과

### 6.1 NS-1 — 확인 완료, 표현 강화

PRD의 "사실상 공개 데이터"는 **정확하며, 오히려 약하게 쓰였다**(F-1: anon 키가 브라우저 번들에 있어 실제로 열거 가능). §1.4의 캡션 문구는 이 사실에 부합하므로 그대로 유지한다. 가드레일 지표("공지 본문에 특정 파트너 식별정보가 포함된 건수 = 0건")도 그대로 유효하다.

법적 맥락: [2026-09-11 시행 개정 개인정보 보호법](https://datalaw.kr/guides/pipa-2026-amendment/)에서 유출 통지·신고 체계가 강화되었다(통지 대상에 위조·변조·훼손 포함, 인지 후 72시간 내 통지). 공지 본문·이미지에 개인정보가 섞인 채 anon 읽기 상태로 게시되면 이는 **노출형 유출로 평가될 여지**가 있고, 그때는 "게시물을 내렸다"로 끝나지 않는다(§6.2의 감사로그 사본, §2.6의 이미지 잔존까지 조치 대상). **개별 사안의 통지·신고 의무 발생 여부는 변호사 검토 필요** — 본 문서는 "그런 상황을 만들지 않는 통제"만 다룬다.

### 6.2 NS-3(감사) — 확인 완료 + 발견 1건

- `content.create/update/delete` 자동 기록: **확인.** `upsert_content_translation`이 `private.log_audit()`를 호출하며 `after_summary`에 `{"status": ...}`를 남긴다. 추가 작업 불필요.
- **부수 소득 — §6.5의 "발행일 부정확" 한계가 부분적으로 해소된다**: `content_item`에 `published_at`이 없어 표시 날짜가 `created_at` 프록시라는 한계는 그대로지만, **draft → published 전환의 정확한 시각은 `audit_log`에 남는다.** "약관 개정 7일 전에 화면 공지했다"는 이행 증빙은 화면 표시 날짜가 아니라 감사로그가 담당한다.
  - **단 `audit_log` 보관기간은 2년**이다(`20260825120000...sql:1659`). 약관 분쟁은 2년 뒤에도 제기될 수 있으므로, **약관·개인정보처리방침 개정 공지 건에 한해 게시 시각을 별도 이력 문서에 수기로 남길 것**(비용 0, NB-R4).
- **발견(F-2) — 감사로그가 본문 사본을 보관한다**: `before_summary := to_jsonb(t)`이므로 수정 전 본문 전체가 `audit_log`에 복제된다. 개인정보가 섞인 공지를 **수정하거나 삭제해도 원본이 2년 남는다.** `human-matching-privacy-review.md`가 세운 "audit_log를 2차 PII 저장소로 만들지 않는다"는 컨벤션과 content 경로가 어긋나 있다(이번 기능이 만든 것은 아니다). 지금 스키마를 바꿀 사안은 아니지만, **사고 대응 절차에 "audit_log 해당 행 정정"을 반드시 포함**해야 한다(NB-R5).

### 6.3 NS-2 — 운영 규칙으로 확정, 문서 정합성 확인

- 약관 §3의 "중대 변경 시 이메일 병행 통지"는 이 기능이 이행하지 못한다(W-N4). **화면 공지 + 수동 이메일을 한 세트로 묶는 체크리스트**가 필요하다:
  1. 개정 본문 확정 → 2. `/supplier/legal/*` 갱신 → 3. 공지 작성·게시(적용일 7일 전 / 중대 변경 30일 전) → 4. **게시 시각을 개정 이력에 수기 기록**(NB-R4) → 5. 중대 변경이면 전체 파트너 이메일 발송 + 발송 근거 보관.
- **문서-실제 정합성 확인 결과**: `partner-terms-v1.0-2026-09-ko.md` §3과 `partner-privacy-v1.0-2026-09-ko.md`가 "서비스 화면에 공지한다"고 선언한 상태에서 그 화면이 없다는 PRD §1.2의 문제 제기는 **사실이며, 이 기능이 그 불일치를 해소하는 것이 맞다.** 다만 위 체크리스트 5번(이메일)이 자동화되지 않는 한 **문서-실행 불일치는 절반만 해소된다.** 이 상태를 명시적으로 인지하고 운영할 것.
- **개인정보처리방침 개정 필요 여부: 불필요.** 새 수집 항목·목적·제3자 제공·처리위탁이 없다. 공지 이미지 버킷도 "개인정보를 담지 않는 것이 전제"인 콘텐츠 저장소이므로 처리방침의 보유·파기 항목에 새 행이 생기지 않는다. **상위 PRD §3.2.5에 PR-10/PR-11을 신설하자는 AM-4 제안은 그대로 반영 권고**(내부 설계 원칙 문서화이지 대외 공개 문서 변경이 아니다).

### 6.4 NS-4 — 아직 열지 않는다

렌더러(`lib/content/renderMarkdown.tsx`)가 raw HTML을 파싱하지 않는 것이 현행 XSS 방어선이라는 §6.4 C-2의 서술은 **코드로 확인했다**(지원 서브셋: `#`/`##`, `**bold**`, `- `/`1. `, 표, `[](url)`; 그 외는 평문). 마크다운 유지 시 정식 검토 불필요.

**렌더러에 이미지 문법을 추가할 때의 조건 2건(NB-R6)**:
- **`src` 스킴 제한**: 현행 `isSafeUrl`은 `http://`·`https://`·`/`를 허용한다. 링크에는 적절하지만 **이미지에는 그대로 쓰면 안 된다.** ① `http://`는 mixed content로 차단되어 깨진다, ② 외부 임의 호스트를 허용하면 공지를 여는 파트너의 IP·User-Agent가 제3자 서버로 전송된다(원치 않는 추적 채널). **이미지 `src`는 우리 Storage 공개 호스트의 `https://` URL로 한정**하는 별도 검증 함수를 둘 것.
- **파싱 충돌 주의**: `renderInline`의 분해 정규식은 `[텍스트](url)`을 잡는다. `![alt](url)`을 그냥 넣으면 앞의 `!`가 떨어져 나오고 나머지가 **링크로** 렌더링된다. 이미지 패턴을 링크 패턴보다 **먼저** 매칭하도록 정규식 순서를 잡을 것.

---

## 7. 권고 사항 (non-blocking)

| ID | 내용 |
|---|---|
| **NB-R1** | `/supplier/notices` 조회에 `status='published'` 필터를 **명시적으로 한 줄 더** 건다. 현재는 anon RLS에만 의존하는데, 나중에 누가 이 호출을 인증 클라이언트로 바꾸면 draft가 조용히 노출된다. 비용 1줄 |
| **NB-R2** | 이미지 업로드 라우트에서 **파일 크기를 바이트 스트림 단계에서 먼저 끊는다**(버퍼에 다 읽은 뒤 검사하지 말 것). 관리자 전용이라 남용 위험은 낮지만 Lambda 메모리 보호 차원 |
| **NB-R3** | 마이그레이션에 **버킷 성격 대비 주석**을 남긴다: "`partner-doc` = 비공개·서명URL·파기크론·법정 보관, `content-image` = 공개·영구·보관기간 없음. 두 버킷의 정책을 서로 참고해 복사하지 말 것." 6개월 뒤 이 대비를 모르는 사람이 정책을 복붙하는 것이 가장 흔한 사고 경로다 |
| **NB-R4** | 약관·처리방침 개정 공지 건은 **게시 시각을 개정 이력 문서에 수기 기록**(감사로그 2년 한계 보완, §6.2) |
| **NB-R5** | 사고 대응 절차(개인정보가 섞인 공지 발견 시): ① 즉시 `is_active=false` 또는 draft 전환 → ② 본문 수정 → ③ **`audit_log`의 해당 `before_summary` 정정**(F-2) → ④ **이미지가 있었다면 Storage 객체 실제 삭제**(NB-B9) → ⑤ 노출 범위·기간 산정 후 통지·신고 요부 판단(**변호사 검토 필요**) |
| **NB-R6** | 렌더러 이미지 지원 시 `src` 스킴 제한 + `![]()` 파싱 순서 (§6.4) |
| **NB-R7** | 신규 조회 함수에 "로그인 게이트는 접근 통제가 아니다" 주석 (§3.3) |
| **NB-R8** | qa-reviewer 추가 항목: ① 공개 버킷 객체 URL이 **로그아웃 상태·시크릿 창에서 열리는지**(의도된 동작 확인), ② `/storage/v1/object/list/content-image`를 anon 키로 호출했을 때 **거부되는지**(NB-B1 검증 — 이게 통과하면 치명), ③ 업로드한 사진의 EXIF가 실제로 제거됐는지(`exiftool` 또는 온라인 뷰어로 1회), ④ `.eq` 필터를 임시로 제거했을 때 `seepn_user` 공지가 실제로 새는지(방어선이 진짜 그 한 줄인지 확인) |
| **NB-R9** | Admin 행에 `대상 미지정` error 톤 배지 (§5.2) |

---

## 8. 핸드오프

### ui-ux-designer
- §1 회신: **NS-1/NS-5 캡션 톤 승인**(격상 요청 없음). 대신 ① 발행 시점 확인창 1회 추가(NB-B7), ② NS-1 캡션을 에디터가 아닌 본문 필드에 결속(NB-B8), ③ NS-5 문구에 "본문에서 지워도 파일은 남습니다" 한 문장 추가(§1.4) — 세 건만 ui-spec에 반영 요청.
- ui-spec §2.3의 "이미지 삭제는 화면에 알릴 필요 없음" 한 줄은 **철회 요청**(§2.6).

### backend-developer
- **NB-B1~NB-B5가 마이그레이션 게이트다.** 특히 NB-B1(SELECT 정책 만들지 말 것)과 NB-B3(RLS 열지 말 것)은 "자연스러워 보이는 잘못된 해법"이므로 착수 전 반드시 읽을 것.
- §2.1~2.4의 버킷 DDL·정책·허용 목록을 그대로 채택 가능. **webp는 매직바이트 탐지기 미지원**이므로 jpeg/png로 시작 권고(§2.4).
- §5의 CHECK 2종을 G-3 시그니처 변경과 **같은 마이그레이션**에.
- §2.4 말미: Storage 응답의 `X-Content-Type-Options` 헤더를 실제 요청으로 1회 확인(추정 금지).

### frontend-developer
- 업로드는 서버 라우트 경유, `service_role` 금지(NB-B4). EXIF 스트립은 새 의존성 없이 바이트 레벨 권장 + Orientation 트레이드오프 인지(NB-B10).
- 조회 함수: 양성 매칭만, 부정 필터 금지, `getPublishedContentList('notice',…)` 우회 차단(NB-B6). 폴백 로케일 `ko`(§4.3).
- 저장 포맷은 **마크다운 유지 권고 유효** — HTML 선택 시 NS-4 정식 검토가 별도로 필요하므로 사전 협의 요청(§6.4).

### qa-reviewer
- NB-R8의 4개 항목이 이번 기능의 보안 회귀 초점. 그중 **`/storage/v1/object/list/content-image`가 anon으로 거부되는지**가 단일 최중요 검증이다.
- 기존 필수 항목(N-E1 대상 유출, N-E3 AI 버튼 서버 방어, N-E5 사례 회귀)은 screen-spec §9 그대로.

### project-manager / product-manager
- PRD §9의 "정식 리뷰 대상 아님" 판정은 **NS-1/NS-2/NS-3에 대해서는 유효**했다. NS-5는 예고된 대로 승격됐고 본 문서가 그 결과다.
- **배포 게이트 요약**: WS-1은 NB-B5/B6/B7/B8, WS-3은 NB-B1/B2/B4/B9/B10. WS-3의 5건은 전부 이미지 파이프라인 항목이라 **WS-3 견적(5~7인일)에 EXIF 제거 + 삭제 경로 확보 공수를 추가**해야 한다(각 0.5인일 수준).

### ceo-advisor
- 에스컬레이션 사안 없음. 다만 대표가 유일한 공지 작성자이므로, **§1.2 발행 확인창과 §2.5 EXIF 제거는 "대표 본인의 실수를 막는 장치"** 라는 점을 인지시킬 것. 두 통제 모두 다른 사람이 대신 걸러줄 수 없는 지점이다.

---

## Version History

| Version | Date | Changes | Author |
|---|---|---|---|
| 1.0 | 2026-09-08 | 초안 — NS-5 정식 검토 승격 판정. 경고 톤 판단(캡션 유지 + 발행 시점 확인창 추가), 공개 이미지 버킷 설계(SELECT 정책 금지·파일명 UUID·허용목록·EXIF 제거·삭제 경로), 파트너 읽기 경로 검증(RLS 변경 불필요, `to authenticated` 금지), `target_audience` NULL 경로 전수 점검(CHECK 2종), 코드 확인 중 발견 2건(anon 키 브라우저 노출 / 감사로그 본문 사본 2년). 배포 게이트 10건 | privacy-security-officer |
