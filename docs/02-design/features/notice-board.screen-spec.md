---
template: feature-screen-spec
version: 1.0
feature: notice-board (공지사항 게시판)
description: notice-board-v1.0.prd.md(v3.0 Final) §12 핸드오프 10개 항목을 확정하는 화면 정의서. WS-1(Admin 코어)·WS-2(파트너 소비 화면)를 상세 설계하고, WS-3(에디터+이미지)는 "무엇을 할 수 있어야 하는지" 수준으로만 정의한다(라이브러리 선택은 frontend-developer 몫).
variables:
  - feature: notice-board
  - date: 2026-09-08
  - author: service-planner
  - project: SEEPN × FKP Unified Platform
  - version: 1.0.0
  - status: Draft — ui-ux-designer(에디터·이미지 UX), privacy-security-officer(§9 경량확인), backend-developer(API 계약) 순으로 확인 요청
---

# 공지사항(Notice) 게시판 — 화면 정의서 v1.0

| 항목 | 내용 |
|------|------|
| 문서 종류 | Feature Screen Spec (PDCA Do phase 착수 전 Design) |
| 작성자 | service-planner |
| 작성일 | 2026-09-08 |
| 입력 문서 | [notice-board-v1.0.prd.md](../../01-plan/features/notice-board-v1.0.prd.md) (v3.0 Final) |
| 선례 스펙 | [fkp-v0.2-phase5d-blog-case-faq.spec.md](./fkp-v0.2-phase5d-blog-case-faq.spec.md) — 화면 흐름·엣지케이스는 이 문서를 승계하고 **달라지는 부분만** 새로 쓴다 |
| 참고 | [admin-ai-translation-draft.screen-spec.md](./admin-ai-translation-draft.screen-spec.md) — AI 초벌 버튼/배지 원본 스펙(이번엔 "비노출"만 다룸) |
| 후속 담당 | ui-ux-designer(에디터·이미지 UX 시안) → privacy-security-officer(§9 경량확인, NS-4/NS-5 조건부 승격) → backend-developer(API 계약) → frontend-developer → qa-reviewer |

### Pipeline References

| Phase | Document | Status |
|---|---|---|
| Plan | `notice-board-v1.0.prd.md` | ✅ Final v3.0 |
| Design (본 문서) | `notice-board.screen-spec.md` | ✅ WS-1/WS-2 상세, WS-3 능력정의 — **service-planner 완료** |
| Design (에디터 시안) | ui-ux-designer | ⏳ 착수 대기 (§5) |
| Security | privacy-security-officer 경량확인 | ⏳ 착수 대기 (§9) |
| Code | backend-developer → frontend-developer | ❌ 미착수 |

---

## 0. 이 문서가 확정하는 것 — PRD §12 대응표

PRD §12가 service-planner에게 위임한 10개 항목과 본 문서의 대응 절을 1:1로 표시한다. 표에 "결정"이라고 적은 항목은 **PRD §11 "위임된 결정" 표에 따라 대표 확인 없이 service-planner가 확정**한 것이다.

| # | PRD §12 항목 | 본 문서 절 | 성격 |
|---|---|---|---|
| 1 | 대상별 로케일 열 구성(1열/3열) + 대상 선택에 따라 편집 폼이 바뀌는 흐름 | §3.3, §3.4 | 결정 |
| 2 | 대상 변경 정책(D-N3) UX | §3.5 | 결정 |
| 3 | AI 초벌 버튼 비노출(G-6) | §3.6 | 결정 |
| 4 | 에디터 화면 정의(N-R13~16, 이미지 업로드 UX 포함, 라이브러리 제외) | §5 | 능력 정의 |
| 5 | 대상 선택 UX + 목록 필터(N-R2) | §3.2, §3.3 | 결정 |
| 6 | `seepn_user` 경고 표시(N-R6, 생략 불가) | §3.7 | 결정 |
| 7 | 번역 상태 표시(N-R20) | §3.8 | 결정 |
| 8 | 파트너 앱 진입점(OQ-N4), 목록/상세 구성, 빈 상태 | §4.1, §4.2, §4.3 | 결정 |
| 9 | Admin 작성 화면의 NS-1 경고 문구 | §3.9 | 결정 |
| 10 | N-R18(프로필 홈 미리보기) 포함 여부 | §4.4 | 결정 — **포함(Include)으로 확정** |

---

## 1. 범위와 승계 원칙

- **WS-1(코어) + WS-2(파트너 소비 화면)를 이번 스프린트 상세 설계 대상으로 삼는다.** §3, §4가 그 대상이다.
- **WS-3(에디터+이미지)는 "무엇을 할 수 있어야 하는지"만 정의한다(§5).** 툴바 라이브러리, DOM 구현 방식, 저장 포맷(C-1/C-2) 최종 선택은 정의하지 않는다 — frontend-developer + privacy-security-officer 몫(PRD §12).
- 화면 흐름·엣지케이스는 [fkp-v0.2-phase5d-blog-case-faq.spec.md](./fkp-v0.2-phase5d-blog-case-faq.spec.md)를 승계한다. 달라지는 지점은 5가지다: **① 대상 2종(파트너/SEEPN 사용자)이 한 화면에 섞인다, ② 원문 로케일이 en이 아니라 ko다, ③ 로케일 열 개수가 항목마다 1열 또는 3열로 다르다, ④ 독자가 익명 방문자가 아니라 로그인한 파트너다, ⑤ 진입점이 FKP 공개 사이트가 아니라 supplier 앱 셸이다.** 이 5가지 외에는 선례 스펙의 결정(마크다운 렌더링 서브셋, 슬러그 규칙, 삭제/비활성화 정책, 로케일 폴백 원칙 등)을 그대로 따른다.
- **아래는 service-planner가 코드를 직접 읽고 확인한 재사용 대상**이며, 이 문서 전체가 이 파일들을 기준으로 "무엇을 바꿔야 하는지"를 말한다: `app/admin/(protected)/board/{ArticleRow.tsx, NewArticleForm.tsx, loadContent.ts, actions.ts, blog/page.tsx}`, `lib/content/{contentTypes.ts, getPublishedContent.ts, renderMarkdown.tsx}`, `lib/admin/translationStatus.ts`, `components/supplier/{SupplierFooter.tsx, SupplierProfileShell.tsx, AuthShell.tsx}`, `lib/supplier/session.ts`, `components/admin/SegmentedControl.tsx`.

---

## 2. 데이터 모델·컴포넌트 계약 재확인 (service-planner 관점)

> 실제 SQL·RPC는 backend-developer 소관(PRD §7). 여기서는 화면이 기대하는 **입력·출력 계약**만 고정한다.

| 항목 | 화면이 기대하는 값 |
|---|---|
| `content_item.content_type` | `'notice'` (기존 `'blog'`는 제거되고 이 값이 그 자리를 대체) |
| `content_item.target_audience` | `'partner'` \| `'seepn_user'` — **notice에서는 NOT NULL, 기본값 없음** |
| `content_item.source_locale` | notice는 항상 `'ko'` (다른 content_type의 `'en'`과 다름, PRD §3.1) |
| 대상별 로케일 배열 | `partner` → `['ko']` / `seepn_user` → `['ko', 'en', 'ja']` — 화면 컴포넌트가 이 배열 길이로 1열/3열을 결정한다 |
| `content_key` 컨벤션 | `notice.{slug}` (기존 `blog.{slug}` 프리픽스 교체, G-4) |
| Admin 조회 | `loadArticleRecords(supabase, 'notice')`가 **대상별 필터 없이 partner+seepn_user 전체를 한 번에** 반환 — 화면에서 클라이언트 필터링(§3.2) |
| 파트너 소비 화면 조회 | 신규 함수(가칭) `getPublishedNoticesForPartner(locale: 'ko')` — **`target_audience='partner'`를 애플리케이션 코드에서 명시적으로 건다**(G-1, RLS는 대상을 구분하지 않음) |
| ArticleRecord 확장 | 기존 `ArticleRecord`에 `targetAudience: 'partner' \| 'seepn_user' \| null`(notice가 아니면 null) 필드 추가 필요 — §3.4 |

---

## 3. Admin 공지사항 화면 (WS-1) — `/admin/board/notice`

### 3.1 내비게이션 변경

- 경로: `/admin/board/blog` → `/admin/board/notice` (파일 이동: `app/admin/(protected)/board/blog/page.tsx` → `app/admin/(protected)/board/notice/page.tsx`).
- 게시판관리 메뉴 탭 순서: **카테고리 → 랜딩카피 → 공지사항 → 사례 → FAQ** ("블로그" 자리를 "공지사항"이 대체, 순서 위치는 그대로 유지). 메뉴 행 자체는 코드 하드코딩이 아니라 대표가 메뉴관리 UI에서 라벨/경로를 바꾼다(PRD N-R11) — service-planner는 **화면 존재와 표시 라벨("공지사항")만 확정**한다.
- 페이지 상단 안내 문구를 블로그용에서 교체: ~~"게시(published) 상태인 글은 최대 1분(ISR) 이내 공개 사이트(/blog)에 반영됩니다."~~ → **"게시(published) 상태인 파트너 공지는 파트너 화면(/supplier/notices)에 즉시 반영됩니다. SEEPN 사용자 공지는 seepn.me가 열리기 전까지 아무 화면에도 노출되지 않습니다."** (이 문구 자체가 N-R6 상시 경고의 일부다, §3.7과 함께 노출)

### 3.2 목록 화면 — 대상 필터 (N-R2, PRD §12 항목 5)

**설계 결정**: 공지사항은 대상별로 화면을 분리하지 않는다. `partner` 공지와 `seepn_user` 공지가 **하나의 목록 안에 함께 나타나고**, 글마다 대상 배지가 붙으며, 상단 필터로 좁혀 볼 수 있다. (블로그/사례처럼 대상별 메뉴를 따로 만들지 않는 이유: 컬럼 1개짜리 구분 값을 위해 화면을 물리적으로 쪼개면 §7.4의 "컬럼 1개로 테이블을 신설하는 것은 과잉"이라는 판단과 같은 과잉설계가 된다.)

| 구성요소 | 동작 | 상태별 표시 | 예외처리 |
|---|---|---|---|
| 대상 필터 (`SegmentedControl<'all'\|'partner'\|'seepn_user'>` 재사용) | 클릭 시 아래 목록을 클라이언트 사이드로 필터링(서버 재조회 없음 — 전체 건수가 적어 페이지네이션 자체가 없다, §6.3 재검토 트리거 승계) | 기본값 **"전체"** | — |
| 필터가 "SEEPN 사용자용"일 때 | 목록 상단에 §3.7의 상시 경고 배너가 함께 노출 | — | — |
| 목록 행 대상 배지 | 각 행 좌측에 `파트너` 또는 `SEEPN 사용자` 배지(neutral tone) | 필터가 "전체"여도 섞여서 표시되므로 배지가 없으면 구분 불가 — **배지는 필터 값과 무관하게 항상 노출** | — |

### 3.3 새 공지 작성 폼 — 대상 선택 (N-R2 기본값 없음, PRD §12 항목 5)

기존 `NewArticleForm`을 확장한다.

| 필드 | 타입 | 필수 | 검증/기본값 |
|---|---|---|---|
| 슬러그 | text input | ✅ | 기존과 동일(`^[a-z][a-z0-9-]{1,64}$`). **주의: 슬러그 네임스페이스는 `partner`/`seepn_user` 공용**이다 — 같은 슬러그를 두 대상에 각각 쓸 수 없다(둘 다 `content_key = notice.{slug}`이므로 unique 제약에 걸림). 플레이스홀더에 "예: terms-update-2026-09 (대상 구분과 무관하게 전체 공지 중 고유해야 함)" 명시 |
| 정렬순서 | number input | ✅ | 기존과 동일(최대값+10). 안내 문구 추가: **"정렬순서를 크게 하면 상단에 고정됩니다"**(N-R19, 새 컬럼 없이 큰 값으로 대체하는 정책을 작성자가 알 수 있게) |
| **대상** (신규 필드) | `<select>`, 첫 옵션은 **빈 값("선택하세요")** — 사전 선택 없음 | ✅ | 옵션: "파트너용(ko 단일)" / "SEEPN 사용자용(ko/en/ja)". **미선택 상태에서는 "추가" 버튼이 비활성화**된다(N-R2 "기본값 없이 명시 선택"을 폼 레벨에서 강제) |
| 대상="SEEPN 사용자용" 선택 시 | 즉시 인라인 경고 배너 노출(§3.7과 동일 문구) | 대상 select 바로 아래, 폼 다른 필드보다 먼저 눈에 띄는 위치 | — |
| 제목 | text input | ✅(저장 시) | 라벨을 기존 "영문 제목"에서 **"제목"**으로 변경(원문이 ko이므로 "영문"이라는 단어가 틀림) |
| 요약 | textarea | ✅(저장 시) | 라벨을 **"요약"**으로 변경 |
| 본문 | (§5 에디터 또는 임시 textarea) | ✅(저장 시) | 라벨을 **"본문"**으로 변경. WS-3 착수 전까지는 기존과 동일한 마크다운 textarea를 그대로 쓴다(WS-1이 WS-3보다 먼저 배포되므로) |

> **생성 직후 상태**: 대상과 무관하게 `ko`를 원문 로케일로 `draft` 상태 저장(기존 "en/draft" 생성 흐름과 대칭, PRD G-3). `partner` 공지는 이 한 번의 저장으로 사실상 완성(번역 대상이 없음) — 목록에서 바로 "게시(published)"로 전환하면 끝난다. `seepn_user` 공지는 이 저장 후 편집 화면에서 en/ja를 추가로 채워야 한다.

### 3.4 목록 행 & 편집 — 대상별 로케일 열 구성 (N-R12/G-2′, PRD §12 항목 1)

**컴포넌트 일반화 지시(frontend-developer 대상, G-2′ 대응)**: `ArticleRow`의 `LOCALES` 상수 배열을 **컴포넌트 하드코딩에서 caller가 넘기는 `locales: { key: ContentLocale; label: string; isSource: boolean }[]` prop으로 변경**한다. 호출부는 아래처럼 분기한다.

```
사례(case_study) 호출부  → locales = [{ key:'en', label:'English (원본)', isSource:true }, { key:'ja', label:'日本語', isSource:false }]  (변경 없음)
공지 · partner 행        → locales = [{ key:'ko', label:'한국어 (원본)', isSource:true }]
공지 · seepn_user 행     → locales = [{ key:'ko', label:'한국어 (원본)', isSource:true }, { key:'en', label:'English', isSource:false }, { key:'ja', label:'日本語', isSource:false }]
```

같은 `/admin/board/notice` 목록 안에서 **행마다 이 배열이 다르다** — `article.targetAudience` 값으로 페이지가 각 행에 넘길 배열을 결정한다(§2 ArticleRecord 확장).

| 구성요소 | 동작 | 상태별 표시 | 예외처리 |
|---|---|---|---|
| 요약행 대상 배지 | §3.2와 동일 | — | — |
| 요약행 언어 배지 | `locales` 배열 길이만큼 반복(1개 또는 3개) — `computeTranslationBadge` 그대로 재사용 | `partner`행은 배지 1개(KO), `seepn_user`행은 배지 3개(KO/EN/JA) | — |
| 편집(펼침) 그리드 | `partner`행은 **1열(grid-cols-1, 카드 전체 너비)**, `seepn_user`행은 **3열(grid-cols-1 sm:grid-cols-3)** — 기존 `sm:grid-cols-2`(en/ja 2열)와 다른 새 클래스 분기가 필요하다 | — | — |
| 슬러그 표시 라벨 | 기존 블로그 행은 `/{urlSegment}/{slug}`(예: `/blog/xxx`)로 "실제 공개 URL"처럼 보이게 표시했다. **공지는 이 표시를 쓰지 않는다** — FKP 공개 사이트에 대응 URL이 없으므로(D-N0-1) 관리자가 실제로 존재하지 않는 공개 URL로 오해할 수 있다. 대신 `content_key` 그대로(`notice.{slug}`)를 라벨로 표시 | — | — |

### 3.5 대상 변경 정책 UX (D-N3, PRD §12 항목 2)

> **정책(PRD §3.4 재확인)**: 대상은 원칙적으로 불변. **`ko` 외 번역 행이 하나도 없을 때만** 변경을 허용한다. 즉 `partner`행은 정의상 en/ja가 존재할 수 없으므로 이 조건을 항상 만족하지만, `seepn_user`행은 en 또는 ja 번역을 하나라도 저장한 순간부터 잠긴다.

```mermaid
flowchart TD
    A[요약행 대상 표시] --> B{en 또는 ja 번역 행이<br/>하나라도 존재하는가?}
    B -- 없음 --> C["대상 = 편집 가능한 select<br/>(현재 값 프리셋)"]
    B -- 있음 --> D["대상 = 잠금 표시(자물쇠 아이콘 + 읽기전용 배지)"]
    C --> E[변경 시 확인 모달:<br/>"대상을 바꾸면 로케일 구성이 바뀝니다. 계속할까요?"]
    E -- 확인 --> F[updateArticleItemAction 확장 호출<br/>targetAudience 갱신]
    D --> G["hover/focus 시 안내 문구:<br/>'번역이 입력된 뒤에는 대상을 변경할 수 없습니다.<br/>대상을 바꾸려면 삭제 후 새로 작성하세요.'"]
```

| 구성요소 | 동작 | 상태별 표시 | 예외처리 |
|---|---|---|---|
| 대상 필드(요약행) | §다이어그램대로 잠금/편집 가능 상태 전환 | 잠김: 회색 배지 + 자물쇠 아이콘 / 편집가능: `<select>` | — |
| 변경 확인 모달 | 기존 `window.confirm` 패턴 재사용(별도 모달 컴포넌트 신설 불필요, 삭제 확인과 동일 수준의 경고) | — | 확인 후 저장 실패 시 "저장 실패" 인라인 문구(기존 패턴과 동일) |
| 잠긴 상태에서의 삭제 유도 | 잠금 배지 인근에 "삭제 후 재작성" 안내를 **툴팁이 아니라 상시 노출되는 캡션**으로 표시(모바일 등 hover 불가 환경 고려, hover 툴팁만 쓰지 않는다) | — | — |

**엣지케이스**: 대상을 `seepn_user`로 선택해 생성한 직후(en/ja 미입력) 곧바로 `partner`로 되돌리는 것은 **허용**된다(고아 번역이 없으므로). 반대로 `partner`로 생성했다가 `seepn_user`로 바꾸는 것도 허용(원래 `partner`는 en/ja가 없으므로 항상 잠금 조건 통과) — **단 이 경우 로케일 열이 1열에서 3열로 늘어나므로, 변경 확인 모달 문구에 "번역 입력 화면이 추가로 나타납니다"를 포함**한다.

### 3.6 AI 초벌 채우기 버튼 비노출 (G-6, PRD §12 항목 3)

- `ArticleRow`의 `showAiFill` 계산식을 **`contentType !== 'case_study' && contentType !== 'notice'`** 로 변경한다(현재는 `contentType !== 'case_study'`뿐). `blog`가 사라지므로 이 표현식이 통과시키는 content_type은 사실상 없어지지만(현재는 case_study/notice 둘 다 배제), **명시적으로 `'notice'`를 나열**해 두어야 향후 `blog`류 콘텐츠가 다시 생기거나 대상별 분기가 생겼을 때 실수로 노출되지 않는다.
- 이 분기는 **`target_audience` 값과 무관하게 `content_type === 'notice'`면 무조건 숨김**이다. `seepn_user` 공지도 번역 대상(en/ja)이 실재하지만, W-N6(§12 후속 과제)이 해소되기 전까지는 노출하지 않는다 — PRD G-6의 명시적 지시.
- **서버 방어(backend-developer 몫, 화면 정의서 참고용으로 명시)**: `aiFillArticleTranslationAction`이 현재 `content_type === 'case_study'`만 거부한다. 여기에 **`content_type === 'notice'`도 동일하게 거부**하도록 조건을 추가해야 한다(UI 비노출과 별개의 진짜 방어선, 기존 case_study 방어와 같은 패턴).
- 화면에서 검증 불가능한 항목이므로 **qa-reviewer 체크리스트에 "공지 편집 화면에 AI 버튼이 어떤 대상에서도 보이지 않는다" + "서버 액션을 직접 호출해도 거부된다" 두 가지를 모두 명시**(PRD가 이미 이렇게 요구함, 본 문서는 화면 쪽 조건만 재확인).

### 3.7 `seepn_user` 소비 화면 부재 경고 (N-R6, PRD §12 항목 6, 생략 불가)

**확정 문구(운영 카피 최종안은 ux-writer 협업 가능, 의미는 고정)**: **"이 대상은 아직 볼 수 있는 화면이 없습니다 — seepn.me 준비 중. 지금 게시해도 아무도 보지 못합니다."**

**노출 위치 3곳(모두 Must, 하나라도 빠지면 N-R6 미충족)**:

| 위치 | 트리거 | 형태 |
|---|---|---|
| ① 새 글 작성 폼 | 대상 select에서 "SEEPN 사용자용" 선택 시 즉시(§3.3) | 인라인 경고 배너(경고색 배경, 아이콘) |
| ② 목록 필터 | 대상 필터를 "SEEPN 사용자용"으로 선택했을 때(§3.2) | 목록 상단 고정 배너 |
| ③ 목록 행 자체 | `target_audience='seepn_user'`인 모든 행(필터가 "전체"여도) | 대상 배지 옆에 작은 경고 아이콘(⚠) + hover 시 같은 문구 |

> **①·②는 상황부(필터/작성) 배너, ③은 상시부(행 단위) 표시**로 이원화한 이유: 대표가 필터를 "전체"로 둔 채 목록을 훑을 때도 `seepn_user` 글이 섞여 있으면 놓치지 않아야 하기 때문이다(③이 없으면 필터를 "SEEPN 사용자용"으로 바꿔야만 경고를 본다 — 그 자체가 이미 놓친 상태를 전제로 함). ③은 hover가 아니라 **아이콘 자체가 상시 노출**되어야 한다(hover 텍스트는 부가 설명일 뿐).

### 3.8 번역 상태 표시 (N-R20, PRD §12 항목 7)

- `computeTranslationBadge`/`computeSourceBadge`(둘 다 시그니처 변경 없이 재사용 가능, `lib/admin/translationStatus.ts` 확인 완료)를 §3.4의 `locales` 배열 길이만큼 반복 호출한다.
- `partner`행: KO 배지 1개(초안/작성완료/게시됨 중 하나) — "번역 필요"라는 warning 배지는 애초에 `isSource=true`인 로케일에는 나타나지 않으므로(기존 함수 로직 그대로) 추가 분기 불필요.
- `seepn_user`행: KO(원본) + EN/JA(번역) 배지 3개. 보조지표 5("en/ja 번역 완료율 100%")를 대표가 목록에서 바로 읽을 수 있도록, **EN 또는 JA가 "번역 필요"(warning tone)인 행은 목록에서 시각적으로 눈에 띄게**(기존 warning 톤 색상 그대로 충분, 별도 강조 불필요 — 이미 다른 색이라 구분됨).

### 3.9 NS-1 경고 문구 (PRD §12 항목 9)

작성/편집 화면(§3.3 새 글 폼 + §3.4 편집 펼침 영역) **양쪽 모두**, 본문 필드 바로 아래에 상시 캡션으로 고정 노출한다(툴팁·최초 1회 모달 아님 — 매번 쓸 때마다 봐야 하는 운영 규칙이기 때문):

> **"공지 내용은 로그인 여부와 무관하게 인터넷에서 누구나 볼 수 있는 공개 데이터입니다. 특정 파트너의 상호명·담당자·연락처·심사 결과 등 개별 식별정보를 적지 마세요."**

### 3.10 목록 페이지 상단 요약 — 통합

`/admin/board/notice` 페이지 상단 구조(위에서 아래):

1. 안내 문구(§3.1 교체본)
2. 대상 필터 SegmentedControl(§3.2) — 필터가 "SEEPN 사용자용"이면 바로 아래 경고 배너(§3.7 ②)
3. `NewArticleForm`(§3.3, 접힌 "+ 새 글 추가" 버튼 기본)
4. 목록(필터링된 `ArticleRow` 반복, §3.4/§3.6/§3.7 ③/§3.8 모두 이 행 안에 적용)

---

## 4. 파트너 소비 화면 (WS-2) — `/supplier/notices`

### 4.1 진입점 & 인증 정책 (OQ-N4, N-R7/N-R8, PRD §12 항목 8)

**확정**: PRD 권고안("푸터 + 프로필 홈 미리보기 조합")을 그대로 채택한다.

| 결정 항목 | 확정 내용 | 근거 |
|---|---|---|
| 전역 진입점 | `SupplierFooter.tsx`에 4번째 링크 **"공지사항"** 추가(`이용약관 · 개인정보처리방침 · 고객센터 · 공지사항` 순, 맨 뒤에 추가해 기존 3개 순서 유지) | `SupplierFooter`는 `AuthShell`(비로그인 카드 셸)과 `SupplierProfileShell`(로그인 후 셸) **양쪽 모두**에 이미 렌더링되고 있음을 코드로 확인(§1 재사용 목록) — 이 파일 하나만 고치면 **/supplier/* 모든 화면에서 1클릭 도달**이 자동으로 만족되어 N-R8("모든 화면에서 2클릭 내")을 여유 있게 충족한다 |
| 인증 정책 | `requireSupplierSession()`만 통과하면 접근 허용(`lib/supplier/session.ts` 확인 완료) — **이메일 미인증 상태도 접근 허용**, `/supplier/profile/layout.tsx`의 이메일 인증 인터스티셜을 공지 화면에는 적용하지 않는다 | 공지는 D-N0-8에 따라 이미 "사실상 공개 데이터"(NS-1)라 접근을 더 엄격히 가둘 보안상 이유가 없고, 오히려 이메일 인증 전 파트너가 "왜 지연되는지" 궁금해할 시점(P-N3)에도 봐야 할 화면이다. **service-planner 자체 결정(비차단, PM 확인 불필요)** |
| 비로그인 접근 | `/supplier/notices` 직접 접근 시 `/supplier/login?next=/supplier/notices`로 리다이렉트(기존 `requireSupplierSession` 리다이렉트 패턴 그대로, 로그인 후 원래 목적지로 돌아오는 `next` 파라미터 처리는 기존 로그인 화면 관례를 따른다) | 기존 패턴 재사용 |
| 화면 셸 | **신규**: `SupplierProfileShell`을 재사용하지 않는다(프로필 제출 체크리스트/탭이 공지와 무관해 혼란을 준다). 대신 상단바(워드마크 + `AccountMenu`, `SupplierProfileShell` 헤더와 동일 스타일) + 본문 + `SupplierFooter`로 구성된 **경량 셸**(`app/supplier/notices/layout.tsx`, 가칭 `SupplierNoticesShell`)을 신설한다. 상단바에 "← 프로필로 돌아가기" 링크 포함 | 기존 `app/supplier/support/page.tsx`가 셸 없이 직접 헤더+`SupplierFooter`를 조립한 것과 같은 급의 화면이라, 그 패턴과 일관 |

### 4.2 목록 페이지 `/supplier/notices`

| 구성요소 | 동작 | 상태별 표시 | 예외처리 |
|---|---|---|---|
| 상단바 | §4.1 셸 공통 | — | — |
| 페이지 타이틀(h1) | "공지사항" | — | — |
| 카드 목록 | `target_audience='partner' AND status='published' AND is_active=true`, `sort_order DESC` — **`target_audience` 필터는 반드시 애플리케이션 쿼리 조건**으로 명시(G-1, RLS가 대상을 구분하지 않으므로 이 필터가 유일한 방어선). 카드 = 제목 + 요약(2~3줄 clamp) + 날짜(`created_at` 프록시, §6.5 한계 승계) | 정상: N개 카드 / 0건: **"아직 등록된 공지가 없습니다."** | DB 조회 실패 시에도 빈 상태와 동일하게 표시(기존 블로그 목록의 graceful-degradation 원칙 승계, §4.1 선례) |
| 페이지네이션 | 없음(MVP) — 선례 스펙과 동일 재검토 트리거(대상당 누적 20건 초과 시 재검토) | — | — |
| 읽음/신규 표시 | **의도적으로 없음**(W-N5 승계 — 조회수·읽음 추적 스키마 자체가 없다) | — | — |
| ISR/캐시 | 로그인 뒤에 있는 화면이라 공개 사이트의 `revalidate=60` 패턴이 아니라 **매 요청 서버 조회**(기존 `/supplier/profile` 계열과 동일하게 캐시하지 않음) | — | — |

### 4.3 상세 페이지 `/supplier/notices/[slug]`

| 구성요소 | 동작 | 상태별 표시 | 예외처리 |
|---|---|---|---|
| 상단바 | §4.1 공통 | — | — |
| 뒤로가기 | "← 공지 목록으로" → `/supplier/notices` | — | — |
| 타이틀(h1) | 제목(ko) | — | — |
| 본문 | `body_markdown`을 기존 `renderContentMarkdown`으로 렌더링(WS-3 배포 전까지는 이미지 문법 미지원 상태 그대로, §5.4에서 렌더러 확장 후 자동 적용) | — | 렌더러가 모르는 문법은 일반 텍스트로 표시(에러 아님, 기존 원칙 승계) |
| 하단 CTA | **없음** — 공개 사이트 상세 페이지의 "문의하기" CTA(`ArticleDetailPage`)는 방문자(바이어)를 리드로 전환하기 위한 것이라 이미 로그인한 파트너에게는 맥락이 다르다. 후속 문의가 필요하면 §4.1 상단바나 Footer의 "고객센터" 링크로 충분 | — | — |
| 대상/상태 불일치 접근 | slug는 존재하지만 `target_audience≠'partner'`이거나 `status≠'published'`이거나 `is_active=false` | **`notFound()`(404)** — 세 조건 중 하나라도 어긋나면 조회 함수가 `null`을 반환하도록 설계(§2 계약). **`seepn_user` 공지의 slug를 안다고 해도 이 경로로는 절대 노출되지 않아야 한다**(G-1의 핵심 검증 포인트, qa-reviewer 필수) | — |
| SEO | **`noindex`** — `/supplier/*` 전체가 이미 `robots: { index: false, follow: false }`(layout.tsx 확인 완료)이므로 별도 처리 불필요 | — | — |

### 4.4 프로필 홈 미리보기 (N-R18, PRD §12 항목 10) — **포함으로 확정**

**결정: 포함한다.** 이유: (1) Should 요구사항이지만 WS-2 견적(1.5인일)에 이미 반영 가능한 규모, (2) P-N3("파트너가 왜 심사가 지연되는지 확인할 접점이 프로필 폼뿐")를 가장 저비용으로 완화하는 지점이 로그인 직후 화면(`/supplier/profile`)이다, (3) PRD 자체가 "권고"로 남겨둔 항목이지 "보류 권고"가 아니다.

| 구성요소 | 동작 | 상태별 표시 | 예외처리 |
|---|---|---|---|
| 위치 | `SupplierProfileShell`의 `StatusBanner` 바로 아래, `ProfileTabs` 바로 위에 **1줄짜리 슬림 위젯**으로 삽입(체크리스트·탭 레이아웃을 건드리지 않는 최소 침습 위치) | | |
| 표시 내용 | **최신 공지 1건만**(3건 캐러셀 아님 — 좁은 가로 폭에서 카드 3개를 넣으면 시선이 분산되고 구현 비용도 늘어 최소 침습 원칙에 어긋난다는 판단) — "최신 공지: {제목} ({날짜}) →" 형태 텍스트 링크 + 우측에 "전체보기" 링크 | 공지가 1건 이상 있을 때만 렌더링 | **공지 0건이면 위젯 자체를 렌더링하지 않는다**(빈 상태 문구를 넣지 않음 — 이 위젯은 발견 보조 장치이지 1차 콘텐츠 영역이 아니므로, 없을 때는 조용히 사라지는 편이 프로필 화면을 덜 어지럽힌다) |
| 클릭 동작 | 제목 클릭 → `/supplier/notices/[slug]`(해당 공지 상세), "전체보기" 클릭 → `/supplier/notices` | — | — |
| 데이터 조회 | §4.2와 동일 조회 함수를 `limit 1`로 재사용(별도 함수 신설 불필요) | — | — |

> **ui-ux-designer 확인 요청(경량)**: PRD는 "에디터·이미지 업로드만 실질 시안 대상"이라 했으나, 이 슬림 위젯은 기존 컴포넌트 조합이 아니라 **새로 생기는 시각 요소**이므로 1줄 와이어프레임 수준의 확인을 권장한다(디자인 시스템 이탈 여부만 체크, 별도 리서치 불필요).

---

## 5. 리치 텍스트 에디터 + 이미지 업로드 (WS-3) — 능력 정의 (라이브러리 선택 제외)

> PRD C-1(저장 포맷 확정은 WS-1 착수 전 완료)·C-2(마크다운 유지 권고)·C-3(이미지는 파이프라인) 제약 위에서, **에디터가 사용자에게 무엇을 하게 해줘야 하는지**만 정의한다. 구현 라이브러리, DOM 구조, 최종 저장 포맷(마크다운 vs HTML)은 frontend-developer + privacy-security-officer 소관이다.

### 5.1 편집 능력 (N-R14 최소선)

| 능력 | 필수 여부 | 정의 |
|---|---|---|
| 제목(H1/H2 수준) 적용 | Must | 마우스로 텍스트 선택 → 툴바 버튼 클릭으로 적용/해제 |
| 굵게 | Must | 동일 |
| 목록(불릿/번호) | Must | 동일, 두 종류 모두 |
| 링크 삽입/편집 | Must | 선택한 텍스트에 URL 부여, 기존 URL 스킴 검증(`http(s)://` 또는 `/`만 허용, 그 외는 텍스트로만 남김 — §5.3 선례 규칙 승계) 재사용 |
| **실시간 결과 표시(WYSIWYG)** | Must | 사용자가 서식을 적용하는 순간 `**bold**` 같은 원시 문법이 아니라 **적용된 결과 형태**로 보여야 한다(N-R14 "작성 중 결과가 보여야 한다") — 최종 저장 포맷이 마크다운이어도 편집 화면 자체는 WYSIWYG이어야 한다는 뜻 |
| 표/코드블록/임베드 새로 만들기 | **불필요(W-N10)** | 툴바에 없어도 된다 |
| **단, 기존 표가 포함된 문서를 열었을 때** | Must | 툴바로 새로 만들 수는 없어도, **사례(case_study) 문서에 이미 있는 마크다운 표를 에디터로 열었을 때 깨지거나 사라지면 안 된다**(N-R15가 W-N10보다 우선) |

### 5.2 기존 콘텐츠 호환 (N-R15)

- 기존 사례/FAQ 본문(마크다운, §5.3 지원 서브셋: 헤딩/굵게/리스트/표/링크)을 에디터로 열었을 때 **서식이 유지된 채로 표시**되어야 하고, 아무 것도 편집하지 않고 저장해도 **원본과 동일한 마크다운이 다시 저장**되어야 한다(왕복 무손실).
- 에디터가 이해하지 못하는 레거시 문법이 있다면(현재는 없음 — 기존 지원 서브셋 안에서만 작성돼 있음) **조용히 삭제하지 않고 원문 그대로 보존**한다.

### 5.3 이미지 업로드 (N-R16, D-N0-6, C-3) — 파이프라인 4요소와 화면의 대응

| C-3 요소 | 화면에서 사용자가 겪는 것 |
|---|---|
| ① 업로드 엔드포인트 | 툴바 "이미지 삽입" 버튼 → 파일 선택 다이얼로그 |
| ② 전용 공개 버킷 | 사용자에게는 보이지 않음(백엔드 관심사) — 단, **업로드 즉시 공개된다는 사실을 화면 문구로 알려야 한다**(아래 경고) |
| ③ 렌더러 이미지 문법 지원 | 업로드 성공 시 에디터 안에서 이미지가 **바로 인라인으로 보여야** 한다(삽입했는데 안 보이면 렌더러가 지원하지 않는 것 — 배포 순서상 렌더러 확장과 에디터 배포가 짝을 이뤄야 함) |
| ④ URL 스킴 검증 | 사용자에게는 보이지 않음(방어적 코딩) |

**업로드 UX 상태 정의**:

| 상태 | 화면 표시 |
|---|---|
| 업로드 중 | 삽입 위치에 진행 표시(스피너 또는 진행바) — 완료 전까지 해당 위치를 편집하지 못하게 막을 필요는 없음(진행 중 표시만 있으면 충분, 커서 이동은 허용) |
| 성공 | 삽입 위치에 이미지가 바로 렌더링 |
| 실패(용량 초과) | 삽입하지 않고 인라인 에러: "파일 용량이 너무 큽니다(최대 {N}MB)" — 정확한 상한값은 backend-developer 확정(§7.6) |
| 실패(허용되지 않는 형식) | 삽입하지 않고 인라인 에러: "지원하지 않는 이미지 형식입니다(jpg/png/webp만 가능)" — **SVG는 클라이언트에서도 파일 선택 단계부터 걸러 서버까지 보내지 않는 것을 권장**(C-3 SVG 제외 권고를 UX 레벨에서도 조기 차단) |
| 실패(네트워크/서버 오류) | "업로드에 실패했습니다. 다시 시도해주세요." + 재시도 가능 |
| 삽입된 이미지 삭제 | 에디터에서 선택 후 삭제 가능(문서에서만 제거, **버킷의 원본 파일은 남는다** — W-N11에 따라 자동 정리하지 않음, 화면에 이 사실을 알릴 필요는 없음, 운영 이슈일 뿐 사용자 경험 이슈가 아님) |
| 이미지 교체(같은 위치 다른 파일로) | Must 아님(Could) — 삭제 후 재삽입으로 충분 |

**NS-5 공개 경고 문구(상시 노출, 업로드 시도 전에 보여야 함)**:

> **"업로드한 이미지는 로그인 없이 인터넷 누구나 볼 수 있습니다. 사업자등록증, 개인 연락처 등 개인정보가 담긴 이미지를 올리지 마세요."**

위치: "이미지 삽입" 툴바 버튼 바로 아래 또는 파일 선택 다이얼로그를 여는 시점에 상시 캡션으로(모달 1회성 아님 — 매번 올릴 때마다 실수 가능성이 있으므로 §3.9 NS-1 캡션과 같은 급의 "항상 보이는 문구"로 취급한다).

### 5.4 배포 순서 제약 (기존 PRD 제약의 화면 반영)

- WS-3는 WS-1/WS-2 배포를 막지 않는다(PRD §8.2-b). **WS-1/WS-2 배포 시점에는 본문 필드가 여전히 plain textarea + 제한 마크다운**이며, 이는 §3.3/§3.4가 이미 그렇게 정의했다(기존 컴포넌트 그대로 재사용).
- WS-3가 나중에 배포될 때 **에디터 도입과 렌더러 이미지 지원 확장은 반드시 같은 배포에 묶는다** — 에디터만 먼저 나가면 "이미지를 넣었는데 파트너 화면에서 안 보인다"는 사고가 난다(§5.3 ③).

---

## 6. 엣지케이스 / 예외 상황 (통합)

| # | 상황 | 정의된 동작 |
|---|---|---|
| **N-E1** | `/supplier/notices`·`/supplier/notices/[slug]` 조회 쿼리에서 `target_audience` 필터가 실수로 빠짐 | 이 문서와 무관하게 **코드 리뷰/QA에서 반드시 잡아야 하는 최우선 회귀 항목**(G-1). 화면 정의서 차원에서는 §2·§4.2·§4.3에 필터 조건을 문서로 못박아 구현 누락 시 스펙 대조로 잡히게 한다 |
| **N-E2** | `seepn_user` 공지에 en/ja 번역을 하나라도 저장한 뒤 대상을 바꾸려는 시도 | §3.5 — UI에서 select 자체가 잠금 표시로 바뀌어 시도 자체가 불가능(서버 액션도 같은 조건으로 거부해야 함 — backend-developer에 전달) |
| **N-E3** | 공지 편집 화면에서 AI 초벌 버튼을 URL 조작/개발자도구로 강제 노출 시도 | 서버 액션이 `content_type==='notice'`를 거부하므로 버튼이 보여도 저장은 실패(§3.6) |
| **N-E4** | `seepn_user` 공지를 게시(`published`)했는데 대표가 "공지했다"고 착각 | §3.7 3중 경고로 방지(작성 시점/필터 시점/행 단위 상시). 완전한 방지는 불가능하므로 **가드레일**로만 취급(경고를 무시하고 진행하는 것 자체는 막지 않음 — 운영 의사결정 영역) |
| **N-E5** | 블로그 제거 후 `case_study`(사례) 게시판이 같은 상수·컴포넌트 공유로 인해 회귀 | 이 문서가 변경을 요구하는 지점(§3.4 `locales` prop 일반화, §3.6 `showAiFill` 조건)이 **`case_study` 호출부의 기존 인자(en/ja 배열, 기존 조건)를 그대로 유지**하는 것을 전제로 설계됨 — qa-reviewer 필수 회귀 항목(G-5) |
| **N-E6** | 슬러그가 `partner`/`seepn_user` 공지 사이에서 중복 시도 | 기존 unique 제약(`content_key`)에 의해 저장 거부, "이미 사용 중인 슬러그입니다" 에러(§3.3 안내 문구로 사전 인지시킴) |
| **N-E7** | `ko`(원문)는 draft인데 `en`/`ja`가 먼저 published인 비정상 상태 | 선례(E-3)와 동일하게 **허용**한다 — 새 제약을 추가하지 않는다. 단, Phase 1에서 seepn.me 폴백 기준이 `en`이 아니라 `ko`임을 후속 구현자가 알아야 함(§6.6 재확인, 이 문서 §2에도 명시) |
| **N-E8** | `/supplier/notices/[slug]`로 `seepn_user` 공지의 실제 slug를 알고 직접 접근 | `target_audience≠'partner'` 조건에서 조회 함수가 `null` 반환 → `notFound()`(§4.3, G-1의 핵심 검증) |
| **N-E9** | 이메일 미인증 파트너가 `/supplier/notices` 접근 | 허용(§4.1 결정) — `/supplier/profile/*`와 다른 정책임을 코드 리뷰 시 혼동하지 않도록 주석 필요(frontend-developer 전달 사항) |
| **N-E10** | 프로필 홈 미리보기 위젯에서 공지 0건 | 위젯 자체 비노출(§4.4) |
| **N-E11** | 세션 만료 상태에서 `/supplier/notices` 접근 | `requireSupplierSession()`의 기존 리다이렉트 동작 그대로(`/supplier/login`), 신규 처리 불필요 |
| **N-E12** | 이미지 업로드 도중 사용자가 저장/이탈 | Must는 아니지만 권장: 업로드 미완료 상태에서 저장 시도 시 "이미지 업로드가 끝난 뒤 저장해주세요" 경고(구체 구현은 frontend-developer, 최소한 업로드 실패 상태로 저장되어 깨진 이미지 참조가 남는 것은 방지) |
| **N-E13** | 동시에 두 관리자가 같은 공지를 편집 | 기존 정책과 동일하게 last-write-wins, 동시편집 잠금은 범위 밖(선례 E-8 승계) |
| **N-E14** | 대표가 옛 즐겨찾기로 `/admin/board/blog` 접근(경로 변경 후) | 404 — 리다이렉트 규칙을 별도로 만들지 않는다(내부 관리자 전용 URL이라 영향 범위가 작음, 운영 공지로 충분) |

---

## 7. 범위 밖 (Out of Scope, 명시적 확인용)

seepn.me 공지 소비 화면(Phase 1, WS-4), 공지 알림/이메일 자동 발송, 조회수·읽음 확인, 파일 첨부(PDF 등), 에디터의 표/코드블록/임베드 신규 작성 기능, 업로드 이미지 고아 파일 자동 정리, `partner` 공지 다국어화, 공지 분류 배지, 게시 시작일·만료일 예약, `seepn_user` 공지 AI 초벌 번역, FKP 공개 사이트 공지 노출, 공지 검색, 페이지네이션(현 규모 기준). 위 항목이 필요해지면 PRD §6.3/§12 후속 과제 표의 트리거 조건에 따라 별도 스펙으로 다룬다.

---

## 8. 변경 파일 지도 (backend/frontend 참고용, 실제 구현 범위는 각 담당자가 확정)

| 파일 | 변경 내용 |
|---|---|
| `lib/content/contentTypes.ts` | `ArticleContentType`에서 `'blog'` 제거, `'notice'` 추가. `CONTENT_TYPE_URL_SEGMENT`/`URL_SEGMENT_TO_CONTENT_TYPE`에서 blog 제거(notice는 공개 URL 세그먼트가 없으므로 추가하지 않음, §3.4 슬러그 라벨 참고) |
| `app/admin/(protected)/board/ArticleRow.tsx` | `LOCALES` 하드코딩 → `locales` prop화(§3.4). `showAiFill` 조건에 `'notice'` 추가(§3.6). 대상 배지·잠금 UI 추가(§3.2/§3.5) |
| `app/admin/(protected)/board/NewArticleForm.tsx` | 대상 select 필드 추가, 라벨 "영문 →" 제거(§3.3) |
| `app/admin/(protected)/board/loadContent.ts` | `loadArticleRecords`가 `target_audience`를 함께 읽어 `ArticleRecord.targetAudience`로 반환(§2) |
| `app/admin/(protected)/board/actions.ts` | `createArticleAction`/`updateArticleItemAction` 입력에 `targetAudience` 추가, G-3 함수 시그니처 변경 반영, `aiFillArticleTranslationAction` notice 방어 추가(§3.6) |
| `app/admin/(protected)/board/blog/` → `notice/` | 디렉터리 이동 + 안내 문구 교체(§3.1) |
| `app/[locale]/blog/**` | 삭제(§7.3, PRD 재확인) |
| `components/Footer.tsx` | Blog 링크 제거(FKP 공개 사이트, PRD §7.3) |
| `components/supplier/SupplierFooter.tsx` | "공지사항" 링크 추가(§4.1) |
| `app/supplier/notices/` (신규) | `layout.tsx`(경량 셸), `page.tsx`(목록), `[slug]/page.tsx`(상세) — §4.2/§4.3 |
| `lib/content/getPublishedContent.ts` 또는 신규 `lib/content/getPublishedNotices.ts` | `target_audience='partner'` 필터가 포함된 신규 조회 함수(§2, G-1) |
| `components/supplier/SupplierProfileShell.tsx` | 최신 공지 미리보기 위젯 삽입(§4.4) |
| `lib/i18n/{types,en,ja}.ts` | `blog.*`, `footer.blogLinkText` 키 제거(PRD §7.3) |

---

## 9. 핸드오프

### ui-ux-designer
- §5(에디터+이미지 업로드)의 실제 시안 — 유일한 실질 신규 비주얼 대상(PRD 재확인)
- §4.4 프로필 홈 미리보기 위젯의 경량 확인(신규 요소이므로, PRD가 언급하지 않은 항목이지만 service-planner가 추가 요청)

### privacy-security-officer
- PRD §9 NS-1~NS-3 경량 확인 + NS-5(이미지 공개 버킷, §5.3) 검토
- 저장 포맷이 HTML로 결정되면 NS-4 정식 검토로 승격(frontend-developer와 함께)

### backend-developer
- §2 데이터 계약(`target_audience` NOT NULL 제약, `source_locale='ko'` 처리, G-3 함수 시그니처) 먼저 확정 후 frontend-developer와 공유(CLAUDE.md 원칙)
- §3.6 서버 방어(`aiFillArticleTranslationAction`에 notice 거부 추가), §3.5 대상 변경 잠금 조건의 서버 측 재검증(UI만 믿지 않음)
- §5.3 이미지 버킷·MIME·용량 상한 확정 후 frontend-developer에 회신

### frontend-developer
- §5 C-1/C-2 저장 포맷 최종 판단(privacy-security-officer와 합의), 에디터 라이브러리 선정
- §3.4 `ArticleRow`/`NewArticleForm`/`loadContent.ts` 로케일 배열 prop 일반화(사례 동작 불변 필수, N-E5)
- §4 파트너 소비 화면 신규 구현

### qa-reviewer
- §6 통합 엣지케이스 표, 특히 N-E1(G-1 유출 방지)·N-E3(AI 버튼 서버 방어)·N-E5(사례 게시판 회귀) 최우선
- §3.5 대상 변경 잠금이 UI와 서버 양쪽에서 일치하는지

### product-manager / project-manager
- 이 문서는 PRD §11 "위임된 결정" 표에 따라 **대표 재확인 없이** 확정했다. 이의가 있으면 회신 요청.
- 착수 시점(OQ-N2)은 여전히 project-manager/대표 소관 — 본 문서는 착수 시점과 무관하게 "착수하면 이렇게 만든다"를 정의한 것.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-09-08 | 초안 — PRD v3.0 Final §12 10개 항목 전건 확정. WS-1(Admin, 대상 필터·선택 UX·로케일 열 1/3·대상변경 잠금 UX·AI버튼 비노출·NS-1/N-R6 경고)·WS-2(`/supplier/notices` 목록/상세/진입점/프로필 미리보기 포함 확정) 상세 설계. WS-3(에디터+이미지)는 능력 정의만(라이브러리 미선택). 통합 엣지케이스 14건, 변경 파일 지도 작성 | service-planner |
