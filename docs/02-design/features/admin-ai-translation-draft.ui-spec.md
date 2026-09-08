---
template: ui-screen-spec
version: 1.0
feature: seepn-unified-platform-v1.0
phase: Admin "AI 초벌 채우기" — 버튼/배지 시각 스펙 (§5.1, §5.3 해소)
description: admin-ai-translation-draft.screen-spec.md §5(시각적 요소 요구사항)를 실제 색상값·레이아웃·상태별 스타일로 구체화한다. 새 컴포넌트/색상 토큰을 만들기 전에 기존 `components/admin/styles.ts`, `lib/admin/translationStatus.ts`, `tailwind.config.ts`의 확정 토큰을 최대한 재사용한다.
variables:
  - feature: seepn-unified-platform-v1.0
  - date: 2026-09-08
  - author: ui-ux-designer
  - project: SEEPN Unified Platform (FKP) — Admin
  - version: 1.0.0
  - status: Draft — frontend-developer 구현 전 참고, screen-spec Gap G-3(translation_source 데이터 통로)는 backend/frontend가 별도 해소
---

# Admin "AI 초벌 채우기" 버튼·배지 UI 스펙

| 항목 | 내용 |
|---|---|
| 문서 종류 | UI Spec (색상 / 레이아웃 / 상태별 시각 분기) |
| 작성자 | ui-ux-designer |
| 입력 문서 | [admin-ai-translation-draft.screen-spec.md](admin-ai-translation-draft.screen-spec.md) §2.1(Tier 확인창), §5(배지/버튼), §9(핸드오프) |
| 참조 코드 | `components/admin/styles.ts`(버튼 토큰) · `tailwind.config.ts`(색상/타입 스케일) · `components/admin/StatusBadge.tsx` · `lib/admin/translationStatus.ts`(`computeTranslationBadge`, `TONE_CLASS`) · `LandingCopyRow.tsx`/`CategoryRow.tsx`/`FaqRow.tsx`/`ArticleRow.tsx`/`CategoryDetailPanel.tsx`(대상 화면 5곳) |
| 스코프 | screen-spec §5.3(버튼 톤), §5.1(배지 2종), §2.1(Tier 확인창 텍스트 구조 참고의견), §5.2(드롭다운 가드 패턴 검토). 코드 구현은 frontend-developer 몫 — 이 문서는 명세만 제공 |
| 후속 담당 | ux-writer(버튼/배지 라벨, 확인창·에러 카피 최종화) → frontend-developer(구현) → qa-reviewer |

---

## 0. 설계 원칙 — 새 토큰·새 컴포넌트를 만들지 않는다

코드 확인 결과, 이번 기능에 필요한 시각 요소는 **이미 기존 토큰으로 100% 충족**된다.

| 요구사항 | 새로 필요한가? | 근거 |
|---|:---:|---|
| 버튼 3번째 톤(outline/secondary) | 새 **클래스 조합**은 필요하지만 새 **색상값**은 불필요 | `adminButtonSecondaryClass`가 이미 `border-neutral-300 bg-neutral-0 text-neutral-700 hover:bg-neutral-100`의 outline 톤을 정의해둠(`components/admin/styles.ts` L9-10). 다만 이 클래스는 `px-4 py-2 admin-label` 크기로 큰 폼 액션(취소 버튼 등)용이라 카드 헤더의 배지 옆에 넣기엔 크다 — **크기만 다른 컴팩트 변형**이 필요 |
| 배지 2종(warning/info) | 새 **컴포넌트/색상** 불필요, **함수 1개** 추가 | `lib/admin/translationStatus.ts`의 `TranslationBadge['tone']`가 이미 `'warning' \| 'info'`를 포함하고, `TONE_CLASS`가 두 톤 모두 이미 스타일 정의(L35-40)를 갖고 있음. 배지를 그리는 방식도 화면마다 이미 정해져 있음(§2 참고) |

**중요한 기존 상태 발견**: 이 저장소에는 배지를 그리는 두 가지 병렬 패턴이 이미 존재한다.

1. `LandingCopyRow`/`CategoryRow`/`FaqRow`/`ArticleRow` 4곳: 각 파일에 로컬로 중복 정의된 `function Badge({label, tone})` — `rounded-full px-2 py-1 admin-label-sm ${TONE_CLASS[tone]}` (pill 모양), `lib/admin/translationStatus.ts`의 `TONE_CLASS` 사용.
2. `CategoryDetailPanel` 1곳: `TranslationEditor` 내부에 인라인 `<span className="rounded-sm px-2 py-0.5 ...">` (chip 모양, 역시 같은 `TONE_CLASS` 사용) + 패널 상단 요약 배지는 별도로 `components/admin/StatusBadge.tsx`의 `<StatusBadge>`(`rounded-sm`, 자체 `BadgeTone`/`TONE_CLASS`, `info` 톤이 `bg-primary-50 text-primary-700`로 1과 미묘하게 다른 값)를 씀.

즉 `components/admin/StatusBadge.tsx`는 이번 5개 대상 카드의 배지 렌더링 경로에 **아예 들어있지 않다**(표준카테고리 패널의 로케일 카드조차 그걸 안 쓰고 인라인 span을 씀). 따라서 이번 신규 배지는 `StatusBadge.tsx`에 통합하지 않고, **`lib/admin/translationStatus.ts`에 이미 있는 톤 체계를 그대로 재사용하는 두 번째 배지**로 추가한다 — 이래야 5개 화면 모두에서 "기존 배지 옆 두 번째 배지"가 **같은 파일이 이미 쓰던 모양(pill or chip)** 그대로 나오고, 화면마다 배지 모양이 섞이지 않는다. `StatusBadge.tsx`/`components/admin/StatusBadge.tsx`의 `info` 톤과 색값이 미세하게 다르다는 기존 불일치는 이번 기능 범위가 아니므로 건드리지 않는다(별도 이슈로만 기록).

---

## 1. "AI 초벌 채우기" 버튼

### 1.1 배치

카드 헤더 한 줄에 라벨(왼쪽) — [AI 버튼] [상태 배지] [소스 배지](오른쪽) 순서로 배치한다(screen-spec §5.3 "배지 왼쪽", §5.1 "기존 배지 오른쪽에 나란히"를 그대로 따르면 이 순서가 나온다).

```
기존 (LandingCopyRow TextEditor 헤더, 예시)
┌────────────────────────────────────────────┐
│ 日本語                              [번역필요] │   ← flex items-center justify-between
└────────────────────────────────────────────┘

변경 후
┌──────────────────────────────────────────────────────────────┐
│ 日本語                 [✨ AI 초벌 채우기] [번역필요] [AI 초안·미검수] │
└──────────────────────────────────────────────────────────────┘

로딩 중
┌──────────────────────────────────────────────────────────────┐
│ 日本語                          [⟳ 번역 중…] [번역필요] [AI 초안·미검수] │
│ (textarea/select/저장 버튼 모두 disabled)                        │
└──────────────────────────────────────────────────────────────┘
```

- 헤더 컨테이너를 `flex items-center justify-between`에서 **`flex flex-wrap items-center justify-between gap-2`**로 바꾸고, 오른쪽 3요소(버튼+배지 2개)를 `<div className="flex flex-wrap items-center gap-2">`로 묶는다. 표준 카테고리 패널처럼 폭이 좁은 컨테이너(사이드 패널)에서 라벨+버튼+배지 2개가 한 줄에 다 안 들어갈 수 있으므로, 넘치면 자동으로 다음 줄로 감싸지도록 방어한다(버튼/배지 자체 마크업은 변경 없이 부모 flex 속성만 조정하면 됨).
- 소스 로케일 카드(en 원문 등)에는 버튼을 아예 렌더링하지 않는다(screen-spec §1.2). `case_study` 글에서도 렌더링하지 않는다(§3.5) — 두 경우 모두 "버튼 없음"이며 "비활성 버튼"이 아니다.
- 로딩 중에도 상태 배지·소스 배지는 **직전 값 그대로 유지**하고 숨기지 않는다 — 응답이 오기 전까지 배지를 껐다 켜면 깜빡임(레이아웃 점프 없음, 정보 손실처럼 보이는 착시 방지)만 생기고 얻는 게 없다.

### 1.2 스타일 토큰 — `adminButtonAiFillClass` (신규, `components/admin/styles.ts`에 추가)

기존 `adminButtonSecondaryClass`와 색상 로직은 동일하되, 카드 헤더에 맞는 컴팩트 크기 + 아이콘 슬롯이 있는 별도 상수로 신설할 것을 권고한다. 5개 파일에서 반복 재사용되는 신규 버튼이라, 5곳에 문자열을 복붙하는 대신(기존 "저장" 버튼이 이미 이런 복붙 방식이라 톤이 파일마다 미세하게 흔들리는 선례가 있음) 한 곳에서 export해 import하는 편이 유지보수에 유리하다.

| 상태 | Tailwind 클래스 | 비고 |
|---|---|---|
| 공통(base) | `inline-flex items-center gap-1.5 rounded-input border admin-label-sm transition-colors focus:outline-none focus:ring-1 focus:ring-primary-500` | `rounded-input`=8px, 기존 버튼과 통일 |
| 크기 | `px-3 py-1.5` | `adminButtonSecondaryClass`(`px-4 py-2`)보다 한 단계 작게 — 옆의 `admin-label-sm` 배지와 높이를 맞추기 위함 |
| Default | `border-neutral-300 bg-neutral-0 text-neutral-700` | `adminButtonSecondaryClass`와 동일 색상값(신규 색 없음) |
| Hover | `hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700` | 저장(파랑 채움)·삭제(빨강 채움)와 명확히 다른 "옅은 파랑 틴트" 호버로, 단순 회색 hover(`hover:bg-neutral-100`, 기존 취소류 버튼과 동일)와도 구분되는 최소한의 "AI 액션" 신호를 준다. 새 색상 없이 기존 `primary-50`/`primary-300`/`primary-700` 재사용 |
| Disabled | `disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-400` | `adminInputClass`의 disabled 톤과 동일 값으로 통일 |
| Loading (버튼 자체) | disabled와 동일 컨테이너 톤(`border-neutral-200 bg-neutral-50 text-neutral-400`) + 아이콘 슬롯을 스피너로 교체, `aria-busy="true"` | 아래 1.4 참고 |

전체 조합 예시(참고용 문자열, 실제 export 여부/정확한 위치는 frontend-developer 판단):

```
'inline-flex items-center gap-1.5 rounded-input border border-neutral-300 bg-neutral-0 px-3 py-1.5 admin-label-sm text-neutral-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-400'
```

### 1.3 아이콘 — 신규 라이브러리 없이 유니코드 글리프 재사용

`package.json`에 아이콘 라이브러리(heroicons/lucide 등)가 없고, 기존 코드도 `CategoryDetailPanel.tsx`의 정렬 이동 버튼(▲▼)처럼 **유니코드 글리프를 아이콘 대용으로 이미 쓰고 있다**(L216, L224). 이 컨벤션을 그대로 따라 새 아이콘 라이브러리를 도입하지 않는다.

- Default 아이콘: `✨`(sparkle) — `<span aria-hidden="true">✨</span>`. 장식용이며 의미 전달은 버튼 텍스트("AI 초벌 채우기")가 담당하므로 `aria-hidden`으로 스크린리더 중복 낭독을 막는다.
- 아이콘 색상은 버튼 텍스트 색을 상속(`text-current`)해 별도 색상 관리가 필요 없게 한다.

### 1.4 로딩 상태 — 기존 스피너 레시피 재사용

`components/RequestForm/SubmitStatus.tsx`(L26)에 이미 쓰이고 있는 스피너 마크업을 축소해 그대로 재사용한다(새 애니메이션/색상 불필요).

```
h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-600
```

- 버튼 라벨 텍스트는 로딩 중 "AI 초벌 채우기" → "번역 중…"(가안, ux-writer 최종화)으로 교체.
- 버튼과 카드 내 다른 컨트롤(텍스트/셀렉트/저장 버튼)은 개별적으로 `disabled` 처리한다(screen-spec §2.1 "G" 단계). 카드 전체를 반투명 오버레이로 덮는 방식은 권장하지 않는다 — 사용자가 방금 입력한 텍스트를 로딩 중에도 계속 눈으로 확인/대조할 수 있어야 하고, `adminInputClass`가 이미 `disabled:bg-neutral-50 disabled:text-neutral-400`로 "비활성" 신호를 컨트롤 단위로 충분히 주고 있어 카드 전체를 가릴 이유가 없다.

### 1.5 Disabled 상태의 이유 안내 — `title` 속성으로 충분

E-1(원문 없음)/E-2(20,000자 초과)로 버튼이 비활성화될 때는 `<button disabled title="원문이 비어 있어 번역할 수 없습니다">`처럼 네이티브 `title` 속성만으로 충분하다 — **`disabled` 상태의 `<button>`은 모든 주요 브라우저에서 `title` 호버 툴팁이 정상 동작**한다(뒤에 나올 `<option disabled>`의 경우와는 다르므로 §4에서 별도로 구분해 다룬다). 커스텀 툴팁 컴포넌트를 새로 만들 필요 없음.

---

## 2. 배지 2종 — `translation_source` 시각화

### 2.1 함수 확장 위치 — `lib/admin/translationStatus.ts`

screen-spec §5.1이 이미 제안한 `computeSourceBadge(row)`를 다음 반환 형태로 추가한다. **`TranslationBadge['tone']` 타입을 넓힐 필요가 없다** — `'warning'`/`'info'`가 이미 그 유니온에 들어있다.

| `translation_source` | 반환 | 라벨(ux-writer 최종화 전 가안, screen-spec §5.1과 동일) |
|---|---|---|
| `'human'` 또는 행 없음 | `null`(렌더 안 함) | — |
| `'ai'` | `{ tone: 'warning', label: 'AI 초안 · 미검수' }` | 기존 `TONE_CLASS.warning` = `bg-accent-500/10 text-accent-600` 그대로 |
| `'ai_reviewed'` | `{ tone: 'info', label: 'AI 초안 · 검수완료' }` | 기존 `TONE_CLASS.info` = `bg-primary-100 text-primary-700` 그대로 |

### 2.2 렌더 방식 — 화면별로 "이미 쓰던 배지 렌더 방식"을 그대로 두 번 호출

새 컴포넌트를 만들지 않고, 각 파일이 이미 갖고 있는 배지 렌더 지점에서 `computeSourceBadge(...)`가 `null`이 아닐 때만 같은 방식으로 한 번 더 그린다.

- `LandingCopyRow` / `CategoryRow` / `FaqRow` / `ArticleRow`(4곳): 이미 정의된 로컬 `<Badge label tone>` 컴포넌트를 조건부로 한 번 더 호출. `<Badge label={badge.label} tone={badge.tone} /> {sourceBadge && <Badge label={sourceBadge.label} tone={sourceBadge.tone} />}`
- `CategoryDetailPanel`: 이미 인라인으로 쓰는 `<span className="rounded-sm px-2 py-0.5 admin-label-sm ${TONE_CLASS[...]}">` 패턴을 조건부로 한 번 더 렌더.

이렇게 하면 배지 모양(pill vs chip)이 화면마다 갈리지 않고 **그 화면이 원래 쓰던 모양을 그대로 유지**한다.

### 2.3 색상 중첩에 대한 참고 — 트레이드오프 인지

`computeTranslationBadge`의 `warning`(예: "번역 필요")과 신규 소스 배지의 `warning`(예: "AI 초안 · 미검수")이 **같은 카드에 동시에 뜰 수 있다** — 둘 다 주황(`accent`) 톤이라 나란히 놓이면 시각적으로 "주황 배지 2개"로 다소 무겁게 보일 수 있다. 텍스트 라벨이 서로 명확히 다르므로 오인 가능성은 낮다고 판단하지만, 완전히 새 색상 축(예: 보라색 계열)을 만들지 않는 이상 이 중첩은 피할 수 없다 — 이번 스코프(기존 토큰 재사용)에서는 감수하는 것으로 결정한다. 추후 배지가 더 늘어나 시각적 노이즈가 실제 문제로 확인되면 별도 색상 트랙 신설을 재검토할 것.

---

## 3. §2.1 Tier 1/2/3 확인창 — `window.confirm` 텍스트 구조 참고 의견

커스텀 모달 디자인은 불필요(스펙대로 `window.confirm` 재사용 확정). 다만 `window.confirm`은 HTML/색상/굵기를 전혀 지원하지 않고 **줄바꿈(`\n`)과 텍스트만** 쓸 수 있다는 제약 안에서, 강도를 텍스트만으로 표현하는 방법에 대한 의견은 다음과 같다.

1. **줄바꿈 구조**: "무슨 일이 일어날지" → (빈 줄) → "그 결과가 뭔지" → (빈 줄) → "계속할지 질문" 3단 구조를 모든 Tier에 통일 적용. 사용자가 confirm 창을 습관적으로 빠르게 스캔하므로, 가장 위험한 문장(결과)을 질문 바로 위, 첫 줄에서 너무 멀지 않은 위치에 둔다.
2. **이모지는 보조 신호로만, 텍스트 단어가 주 신호**: 🟡/🟠/🔴는 시각적으로만 구분될 뿐 스크린리더는 이를 "노란 원", "빨간 원" 등으로 읽어 위험도를 전달하지 못한다. Tier 2/3는 이모지와 별개로 "경고" 또는 "주의" 같은 단어를 문장 맨 앞에 명시적으로 넣을 것을 권고한다(예: "⚠ 경고 — 게시 중인 번역입니다."). Tier 1은 반복적으로 자주 뜨는(운영 중 흔한) 확인창이므로 이모지·강한 단어 없이 담백하게("이미 AI 초안이 있습니다...") 두어 경고 피로(alert fatigue)를 방지하고, Tier 2/3에서만 강도를 올려 상대적 심각도 차이를 유지한다.
3. **플랫폼 한계 — 기본 포커스 버튼**: `window.confirm`은 보통 "확인" 버튼에 기본 포커스가 가 있어 Enter 키 오조작 시 그대로 실행된다(이 동작은 브라우저가 결정하며 커스터마이즈 불가). Tier 3(라이브 콘텐츠 강등)처럼 되돌리기 어려운 액션에서 이 위험을 줄일 방법은 카피의 명확성뿐이다 — "계속할까요?"보다 "다시 받으면 지금 즉시 비공개로 전환됩니다. 그래도 진행할까요?"처럼 결과를 질문 안에 다시 한번 반복해 담는 문장을 권고한다. 이 한계 자체를 없애려면 커스텀 모달이 필요하지만, 그건 이번 스코프 밖이므로 참고로만 남긴다.

---

## 4. §5.2 상태 드롭다운 "게시됨 비활성 + 툴팁" — 패턴 검토 결과

기존 `<select>` + `STATUS_OPTIONS.map(<option>)` 구조에 `disabled={opt.value === 'published' && translationSource === 'ai'}`를 추가하는 것 자체는 **네이티브 HTML로 바로 가능**하고 `adminInputClass`가 입혀진 `<select>` 셸도 변경할 필요 없다.

**다만 "툴팁"이라는 표현은 구현 방식을 한 단계 낮춰야 한다.** `<option>` 요소의 `title` 속성은 Firefox에서는 호버 툴팁으로 뜨지만, **Chrome/Edge(Chromium 계열)는 네이티브 OS 드롭다운 팝업을 그리기 때문에 `<option>`의 `title` 호버 툴팁을 지원하지 않는다** — (앞서 §1.5에서 다룬, disabled `<button>`의 `title`이 모든 브라우저에서 잘 뜨는 것과는 별개의 문제). 이 Admin 콘솔의 주 사용 브라우저가 Chrome 계열일 가능성이 높으므로, 이 정보 전달을 hover 툴팁에만 의존하면 대부분의 운영자가 못 보고 지나간다.

**권고**: `translation_source === 'ai'`인 동안 드롭다운 아래에 **항상 보이는** 안내 문구를 상시 배치한다.

```
<select ...>...</select>
<p className="mt-1 admin-label-sm text-neutral-500">AI 초안은 검수 후 발행할 수 있습니다</p>   ← translation_source === 'ai'일 때만
```

- `<option disabled title="...">`은 Firefox 등 지원 브라우저를 위해 부가로 남겨둬도 무해하지만, 이게 유일한 안내 수단이 되지 않도록 한다.
- 이 문구는 hover 여부와 무관하게 항상 보이므로 오히려 "드롭다운을 열어봐야 아는" 기존 요청사항보다 발견성이 높아지는 부수 이득이 있다.
- `ai_reviewed`로 승격되면(§2.2) 다음 렌더에서 문구도 `select` 옵션 활성화와 함께 자동으로 사라진다 — 별도 상태 관리 불필요, 기존 조건부 렌더링 로직 그대로.

---

## 5. 접근성 체크리스트

| 항목 | 조치 |
|---|---|
| 포커스 링 | 버튼에 `focus:ring-1 focus:ring-primary-500` — 기존 `adminInputClass`/`adminButtonPrimaryClass`와 동일한 포커스 링 색상으로 통일 |
| 아이콘 | `✨`/스피너 모두 `aria-hidden="true"` — 의미는 텍스트 라벨이 전담 |
| 로딩 상태 알림 | 버튼에 `aria-busy="true"` 추가 권고(스크린리더가 상태 변화를 인지하도록) |
| 터치 영역 | `px-3 py-1.5` + `admin-label-sm`은 이 화면군의 기존 컨벤션(저장/삭제가 텍스트 링크 수준으로 더 작음)과 일치하는 수준 — 데스크톱 마우스 조작 전용 Admin 화면이라는 전제하에 허용. 추후 태블릿 지원이 필요해지면 전체 Admin 컨트롤 크기를 함께 재검토해야 함(이번 기능만 키우면 오히려 화면 내 불일치가 생김) |
| 색만으로 의미 전달 금지 | 배지 2종 모두 색(주황/파랑) + 텍스트 라벨을 함께 사용 — 색맹 사용자도 라벨 텍스트로 상태 구분 가능 |

---

## 6. 후속 핸드오프

| 대상 | 요청 |
|---|---|
| ux-writer | 버튼 라벨("AI 초벌 채우기"/"번역 중…"), 배지 라벨 2종, §3의 Tier 1/2/3·§2.2 확인창 최종 카피, §4의 드롭다운 안내 문구 최종화 |
| frontend-developer | `components/admin/styles.ts`에 `adminButtonAiFillClass` 추가(§1.2) · `lib/admin/translationStatus.ts`에 `computeSourceBadge` 추가(§2.1) · 5개 파일 헤더 레이아웃에 버튼+배지 배선(§1.1, §2.2) · 드롭다운 `disabled` 조건 + 상시 안내 문구(§4) · Gap G-3(`TranslationRow`에 `translation_source` 필드 추가) 선결 필요 |
| qa-reviewer | 배지 동시 노출 시(§2.3) 라벨 가독성, Chrome/Firefox 양쪽에서 드롭다운 disabled 옵션 동작 확인(§4), 버튼 disabled/loading 상태 전환 시 다른 컨트롤과의 disable 동기화(§1.4) |
