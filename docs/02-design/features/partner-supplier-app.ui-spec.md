---
template: ui-screen-spec
version: 1.0
feature: seepn-unified-platform-v1.0
phase: "/supplier — Korean Partner 자가등록/프로필관리 앱 시각·인터랙션 스펙"
description: partner-supplier-app.screen-spec.md(SUP-01~14)이 정의한 화면 흐름/상태/엣지케이스를 실제 레이아웃·컴포넌트·인터랙션 스펙으로 구체화한다. D-S2(RequestForm 버튼/인풋 토큰 재사용)를 그대로 따르며, 신규 시각요소(상태배너 톤, 탭 인디케이터, 업로드 위젯, 회원가입 진행표시, 동의값 미확인 안내)만 새로 정의한다.
variables:
  - feature: seepn-unified-platform-v1.0
  - date: 2026-09-03
  - author: ui-ux-designer
  - project: SEEPN Unified Platform (FKP + SEEPN) — Partner Self-Service
  - version: 1.0.0
  - status: Draft — §10 Open Design Questions 확인 후 Final 전환
---

# `/supplier` — Korean Partner 자가등록/프로필관리 앱 UI 스펙

| 항목 | 내용 |
|---|---|
| 문서 종류 | UI Design Spec (레이아웃 / 컴포넌트 / 인터랙션 / 반응형) |
| 작성자 | ui-ux-designer |
| 대상 화면 | SUP-01~14 전체(14개) — `partner-supplier-app.screen-spec.md` §0.2 화면 목록과 1:1 |
| 입력 문서 | [partner-supplier-app.screen-spec.md](./partner-supplier-app.screen-spec.md) 전체(특히 §0 D-S1~D-S6, §1 재사용 자산, §2 mermaid 플로우, §4 화면별 상세) · [seepn-admin-ui-design-system.spec.md](./seepn-admin-ui-design-system.spec.md)(포맷/토큰 선례) · `tailwind.config.ts` · `components/RequestForm/*` |
| 디자인 원칙 | 새 화면은 새 토큰을 만들지 않는다(D-S2) — buyer 계열 토큰만 사용. 새 컴포넌트는 재사용 불가능할 때만 만든다 |
| 후속 담당 | ux-writer(카피 확정) → frontend-developer(구현) → qa-reviewer |

---

## 0. 전제와 범위

- **In**: 14개 화면의 레이아웃 구조, 신규 컴포넌트(상태배너, 탭 네비게이션+인디케이터, 문서 업로드 위젯, 토글 스위치, 회원가입 진행표시) 스펙, 기존 재사용 컴포넌트의 스타일 조정 지점, 반응형 규칙, 접근성 체크리스트.
- **Out**: 필드 목록/검증 규칙/RPC 계약(screen-spec 소관, 변경 없이 그대로 참조), 카피 최종 문구(ux-writer 소관 — 본 문서는 레이아웃 설명을 위해 screen-spec의 임시 문구를 그대로 인용만 함), 실제 `.tsx` 구현(frontend-developer 소관).
- **전제**: D-S2에 따라 색상/타이포 토큰은 `tailwind.config.ts`의 buyer 계열(`primary`/`neutral`/`accent`/`success`/`error`/`secondary`, 폰트사이즈 `h1`~`label-caption`)만 쓴다. Admin 전용 `sidebar-*` 색상, `admin-sans` 폰트는 쓰지 않는다. 단, `StatusBadge`/`ProgressBar`가 내부적으로 쓰는 `admin-label-sm`/`admin-body-sm` 같은 폰트사이즈 유틸은 이름만 `admin-*` 접두어일 뿐 다크 배경이나 Admin 전용 로직에 종속되지 않는 순수 Tailwind 유틸이므로 그대로 재사용해도 D-S2 위반이 아니다(§4.1에서 명시).
- **읽은 코드베이스**: `components/RequestForm/{styles.ts,FormField.tsx,ConfirmSubmitModal.tsx,Step1.tsx,RequestForm.tsx}`, `components/admin/{StatusBadge.tsx,ProgressBar.tsx}`, `app/admin/(protected)/partners/CategoryPicker.tsx`, `lib/admin/partnerLabels.ts`, `tailwind.config.ts`, `components/icons/GlobeIcon.tsx`(인라인 SVG 컨벤션 확인).

---

## 1. 타이포/색상 참조표 (신규 토큰 없음 — 기존 값 재확인용)

새로 만드는 값은 하나도 없다. 아래는 이 문서 전체에서 반복 인용할 buyer 스케일을 한 번에 정리한 것뿐이다.

| 용도 | 클래스 | 크기/행간/굵기 |
|---|---|---|
| 카드/모달 타이틀 | `text-h3` | 20/28/600 |
| 페이지 타이틀(있다면) | `text-h2` | 28/36/600 |
| 본문 | `text-body` | 16/24 |
| 보조 본문(설명, 라벨) | `text-body-sm` | 14/20 |
| 캡션(도움말, 타임스탬프) | `text-label-caption` | 12/16 |
| 버튼 라벨 | `text-label-button` | 16/24/600(=`primaryButtonClass`/`secondaryButtonClass`에 내장) |
| 입력 필드 | `inputClass`(`components/RequestForm/styles.ts`) | — |
| 주 버튼 | `primaryButtonClass` | — |
| 보조 버튼 | `secondaryButtonClass` | — |
| 에러 텍스트 | `errorTextClass` | `text-label-caption text-error` |
| 카드 모서리 | `rounded-card`(12px) | 모달/큰 카드 |
| 입력/작은 요소 모서리 | `rounded-input`(8px) | 인풋, 버튼 |
| 배지 모서리 | `rounded-sm`(4px) | 상태 배지, 카테고리 칩 |

색상은 `primary`(블루, CTA/포커스/링크), `neutral`(중립/텍스트/보더), `accent`(앰버, warning), `success`(그린), `error`(레드), `secondary`(에메랄드, "인증/신뢰" 전용 — `seepn-admin-ui-design-system.spec.md` §4.4가 이미 이 의미로 확정) 그대로.

---

## 2. 공통 레이아웃 셸

### 2.1 비인증 화면 셸 (SUP-01·02·03·04·05·06·07)

Figma S-01 실사는 페이지 전체를 어두운 배경 + 중앙 카드로 그리지만, D-S2에 따라 색은 buyer 톤(밝은 배경)으로 대체한다. **구조(중앙 정렬 카드)만 Figma를 따르고, 색은 `RequestForm` 패널과 통일한다** — 이것이 "같은 서비스의 다른 화면처럼 보이지 않는" 문제를 막는다.

```
┌─────────────────────────────────────────────┐
│  bg-neutral-50, min-h-screen, flex center     │
│                                                │
│        ┌───────────────────────────┐         │
│        │ bg-neutral-0, rounded-card,│         │
│        │ border border-neutral-200, │         │
│        │ shadow-sm, p-8, max-w-[420px]│       │
│        │                             │        │
│        │  [워드마크: "SEEPN Partner"]│        │
│        │  (text-label-button,        │        │
│        │   text-primary-700, 클릭 시  │        │
│        │   외부 마케팅 홈으로 이동)    │        │
│        │                             │        │
│        │  [진행 표시 — SUP-02/03만]   │        │
│        │  h3 타이틀                  │        │
│        │  body-sm 서브카피(선택)      │        │
│        │                             │        │
│        │  [FormField ×N]             │        │
│        │  (inputClass, FormField.tsx │        │
│        │   그대로 재사용)             │        │
│        │                             │        │
│        │  [primaryButtonClass, w-full]│       │
│        │  [보조 링크들, body-sm,      │        │
│        │   text-primary-600]         │        │
│        └───────────────────────────┘         │
└─────────────────────────────────────────────┘
```

- **카드 폭 420px**: `RequestForm`의 600px보다 좁힌다 — 로그인/가입 폼은 필드 수가 적고(SUP-01: 2필드, SUP-03: 4필드) 세로로 짧아, 넓은 카드는 시선이 좌우로 낭비된다. 420px는 Tailwind 기본 `max-w-md`(448px)에 가까운 실용적 폭.
- **버튼 `w-full`**: `RequestForm` 원본은 버튼을 `self-start`(내용 폭)로 두지만(§7.7 "Hero의 부속"), 로그인 카드는 그 자체가 화면의 유일한 콘텐츠이므로 버튼이 카드 폭 전체를 채우는 게 시각적 완결성이 높고 터치 영역도 커진다(모바일 접근성).
- **에러 배너(전역 실패, 예: `INVALID_CREDENTIALS`)**: 폼 상단, 타이틀 바로 아래에 `bg-error-100 border border-error/30 rounded-input px-4 py-3` 박스 + `text-body-sm text-error`. 필드별 인라인 에러(`errorTextClass`)와 구분해, "이 화면 전체가 실패했다"를 한눈에 알리는 용도로만 쓴다(예: 이메일/비번 둘 다 문제라 특정 필드를 짚을 수 없는 경우).
- **로딩 상태**: 버튼 내부 텍스트를 "로그인 중..."/"가입 처리 중..." 등으로 바꾸고 `disabled` — 별도 스피너 오버레이는 쓰지 않는다(`ConfirmSubmitModal`의 로딩 패턴과 달리, 이 화면들은 모달이 아니라 페이지 전체이므로 버튼 자체의 상태 변화로 충분).

### 2.2 인증 후 셸 (SUP-08~14) — 이 앱의 본체

상단바(전 화면 공통) + 콘텐츠 영역(탭 셸이 감싸는 SUP-09~13, 또는 SUP-14 모달)으로 구성.

**상단바** (`h-16`, `bg-neutral-0`, `border-b border-neutral-200`, `px-6`):
- 좌측: 워드마크("SEEPN Partner", `text-label-button text-primary-700`) — 클릭 시 `/supplier/profile`(유일한 "홈")로 이동. Admin처럼 사이드바 전체를 두지 않는 이유는 D-S3(전용 대시보드 없음)와 맞물려, 탐색할 메뉴 자체가 "탭 5개"뿐이라 사이드바 수준의 IA가 불필요하기 때문 — 사이드바를 만들면 오히려 탭과 메뉴가 이중으로 존재하는 혼란을 만든다.
- 우측: 계정 메뉴 — `{display_name} ▾` 텍스트 버튼(`text-body-sm text-neutral-700`) 클릭 시 드롭다운(설정 바로가기 / 로그아웃 2항목만). **아바타/이니셜 원형 아이콘은 넣지 않는다** — Admin `Avatar` 컴포넌트를 그대로 가져오면 "관리자 화면 같다"는 인상을 주고(D-S2 취지 위배), 파트너 계정은 개인이 아니라 회사 단위라 이니셜 아바타의 의미도 약하다.
- 상단바에는 알림벨을 넣지 않는다(SS-14 Won't·실시간 알림 없음 — screen-spec §2.1 step 9 "재방문 시 반영"과 정합).

**콘텐츠 영역** (`max-w-6xl mx-auto px-6 py-8`):

```
1) 상태 배너           (전체 폭, §5)
2) ┌─ 탭 네비게이션 ──────────┐  ┌─ 제출 준비 카드 ──┐
   │ 기본정보 역량정보 문서    │  │ (lg 이상: sticky, │
   │ 연락처 설정              │  │  §6)              │
   │ ─────────────────────── │  │ 완성도 바          │
   │                          │  │ 체크리스트         │
   │  [탭 콘텐츠: SUP-09~13]  │  │ [제출하기]         │
   │                          │  │                   │
   └──────────────────────────┘  └───────────────────┘
     flex-1 (~66%)                 w-[300px] shrink-0
```

- **왜 체크리스트를 별도 사이드 카드로 분리하고 탭 콘텐츠 안에 넣지 않는가**: 제출 가능 여부는 5개 탭 전체의 상태를 종합한 값이다. 특정 탭(예: 기본정보) 안에 두면 "이 탭에서만 보이는 정보"처럼 오인되고, 사용자가 다른 탭에 있을 때 자신이 제출에 얼마나 가까운지 알 수 없다. **셸 레벨의 상시 표시 요소로 분리해야 "이 화면(SUP-08)의 핵심 행동 = 체크리스트를 채워서 제출하기"가 어느 탭에 있든 항상 보인다** — 이것이 SUP-08을 "셸"로 규정한 D-S3/D-S4의 의도를 시각적으로 구현하는 방식이다.
- 탭 콘텐츠와 체크리스트 카드는 `gap-8`로 분리, 체크리스트 카드는 `rounded-card border border-neutral-200 bg-neutral-0 p-5`.

---

## 3. 화면별 상세

### 3.1 SUP-01 로그인

§2.1 셸 그대로. 필드 2개(이메일, 비밀번호+eye 토글) + 로그인 버튼(`w-full`) + 링크 2개("파트너 등록"은 타이틀 아래 눈에 띄게, "비밀번호를 잊으셨나요"는 버튼 아래 작게). 비밀번호 eye 토글 아이콘은 `GlobeIcon.tsx`와 동일한 인라인 SVG 컨벤션(24 viewBox, `stroke=currentColor`, `strokeWidth 1.75`)으로 눈/눈-슬래시 두 종을 새로 그린다.

### 3.2 SUP-02/03 회원가입 2단계 — 진행 표시

두 화면은 **같은 카드, 같은 URL**(`/supplier/signup`) 안에서 클라이언트 상태로만 전환된다(§3.4 이유는 screen-spec 참조). 이 문서가 정의하는 것은 "지금 2단계 중 몇 번째인지"를 보여주는 시각 요소다.

```
[●━━━━] [━━━━]   1/2단계 · 약관 동의        ← Step 1
[●━━━━] [●━━━━]  2/2단계 · 계정 정보 입력    ← Step 2
```

- 두 개의 32px×4px `rounded-full` 세그먼트(`gap-1.5`) — 완료/현재 단계는 `bg-primary-600`, 아직 도달 안 한 단계는 `bg-neutral-200`. 오른쪽에 `text-label-caption text-neutral-500`로 "1/2단계 · {단계명}" 텍스트 병기.
- 이 세그먼트바 형태는 `RequestForm/Step1.tsx`의 기존 "Step 1 of 3" 에어로우 라벨(`text-label-button text-primary-600`, §7.7 문서에 이미 있는 패턴)을 그대로 재사용하지 않고 **새로 추가하는 이유**: 기존 3단계 라벨은 텍스트만 있고 진행률을 시각화하지 않는다. 회원가입은 서비스 첫인상이자 이탈이 가장 아까운 지점이므로("얼마나 남았는지"가 불안을 줄여줌) 최소한의 시각적 진행 바를 얹는 투자가 정당화된다. 반대로 기존 3단계 요청폼(마케팅 사이트 내 미니폼)은 굳이 바꾸지 않는다(이번 작업 범위 밖).
- Step1 → Step2 전환 시 카드 높이가 바뀌면(필드 개수가 다름) 카드가 갑자기 커지는 느낌을 줄이기 위해 `transition-[height]` 애니메이션은 **넣지 않는다**(Should 아님) — 요청폼도 단계 전환 시 애니메이션이 없으므로 일관성 유지, 불필요한 복잡도 배제.
- "이전" 버튼(`secondaryButtonClass`)은 "다음/가입하기" 버튼(`primaryButtonClass`) 왼쪽에 나란히(`flex gap-3`), Step1에는 이전 버튼이 없다(첫 단계이므로).

### 3.3 SUP-04 가입완료(이메일 인증 안내)

카드 셸이지만 폼이 없다 — 중앙에 아이콘(봉투, 인라인 SVG) + 안내문 + 재발송 버튼(`secondaryButtonClass`, 60초 카운트다운 중엔 "재발송 (57초)"처럼 라벨 자체가 카운트다운을 겸함, 별도 타이머 UI 불필요) + "로그인" 링크. 세션이 없는 화면이므로 상단바의 계정 메뉴도 없다(§2.1 셸).

### 3.4 SUP-05 이메일 인증 콜백

§2.1 셸, 상태 4종(성공/토큰없음/만료/이미인증) 모두 같은 레이아웃(아이콘 + 메시지 + 버튼 1개)이고 아이콘/버튼 라벨만 분기. 성공은 `text-success` 체크 아이콘, 나머지 3종은 `text-neutral-400`(에러로 취급 안 하는 "이미 인증" 포함 — 사용자를 탓하는 톤을 피한다) 또는 `text-error`(진짜 실패인 "형식 불일치"만).

### 3.5 SUP-06/07 비밀번호 찾기·재설정

§2.1 셸 그대로, 필드 1~2개. SUP-06 성공 응답은 항상 동일 문구이므로 성공/실패 분기 UI 자체가 없다(폼이 안내 문구로 완전히 치환됨, "메일함을 확인해주세요" — SUP-04와 톤 통일).

### 3.6 SUP-08 프로필 홈 셸 — 상태배너 + 탭 네비게이션 (핵심 화면)

§2.2 레이아웃 그대로. 이 화면 자체의 "단 하나의 핵심 행동"은 **탭을 채워서 제출하기**이며, 셸은 그 행동을 방해하지 않고 항상 보이게 하는 역할만 한다(정보 제공은 배너·체크리스트, 실제 입력은 탭 콘텐츠).

상태배너/탭인디케이터/체크리스트카드의 상세는 §5·§6에서 분리 정의(여러 탭에서 공유되는 요소라 반복 방지).

### 3.7 SUP-09 기본정보 탭

탭 콘텐츠는 `flex flex-col gap-6` 안에 `FormField` 반복. 라디오 그룹(법인/개인사업자, 버티컬, 해외거래 유무)은 가로 배치 pill 버튼 2~3개(`rounded-input border`, 선택 시 `border-primary-500 bg-primary-50 text-primary-700`, 체크박스형 라디오 원 없이 pill 자체가 상태를 표현 — 터치영역 확보에 유리, 최소 40px 높이). 사업자등록번호 필드는 `inputClass` + 우측에 붙는 "확인" 버튼(`secondaryButtonClass`, 사이즈만 `px-4 py-2.5`로 인풋 높이에 맞춤) — **onBlur 자동확인 대신 버튼 명시 확인을 기본값으로 채택**(screen-spec §4.2 권고 그대로). 결과는 필드 바로 아래 인라인 텍스트로: 중복 시 `text-error`, 통과 시 텍스트 없음(성공 배지 불필요 원칙 그대로 유지).

버티컬(제품/서비스) 선택 시 "역량정보 탭의 입력 항목이 바뀝니다" 안내는 라디오 그룹 바로 아래 `text-label-caption text-neutral-400`로 1줄.

### 3.8 SUP-10 역량정보 탭

최상단에 `CategoryPicker`(§9 프론트엔드 메모의 토큰 교체 적용) 배치, 0개 선택 시 그 아래 `text-label-caption text-accent-700` 비차단 경고 1줄("카테고리가 선택되지 않았습니다 — 매칭 정확도에 영향을 줍니다") — 배경색 박스 없이 텍스트만(제출을 막지 않는 낮은 심각도이므로 시각적 무게도 낮게).

버티컬 미선택 시(§4.3 표) 카테고리 피커 아래 전체를 흐림 처리하지 않고, **아예 렌더링하지 않고** 안내 카드(`bg-neutral-50 border border-dashed border-neutral-300 rounded-card p-6 text-center text-body-sm text-neutral-500`) 하나로 대체 + "기본정보 탭으로 이동" 링크. 흐림+비활성 방식(있지만 못 누르게)보다 "아직 없음" 상태를 명확히 하는 편이 혼란이 적다.

Vertical A/B 필드는 기존 `inputClass`/select 반복, 레퍼런스 프로젝트(반복 입력)는 카드형 리스트(각 항목 `border border-neutral-200 rounded-input p-4`, 우상단에 작은 "삭제"(×) 버튼) + 하단 "+ 레퍼런스 추가" (`secondaryButtonClass`, 작은 사이즈).

### 3.9 SUP-11 문서 탭 — 업로드 위젯 상세

레이아웃 순서(위→아래):

1. **고정 경고 배너**: "사업자등록증 등에 주민등록번호가 포함되어 있지 않은지 확인해주세요. 포함되어 있으면 반려됩니다." — `bg-accent-100 border border-accent-500/30 rounded-input px-4 py-3 flex gap-2 items-start`, 좌측에 경고 삼각형 인라인 SVG(`text-accent-600`), 텍스트 `text-body-sm text-accent-700`. 이 배너는 문서 유형과 무관하게 **항상** 위젯 위에 고정(스크롤해도 사라지지 않을 필요는 없음 — 페이지 자체가 길지 않으므로 sticky 불필요).
2. **문서 유형 select** + **드롭존**을 한 세트로:
   - select(`inputClass` 상속 스타일의 select 버전, `w-full sm:w-64`) — `DOC_TYPE_LABELS` 4종.
   - 선택값이 `business_registration_cert`이고 아직 해당 유형 문서가 없으면, select 아래 `text-label-caption` 한 줄 + "필수" 태그(`inline-block rounded-sm bg-primary-50 px-1.5 text-primary-700 text-label-caption`)로 "제출에 필요"임을 표시.
   - 드롭존: `min-h-[160px] rounded-card border-2 border-dashed border-neutral-300 bg-neutral-50 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors`, hover/dragover 시 `border-primary-400 bg-primary-50`. 내부: 업로드 인라인 SVG 아이콘(32px, `text-neutral-400`) + "파일을 드래그하거나 클릭하여 업로드"(`text-body font-medium text-neutral-700`) + "PDF, JPG, PNG · 최대 10MB"(`text-body-sm text-neutral-500`). 전체 영역이 클릭 가능(숨겨진 `<input type=file>`을 감쌈).
   - 업로드 진행 중에는 드롭존 내용이 파일명 + 얇은 진행바(`ProgressBar` 유사 스타일, `h-1 rounded-full bg-neutral-200`에 `bg-primary-500` 채움) + 퍼센트로 치환.
   - 업로드 실패 시 드롭존 테두리가 `border-error`로 잠깐 바뀌고 아래 `errorTextClass`로 "업로드 실패 — 파일 형식/크기를 확인해주세요".
3. **업로드된 문서 목록**(드롭존 아래, `divide-y divide-neutral-200`): 행마다 `flex items-center justify-between py-3`.
   - 좌측: `StatusBadge(tone='neutral', label=DOC_TYPE_LABELS[type])` + 파일명(`text-body-sm font-medium text-neutral-900 truncate`) + 그 아래 `text-label-caption text-neutral-400`(용량·업로드일).
   - 우측: "보기"(`text-body-sm text-primary-600 hover:underline`) + "삭제"(`text-body-sm text-error hover:underline`).
   - **삭제는 모달이 아니라 인라인 확인으로 처리**: "삭제" 클릭 시 그 행의 우측 액션 영역만 "정말 삭제할까요? [취소] [삭제]"로 바뀐다(행 전체가 사라지거나 별도 다이얼로그를 띄우지 않음). **`ConfirmSubmitModal` 패턴(전체화면 모달)을 쓰지 않는 이유**: 그 패턴은 "제출"/"탈퇴"처럼 되돌리기 어렵고 화면 전체 맥락을 요약해 보여줘야 하는 무거운 액션용이다. 문서 삭제는 목록 안의 개별 항목 하나를 지우는 잦고 가벼운 액션이고(재업로드로 복구 가능), 모달을 띄우면 오히려 "별거 아닌 일에 과한 확인 절차"로 느껴져 마찰만 늘린다 — 리스트형 파괴적 액션은 인라인 확인, 세션/계정 단위의 파괴적 액션은 모달이라는 원칙으로 구분한다(SUP-14는 계정 단위이므로 모달 유지).
4. 문서가 하나도 없으면 목록 영역 자체를 렌더링하지 않는다(빈 상태 문구 불필요 — 드롭존이 이미 "여기에 넣으세요"를 말하고 있음).

### 3.10 SUP-12 연락처 탭

가장 단순한 탭 — `FormField` 4~5개 세로 나열 + 하단 저장 버튼(§6 저장 상태 패턴). 상단에 신뢰 문구("이 정보는 목록에 마스킹되어 표시되며...")를 `text-label-caption text-neutral-400`로 폼 위에 배치(경고가 아니라 안심시키는 정보이므로 박스 없이 조용한 캡션 톤 — §3.11의 G-S1 처리와 같은 원칙 적용).

### 3.11 SUP-13 설정 탭 — 토글 + G-S1 처리

섹션 4개, 각각 `border-b border-neutral-200 pb-6 mb-6`(마지막 섹션 제외)로 구분:

**공통 토글 스위치 컴포넌트(신규, `components/supplier/ToggleSwitch.tsx` 제안)**: 코드베이스에 토글 컴포넌트가 없어 새로 정의한다. `w-10 h-6 rounded-full` 트랙 + `w-5 h-5 rounded-full bg-neutral-0 shadow` 썸(`translate-x` 애니메이션). ON 트랙 `bg-primary-600`, OFF 트랙 `bg-neutral-300`. `role="switch"` `aria-checked` 필수(접근성). 터치영역은 트랙 자체가 40×24px로 작으므로 클릭 가능 영역을 `p-2`로 패딩해 최소 44px 히트박스 확보(시각적 크기는 유지, 클릭 판정 영역만 확장).

1. **공개 노출**: 라벨+설명(좌) / 토글(우) 한 행. 아래 상태별 보조 문구:
   - `off`: 문구 없음(기본 상태)
   - `on`: `text-label-caption text-success` "현재 공개 중입니다"
   - `suspended`: 토글 자체를 `disabled`(트랙 `bg-neutral-200`, 커서 not-allowed) + `text-label-caption text-neutral-500` "운영자에 의해 공개가 중단되었습니다. 사유는 고객센터로 문의해주세요"
   - `not_verified`/`business_registration_cert_missing` 실패 응답: 토글은 시각적으로 OFF로 되돌아가고, 행 바로 아래 `bg-primary-50 rounded-input px-3 py-2 text-body-sm text-primary-700`(경고 아님, 안내 톤이므로 error/accent가 아니라 primary 사용) 박스로 사유 표시 + 문서 탭 딥링크.

2. **마케팅 수신 동의 — G-S1 처리 (요청 핵심 사항)**: 같은 라벨+토글 레이아웃을 쓰되, **토글을 명확한 ON/OFF 2값이 아니라 "확인 필요" 3번째 시각 상태로 초기 렌더링**한다.
   - 트랙: `bg-neutral-200`(on의 primary도, off의 neutral-300도 아닌 중간 톤 — "모른다"는 것 자체를 색으로 정직하게 표현). 썸은 트랙 중앙(`left-1/2 -translate-x-1/2`)에 위치, on/off 어느 쪽에도 붙어있지 않음.
   - 라벨 오른쪽에 아주 작은 보조 텍스트 칩이 아니라, **토글 바로 아래 한 줄**: `text-label-caption text-neutral-400`(경고색이 아닌 가장 낮은 위계의 캡션 톤) "현재 설정값을 불러올 수 없습니다. 원하는 상태로 눌러주세요." — 이 문서 §요청사항 6이 요구한 "경고처럼 보이지 않게"를 만족시키는 핵심 장치는 **색을 쓰지 않는 것**이다. `accent`/`error`로 칠하면 즉시 "문제가 생겼다"는 신호로 읽히므로, 이 문장은 폼 어디에나 있는 평범한 도움말(`text-label-caption text-neutral-400`, 예: SUP-12의 마스킹 안내와 동일 톤)과 완전히 같은 스타일을 쓴다.
   - 사용자가 토글을 처음 클릭하는 순간, 3번째 상태는 사라지고 일반 2값 토글(트랙이 즉시 `bg-primary-600` 또는 `bg-neutral-300`으로, 썸이 좌/우로 이동하며 애니메이션)로 전환되며 그 값 그대로 `partner_grant_consent` RPC 인자가 된다. 이후에는 보조 캡션도 사라진다(같은 세션 안에서는 사용자가 방금 누른 값이 곧 "현재값"이므로 더 이상 불확실하지 않음).
   - **왜 그냥 OFF로 그리고 캡션만 붙이는(screen-spec 원안) 대신 3-상태 토글을 권장하는가**: OFF로 그리면 실제로는 가입 시 켰을 수도 있는 사용자에게 "당신은 지금 꺼져 있다"는 **거짓 정보**를 명확한 토글 모양으로 보여주는 셈이다. 캡션을 곁들여도 토글의 시각적 형태(트랙 색+썸 위치)가 이미 "OFF"라고 강하게 말하고 있어 캡션을 안 읽고 지나칠 위험이 크다. 중립 회색 트랙 + 중앙 썸은 "형태 자체가 모른다고 말하는" 유일한 방법이라 거짓 신호를 주지 않는다. 구현 비용은 CSS 상태 하나 추가 수준으로 낮다.
   - G-S1이 backend-developer에 의해 해소되면(OQ-S1, `get_own_partner_consents()` 신설) 이 3번째 상태는 자연히 제거되고 일반 2값 토글로 단순화된다 — **임시 UI이므로 코드에 "G-S1 해소 시 제거" 주석을 남기도록 frontend-developer에 인계**.

3. **비밀번호 변경**: 새 비밀번호/확인 2필드 + `secondaryButtonClass`(설정 탭 안의 부차적 액션이므로 primary는 아래 "탈퇴" 옆이 아니라 이 섹션에서 상대적으로 낮은 위계 — 다만 저장 성공/실패 피드백은 §6과 동일 패턴).

4. **탈퇴**: `text-error`로 색을 준 텍스트 버튼 하나("탈퇴하기") — 다른 섹션과 달리 이 섹션은 위험 액션이므로 `secondaryButtonClass`(중립 보더)가 아니라 `border-error text-error hover:bg-error-100` variant(§9 프론트엔드 메모: `destructiveButtonClass` 신규 필요, admin 쪽 `adminButtonDestructiveClass`와 동일 아이디어를 buyer 토큰으로).

### 3.12 SUP-14 탈퇴 확인 모달

`ConfirmSubmitModal` 그대로 재사용(요약 섹션 대신 경고 문구 1개 박스 + 재가입 안내 1줄). 확인 버튼은 `primaryButtonClass`가 아니라 **`destructiveButtonClass`**(§3.11에서 정의한 것과 동일)로 교체 — 원본 컴포넌트가 `primaryButtonClass`를 하드코딩하고 있으므로 `confirmButtonClassName?: string` prop을 추가하는 소폭 리팩터링이 필요하다(§9).

---

## 4. 신규/변경 컴포넌트 목록

| 컴포넌트 | 상태 | 비고 |
|---|---|---|
| `components/supplier/ToggleSwitch.tsx` | 신규 | 2값 + "확인 필요" 3값 모드(`value: boolean \| 'unknown'`) 지원 |
| `components/supplier/DocumentDropzone.tsx` | 신규 | §3.9. 파일 검증(확장자/용량)은 UI 레이어에서 1차만, 실제 해시/매직바이트 검증은 서버(§9 아키텍처 메모) |
| `components/supplier/StatusBanner.tsx` | 신규 | §5. `VERIFICATION_STATE_TONE` 매핑을 받아 `StatusBadge`의 톤 팔레트를 재사용(색상만, 배지 형태는 아님 — 배너는 배지보다 큰 박스형) |
| `components/supplier/SubmissionChecklist.tsx` | 신규 | §2.2 사이드 카드. `computeSubmissionGaps()` 결과 → 체크리스트 렌더 |
| `components/supplier/ProfileTabs.tsx` | 신규 | §6. 탭 5개 + dot 인디케이터 + 저장상태 전파 |
| `ConfirmSubmitModal.tsx` | 변경 | `confirmButtonClassName?: string` prop 추가(기본값 `primaryButtonClass` 유지, SUP-14가 destructive로 오버라이드) |
| `CategoryPicker.tsx` | 변경 | §9. `adminInputClass` 하드코딩 제거, buyer 토큰 주입 가능하도록 prop화 |
| `components/RequestForm/styles.ts` | 확장 | `destructiveButtonClass` 신규 export 추가(§3.11) |
| `StatusBadge`/`ProgressBar` | 변경 없음 | 그대로 import(§0 전제) |

---

## 5. 상태 배너 톤 매핑 (요청사항 5)

`lib/admin/partnerLabels.ts`의 `VERIFICATION_STATE_TONE`을 그대로 가져와 쓰되, **`submitted`/`under_review`의 톤 불일치를 이 문서에서 정정 권고한다.**

| `verification_state` | 배너 문구(screen-spec §4.0) | 기존 코드 톤(`VERIFICATION_STATE_TONE`) | 이 문서의 채택 톤 | 배경/보더/텍스트 | 아이콘 |
|---|---|:---:|:---:|---|---|
| `draft` | "프로필을 작성 중입니다" | neutral | neutral | `bg-neutral-50 border-neutral-300 text-neutral-700` | 연필(편집) |
| `submitted` | "검증 대기 중입니다..." | **info** | info | `bg-primary-50 border-primary-500 text-primary-700` | 시계 |
| `under_review` | "검증 대기 중입니다..."(동일 문구) | **warning** ⚠ | **info**(정정) | `bg-primary-50 border-primary-500 text-primary-700` | 시계 |
| `verified` | "검증이 완료되었습니다" + 공개설정 링크 | success | success | `bg-success-100 border-success text-success` | 체크원 |
| `rejected` | "반려되었습니다: {사유}" + 재제출 안내 | error | error | `bg-error-100 border-error text-error` | 경고삼각형 |
| `suspended`(계정) | 로그인 자체를 차단(§3.1) — 이 배너에 도달하지 않음 | neutral | — | — | — |

**정정 이유**: screen-spec §4.0이 "`submitted`/`under_review`는 텍스트를 구분하지 않는다(같은 문구)"고 명시했는데, 기존 `lib/admin/partnerLabels.ts`는 두 상태에 다른 배지 톤(info vs warning)을 준다. **같은 문구인데 색만 바뀌면 "뭔가 상태가 나빠졌나?"라는 오해를 준다** — 텍스트와 색은 항상 같은 정보를 전달해야 한다는 원칙에 따라, `/supplier` 배너는 두 상태 모두 `info`로 통일할 것을 권고한다. (Admin 쪽 배지는 운영자가 두 상태를 구분해 관리 우선순위를 정할 수도 있으므로 그대로 두는 것이 맞을 수 있음 — Admin 화면 자체의 톤 변경은 이 문서 범위 밖이며 필요하면 별도 확인.)

배너 구조: `rounded-card border-l-4 {border색} {bg색} px-5 py-4 flex items-start gap-3`, 좌측 아이콘(20px), 우측 텍스트 블록(문구 + 있으면 CTA 링크/버튼), `aria-live="polite"`(제출 성공 시 배너가 페이지 새로고침 없이 즉시 바뀌므로 스크린리더가 변경을 인지하도록).

---

## 6. 탭 완료/저장 상태 인디케이터 (요청사항 2)

두 가지 서로 다른 신호를 분리해서 설계한다 — 섞으면 "빨간 점이 에러인지 미저장인지 미입력인지" 모호해진다.

### 6.1 탭 자체의 "필수 항목 미입력" 점 (탭 바에 상시 표시)

```
기본정보   역량정보 ●   문서   연락처   설정 ●
```

- 위치: 탭 라벨 텍스트 오른쪽에 인라인(`gap-1.5`)으로 6px `rounded-full bg-accent-500` 점. 절대위치 배지가 아니라 텍스트 흐름 안의 요소로 둔다 — 절대위치 배지는 라벨 길이가 다른 5개 탭에서 정렬이 흐트러지기 쉽다.
- 색은 `error`(빨강)가 아니라 `accent`(앰버)로 — 미입력은 "고장/실패"가 아니라 "아직 할 일이 남음"이므로 톤 자체가 덜 위협적이어야 한다(§5의 톤-일관성 원칙과 동일 논리).
- 스크린리더: 점은 `aria-hidden`, 탭 버튼에 `aria-label="기본정보, 필수 항목 미입력"`(점이 있을 때만 접미사 추가).
- 판정 기준: `computeSubmissionGaps()`가 반환하는 gap 항목을 필드→탭 매핑 테이블로 역산해 "이 탭에 속한 gap이 1개 이상이면 점 표시". 이 매핑 테이블(필드 키 → 탭 ID)은 체크리스트 카드(§2.2)의 "항목 클릭 시 해당 탭으로 이동" 기능과 동일한 테이블을 공유해야 한다(§9 구현 메모).

### 6.2 개별 탭의 "저장 상태" (탭 콘텐츠 하단, 탭 바가 아니라 각 탭 내부)

탭 바에는 넣지 않는다 — 저장 상태는 "지금 이 탭 안에서 편집 중인" 임시 상태이고, 다른 탭으로 이동하면 의미가 없어지는 정보이기 때문이다(탭 바의 점은 반대로 "탭을 벗어나도 유지되는" 영속적 신호).

각 탭 콘텐츠 최하단, 저장 버튼 좌측에 상태 텍스트:

| 상태 | 텍스트 | 스타일 | 저장 버튼 |
|---|---|---|---|
| 진입 직후(미수정) | (없음) | — | `primaryButtonClass`, 활성 |
| 수정함(미저장) | "저장되지 않은 변경사항이 있습니다" | `text-label-caption text-accent-700` | 활성 |
| 저장 중 | "저장 중..." | `text-label-caption text-neutral-400` | `disabled` |
| 저장 성공(직후 3초) | "방금 저장되었습니다" | `text-label-caption text-success` | 활성(3초 후 텍스트만 사라짐, 별도 토스트도 병행 — screen-spec §4.0 "성공 시 토스트" 유지) |
| 저장 실패 | "저장 실패 — 다시 시도해주세요" | `errorTextClass` | 라벨 "다시 시도"로 교체 |

버튼 위 고정 캡션(항상 표시, 상태와 무관): `text-label-caption text-neutral-400` "자동저장되지 않습니다. 탭을 벗어나기 전에 저장해주세요"(screen-spec §1.3 권고 문구 그대로) — 30분 세션 만료(EDGE-7)와 라우팅 기반 탭 전환(각 탭이 별도 URL) 두 위험을 한 문장으로 커버.

### 6.3 탭 전환 시 미저장 데이터 보호 (screen-spec에 없던 gap 보강)

SUP-09~13은 서로 다른 라우트(`/supplier/profile/basic` 등)다. 즉 탭을 바꾸는 것은 **페이지 이동**이라 저장하지 않은 입력이 그냥 사라질 수 있다. 이 문서는 아래를 인터랙션 요구사항으로 추가한다(§9에서 구현 메모로도 반복):

- 탭에 미저장 변경사항이 있는 상태에서 다른 탭 버튼을 클릭하면, 라우팅 전에 네이티브 `confirm()` 또는 경량 인라인 확인("저장하지 않은 변경사항이 있습니다. 이동하시겠습니까?")으로 막는다.
- 브라우저 탭 닫기/새로고침에는 표준 `beforeunload` 핸들러로 동일하게 방어.
- 이 보호장치는 EDGE-7(세션 만료)의 완화책(sessionStorage 백업, OQ-S8)과는 별개로, **"단순히 다른 탭을 눌러서" 데이터를 잃는 훨씬 흔한 사고**를 막는 최소한의 안전장치다 — MVP Should가 아니라 Must로 권고한다(구현 비용이 매우 낮고, 없으면 D-S4가 약속한 "탭 자유 이동"이 오히려 데이터 유실 함정이 된다).

---

## 7. 반응형 규칙 (요청사항 7)

PRD/screen-spec 어디에도 모바일 앱 대응 요구가 없고, 이 앱의 실제 사용 맥락(사업자등록증 스캔본 업로드, 긴 회사소개 작성, 표준 카테고리 380여 개 트리 검색)은 **키보드+큰 화면에서 훨씬 편하다.** 따라서:

- **최적화 타깃: 데스크톱(≥1024px, `lg`)**. §2.2의 2컬럼(탭+사이드 체크리스트) 레이아웃은 `lg` 이상에서만 적용.
- **태블릿(768~1023px, `md`)**: 체크리스트 카드가 탭 콘텐츠 아래로 내려와 세로 1컬럼이 된다(`sticky` 해제). 폼 필드 자체는 이미 `max-w` 제한 안에 있어 태블릿 폭에서도 그대로 잘 맞는다 — 별도 재배치 불필요.
- **모바일(<768px)**: 지원은 하되 "터치 최적화 리디자인"은 하지 않는다(범위 밖) — 존재하는 컴포넌트가 폭에 맞게 자연스럽게 줄바꿈되는 수준(그레이스풀 리플로우)까지만 보장한다.
  - 탭 네비게이션 5개는 한글 라벨이 짧아(2~4자) 375px 폭에서도 줄바꿈 없이 들어가지만, 여유를 위해 `overflow-x-auto` + `scroll-snap`을 걸어 폭이 더 좁은 기기(예: 320px)에서도 안전하게 만든다.
  - 문서 업로드 드롭존의 파일 선택 `<input type=file>`은 `capture` 속성을 **강제하지 않는다**(카메라 촬영과 갤러리 선택 둘 다 열리도록 기본 동작 유지) — 사업자등록증은 이미 스캔된 PDF를 갖고 있는 경우가 많아 카메라 전용으로 좁히면 오히려 불편하다.
  - `CategoryPicker`의 검색 드롭다운(`max-h-64 overflow-y-auto`)은 모바일에서도 그대로 쓰되, 가상 키보드가 뜬 상태에서 드롭다운이 화면 밖으로 밀리지 않도록 `position: fixed` 대안은 이번 범위에서 검토하지 않는다(기존 Admin 동일 컴포넌트가 이미 겪고 있을 이슈이므로, 발견되면 Admin/Supplier 공통 이슈로 별도 티켓).
- **결론**: "최소 태블릿 대응은 필요"(요청사항 7의 질문에 대한 답) — 데스크톱 다음으로 태블릿까지는 레이아웃 단위로 명시 대응하고, 모바일은 컴포넌트 리플로우로 커버하는 3단 대응(lg 최적화 / md 1컬럼 / sm 이하 리플로우)으로 정한다. 별도 모바일 전용 화면/네비게이션(예: 하단 탭바)은 만들지 않는다.

---

## 8. 접근성 체크리스트

| 항목 | 요구사항 |
|---|---|
| 색 대비 | `text-error`(#DC2626)/`text-accent-700`(#B45309)/`text-success`(#16A34A) 모두 각자의 배경(`error-100`/`accent-100`/`success-100`) 위에서 AA(4.5:1) 확인됨(기존 Admin 배지에서 이미 검증된 조합 재사용, §4.1) |
| 포커스 링 | 모든 인터랙티브 요소(토글, 탭 버튼, 드롭존)는 `focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2` — `inputClass`가 이미 갖고 있는 포커스 스타일과 시각적으로 통일 |
| 터치 영역 | 토글 스위치 히트박스 44px 이상(§3.11), 탭 버튼 세로 패딩 `py-3` 이상, 문서 목록의 "보기"/"삭제" 텍스트 링크도 `py-1` 패딩으로 히트박스 확보 |
| 키보드 내비게이션 | 탭 네비게이션은 `role="tablist"`/`role="tab"`/`role="tabpanel"` + 화살표 키로 탭 간 이동(WAI-ARIA Tabs 패턴) |
| 스크린리더 상태 전달 | 상태배너 `aria-live="polite"`(§5), 저장상태 텍스트도 같은 영역에 `aria-live="polite"`로 묶어 저장 성공/실패를 즉시 안내 |
| 폼 에러 연결 | 기존 `FormField`/`errorTextClass` 패턴이 이미 라벨-에러 연결을 전제로 하므로 그대로 계승 — 신규 필드도 동일 패턴 사용 필수(별도 스타일 금지) |
| 문서 삭제 인라인 확인 | §3.9 — 파괴적 액션이지만 모달이 아니므로, 인라인 확인 상태로 전환될 때 포커스가 "삭제" 버튼 자리(이제는 "삭제" 확인 버튼)에 그대로 유지되도록(포커스 유실 방지) |

---

## 9. 프론트엔드 구현 메모 (재사용 자산 조정 필요사항 정리)

screen-spec §1.1이 이미 짚은 것을 포함해, 이 문서에서 구체화된 변경 요구를 한곳에 모은다.

1. **`CategoryPicker.tsx` 토큰 교체**: 현재 `adminInputClass`(admin 전용, `px-3 py-2 admin-body`)를 하드임포트한다. `/supplier`에서 쓰려면 buyer `inputClass`(`px-4 py-2.5 text-body`)로 바뀌어야 시각적으로 이질감이 없다. **로컬 복제본을 새로 만들지 말고, `inputClassName`/`itemClassName` 등 스타일 override prop을 받는 방식으로 소폭 리팩터링할 것을 권장**(로직 중복 방지, admin 쪽은 기본값 그대로 두면 변경 없음). 선택 칩/드롭다운 항목의 `admin-label-sm`/`admin-body-sm`도 같은 방식으로 buyer `text-label-caption`/`text-body-sm`로 override 가능하게.
2. **`ConfirmSubmitModal.tsx`**: `confirmButtonClassName?: string` prop 추가(기본 `primaryButtonClass`), SUP-14에서 `destructiveButtonClass`로 오버라이드.
3. **`components/RequestForm/styles.ts`에 `destructiveButtonClass` 추가**: `'rounded-input border border-error px-6 py-3 text-label-button text-error transition-colors hover:bg-error-100 disabled:cursor-not-allowed disabled:opacity-50'` — admin의 `adminButtonDestructiveClass`와 동일 패턴을 buyer 사이즈(`px-6 py-3`, `text-label-button`)로.
4. **문서 삭제는 순수 클라이언트 호출로 끝나지 않는다**(G-S3, screen-spec §4.4 아키텍처 노트 그대로 승계) — UI는 낙관적으로 즉시 행을 제거해도 되지만, 실패 시 롤백(행 복원 + 에러 토스트) 처리가 필요.
5. **탭 전환 가드(§6.3)**: Next.js App Router에서 클라이언트 사이드 탭 전환 가로채기는 `router.push` 전에 커스텀 확인을 넣는 방식(예: 탭 링크를 `<Link>`가 아니라 `onClick`에서 dirty 체크 후 `router.push` 호출)으로 구현 — `beforeunload`만으로는 인앱 라우팅을 못 막으므로 반드시 별도 처리 필요.
6. **마케팅 동의 3-상태 토글(§3.11)**: `ToggleSwitch`의 `value` 타입을 `boolean | 'unknown'`으로 설계하고, 이 컴포넌트를 쓰는 곳은 마케팅 동의 토글 하나뿐이므로 다른 2값 토글(공개노출)에는 항상 `boolean`만 전달 — 3번째 상태가 실수로 다른 곳에 노출되지 않도록 타입으로 강제.
7. **아이콘**: 외부 아이콘 패키지 추가 금지(PRD OQ-7, `GlobeIcon.tsx` 컨벤션 계승) — 이 문서가 요구하는 신규 아이콘(시계/체크원/경고삼각형/연필/업로드/눈-토글)은 전부 `components/icons/`에 24 viewBox, `stroke=currentColor`, `strokeWidth 1.75`, `aria-hidden` 컨벤션으로 손으로 그릴 것.

---

## 10. Open Design Questions

| ID | 질문 | 이 문서의 권고 |
|---|---|---|
| **OD-1** | `submitted`/`under_review` 배너 톤 통일(info로)이 `lib/admin/partnerLabels.ts`의 `VERIFICATION_STATE_TONE`(Admin 쪽 배지에도 쓰이는 공유 상수) 자체를 바꾸는 것인지, `/supplier` 전용으로 별도 매핑을 두는 것인지 | Admin 쪽 배지의 info/warning 구분이 운영자에게 의미가 있는지 product-manager 확인 필요 — 의미 없다면 상수 자체를 통일(중복 매핑 회피), 의미 있다면 `/supplier`만 별도 상수(`SUPPLIER_VERIFICATION_STATE_TONE`) 신설 |
| **OD-2** | 마케팅 동의 3-상태 토글이 G-S1 해소(OQ-S1) 이후에도 "확인 필요" 로직을 코드에서 완전히 제거하는 시점을 누가 트리거할지 | frontend-developer가 `get_own_partner_consents()` RPC 존재 여부로 기능 플래그처럼 분기하기보다, backend-developer가 RPC를 배포하는 PR과 같은 PR에서 이 3-상태 로직을 제거하는 후속 커밋을 명시적으로 남기도록 체크리스트화 권장 |
| **OD-3** | 탭 전환 가드(§6.3)의 확인 UX를 네이티브 `confirm()`(브라우저 기본 다이얼로그, 스타일링 불가)으로 할지 자체 인라인 다이얼로그로 할지 | MVP는 네이티브 `confirm()`으로 충분(구현 비용 최소) — 브랜드 일관성보다 안전장치 존재 자체가 우선. 추후 자체 다이얼로그로 교체 가능 |

---

## Version History

| Version | Date | Changes | Author |
|---|---|---|---|
| 1.0 | 2026-09-03 | 최초 작성 — SUP-01~14 전체 레이아웃/컴포넌트/인터랙션 스펙, 상태배너 톤 매핑(및 기존 톤 불일치 정정 권고), 탭 완료점/저장상태 2트랙 인디케이터, 회원가입 2단계 진행바, 문서 업로드 위젯, 마케팅 동의 3-상태 토글(G-S1 대응), 반응형 3단 규칙, 접근성 체크리스트, 프론트엔드 구현 메모 7건 | ui-ux-designer |
