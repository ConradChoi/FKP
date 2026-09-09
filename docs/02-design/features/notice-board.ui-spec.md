---
template: ui-screen-spec
version: 1.0
feature: notice-board
phase: 에디터+이미지 업로드 시안 / 대상(target_audience) 시각 요소 / 프로필 홈 미리보기 위젯
description: notice-board.screen-spec.md(v1.0)가 ui-ux-designer에게 위임한 3개 항목(§5 에디터+이미지, §3.2~3.9 대상 관련 시각요소, §4.4 프로필 홈 위젯)을 실제 색상·레이아웃·상태별 스타일로 구체화한다. 새 컴포넌트/색상 토큰을 만들기 전에 `components/admin/styles.ts`, `tailwind.config.ts`, `lib/admin/translationStatus.ts`, 기존 경고 배너 선례(NewPartnerEntryForm/Top3ConfirmSection/DocumentsForm)를 최대한 재사용한다.
variables:
  - feature: notice-board
  - date: 2026-09-08
  - author: ui-ux-designer
  - project: SEEPN × FKP Unified Platform
  - version: 1.0.0
  - status: Draft — ux-writer(문구 최종화) → frontend-developer(구현, 에디터 라이브러리 선정) → privacy-security-officer(NS-5 톤 확인) → qa-reviewer
---

# 공지사항(Notice) 게시판 — UI 스펙 (에디터·대상 UX·프로필 위젯)

| 항목 | 내용 |
|---|---|
| 문서 종류 | UI Spec (색상 / 레이아웃 / 상태별 시각 분기) |
| 작성자 | ui-ux-designer |
| 입력 문서 | [notice-board.screen-spec.md](notice-board.screen-spec.md) §3(Admin), §4.4(프로필 위젯), §5(에디터+이미지) / [notice-board-v1.0.prd.md](../../01-plan/features/notice-board-v1.0.prd.md) §6.4, §9 NS-5 |
| 참조 코드 | `components/admin/styles.ts`, `tailwind.config.ts`, `lib/admin/translationStatus.ts`(`computeTranslationBadge`, `TONE_CLASS`), `components/admin/StatusBadge.tsx`, `components/admin/SegmentedControl.tsx`, `app/admin/(protected)/board/{ArticleRow.tsx, NewArticleForm.tsx}`, `app/admin/(protected)/leads/[id]/matching/{Top3ConfirmSection.tsx, NewPartnerEntryForm.tsx}`(경고 배너 선례), `app/supplier/profile/documents/DocumentsForm.tsx`(업로드 UI 선례), `components/supplier/{SupplierProfileShell.tsx, StatusBanner.tsx, ProfileTabs.tsx}`, `lib/content/renderMarkdown.tsx`(실제 지원 마크다운 서브셋) |
| 스코프 | screen-spec §5(에디터/이미지 능력을 실제 시안으로), §3.2~3.9(대상 배지/필터/경고/잠금 UX 시각화), §4.4(위젯 경량 확인 요청에 대한 실제 레이아웃) |
| 스코프 아님 | 에디터 라이브러리 선택, DOM 구현, 저장 포맷(C-1/C-2) 최종 결정, 실제 컴포넌트 코드 — frontend-developer 소관 |
| 후속 담당 | ux-writer(경고/에러 문구 최종화, 의미는 본 문서·PRD가 고정) → frontend-developer(구현) → privacy-security-officer(NS-5 문구/노출 방식 확인) → qa-reviewer |

---

## 0. 설계 원칙과 먼저 짚어야 할 것

### 0.1 새 토큰·새 컴포넌트를 만들지 않는다 (기존 자산 감사 결과)

| 필요 요소 | 새로 필요한가 | 근거 |
|---|:---:|---|
| 경고 배너(박스형) | 아니오 | `NewPartnerEntryForm.tsx`(`rounded-input border border-accent-200 bg-accent-100 p-3` + `admin-body-sm text-accent-700`) 패턴을 그대로 재사용. **Admin 안에서 이미 3곳(카테고리 중복 경고, 재검증 전 파트너 경고, 사업자번호 중복 경고)이 같은 값을 쓰고 있어 사실상 확정 토큰** |
| 대상/배지 pill | 아니오 | `ArticleRow.tsx`의 로컬 `Badge({label, tone})` + `TONE_CLASS`(`neutral`/`warning`/`success`/`info`) 그대로 재사용. `neutral` 톤(`bg-neutral-100 text-neutral-600`)이 대상 배지에 정확히 맞음 |
| 진행 스피너 | 아니오 | `adminSpinnerClass` 재사용 |
| 저장/취소/삭제 버튼 | 아니오 | `adminButtonPrimaryClass`/`adminButtonSecondaryClass`/`adminButtonDestructiveClass`/`adminButtonGhostClass` 재사용 |
| **에디터 툴바 버튼**(컴팩트 아이콘 버튼) | **부분적으로 필요** | 기존 버튼 4종은 전부 `px-4 py-2`급 폼 액션 크기다. 툴바처럼 6~7개 버튼이 한 줄에 붙는 용도의 컴팩트 아이콘 버튼은 없다 — `adminButtonAiFillClass`(카드 헤더용 컴팩트 버튼)의 색상 로직을 그대로 가져오되 정사각형에 가까운 아이콘 전용 크기로 새 클래스 조합을 정의한다(§1.3). **색상값은 새로 만들지 않는다** |
| 아이콘 세트(SVG) | **의도적으로 도입하지 않음** | Admin에는 SVG 아이콘 컴포넌트가 아예 없다(`✨` `⚠` 같은 유니코드 글리프로 통일돼 있음, `AiFillButton.tsx`/`Top3ConfirmSection.tsx` 확인). `components/icons/SupplierIcons.tsx`는 `/supplier` 전용이고 에디터는 Admin 전용 화면이므로 이식 대상이 아니다. **툴바도 같은 관례를 따라 텍스트/유니코드 글리프로 구성**(§1.2). 다만 이건 강제가 아니라 권고다 — 선택한 에디터 라이브러리가 자체 SVG 아이콘 세트를 번들하면 그걸 써도 무방하다(§1.2 하단 참고) |

### 0.2 시작 전에 지적할 것 — 이탤릭 버튼을 넣지 말 것

이번 작업 요청에는 "볼드/이탤릭/링크/목록/이미지"가 언급됐지만, **PRD N-R14 최소선과 screen-spec §5.1 모두 이탤릭을 요구하지 않는다**(요구: 제목/굵게/목록/링크/문단). 더 결정적으로, `lib/content/renderMarkdown.tsx`를 확인한 결과 **현재 렌더러는 이탤릭 마크다운 문법(`*text*`)을 지원하지 않는다** — 지원 서브셋은 `#`/`##` 헤딩, `**굵게**`, `- `/`1. ` 목록, `|표|`, `[링크](url)` 뿐이다(파일 상단 주석 §5.3에 명시).

**결론: 이탤릭 버튼을 넣지 않는다.** 넣으면 사용자가 이탤릭을 적용해도 저장 후 파트너 화면에서 서식이 사라지는(또는 `*text*`가 그대로 텍스트로 보이는) 조용한 버그가 된다 — "적용했는데 안 먹힌다"는 최악의 에디터 신뢰도 손실이다. 이 판단은 §1.1 툴바 구성에 반영했다.

### 0.3 레이아웃 판단 — 분할 미리보기(edit/preview 2단) 대신 단일 WYSIWYG 영역

N-R14가 요구하는 것은 "작성 중 결과가 보여야 한다"이지 "원문 마크다운과 렌더링 결과를 나란히 보여줘야 한다"가 아니다. `seepn_user` 공지는 편집 그리드가 **3열**(§3.4)이라, 각 로케일 카드가 이미 좁다 — 카드 하나 안에 편집창+미리보기창을 또 나누면 실사용 폭이 지나치게 좁아진다(모바일 관리 시나리오는 없지만 데스크톱에서도 3분할×2단은 실질적으로 못 쓴다). **단일 contentEditable 영역이 곧 미리보기를 겸하는 WYSIWYG 방식**으로 확정한다(§1.3).

### 0.4 타이포그래피 불일치 주의 (frontend-developer 참고)

에디터는 Admin 화면 안에 있으므로 Admin 타이포 토큰(`admin-*`, Pretendard/Inter)으로 그려진다. 반면 실제 파트너 화면(`/supplier/notices/[slug]`)의 `renderContentMarkdown`은 버이어 공용 토큰(`text-h2`/`text-h3`/`text-body`, Inter)을 쓴다. **에디터 내부 미리보기와 실제 게시 결과의 글꼴/크기가 픽셀 단위로 같지 않다** — 이는 의도된 것이다(N-R14의 목적은 "원시 문법 노출 방지"이지 "픽셀 동일성"이 아니다). frontend-developer는 이 차이를 버그로 보고하지 않아도 된다. 단, **상대적 위계**(H1 > H2 > 본문, 굵게가 굵게로 보임)는 에디터 안에서도 반드시 성립해야 한다.

---

## 1. 에디터 툴바 + 레이아웃 (N-R13~N-R15, PRD §6.4)

### 1.1 툴바 구성 — 최소선 그대로, 그룹 3개

```
┌──────────────────────────────────────────────────────────────┐
│ [본문 ▾]  |  B  |  • 목록  1. 목록  |  🔗 링크  🖼 이미지        │
├──────────────────────────────────────────────────────────────┤
│ (contentEditable 영역 — 여기서 바로 서식이 적용된 채로 보임)      │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

| 그룹 | 구성 | 근거 |
|---|---|---|
| 1. 문단 서식 | `[본문 ▾]` 드롭다운(옵션: 본문/제목1/제목2) | N-R14 "제목(H1/H2)...문단을 적용" — 토글 버튼 2개(H1/H2)로 만들면 "누른 상태에서 또 눌러야 해제되는지"가 모호해진다. **드롭다운 1개로 "지금 커서가 있는 블록의 종류"를 명확히 보여주고 바꾸는 편이 오조작이 적다**(현재 상태 표시 겸용) |
| 2. 인라인 서식 | `B`(굵게) 1개만 | 이탤릭 제외(§0.2). 밑줄/취소선도 N-R14 밖이라 넣지 않음(W-N10과 같은 원칙 — 최소선 밖은 추가하지 않는다) |
| 3. 목록 | `• 목록`(불릿), `1. 목록`(번호) | 렌더러가 두 종류 모두 지원(§5.3 확인 완료) |
| 4. 삽입 | `🔗 링크`, `🖼 이미지` | 구분선(divider)으로 앞 그룹과 시각적으로 분리 — "서식 적용"과 "새 요소 삽입"은 다른 종류의 행동이므로 그룹을 나눠 인지 부하를 낮춘다 |

**표/코드블록 버튼 없음(W-N10)**. 단 기존 사례(case_study) 문서의 표를 열었을 때는 §1.4에서 별도로 다룬다(만들 수는 없어도 깨지면 안 됨).

### 1.2 툴바 버튼 시각 사양

기존 버튼 색상 로직(`adminButtonSecondaryClass`)을 그대로 쓰되, 툴바 전용 컴팩트 변형을 정의한다. `components/admin/styles.ts`에 추가할 것을 권고(named export, `adminButtonAiFillClass` 옆에 두는 선례를 따름):

```ts
// 신규 제안 — components/admin/styles.ts
export const adminEditorToolbarButtonClass =
  'inline-flex h-8 min-w-[32px] items-center justify-center gap-1 rounded-sm px-2 admin-body-sm text-neutral-600 transition-colors hover:bg-neutral-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:text-neutral-300'

export const adminEditorToolbarButtonActiveClass =
  'bg-primary-50 text-primary-700 hover:bg-primary-100'
```

| 상태 | 클래스 조합 | 설명 |
|---|---|---|
| 기본(비활성 서식) | `adminEditorToolbarButtonClass` | 커서 위치에 해당 서식이 적용돼 있지 않음 |
| 활성(적용됨) | `adminEditorToolbarButtonClass + adminEditorToolbarButtonActiveClass` | 커서가 굵은 글씨/목록/링크 안에 있을 때. `aria-pressed="true"` 동반 |
| disabled | `disabled` 속성만 부여(예: 이미지 업로드 중에는 새 이미지 버튼 disabled) | 별도 클래스 불필요, `disabled:` 접두 클래스가 이미 처리 |
| 툴바 컨테이너 | `flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-neutral-50 px-2 py-1.5` | `flex-wrap` 필수 — `seepn_user` 3열 그리드(§3.4)에서 카드 폭이 좁아지면 자동 줄바꿈되어야 함(AI 버튼 헤더와 동일 원칙, `admin-ai-translation-draft.ui-spec.md` §1.1 재확인) |
| 그룹 구분선 | `<span className="mx-1 h-5 w-px bg-neutral-200" aria-hidden="true" />` | §1.1의 4개 그룹 사이 |

**글리프**: `B`는 실제 볼드체 텍스트(`font-bold`)로, `•`/`1.`는 문자 그대로, `🔗`/`🖼`는 유니코드 이모지로 표기(§0.1 이유). **모든 버튼에 `aria-label` 필수**(예: `aria-label="굵게"`, `aria-label="이미지 삽입"`) — 글리프만으로는 스크린리더가 의미를 읽지 못한다. `title` 속성도 함께 부여해 마우스 hover 툴팁을 겸한다(`AiFillButton.tsx`의 `title=disabledReason` 선례와 같은 방식).

> **frontend-developer 재량**: 최종 선택한 에디터 라이브러리가 자체 SVG 아이콘을 번들하고 있고 그게 더 자연스럽다면 그걸 써도 된다 — 이 문서가 못 박는 것은 **그룹 구성·순서·라벨·톤**이지 "반드시 유니코드 글리프여야 한다"가 아니다.

### 1.3 편집 영역(WYSIWYG) 시각 사양

| 항목 | 값 |
|---|---|
| 컨테이너 | 툴바 + 편집영역을 하나의 카드로 묶는다: `rounded-input border border-neutral-300 bg-neutral-0` (툴바는 위 절 참고, 편집영역과 사이에 `border-b`로 이미 분리됨) |
| 포커스 상태 | 편집영역에 포커스가 들어가면 **카드 전체**에 `adminInputClass`와 동일한 포커스 링을 준다: `focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500`. 네이티브 `<input>`이 아니라 `contentEditable`이므로 `:focus`가 아니라 `:focus-within`을 부모에 걸어야 함(frontend-developer 구현 시 필수 확인 사항) |
| 편집영역 패딩/최소높이 | `min-h-[200px] p-3` — 기존 textarea의 `min-h-[200px]`와 동일한 자리 크기를 승계해 레이아웃 점프 없이 교체 가능 |
| 제목1(H1) 표시 | `admin-heading-2`급(24px/600) — Admin 타이포 스케일 안에서 "본문보다 눈에 띄게 크다"만 성립하면 되고, 정확히 24px일 필요는 없다(§0.4) |
| 제목2(H2) 표시 | `admin-heading-3`급(18px/600) |
| 본문(문단) 표시 | `admin-body`(14px/22px) |
| 굵게 표시 | `font-bold` (해당 span만) |
| 목록 표시 | 불릿: `list-disc pl-5`, 번호: `list-decimal pl-5` — 렌더러 출력(`renderMarkdown.tsx`의 `pl-5`)과 동일한 들여쓰기 값을 맞춰서, 에디터 안에서 본 들여쓰기 "느낌"이 실제 파트너 화면과 최대한 비슷하게(§0.4의 "상대적 위계는 맞춰야 한다" 요구를 목록 들여쓰기까지 확장 적용) |
| 링크 표시 | `underline text-primary-600` — 렌더러의 `<a className="underline hover:text-primary-600">`와 시각적으로 동일하게(§0.4) |
| placeholder(빈 상태) | "본문을 입력하세요" — `text-neutral-400`, 커서가 비어있는 첫 줄에 있을 때만 노출(일반적인 contentEditable placeholder 패턴) |

### 1.4 기존 마크다운 호환 (N-R15)

- 사례/FAQ의 기존 표(`|...|`)를 에디터로 열면 **표 형태 그대로 렌더링**되어야 한다(수정 UI는 없어도 무방 — 툴바에 표 버튼이 없으므로 새로 만들 수는 없지만, 이미 있는 표를 지우거나 깨뜨리면 안 된다는 뜻). 표시 스타일은 `renderMarkdown.tsx`의 기존 표 스타일(`border-collapse`, `border-neutral-200`, `bg-neutral-50` 헤더)을 편집영역 안에서도 그대로 재사용해 시각적 이질감을 줄인다.
- 왕복 무손실 검증은 화면 요소가 아니라 로직 요구사항이므로 이 문서 범위 밖(PRD §5.2, frontend-developer/qa-reviewer 소관). 다만 **에디터가 이해 못 하는 문법을 만나면 자리 표시 없이 조용히 사라지는 UI가 되면 안 된다** — 최소한 원문 텍스트 그대로 보존해 사용자가 "뭔가 사라졌다"고 오인하지 않게 한다(§5.2 원칙의 시각적 귀결).

---

## 2. 이미지 업로드 UI (N-R16, D-N0-6, C-3, NS-5)

### 2.1 삽입 트리거

`🖼 이미지` 버튼 클릭 → 네이티브 파일 선택 다이얼로그. `accept="image/jpeg,image/png,image/webp"`를 **HTML `accept` 속성에도 명시**해 SVG/GIF 등을 파일 탐색기 단계에서부터 최대한 걸러낸다(§2.4, C-3 SVG 제외 권고의 UX 선제 조치 — 서버 검증을 대체하지 않음, 어디까지나 사용자 실수를 줄이는 보조 장치).

### 2.2 NS-5 공개 경고 문구 — 노출 위치와 톤

**결정: "상시 노출 캡션" 톤으로, §3.9의 NS-1 캡션과 같은 급으로 취급한다(screen-spec §5.3이 이미 이렇게 지시함).** 즉 이미지 버튼을 누를 때 처음 뜨는 1회성 모달이 아니라, **에디터가 열려 있는 동안 항상 보이는 문구**다.

| 항목 | 값 | 이유 |
|---|---|---|
| 위치 | 툴바 바로 아래, 편집영역 위(카드 바깥, 카드와 NS-1 캡션 사이) — §2.5 레이아웃 참고 | 이미지 버튼을 누르기 **전에** 이미 보여야 "실수로 개인정보 이미지를 고르기 전" 시점에 경고가 도달한다(모달은 파일을 이미 고른 뒤에 뜨므로 늦다) |
| 형태 | 박스 없는 컬러 텍스트 캡션: `⚠` 접두 + `admin-label-sm text-accent-700` | **박스형 배너(§3.7의 대상 경고)와 의도적으로 다른 급.** 대상 경고는 "이 글 자체가 발행돼도 아무도 못 본다"는 상황 트리거형 1회성 경고라 눈에 띄어야 하고, NS-5/NS-1은 **매 카드·매 세션마다 반복 노출**되는 상시 캡션이라 박스로 만들면 화면이 경고 배너로 뒤덮여 피로도만 높아지고 오히려 무시된다(경고 피로, alert fatigue). 색이 있는 텍스트로도 "항상 거기 있다"는 인지는 충분히 만들어진다 |
| 아이콘 색 | `text-accent-600`(글리프 `⚠`) | 기존 코드의 관례(`WarningTriangleIcon`은 아이콘에 `accent-600`, 본문 텍스트는 `accent-700`을 쓰는 분리 패턴, `StatusBanner.tsx`/`DocumentsForm.tsx` 확인)를 텍스트 전용 환경에서도 유지 — 아이콘·글리프는 채도 높은 600번대, 본문 텍스트는 대비 확보를 위해 700번대 |
| 접근성 | 색만으로 경고를 표시하지 않도록 `⚠` 글리프를 항상 텍스트와 함께 붙인다(색맹 사용자 대응, 이미 `⚠`를 접두어로 못 박은 이유) | — |

### 2.3 업로드 상태 4+1가지 — 편집영역 안에서의 표현

업로드는 편집영역 내부, 커서가 있던 자리에 인라인 블록으로 나타난다(별도 사이드 패널 없음 — WYSIWYG 원칙 §0.3 연장).

| 상태 | 시각 표현 | 톤/클래스 |
|---|---|---|
| **① 진행 중** | 삽입 위치에 점선 테두리 placeholder 박스(높이 120px): 스피너 + "업로드 중… {파일명}" | `flex h-[120px] items-center justify-center gap-2 rounded-input border-2 border-dashed border-neutral-300 bg-neutral-50` 안에 `adminSpinnerClass` + `admin-body-sm text-neutral-500`. 커서는 이 블록 뒤로 이동 가능(다른 곳 계속 편집 허용, screen-spec §5.3 명시) |
| **② 성공** | 같은 자리에 이미지가 바로 렌더링. hover/focus 시 우상단에 삭제 버튼 노출 | 이미지: `max-w-full rounded-input border border-neutral-200`. 삭제 버튼: `absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900/70 text-neutral-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-error` — **`opacity-0`이지 `hidden`이 아니다**: DOM에는 항상 존재해야 키보드 포커스(Tab)로 도달 가능하고 스크린리더가 발견할 수 있다(순수 hover-only 노출은 키보드 사용자를 배제하는 흔한 접근성 결함이라 명시적으로 피함). `aria-label="이미지 삭제"` 필수 |
| **③ 실패 — 용량 초과** | 삽입되지 않음. 커서 자리에 인라인 에러 카드가 잠깐 나타났다 다음 입력 시 사라짐 | `rounded-input border border-error/30 bg-error-100 px-3 py-2 admin-body-sm text-error` — "파일 용량이 너무 큽니다(최대 {N}MB)." + 우측에 `✕`(닫기, `text-error hover:underline` 텍스트 버튼) |
| **④ 실패 — 형식 오류** | 동일 카드 스타일, 문구만 다름 | "지원하지 않는 이미지 형식입니다(jpg/png/webp만 가능)." — SVG를 골랐을 때도 이 경로(§2.4는 사전 차단이지 완전 차단 보장이 아니므로 서버 거부 시 동일 카드로 수렴) |
| **⑤ 실패 — 네트워크/서버 오류**(screen-spec에 명시된 4가지 외 추가, N-E12 관련) | 동일 카드 스타일 + 재시도 버튼 | "업로드에 실패했습니다. 다시 시도해주세요." + "다시 시도"(`text-error underline`, 같은 파일 객체로 재요청) |

> **③④⑤ 공통 시각 언어를 하나로 통일한 이유**: 사용자 입장에서 "왜 실패했는지"는 문구로 구분되면 충분하고, 카드 스타일까지 매번 다르게 만들면 오히려 "이건 다른 종류의 실패인가?"라는 오해를 만든다. 기존 `errorTextClass`/`text-error` 관례와도 일치.

### 2.4 SVG 사전 차단 (UX 레벨)

파일 선택 `accept` 속성에 SVG를 포함하지 않는다(§2.1). 그럼에도 드래그앤드롭이나 OS 파일탐색기의 "모든 파일" 우회로 SVG가 선택될 수 있으므로, **클라이언트 단에서 MIME 확인 후 위 ④(형식 오류) 카드로 동일하게 처리**한다 — SVG 전용 에러 문구를 따로 만들지 않는다(사용자에게는 "지원하지 않는 형식"이면 충분하고, "SVG는 보안상 위험해서"라는 이유까지 설명할 필요는 없다 — 그건 NS-5 원칙의 배경일 뿐 사용자 대면 문구가 아니다).

### 2.5 레이아웃 종합 (§3.3/§3.4 안에서의 위치)

```
┌ ArticleTranslationEditor 카드 ──────────────────────────────┐
│ 제목 [input]                                                │
│ 요약 [textarea]                                             │
│ 본문                                                         │
│  ┌ 에디터 카드 (§1.3) ─────────────────────────────────────┐ │
│  │ [본문▾] | B | •목록 1.목록 | 🔗링크 🖼이미지              │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │ (편집영역, 최소 200px)                                  │ │
│  └──────────────────────────────────────────────────────┘ │
│  ⚠ 업로드한 이미지는 로그인 없이 인터넷 누구나 볼 수 있습니다... │ ← NS-5, admin-label-sm text-accent-700
│  ⚠ 공지 내용은 로그인 여부와 무관하게 인터넷에서 누구나...       │ ← NS-1, admin-label-sm text-accent-700 (§3.9)
│ [저장]                                                        │
└──────────────────────────────────────────────────────────┘
```

NS-5가 NS-1보다 위에 오는 이유: NS-5는 "본문 필드"라는 더 큰 범위 중에서도 이미지라는 좁은 범위에 대한 경고이므로, 에디터 바로 아래(더 가까운 위치)에 붙이고, NS-1(본문 전체에 대한 경고)은 그다음 줄에 둔다 — **가까운 것이 좁은 경고, 먼 것이 넓은 경고**라는 위치 논리를 지킨다.

---

## 3. 대상(target_audience) 관련 화면 요소

### 3.1 대상 선택 UX (새 글 폼, §3.3)

| 요소 | 스타일 |
|---|---|
| `<select>` | 기존 `adminInputClass` 그대로. 첫 옵션 `<option value="" disabled selected>선택하세요</option>` |
| 옵션 라벨 | "파트너용(ko 단일)" / "SEEPN 사용자용(ko/en/ja)" — 괄호 안 언어 구성을 옵션 라벨에 바로 노출해, select만 보고도 결과를 예측하게 함(추가 클릭 없이) |
| 미선택 시 "추가" 버튼 | `adminButtonPrimaryClass`의 기존 `disabled:` 클래스가 이미 이 상태를 커버(새 스타일 불필요) — `disabled` 속성만 `!targetAudience`로 바인딩 |
| "SEEPN 사용자용" 선택 시 인라인 경고 | §3.3 박스형(아래 §3.3 참고), select 바로 아래, 다른 필드(제목/요약/본문)보다 **위**에 배치 |

### 3.2 목록 대상 필터 (§3.2)

`SegmentedControl<'all'|'partner'|'seepn_user'>` 그대로 재사용. `activeClassName`만 지정하면 되므로 새 컴포넌트 불필요.

```ts
const options = [
  { value: 'all', label: '전체', activeClassName: 'bg-primary-600 text-neutral-0' },
  { value: 'partner', label: '파트너', activeClassName: 'bg-primary-600 text-neutral-0' },
  { value: 'seepn_user', label: 'SEEPN 사용자', activeClassName: 'bg-primary-600 text-neutral-0' },
]
```

기존 `SegmentedControl` 사용처(judge_status 3지선다)와 동일한 `activeClassName` 값을 그대로 승계 — 이 컴포넌트가 이미 "선택된 세그먼트는 primary-600 채움"이라는 톤을 확립해뒀으므로 새 톤을 만들지 않는다.

### 3.3 `seepn_user` 소비 화면 부재 경고 — 3중 노출의 시각 차등 (N-R6, 생략 불가)

screen-spec §3.7이 정의한 3곳을 "**상황 트리거형(무겁게) vs 상시 반복형(가볍게)**" 원칙으로 차등화한다(§2.2에서 이미 쓴 것과 같은 원칙):

| 위치 | 트리거 빈도 | 시각 무게 | 스타일 |
|---|---|---|---|
| ① 새 글 폼 (대상="SEEPN 사용자용" 선택 시) | 그 글을 작성하는 동안 1번 | **무겁게 — 박스형** | `flex items-start gap-2 rounded-input border border-accent-200 bg-accent-100 px-4 py-3` 안에 `⚠`(`text-accent-600`, 20px급) + `admin-body-sm text-accent-700` 문구. `NewPartnerEntryForm.tsx`의 중복 경고 박스와 동일 톤·크기(선례 그대로 재사용) |
| ② 목록 필터 = "SEEPN 사용자용" | 필터를 그 값으로 바꿀 때마다(반복 가능하지만 "지금 이 목록을 보는 맥락"에 대한 경고라 상황형으로 분류) | **무겁게 — 박스형**, 단 필터 바로 아래 전체 폭 | 위와 동일 클래스, `mt-3 w-full` |
| ③ 목록 행 자체 (모든 `seepn_user` 행, 필터 무관) | **행 개수만큼 상시 반복** | **가볍게 — 아이콘 1개** | 대상 배지(§3.4) 오른쪽에 `<span title="{NS-5와 동일 의미의 경고 문구}" className="text-accent-600 cursor-help" aria-label="소비 화면 없음 경고">⚠</span>`. `title` 속성이 곧 hover 툴팁(네이티브, `AiFillButton`의 `disabledReason` 툴팁과 같은 기법) — **아이콘 자체는 항상 보이고, 문구는 hover/focus 시에만** 보인다(screen-spec §3.7 "아이콘 자체가 상시 노출, hover 텍스트는 부가 설명" 요구를 정확히 구현) |

**행 개수만큼 반복되는 ③에 박스를 쓰지 않는 이유**를 다시 한번: 만약 대표가 `seepn_user` 공지를 5건 올려두면 필터="전체" 화면에 박스 5개가 늘어서서 목록 자체가 안 보이게 된다. 아이콘 1개는 스캔 가능성을 유지하면서도 "놓치지 않는다"는 목적은 100% 달성한다.

### 3.4 대상 배지 + 잠금 UX (D-N3, §3.5)

| 상태 | 표시 | 색상 |
|---|---|---|
| 대상 배지(공통, 모든 행) | `Badge` 재사용 — 라벨 "파트너" 또는 "SEEPN 사용자" | `tone="neutral"` → `bg-neutral-100 text-neutral-600` (기존 `TONE_CLASS.neutral` 그대로) |
| **편집 가능 상태**(en/ja 번역 없음) | `<select>`(현재 값 프리셋), 스타일은 §3.1과 동일 `adminInputClass` | — |
| **잠긴 상태**(en/ja 번역 존재) | select 대신 배지형 표시: `🔒 {대상명}` | `bg-neutral-100 text-neutral-500`(대상 배지의 neutral보다 한 단계 더 죽인 톤 — "선택 가능한 것처럼 보이면 안 된다"는 신호를 색으로도 준다. 정확히는 동일 `neutral-100` 배경에 텍스트만 `neutral-500`으로 한 단계 낮춰 "비활성"임을 배지 모양이 아니라 채도로 구분) |
| 잠금 상태 캡션(상시, hover 아님) | 배지 바로 아래 한 줄 | `admin-label-sm text-neutral-400` — "번역이 입력된 뒤에는 대상을 변경할 수 없습니다. 대상을 바꾸려면 삭제 후 새로 작성하세요." (screen-spec §3.5가 이미 "hover 툴팁만 쓰지 않는다"고 명시했으므로 여기는 상시 캡션. **§3.3 hover-only 아이콘과 다른 처리** — 이유: 잠금은 "왜 이 select가 없는지" 자체가 UI 이해에 필수 정보라 hover 발견에 의존하면 안 되고, ③번 경고 아이콘은 "이미 알고 있는 것을 다시 상기시키는" 보조 정보라 hover로 충분) |
| 변경 확인 모달 | `window.confirm` 그대로(신규 모달 컴포넌트 불필요, screen-spec §3.5 지시) | — |

```
편집 가능:  [ SEEPN 사용자용 ▾ ]

잠김:       [🔒 SEEPN 사용자]  ← bg-neutral-100 text-neutral-500, rounded-full px-2 py-1 admin-label-sm
            번역이 입력된 뒤에는 대상을 변경할 수 없습니다.
            대상을 바꾸려면 삭제 후 새로 작성하세요.
            ↑ admin-label-sm text-neutral-400, 상시 노출
```

### 3.5 AI 초벌 버튼 비노출 (G-6, §3.6)

시각 요소 자체가 "없음"이 요구사항이므로 새 스타일은 없다. 확인만: `showAiFill` 계산이 `contentType !== 'notice'`를 포함하도록 바뀌면, `ArticleTranslationEditor` 헤더는 `admin-ai-translation-draft.ui-spec.md` §1.1의 "소스 로케일 카드"와 동일하게 **버튼 슬롯 자체가 렌더링되지 않는** 상태가 된다(비활성 아님, 부재). 레이아웃상 헤더는 `Badge`만 남고 한 줄이 짧아지는데, 이는 기존 소스 카드 헤더가 이미 겪고 있는 모양이라 새로운 레이아웃 케이스가 아니다.

### 3.6 번역 상태 배지 (N-R20, §3.8)

`computeTranslationBadge`/`TONE_CLASS` 그대로, 개수만 대상별로 1개/3개. 추가 스타일 없음 — screen-spec §3.8이 이미 "기존 warning 톤 색상 그대로 충분"이라 확인했고, 코드 확인 결과도 동일 결론이라 이 문서에서 더 정할 게 없다.

### 3.7 NS-1 경고 문구 스타일 (§3.9)

§2.2에서 이미 정의한 "상시 캡션, 박스 없음" 톤을 그대로 적용: `admin-label-sm text-accent-700` + `⚠` 접두, 본문 필드(에디터) 바로 아래. 새 글 폼과 편집 펼침 영역 양쪽에 동일하게 반복 배치.

---

## 4. 프로필 홈 미리보기 위젯 (N-R18, §4.4)

### 4.1 위치와 레이아웃

`SupplierProfileShell`의 `StatusBanner`와 `ProfileTabs` 사이, 기존 `mt-6` 간격 리듬을 그대로 따른다(파일 확인 결과 `StatusBanner` → `<div className="mt-6"><ProfileTabs /></div>` 순서이므로, 위젯을 그 사이에 `mt-4` 간격으로 끼워 넣어 두 블록이 붙어 보이지 않게 최소한의 시각적 분리를 준다).

```
┌ StatusBanner ────────────────────────────────────┐
│ (검증 상태 배너, 기존)                              │
└──────────────────────────────────────────────────┘
  ↕ mt-4
┌ 공지 미리보기 위젯 (신규, 슬림 1줄) ──────────────────┐
│ 최신 공지: {제목} ({날짜})              전체보기 →   │
└──────────────────────────────────────────────────┘
  ↕ mt-6
┌ ProfileTabs ──────────────────────────────────────┐
```

### 4.2 스타일 사양

| 항목 | 값 | 근거 |
|---|---|---|
| 컨테이너 | `flex items-center justify-between gap-3 rounded-card border border-neutral-200 bg-neutral-0 px-4 py-3` | `StatusBanner`(`rounded-card border-l-4`)와 구분되는 얇은 카드 — 위젯이 "상태를 알리는 배너"가 아니라 "발견 보조 링크"라는 성격 차이를 테두리 두께로 표현(border-l-4 vs 일반 border) |
| 제목 링크 | `제목` 부분만 `text-body-sm font-medium text-neutral-900 hover:text-primary-700 hover:underline`(클릭 가능 영역), 날짜는 `text-label-caption text-neutral-400`을 이어붙임: "최신 공지: **{제목}** ({날짜})" | 공지 도메인이 아니라 프로필 화면의 톤(`text-body-sm`/`text-label-caption`, Inter 계열)을 따른다 — 이 위젯은 Admin이 아니라 `/supplier` 화면이므로 **admin-* 토큰이 아니라 §SupplierProfileShell이 이미 쓰는 buyer 공용 토큰**을 사용해야 함(주의: §1~3의 admin-* 토큰과 섞으면 안 됨) |
| "전체보기" | `text-label-caption text-primary-600 hover:underline whitespace-nowrap`, 화살표 문자 `→`를 라벨에 포함 | 새 아이콘(chevron-right SVG) 도입을 피하기 위해 텍스트 화살표로 대체 — §0.1의 "새 아이콘 세트 도입 안 함" 원칙을 `/supplier` 쪽에도 동일 적용(다만 `/supplier`는 이미 `SupplierIcons.tsx`가 있으므로, 화살표 아이콘이 향후 다른 화면에서도 반복 필요해지면 그때 `ChevronRightIcon`을 추가하는 편을 권고 — 이번 1곳만을 위해 새 아이콘 파일을 만들 필요는 없음) |
| 제목 말줄임 | `truncate max-w-[70%]`(또는 flex-1 min-w-0 + truncate) | 좁은 화면에서 "전체보기" 링크가 밀려나지 않도록 제목 쪽만 줄임 |
| 0건일 때 | **렌더링 안 함**(screen-spec §4.4 이미 확정) — 별도 스타일 없음 | — |

### 4.3 접근성

- 카드 전체를 링크로 감싸지 않는다(제목과 "전체보기" 목적지가 다르므로 각각 별도 `<a>`/`<Link>`) — 하나의 카드에 클릭 가능한 영역이 2곳이면 각 링크의 히트 영역이 명확히 분리돼야 혼동이 없다.
- 제목 링크 `aria-label`: "최신 공지: {제목}, {날짜}에 게시" 수준으로 스크린리더에 날짜까지 함께 전달(시각적으로는 옅은 회색 텍스트라 스크린리더가 건너뛰기 쉬운 정보이므로 명시).

---

## 5. 접근성 요약 (문서 전체 재확인)

| 항목 | 조치 |
|---|---|
| 색만으로 정보 전달 금지 | 모든 경고에 `⚠`/`🔒` 글리프를 색상과 함께 병기(§2.2, §3.3, §3.4) |
| 키보드 접근 | 이미지 삭제 버튼은 `opacity-0`이지 `hidden`이 아님(§2.3 ②), 툴바 버튼은 `aria-pressed`로 토글 상태 노출(§1.2), 프로필 위젯 링크는 일반 `<a>`/`<Link>`(§4.3) |
| 스크린리더 라벨 | 글리프 전용 버튼 전부 `aria-label` 필수(§1.2), 경고 아이콘 `aria-label`(§3.3 ③) |
| 색 대비 | 아이콘/글리프는 `accent-600`, 본문 텍스트는 `accent-700`으로 분리(§2.2) — 기존 코드가 이미 이 분리를 쓰고 있어 대비 기준을 벗어난 적 없음. 새로 추가하는 "박스 없는" 캡션(§2.2, §3.7)도 흰 배경 위 `accent-700` 기준으로, `accent-600`보다 진한 값을 텍스트에 쓰도록 명시(대비 확보) |
| 터치/클릭 영역 | 툴바 버튼 최소 `h-8`(32px), 이미지 삭제 버튼 `h-6 w-6`이지만 hover/focus 확장 영역 없이도 마우스 정밀 조작이 전제인 Admin 데스크톱 화면이라 허용 범위로 판단(모바일 대상 아님) |

---

## 6. 신규 vs 재사용 토큰 요약

| 토큰/컴포넌트 | 상태 |
|---|---|
| `adminEditorToolbarButtonClass`, `adminEditorToolbarButtonActiveClass` | **신규**(§1.2) — `components/admin/styles.ts`에 추가 권고 |
| 이미지 삭제 원형 버튼 클래스 | **신규, 1회성**(§2.3) — 재사용 빈도가 낮아 `styles.ts` export까지는 불필요, 인라인으로 충분 |
| 그 외 색상값(neutral/primary/accent/error/success) | **전부 기존 `tailwind.config.ts` 값 재사용**, 신규 hex 없음 |
| `Badge`, `SegmentedControl`, `computeTranslationBadge`, `adminSpinnerClass`, `adminInputClass`, `adminButtonPrimaryClass` 등 | **전부 재사용**, 변경 없음 |
| 프로필 위젯 컨테이너 | **신규 레이아웃 1개**(§4.2), 토큰은 기존 buyer 공용 토큰 재사용 |

---

## 7. 핸드오프

### ux-writer
- NS-1/NS-5/N-R6(3곳)/이미지 업로드 에러 4+1종/대상 잠금 캡션의 **정확한 최종 카피** — 이 문서와 PRD가 의미(무엇을 경고해야 하는지)와 톤(경고 강도, §2.2/§3.3의 "무겁게 vs 가볍게" 구분)은 고정했으니, 어미·존댓말 수위·이모지 사용 여부(예: `⚠`를 실제로 노출할지 텍스트로만 "주의:"라 쓸지)를 확정해달라
- 위젯의 "최신 공지: {제목} ({날짜})" 문구 패턴 확정

### frontend-developer
- §1~2 에디터/이미지 UI는 **라이브러리 API에 맞춰 이 스펙의 시각 규칙(그룹 구성, 상태별 스타일, 경고 위치·톤)을 구현**하면 됨 — 정확한 DOM 구조는 위임
- `adminEditorToolbarButtonClass` 등 신규 토큰은 `components/admin/styles.ts`에 추가(§6)
- §0.4 타이포 불일치는 버그 아님 — 상대적 위계만 보장할 것
- §3.4 `🔒` 잠금 배지는 `Badge` 컴포넌트의 `tone` prop을 확장하지 말고(기존 4개 톤에 없는 값이므로) **별도 인라인 span으로 처리** 권고(기존 `TONE_CLASS`에 5번째 톤을 추가하면 다른 4개 화면에도 영향 범위가 생기므로, notice 전용 로컬 처리가 더 안전)

### privacy-security-officer
- §2.2/§3.7의 NS-5/NS-1 노출 방식("박스 없는 상시 캡션")이 보안 요구 수준에 충분한지 확인 — 부족하다고 판단되면 §3.3의 박스형으로 격상 요청 가능(이 문서의 "가벼운 톤" 선택은 경고 피로 방지가 목적이지 보안 완화가 목적이 아님, 최종 판단은 privacy-security-officer 권한)

### qa-reviewer
- 이미지 삭제 버튼의 키보드 접근성(Tab으로 도달, Enter로 삭제) 실제 동작 확인 — hover 전용 구현으로 잘못 만들어지는 회귀가 흔한 지점
- `seepn_user` 경고 아이콘(③)이 필터="전체"에서도 행마다 보이는지, 잠금 배지(§3.4)가 en/ja 번역 저장 직후 select에서 배지로 정확히 전환되는지

---

## Version History

| Version | Date | Changes | Author |
|---|---|---|---|
| 1.0 | 2026-09-08 | 초안 — 에디터 툴바(이탤릭 제외 근거 포함)/WYSIWYG 편집영역/이미지 업로드 5상태(용량초과·형식오류·네트워크오류 포함)/NS-5 톤 결정, 대상 배지·필터·3중 경고 차등화(상황형 박스 vs 상시형 캡션 원칙)·잠금 UX, 프로필 홈 위젯 레이아웃, 접근성 요약, 신규/재사용 토큰 정리 | ui-ux-designer |
