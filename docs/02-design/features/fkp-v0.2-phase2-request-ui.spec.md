---
template: ui-screen-spec
version: 1.0
feature: fkp-v0.2-platform-foundation
phase: Phase 2 — User 접수 UX 개선 (E2), 화면 시안
description: fkp-v0.2-phase2-request-flow.spec.md §11 핸드오프를 입력으로 받아 Hero recap 카드, 이어가기 패널 recap, 헤더 내비 진입점, /request 미니멀 페이지, success 리셋 트랜지션, Categories hover, 언어전환 confirm의 실제 레이아웃/토큰/인터랙션을 확정한다.
variables:
  - feature: fkp-v0.2-platform-foundation
  - date: 2026-08-25
  - author: ui-ux-designer
  - project: Find Korean Partners (FKP)
  - version: 0.2.0
  - status: Final (구현 준비 완료)
---

# FKP v0.2 Phase 2 — 접수 플로우 화면 시안 (ui-ux-designer)

| 항목 | 내용 |
|------|------|
| 문서 종류 | UI Screen Spec (PDCA Design phase, 시안) |
| 작성자 | ui-ux-designer |
| 작성일 | 2026-08-25 |
| 상태 | Final |
| 입력 문서 | [fkp-v0.2-phase2-request-flow.spec.md](./fkp-v0.2-phase2-request-flow.spec.md) §4, §7, §11 |
| 후속 담당 | ux-writer(카피) → frontend-developer(구현) → qa-reviewer |
| 디자인 툴 | 없음(Figma 미연동) — 본 문서가 유일한 시안 소스. Tailwind 토큰명/클래스는 `tailwind.config.ts` 기준 |

### Pipeline References

| Phase | Document | Status |
|-------|----------|--------|
| Design (플로우 스펙) | [fkp-v0.2-phase2-request-flow.spec.md](./fkp-v0.2-phase2-request-flow.spec.md) | ✅ Final |
| Design (본 문서, 시안) | 화면/컴포넌트 레이아웃·토큰·인터랙션 확정 | ✅ Final |
| Design (카피) | ux-writer 카피 가이드 | ❌ 본 문서 완료 후 착수 |
| Code | frontend-developer 구현 | ❌ 미착수 |

---

## 0. 이 문서의 범위

플로우 스펙(§11)이 지정한 5개 시안 대상 + 2개 추가 결정 사항을 다룬다. **"무엇을 보여줄지"는 플로우 스펙이 이미 정의했으므로 재정의하지 않는다** — 여기서는 각 상태의 실제 레이아웃, 여백, 타이포, 컬러 토큰, 인터랙션 디테일만 정의한다.

1. Hero 요약(recap) 카드
2. 이어가기 패널 Step1/Step2 요약(collapsed + Edit)
3. 헤더 "Request" 내비 진입점
4. `/[locale]/request` 미니멀 레이아웃
5. Success 화면 + "새 요청 시작" 리셋 트랜지션
6. (추가) Categories 카드 hover/cursor 스타일
7. (추가) 언어전환 confirm 다이얼로그 — native `confirm()` vs 커스텀 모달 결정

모든 색상/타이포/여백은 기존 `tailwind.config.ts`에 이미 정의된 토큰만 사용한다. **새로 추가한 토큰은 없다** (§10에서 근거 설명).

---

## 1. 기존 컴포넌트 확인 결과 (재사용 가능 여부 검토)

새 컴포넌트를 만들기 전에 검토한 기존 자산:

| 기존 요소 | 위치 | 재사용 방식 |
|---|---|---|
| `Step1`/`Step2`/`Step3`/`SubmitStatus`/`FormField` | `components/RequestForm/` | 마크업 그대로 재사용. Step1만 Hero 컨텍스트용 시각 변형(§3.2) 필요 |
| `inputClass`/`primaryButtonClass`/`secondaryButtonClass`/`errorTextClass` | `components/RequestForm/styles.ts` | 그대로 재사용, 신규 버튼 스타일 추가 없음 |
| Hero 섹션 패턴(`px-section-x-mobile py-section-y lg:px-section-x`, `max-w-[1200px]`) | `components/Hero.tsx` | 컨테이너 규칙 유지 |
| Categories 카드(`rounded-card border border-neutral-200 p-6`) | `components/Categories.tsx` | 콘텐츠 유지 + 상호작용 스타일만 추가 |
| LanguageSwitcher의 "현재 상태" 표현(`aria-current` + 컬러 스왑) | `components/LanguageSwitcher.tsx` | 헤더 "Request" 진입점의 `/request` 페이지 내 표시에 동일 패턴 재사용(§5.2) |

**신규로 만드는 것은 오직**: (a) `RecapCard`류 시각 패턴(Hero/패널에서 공유), (b) 헤더 "Request" 버튼, (c) 두 개의 인라인 SVG 아이콘(체크서클) — 새 색상·타이포·라운딩 토큰은 도입하지 않는다.

---

## 2. Hero — 상태별 시안

### 2.1 idle 상태

```
┌─ Hero section (px-section-x-mobile lg:px-section-x, py-section-y, bg-neutral-0) ─┐
│  ┌─ max-w-[1200px] mx-auto ─────────────────────────────────────────────────┐   │
│  │  H1  text-display-hero text-neutral-900                                  │   │
│  │      "Find the right Korean partner for your business."                 │   │
│  │                                                                          │   │
│  │  ↕ mt-4                                                                  │   │
│  │  P   max-w-2xl text-body-lg text-neutral-600  (subheadline)             │   │
│  │                                                                          │   │
│  │  ↕ mt-8                                                                  │   │
│  │  ┌─ mini-form wrapper: max-w-xl flex flex-col gap-4 ──────────────┐     │   │
│  │  │  FormField (whatLookingFor)                                    │     │   │
│  │  │    label  text-body-sm font-medium text-neutral-700            │     │   │
│  │  │    textarea rows=3  inputClass (stretched full width)          │     │   │
│  │  │  FormField (category)                                          │     │   │
│  │  │    label  text-body-sm font-medium text-neutral-700            │     │   │
│  │  │    select (native)  inputClass                                 │     │   │
│  │  │  ↕ mt-2                                                        │     │   │
│  │  │  button.primaryButtonClass  self-start  "Start My Request"     │     │   │
│  │  └──────────────────────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
```

**정확한 클래스**:

```html
<section className="px-section-x-mobile py-section-y lg:px-section-x">
  <div className="mx-auto max-w-[1200px]">
    <h1 className="text-display-hero text-neutral-900">{headline}</h1>
    <p className="mt-4 max-w-2xl text-body-lg text-neutral-600">{subheadline}</p>

    <div className="mt-8 flex max-w-xl flex-col gap-4">
      {/* Step1 컴포넌트 재사용, variant="hero" — §2.2 참고 */}
    </div>
  </div>
</section>
```

**디자인 결정 및 근거**:

- **`max-w-xl`(576px)로 폭 제한**: 플로우 스펙 §7.7 "미니입력은 넓은 화면에서도 Hero의 부속으로 보여야 하며 독립 섹션처럼 확장하지 않는다"를 만족시키기 위함. Hero 컨테이너(1200px) 전체 폭으로 늘리면 1440px에서 별도의 "폼 섹션"처럼 보여 Hero=Step1이라는 인지가 깨진다.
- **카드/박스 배경 없음**: 기존 Hero의 idle 상태(현재 배포본)는 CTA가 배경 없이 Headline과 같은 흰 배경 위에 얹혀 있다. idle 미니입력도 동일하게 **박스 처리하지 않는다** — 배경을 넣지 않는 이유는 뒤에 나올 recap 카드(§2.3)의 tinted 박스 처리와 대비를 만들어, "이 카드가 보이면 = 이미 입력이 잠겼다(읽기 전용)"는 신호를 색으로만 전달하기 위해서다. idle에도 박스를 두르면 이 신호가 무뎌진다.
- **CTA 버튼 `self-start`**: 부모가 `flex flex-col`이라 기본 `align-items: stretch`로 인해 버튼이 풀폭으로 늘어난다. 기존 Hero CTA는 `inline-block`(내용 폭)이었으므로 시각적 일관성을 위해 `self-start` 필수.
- **"Step 1 of 3" 라벨 숨김(variant="hero")**: 기존 `Step1.tsx`는 상단에 `text-label-button text-primary-600` 톤으로 "Step 1 of 3 — What You're Looking For"를 렌더링한다. 이 라벨을 Hero에 그대로 노출하면 **방문 직후 "3단계나 해야 하나"는 부담을 먼저 준다** — 첫 화면에서 진행률을 알리는 것은 이미 몰입한 사용자(패널 진입 이후)에게는 동기부여가 되지만, 아직 시작 전인 방문자에게는 마찰이다. `Step1` 컴포넌트에 `variant?: 'hero' | 'panel'` prop을 추가해 `variant==='hero'`일 때 이 라벨 줄을 렌더링하지 않도록 한다(§9 근거 요약, 코드는 frontend-developer 재량).
- **버튼 정렬 `justify-start`(=변형 없이 기본 block)**: 기존 `Step1.tsx`는 버튼을 `<div className="flex justify-end">`로 감싸 오른쪽 정렬한다. 이는 옆에 "Back" 버튼이 없는 패널 레이아웃 관례다. Hero에는 대응하는 "Back" 버튼이 없으므로 오른쪽 정렬 시 버튼이 붕 뜬 느낌을 준다 — `variant==='hero'`일 때는 `justify-end` 래퍼를 생략하고 버튼을 그냥 흐름대로(왼쪽 정렬) 렌더링한다.

### 2.2 step1_active 상태 (사용자가 입력 중)

레이아웃은 2.1과 동일. 차이는 값(입력된 텍스트/선택값)과 에러뿐.

- 검증 실패 시: `FormField`의 기존 에러 슬롯 그대로 사용 — `<span className={errorTextClass}>`(`text-label-caption text-error`)가 각 필드 아래 노출. **Hero 자체가 스크롤하거나 흔들리지 않는다.** 포커스도 유지(자동 스크롤 없음).
- 자동 포커스 금지(§7 원칙 3): 페이지 로드 시에도, `step1_active` 진입 시에도 `autoFocus`를 걸지 않는다.

### 2.3 recap 상태 (step2_active ~ success)

Step1 통과 직후부터 이어가기 패널로 스크롤되며 Hero는 아래처럼 접힌다. **컨테이너 폭(`max-w-xl`)과 위치(`mt-8`)는 idle과 동일하게 유지** — 상태가 바뀌어도 CTA 버튼이 같은 자리에서 텍스트만 바뀌는 것처럼 느껴지게 하기 위함(수평 점프 방지).

```
┌─ mini-form wrapper: mt-8 max-w-xl ──────────────────────────────────┐
│ ┌─ recap card: rounded-card border border-primary-200 bg-primary-50 ┐│
│ │  p-5 sm:p-6                                                       ││
│ │                                                                    ││
│ │  ┌ top row: flex items-center justify-between gap-3 ┐             ││
│ │  │ [✓ icon] YOUR REQUEST (label-caption, uppercase)  │  [Edit]    ││
│ │  └─────────────────────────────────────────────────┘             ││
│ │                                                                    ││
│ │  ↕ mt-3                                                           ││
│ │  "A Korean EdTech company for AI curriculum licensing"            ││
│ │  text-body text-neutral-800 line-clamp-2                          ││
│ │                                                                    ││
│ │  ↕ mt-3                                                           ││
│ │  ⬤ IT & AI   (pill: rounded-full bg-primary-100                  ││
│ │              text-primary-700 text-body-sm px-3 py-1)             ││
│ └────────────────────────────────────────────────────────────────┘│
│                                                                       │
│ ↕ mt-4                                                               │
│ button.primaryButtonClass  self-start  "Continue My Request"        │
└───────────────────────────────────────────────────────────────────┘
```

**정확한 마크업**:

```html
<div className="mt-8 max-w-xl">
  <div className="rounded-card border border-primary-200 bg-primary-50 p-5 sm:p-6">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <CheckIcon className="h-4 w-4 shrink-0 text-primary-600" />
        <span className="text-label-caption uppercase tracking-wide text-primary-700">
          {/* [[COPY]] 예: "Your request" */}
        </span>
      </div>
      <button
        type="button"
        onClick={onEditStep1}
        className="inline-flex min-h-11 items-center rounded px-3 text-body-sm font-medium text-primary-700 underline hover:text-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
      >
        {/* [[COPY]] 예: "Edit" */}
      </button>
    </div>

    <p className="mt-3 text-body text-neutral-800 line-clamp-2">{formData.whatLookingFor}</p>

    <span className="mt-3 inline-block rounded-full bg-primary-100 px-3 py-1 text-body-sm font-medium text-primary-700">
      {categoryDisplayName}
    </span>
  </div>

  <button type="button" onClick={onContinueClick} className={`${primaryButtonClass} mt-4 self-start`}>
    {/* [[COPY]] 예: "Continue My Request" */}
  </button>
</div>
```

**디자인 결정 및 근거**:

- **`bg-primary-50` + `border-primary-200`**: idle의 "박스 없음"과 명확히 대비되는 유일한 tinted 카드 — "이 값은 확정되어 잠겼다"는 상태 변화를 색만으로 전달(문구 없이도 인지 가능, 스크린리더는 `aria-label`로 보완, §7 접근성).
- **`line-clamp-2`로 요약 텍스트 절단**: `whatLookingFor`는 자유 텍스트(길 수 있음). Hero recap 카드는 "여기 입력한 게 이어지고 있다"는 확인용이지 전체 내용 재확인용이 아니므로 2줄로 충분 — 전체 내용은 Edit 클릭 시 패널에서 원문 그대로 볼 수 있다(Tailwind 3.4는 `line-clamp` 코어 플러그인 내장, 별도 설치 불필요).
- **카테고리를 pill 배지로 분리**: 자유 텍스트(문장)와 구조화된 값(카테고리)을 시각적으로 구분해 "두 개의 다른 정보"임을 즉시 알 수 있게 한다. `rounded-full`은 기존 `borderRadius` 토큰(`input`/`card`)에 없는 값이지만 Tailwind 코어 기본값이므로 신규 토큰 추가가 필요 없다.
- **Edit 버튼 `min-h-11`(44px)**: 텍스트만 있는 작은 링크형 버튼이라도 WCAG 2.5.5 터치 타깃 최소 44×44px를 만족하도록 `inline-flex items-center min-h-11 px-3`로 클릭 가능 영역을 확보한다(시각적으로는 텍스트 크기 그대로, 히트박스만 확장). 이 패턴은 본 문서의 모든 신규 소형 인터랙티브 요소(Edit 버튼들, §4.2)에 공통 적용한다.
- **"Continue My Request" 버튼을 카드 밖, 아래 배치**: 카드 안에 CTA까지 넣으면 카드가 "폼 하나"처럼 보여 Edit과 Submit 두 가지 행동이 한 박스에 공존해 혼란을 준다. 카드는 "확인용 정보"로, 버튼은 "다음 행동"으로 명확히 분리한다.
- **버튼 클릭 시 재검증 없음**(플로우 스펙 §4.1 명시) — 그냥 패널로 스크롤만.

### 2.4 반응형

| 브레이크포인트 | 차이 |
|---|---|
| 375px(base) | 위 레이아웃 그대로. `max-w-xl`(576px)이 375px 뷰포트보다 넓으므로 실질적으로 `w-full`처럼 동작(좌우 `px-section-x-mobile` 20px만 적용) |
| 640px(`sm:`) | 변화 없음(추가 breakpoint 불필요) |
| 1024px(`lg:`) | `px-section-x`(120px)로 좌우 패딩 확대(기존 Hero 규칙 그대로). 미니폼 `max-w-xl`은 유지되어 Hero 전체 폭(1200px) 대비 시각적으로 왼쪽에 붙은 "부속물"로 보임(§7.7 의도대로) |

**375px above-the-fold 검증**: Header(~64px) + `py-section-y` 상단 패딩(80px) + `text-display-hero`(56px line-height) + `mt-4`(16px) + `text-body-lg` 2줄(~56px) ≈ 272px. iPhone SE(667px height) 기준으로도 Headline+Subheadline이 여유 있게 최초 뷰포트 안에 들어온다 — 미니폼/CTA가 이어서 스크롤 영역에 위치해도 §7 원칙 2 위반 없음(검증 완료).

### 2.5 접근성

- Recap 카드에 `role="status"` 또는 `aria-live="polite"`를 주는 것은 **권장하지 않음** — Step1 통과는 사용자가 직접 트리거한 동작이라 스크린리더가 포커스 이동만으로도 변화를 인지한다. 대신 recap 카드 진입 시 포커스가 실제로 패널의 Step2 첫 필드로 이동하므로(플로우 스펙 §2.2) 스크린리더 사용자는 자연스럽게 컨텍스트를 따라간다.
- 카테고리 pill은 순수 텍스트 배지이므로 스크린리더에는 이어지는 텍스트로 자연스럽게 읽힘 — 별도 `aria-label` 불필요.

---

## 3. 이어가기 패널 (`#request-form`, RequestFormContinuation)

### 3.1 컨테이너

```html
<section
  id="request-form"
  className="scroll-mt-6 px-section-x-mobile py-section-y lg:px-section-x"
>
  <div className="mx-auto flex max-w-[600px] flex-col gap-6">
    {/* Step1 recap 또는 편집 폼 (step >= 2일 때만) */}
    {/* Step2 recap 또는 편집 폼 (step >= 3일 때만) */}
    {/* 현재 활성 스텝 컴포넌트 또는 SubmitStatus */}
  </div>
</section>
```

- `max-w-[600px]`은 기존 `RequestForm.tsx`의 폼 컨테이너 폭을 그대로 승계 — 이 패널이 "새 컴포넌트"가 아니라 기존 폼의 연장임을 시각적으로도 일치시킨다.
- `scroll-mt-6`(24px): 헤더가 sticky/fixed가 아니므로 오프셋 보정은 불필요하지만, 스크롤 도착 시 섹션 상단이 뷰포트 경계에 완전히 붙지 않도록 약간의 여백을 준다(가독성).
- idle 상태에서는 이 섹션 자체를 렌더링하지 않는다(플로우 스펙 §4.2 — DOM에 없거나 height:0). **권장: DOM에서 아예 제거(`{step >= 2 && status !== 'idle-reset' && <section>...}`)** — height:0만 주는 방식은 스크린리더가 숨겨진 빈 랜드마크를 여전히 순회할 수 있어 완전 제거가 더 안전하다.
- idle→step2 전환 시 섹션이 DOM에 새로 마운트되는 순간과 스크롤 트리거 순간의 순서는 §7.2에서 상세.

### 3.2 공용 RecapCard 패턴 (Step1/Step2 동일 컴포넌트 재사용 권장)

Hero recap(§2.3)과 시각적으로 **동일한 카드 스타일**을 재사용한다 — 다른 스타일을 쓰면 "이게 다른 종류의 정보"라는 잘못된 신호를 준다. 구조:

```
┌ rounded-card border border-primary-200 bg-primary-50 p-5 sm:p-6 ─────┐
│ top row: [✓ icon] {EYEBROW}                              [Edit]      │
│ ↕ mt-3                                                                │
│ {summary line 1 — text-body text-neutral-800}                        │
│ ↕ mt-1 (있을 때만)                                                    │
│ {summary line 2 — text-body-sm text-neutral-600 line-clamp-1}        │
└────────────────────────────────────────────────────────────────────┘
```

**Step1 recap 내용**(패널 진입 시, step≥2):
- eyebrow: [[COPY]] 예 "Your request"
- line 1: `whatLookingFor` (`line-clamp-2`)
- line 2 대신 카테고리 pill(§2.3과 동일한 `rounded-full bg-primary-100 text-primary-700` 배지, `mt-3`)

**Step2 recap 내용**(step≥3에서만 노출):
- eyebrow: [[COPY]] 예 "Details"
- line 1(`text-body text-neutral-800`): 구조화 값 3개를 가운뎃점으로 연결 — `{partnerTypeLabel} · {budgetLabel} · {timelineLabel}`
- line 2(`text-body-sm text-neutral-600 line-clamp-1 mt-1`): `purpose` 자유 텍스트 1줄 요약

**정확한 마크업(Step2 recap 예시)**:

```html
<div className="rounded-card border border-primary-200 bg-primary-50 p-5 sm:p-6">
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-2">
      <CheckIcon className="h-4 w-4 shrink-0 text-primary-600" />
      <span className="text-label-caption uppercase tracking-wide text-primary-700">{/* [[COPY]] "Details" */}</span>
    </div>
    <button type="button" onClick={onEditStep2} className="inline-flex min-h-11 items-center rounded px-3 text-body-sm font-medium text-primary-700 underline hover:text-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500">
      {/* [[COPY]] "Edit" */}
    </button>
  </div>
  <p className="mt-3 text-body text-neutral-800">
    {partnerTypeLabel} · {budgetLabel} · {timelineLabel}
  </p>
  <p className="mt-1 text-body-sm text-neutral-600 line-clamp-1">{formData.purpose}</p>
</div>
```

### 3.3 패널 내부 순서(예: step3_active 상태)

```
┌ #request-form ──────────────────────────────────────────┐
│  [Step1 RecapCard — collapsed]                           │
│  ↕ gap-6                                                  │
│  [Step2 RecapCard — collapsed]                            │
│  ↕ gap-6                                                  │
│  [Step3 폼 — 기존 Step3.tsx 그대로, 활성/편집 가능]        │
└───────────────────────────────────────────────────────────┘
```

부모 컨테이너가 `flex flex-col gap-6`이므로 각 블록 사이 24px 간격이 자동 적용된다 — 각 recap 카드/폼 블록에 개별 마진을 주지 않는다(간격 값을 한 곳에서만 통제해 유지보수 용이).

### 3.4 "Edit" 인터랙션 — 손실 없는 편집 (구현 노트, 상태 로직)

`[Edit]` 클릭 시 해당 recap 카드가 **그 자리에서** 편집 가능한 폼(Step1 또는 Step2의 원래 마크업)으로 바뀐다. 이때:

- 다른 recap 카드나 이후 스텝(예: Step3에 이미 입력된 값)은 **그대로 유지**된다 — 사라지거나 초기화되지 않는다(플로우 스펙 E2-R3 "손실 없는 이어짐"과 동일 원칙의 연장).
- 편집 중인 폼의 "Next" 버튼을 다시 누르면(재검증 통과 시) 그 자리가 다시 recap 카드로 접힌다. **뒤 단계로 자동 진행하지 않는다** — 이미 Step3까지 진행한 상태에서 Step1을 Edit했다면, Step1 재확정 후에도 여전히 Step3가 활성 상태로 남아 있어야 한다(사용자가 다시 Step2까지 순서대로 훑을 필요 없음).
- 동시에 두 개의 recap 카드가 "편집 중" 모드가 되는 일은 없다 — 하나를 Edit하면 다른 하나는 collapsed 상태를 유지(플로우 스펙 §9의 "동시에 하나의 활성 편집 위치" 원칙을 패널 내부에도 동일 적용).

> 이 부분은 시각 디자인상 새로운 마크업이 필요 없다(Step1/Step2 컴포넌트를 그 자리에 그대로 렌더링하면 됨). 상태 관리 방식(어떤 스텝이 지금 "편집 중"인지 별도 플래그로 관리)은 frontend-developer 재량이나, 위 동작 계약은 반드시 지켜야 한다.

### 3.5 반응형

375px/1024px 모두 위 레이아웃 그대로(폭이 `max-w-[600px]`로 고정되어 태블릿/데스크톱에서도 카드가 과도하게 넓어지지 않음 — 가독성 있는 텍스트 줄 길이 유지).

---

## 4. 헤더 "Request" 내비게이션 진입점

### 4.1 배치 결정

현재 헤더(`app/[locale]/page.tsx`에 인라인, 컴포넌트 분리 안 됨):

```html
<header className="flex items-center justify-between border-b border-neutral-200 px-section-x-mobile py-4 lg:px-section-x">
  <Link>{logo}</Link>
  <LanguageSwitcher />
</header>
```

**결정: "Request" 진입점을 로고와 LanguageSwitcher 사이, 헤더 오른쪽 그룹에 추가한다.**

```
┌─ header: flex items-center justify-between ──────────────────────┐
│  [Logo]                          [Request 버튼]  |  [EN | JA]    │
└────────────────────────────────────────────────────────────────┘
```

```html
<header className="flex items-center justify-between gap-4 border-b border-neutral-200 px-section-x-mobile py-4 lg:px-section-x">
  <Link href={`/${locale}`} className="text-body font-semibold text-primary-900 sm:text-h3">
    {logo}
  </Link>
  <div className="flex items-center gap-3 sm:gap-6">
    <RequestNavEntry .../>
    <LanguageSwitcher .../>
  </div>
</header>
```

**근거**:
- LanguageSwitcher는 저빈도 유틸리티 행동이라 기존 위치(맨 오른쪽 바깥쪽)를 그대로 유지한다 — 안정적인 요소를 불필요하게 재배치하지 않는다.
- "Request"는 이 서비스 전체에서 가장 중요한 전환 행동이므로 로고 다음으로 시선이 닿는 왼쪽-오른쪽 스캔 흐름상 LanguageSwitcher보다 안쪽(왼쪽)에 둔다 — 최종적으로 오른쪽 끝에 도달했을 때 언어 전환이라는 "덜 중요한" 옵션이 나오는 순서가 자연스럽다.

### 4.2 스타일 — 페이지/상태별

| 컨텍스트 | 시각 | 근거 |
|---|---|---|
| 기본(모든 페이지, `/request` 제외) | **아웃라인 버튼**: `rounded-input border border-primary-600 px-4 py-2 text-body-sm font-medium text-primary-600 transition-colors hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500` | 텍스트 링크만으로는 "이걸 누르면 접수를 시작/이어간다"는 행동 유도가 약함(모호한 라벨/낮은 발견성 방지). 그렇다고 Hero의 `primaryButtonClass`(진한 파란 배경)와 동일하게 채우면 헤더가 Hero CTA와 시각적 우선순위를 다투게 되어 "이 페이지에서 가장 중요한 버튼이 무엇인지" 헷갈린다. 아웃라인 버튼은 "클릭 가능한 명확한 CTA"이면서도 Hero의 채워진 버튼보다 한 단계 낮은 시각적 무게를 가진다 |
| `/[locale]/request` 페이지에서(자기 자신) | LanguageSwitcher의 현재 locale과 동일한 문법 재사용: 버튼 테두리 제거, `aria-current="page"` + `className="text-body-sm font-medium text-primary-600"`(테두리·hover 없음, `cursor-default`) | 이미 이 서비스가 존재하는 "현재 위치 표시" 시각 언어(LanguageSwitcher)를 그대로 재사용해 새로운 패턴을 만들지 않는다. 클릭해도 의미 있는 동작이 없으므로 버튼 chrome을 없애 "지금 여기 있다"는 상태로만 보이게 한다 |

**정확한 마크업**:

```html
{/* 기본(다른 페이지) */}
<button
  type="button"
  onClick={handleRequestNavClick}
  className="rounded-input border border-primary-600 px-4 py-2 text-body-sm font-medium text-primary-600 transition-colors hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
>
  {/* [[COPY]] 예: "Request" */}
</button>

{/* /request 페이지에서 */}
<span aria-current="page" className="cursor-default px-4 py-2 text-body-sm font-medium text-primary-600">
  {/* [[COPY]] 동일 라벨 */}
</span>
```

### 4.3 375px 대응

Logo(`text-h3`=20px) + Request 버튼 + `EN | JA`가 한 줄에 모두 들어가야 한다. 대략적인 폭 계산(Inter 20px semibold 기준 추정치, 실제 빌드에서 재확인 필요):

- 로고 "Find Korean Partners" ≈ 190~210px
- Request 버튼(패딩 포함) ≈ 80~90px
- `EN | JA` ≈ 50px
- 헤더 좌우 패딩(`px-section-x-mobile` 20px × 2) = 40px
- 요소 간 간격(`gap-3`=12px × 2, 헤더 `gap-4`=16px) ≈ 40px

합산 시 375px 예산을 초과할 가능성이 있어 **모바일 전용 축소 규칙**을 명시한다:

```html
<Link className="text-body font-semibold text-primary-900 sm:text-h3">  {/* 16px → sm 이상 20px */}
```

- 로고 폰트를 모바일에서 `text-h3`(20px) 대신 `text-body`(16px)+`font-semibold`로 축소(≥640px에서는 원래 `text-h3`로 복귀). 브랜드 워드마크는 유지하되 크기만 줄여 폭을 15~20% 절감.
- `header`의 우측 그룹 간격을 모바일에서 `gap-3`(12px), `sm:` 이상에서 `gap-6`(24px)로 축소(위 마크업에 이미 반영).
- 그래도 넘칠 경우의 안전장치: `header`에 `flex-wrap gap-y-2`를 추가해 우측 그룹 전체가 2번째 줄로 자연스럽게 내려가도록 허용(개별 아이템이 따로 줄바꿈되는 것 방지). 이건 폴백이며, 1차로는 위 축소만으로 372px 폭 내에 들어오는 것을 목표로 한다.

> **QA 필요**: 위 폭 계산은 추정치다. frontend-developer 구현 후 실제 375px 뷰포트에서 줄바꿈 여부를 반드시 확인할 것.

### 4.4 발견한 갭 — LegalPage에는 헤더 자체가 없음 (능동적 지적)

`components/LegalPage.tsx`(`/privacy`, `/terms`가 사용)를 확인한 결과, **이 두 페이지에는 헤더가 아예 없다** — "← Back to Find Korean Partners" 텍스트 링크 하나만 있고 로고/LanguageSwitcher/Request 진입점이 없다.

플로우 스펙 §4.3은 "Request" 진입점이 **"모든 페이지 공통"**으로 상시 노출되어야 한다고 명시하고, §5 분기 표에도 `/privacy`, `/terms`에서 클릭 시 `/request`로 이동하는 동작이 정의되어 있다 — 이는 **해당 페이지들에 헤더 자체가 존재함을 전제**로 한다. 현재 구현은 이 전제를 만족하지 못한다.

**제안**: `/privacy`, `/terms`에도 Home/`/request`와 동일한 헤더(Logo + Request 진입점 + LanguageSwitcher)를 추가한다. 기존 "← Back to Find Korean Partners" 링크는 콘텐츠 흐름 안에 위치한 보조 탈출구로 유지해도 무방(로고 링크와 기능이 겹치지만, 아티클 하단/상단 맥락에서 자연스러운 이차 동선이라 제거할 필요는 없음). 이 변경은 본 문서 범위(Phase 2 시안)에 포함하며, 헤더가 컴포넌트로 분리되어야 한다는 점과 함께 §9 핸드오프에 반영한다.

---

## 5. `/[locale]/request` 페이지 — 미니멀 레이아웃

```
┌ Header (Logo + Request진입점[aria-current] + LanguageSwitcher) ─┐
├───────────────────────────────────────────────────────────────┤
│ Context blurb section (px-section-x-mobile lg:px-section-x,    │
│   pt-12 pb-6, no bg)                                            │
│   max-w-[600px] mx-auto                                         │
│     p.text-body-lg.text-neutral-700  — 한 줄 컨텍스트 카피      │
├───────────────────────────────────────────────────────────────┤
│ RequestForm section (기존 컴포넌트 그대로, id="request-form")   │
│   px-section-x-mobile lg:px-section-x, pt-0 pb-section-y        │
│   max-w-[600px] mx-auto                                         │
│     Step1 → Step2 → Step3 → SubmitStatus (연속 배치)            │
├───────────────────────────────────────────────────────────────┤
│ Footer (기존 그대로)                                            │
└───────────────────────────────────────────────────────────────┘
```

**정확한 마크업**:

```html
<main>
  <Header /* Logo + RequestNavEntry(aria-current) + LanguageSwitcher */ />

  <section className="px-section-x-mobile pb-6 pt-12 lg:px-section-x">
    <div className="mx-auto max-w-[600px]">
      <p className="text-body-lg text-neutral-700">{/* [[COPY]] 한 줄 컨텍스트 */}</p>
    </div>
  </section>

  <RequestForm dict={...} categoriesDict={...} locale={locale} />
  {/* 기존 RequestForm.tsx: id="request-form", pt-0 pb-section-y로 top padding만 조정 */}

  <Footer dict={...} locale={locale} />
</main>
```

**디자인 결정 및 근거**:

- **마케팅 섹션 완전 배제**(HowItWorks/Categories/WhyUs 없음) — 플로우 스펙 §3 목적("이미 관심이 확정된 방문자")에 부합. 명함/이메일로 유입된 사용자에게 다시 "왜 이 서비스를 써야 하는지"를 설득할 필요가 없다.
- **컨텍스트 블러브 폭을 폼과 동일한 `max-w-[600px]`로 통일**: Hero처럼 넓은 `max-w-[1200px]`를 쓰면 짧은 한 줄 문장이 매우 넓게 퍼져 시선이 분산된다. 폼과 같은 폭으로 좁혀 "이 문장 다음이 바로 폼이다"라는 흐름을 시각적으로 이어준다.
- **블러브(`pb-6`)와 폼 섹션(`pt-0`) 사이 이중 여백 제거**: 두 섹션을 별개 `<section>`으로 유지하되(구현 편의상), 여백은 하나로 합쳐 "짧은 인트로 + 폼"이 하나의 흐름처럼 보이게 한다. `RequestForm.tsx`가 현재 `py-section-y`(상하 80px 동일)를 쓰므로, `/request` 페이지에서만 상단 패딩을 줄이는 오버라이드가 필요 — `RequestForm` 컴포넌트에 `topPadding?: 'default' | 'tight'` 같은 prop을 추가하거나, `/request` 전용 래퍼에서 `className="[&>section]:pt-0"` 형태로 조정(구현 방식은 frontend-developer 재량, 시각 결과만 명시).
- **`RequestForm` 컴포넌트를 변형 없이 그대로 재사용**: Home과 달리 `/request`는 Step1이 Hero로 분리되지 않은 "원래 형태"이므로, Phase 1부터 존재하던 `RequestForm.tsx`(Step1→2→3 연속, 내부 상태 자체 관리)를 그대로 마운트하면 된다 — 이 페이지를 위한 새로운 폼 오케스트레이션 로직은 필요 없다.

### 5.1 아키텍처 메모(구현 참고, 결정은 frontend-developer 재량)

Home 페이지는 Step1을 Hero로 분리하고 Step2/3을 별도 패널로 옮기는 **새로운** 오케스트레이션이 필요한 반면, `/request` 페이지는 **기존 `RequestForm.tsx`를 그대로** 쓴다. 즉 같은 "Step1/2/3/SubmitStatus" 원자 컴포넌트를 두 개의 서로 다른 상위 컨테이너(기존 `RequestForm` vs 신규 Home 전용 오케스트레이터)가 각각 감싸는 구조가 된다. 두 컨테이너가 상태 로직을 중복 구현할지, 공유 훅으로 뺄지는 UI 설계 범위 밖이나, **시각적으로는 완전히 동일한 필드 마크업/토큰을 사용해야 한다**(다른 코드 경로여도 다른 디자인처럼 보이면 안 됨) — 이 점만 frontend-developer에게 제약으로 남긴다.

---

## 6. Success 화면 + "새 요청 시작" 리셋 트랜지션

### 6.1 화면 시안

```
┌ SubmitStatus (success) — flex flex-col items-center gap-4 py-12 ─┐
│                                                                     │
│           ⊙  (CheckCircle, h-12 w-12 text-success)                │
│                                                                     │
│   "Thank you! We've received your request and will get back       │
│    to you soon."   — text-h3 text-success, text-center             │
│                                                                     │
│   ↕ mt-2                                                            │
│   [ 새 요청 시작 ]  — secondaryButtonClass                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────┘
```

```html
<div className="flex flex-col items-center gap-4 py-12 text-center">
  <CheckIcon className="h-12 w-12 text-success" strokeWidth={1.5} />
  <p className="text-h3 text-success">{dict.status.success}</p>
  <button
    type="button"
    onClick={handleReset}
    disabled={resetting}
    className={`${secondaryButtonClass} mt-2 disabled:cursor-not-allowed disabled:opacity-50`}
  >
    {/* [[COPY]] 예: "Start a New Request" */}
  </button>
</div>
```

**디자인 결정 및 근거**:

- **체크서클 아이콘 신규 추가**: 기존 success 화면은 텍스트 한 줄뿐이다(`components/RequestForm/SubmitStatus.tsx` 현재 구현). 완료 상태에 시각적 확인 요소(아이콘)를 더하는 것은 저비용·저위험으로 완료감을 강화하는 흔한 패턴이며, "새 요청 시작" 버튼이 추가되어 화면 요소가 하나 더 늘어난 만큼 아이콘이 텍스트-버튼 사이 시각적 앵커 역할을 한다.
- **"새 요청 시작" 버튼은 `secondaryButtonClass`(아웃라인), `primaryButtonClass`(채움) 아님**: 이 버튼은 저빈도·선택적 행동이다(플로우 스펙: "버튼을 누르지 않는 한 success 화면은 계속 유지됨"). Primary 스타일은 Next/Submit처럼 "다음에 반드시 할 일"에 예약해 둔다 — 여기 채운 버튼을 쓰면 "아직 뭔가 더 해야 하나?"라는 오해를 줄 수 있다.
- **`disabled` 상태 스타일 인라인 처리**: `secondaryButtonClass`(`styles.ts`)에는 현재 `disabled:` variant가 없다(`primaryButtonClass`에만 있음). 이 버튼에서만 `disabled:cursor-not-allowed disabled:opacity-50`을 인라인으로 추가하거나, `styles.ts`의 `secondaryButtonClass`에 동일 규칙을 영구 추가하는 것을 권장(다른 곳에서도 재사용될 수 있으므로 후자를 권장).

### 6.2 리셋 시퀀스 (OQ-4 비차단 항목에 대한 제안)

플로우 스펙 §10 OQ-4가 애니메이션 수치/디테일을 ui-ux-designer/frontend-developer 재량으로 남겼다. 아래 시퀀스를 제안한다 — 핵심은 **"패널이 접히는 것"과 "화면이 스크롤되는 것"이 동시에 일어나면 안 된다**는 점이다(동시에 일어나면 스크롤 중 콘텐츠 높이가 줄어들어 사용자가 보고 있던 지점이 요동치는 스크롤 점프가 발생한다).

```
1. 사용자가 "새 요청 시작" 클릭
2. 버튼 즉시 disabled 처리(중복 클릭 방지)
3. window.scrollTo({ top: 0, behavior: 'smooth' })  또는 Hero 섹션으로 scrollIntoView
4. 스크롤이 끝날 때까지 대기
   - 권장 구현: setTimeout(..., 500) — 대부분 브라우저의 smooth scroll 기본 지속시간과 근접한 안전한 값
   - 더 정교하게 하려면 scroll 이벤트에서 scrollY 변화가 멈추는 시점을 폴링해도 되지만, 이번 Phase에서는 고정 딜레이로 충분(YAGNI)
5. 딜레이 종료 후에만 상태 리셋 실행: formData/consent/errors 초기화, step=1, status='idle'
   → 이 시점에 이어가기 패널이 DOM에서 제거되어 height:0이 되지만, 사용자는 이미 화면 맨 위(Hero)를 보고 있으므로 레이아웃 변화가 뷰포트 밖에서 일어나 체감되지 않는다
6. Hero의 미니입력은 빈 값으로 초기화되어 보임. autoFocus는 걸지 않는다(§7 원칙 3 — 리셋도 "페이지 로드에 준하는 재시작"으로 취급)
```

**`prefers-reduced-motion` 대응**:

```
matchMedia('(prefers-reduced-motion: reduce)').matches === true 인 경우:
  - 3번 단계: behavior: 'auto'(즉시 이동, 애니메이션 없음)
  - 4번 단계의 딜레이: 생략(0ms) — 애니메이션이 없으므로 순서를 보호할 필요가 없다(스크롤이 이미 즉시 끝난 상태이므로 5번을 바로 실행해도 점프가 발생하지 않음)
```

이 처리는 "구현 시 기본 준수 사항"(플로우 스펙 §10 OQ-4)이므로 frontend-developer가 별도 확인 없이 적용한다.

---

## 7. Categories 카드 — hover/cursor 스타일

### 7.1 변경 사항

카드 콘텐츠(이름/키워드)는 **변경 없음**. `<div>` → 클릭 가능한 `<button>`으로 태그만 교체하고, 상호작용 스타일을 추가한다.

```html
<button
  type="button"
  onClick={() => onCategoryClick(key)}
  aria-label={/* [[COPY]] 예: `${item.name} — Use this category to start your request` */}
  className="rounded-card border border-neutral-200 bg-neutral-0 p-6 text-left transition-colors hover:border-primary-300 hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
>
  <h3 className="text-h3 text-neutral-900">{item.name}</h3>
  <ul className="mt-3 space-y-1 text-body-sm text-neutral-600">
    {item.keywords.map((k) => <li key={k}>{k}</li>)}
  </ul>
</button>
```

**디자인 결정 및 근거**:

- **`<div>` → `<button>` 태그 교체(시맨틱 수정)**: 카드가 실제로 상태를 바꾸는 인앱 동작(카테고리 프리필 + 스크롤)을 수행하므로, 링크(`<a>`, URL 이동 아님)가 아니라 네이티브 `<button>`이 적절하다. 이렇게 하면 키보드 포커스/Enter·Space 활성화/스크린리더 "버튼" 역할 안내가 **자동으로** 따라와 `role="button"` + `tabIndex`+ 커스텀 `onKeyDown` 같은 수동 ARIA 작업이 필요 없다(접근성 기본값 활용).
- **화살표 아이콘/"클릭하세요" 문구를 추가하지 않음**: 플로우 스펙 §4.4가 "카드 콘텐츠 자체는 변경 없음"을 명시했으므로, hover 배경/테두리 색 변화 + `cursor-pointer`(button 기본값)만으로 클릭 가능성을 알린다. 신규 텍스트/아이콘 요소를 추가하지 않는 것은 스펙 제약을 지키는 동시에 "콘텐츠 밀도를 늘리지 않는다"는 원칙에도 부합한다.
- **`hover:bg-primary-50`**: recap 카드(§2.3, §3.2)와 동일한 tint 컬러를 사용해 "primary-50 계열 배경 = 이 서비스에서 상호작용/선택 상태를 뜻한다"는 일관된 색 언어를 페이지 전체에서 통일한다.
- **`aria-label`이 별도로 필요한 이유**: 버튼 안에 시각적으로는 "카테고리 이름 + 키워드 목록"만 있어, 스크린리더 사용자에게는 이 버튼이 무엇을 하는지(요청 폼에 이 카테고리를 채운다는 것)가 전달되지 않는다. 시각 사용자는 Hero/패널의 recap 반응으로 결과를 확인할 수 있지만 스크린리더 사용자는 그 인과관계를 텍스트로 들어야 한다 — 카피는 ux-writer 확정 필요(§8).

### 7.2 반응형

기존 그리드(`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5`) 변경 없음.

---

## 8. 언어 전환 확인 다이얼로그 — native `confirm()` 채택

### 8.1 결정

**브라우저 기본 `window.confirm()`을 사용한다. 커스텀 모달은 만들지 않는다.**

### 8.2 근거

1. **발생 빈도와 중요도가 낮다**: 이 다이얼로그는 "폼 진행 중(step1_active~step3_active)에 언어를 전환하는" 드문 edge case에서만 뜬다(플로우 스펙 §8 E-3). 서비스의 핵심 전환 경로(접수 자체)와 무관한 경고성 확인이다.
2. **네이티브 confirm이 필요한 모든 것을 이미 무료로 제공한다**: 포커스 트랩, 배경 상호작용 차단(모달성), 키보드 지원(Enter=확인, Esc=취소), 스크린리더가 인식하는 네이티브 다이얼로그 역할 — 이 모두를 커스텀 구현하면 상당한 접근성 리스크(포커스 트랩 누락, ESC 미지원, 포커스 리턴 누락 등 흔한 커스텀 모달 버그)를 새로 만드는 셈이다.
3. **이 프로젝트는 User 화면에서 외부 UI 라이브러리를 쓰지 않는다(PRD OQ-7)**: 접근성이 검증된 헤드리스 다이얼로그 라이브러리(Radix 등)를 쓸 수 없는 제약 하에서, 처음부터 완전히 수작업으로 접근성 있는 모달을 만드는 비용은 이 기능의 중요도 대비 과도하다.
4. **내용이 단순하다**: 메시지는 정적인 한 문장 + 확인/취소 두 버튼뿐이다. 링크, 폼 요소, 브랜드 비주얼이 전혀 필요 없는 순수 "예/아니오" 확인이므로 네이티브 confirm의 "커스터마이징 불가"라는 단점이 실질적으로 손해가 되지 않는다.
5. **YAGNI**: 이 서비스의 원 설계 문서(`fkp-landing-page.design.md` §1.2)도 "필요 이상으로 추상화하지 않는다"를 원칙으로 명시했다 — 재사용 빈도가 거의 없는 단발성 확인에 새 디자인 패턴(오버레이 dim, 다이얼로그 카드, 포커스 관리)을 도입하는 것은 이 원칙에 반한다. 추후 유사한 확인이 여러 곳에서 반복적으로 필요해지면 그때 커스텀 컴포넌트로 승격한다.

### 8.3 인터랙션 계약(카피/구현 참고용)

```
LanguageSwitcher onClick:
  if (flowState !== 'idle' && flowState !== 'success') {
    const proceed = window.confirm(copy.languageSwitchWarning) // [[COPY]] ux-writer, en/ja
    if (!proceed) {
      event.preventDefault()  // 네비게이션 중단, 상태 그대로 유지
      return
    }
  }
  // proceed === true 이거나 idle/success인 경우: 기존 <Link> 네비게이션 그대로 진행
```

- 기존 `LanguageSwitcher.tsx`는 `<Link>`(Next.js)를 쓰고 있어, `onClick`에서 `window.confirm()` 결과에 따라 `event.preventDefault()`만 호출하면 되므로 `<Link>`를 `<button>`으로 바꿀 필요가 없다(프리페치/SEO 이점 유지, JS 비활성 환경에서도 최소한 링크 자체는 동작).
- `idle`/`success` 상태에서는 confirm 없이 즉시 전환(잃을 입력이 없으므로) — 이 조건 분기는 시각 요소가 아니라 로직이므로 frontend-developer가 플로우 상태를 LanguageSwitcher(또는 상위)에서 읽을 수 있어야 한다(플로우 스펙 §5 마지막 문단과 동일한 제약).

---

## 9. 신규 토큰/에셋 — 최소화 확인

| 필요 요소 | 기존 토큰으로 해결 가능? | 비고 |
|---|---|---|
| Pill/배지 라운딩 | ✅ `rounded-full`(Tailwind 코어 기본값) | `tailwind.config.ts`의 `card`/`input` 라운딩과 별개로 코어에 이미 존재, config 수정 불필요 |
| 텍스트 2줄 절단 | ✅ `line-clamp-2`(Tailwind 3.3+ 코어 플러그인) | 이 프로젝트 `tailwindcss: ^3.4.17` — 별도 플러그인 설치 불필요 |
| 44px 터치 타깃 | ✅ `min-h-11`(Tailwind 기본 spacing scale, 2.75rem) | config의 `spacing` extend(`section-y`/`section-x`)와 무관하게 코어 스케일 그대로 사용 가능 |
| 체크서클 아이콘 | 신규 — 인라인 SVG(외부 아이콘 라이브러리 아님) | 아래 참고 |
| 색상/타이포/카드 라운딩 | ✅ 기존 `primary`/`neutral`/`success` 팔레트, `text-h3`/`text-body`/`text-body-sm`/`text-label-caption`, `rounded-card` 그대로 | 신규 색상·폰트사이즈 추가 없음 |

**체크서클 아이콘(예시, 정확한 좌표는 구현 시 육안 조정 가능)**:

```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="9" />
  <path d="M8 12.5l2.5 2.5L16 9.5" />
</svg>
```

`h-4 w-4 text-primary-600`(recap 카드용, §2.3/§3.2), `h-12 w-12 text-success` `strokeWidth={1.5}`(success 화면용, §6.1)로 크기/색만 바꿔 재사용. 이것은 외부 아이콘 패키지가 아니라 손으로 작성한 인라인 SVG이므로 PRD OQ-7(User 화면 외부 UI 라이브러리 금지)에 저촉되지 않는다.

---

## 10. UX 이슈 — 능동적으로 지적하는 사항 요약

1. **LegalPage에 헤더 없음**(§4.4) — `/privacy`, `/terms`에 "Request" 진입점을 노출하려면 헤더 자체를 먼저 추가해야 한다. 플로우 스펙이 암묵적으로 전제한 것을 구현이 아직 만족하지 못하는 지점.
2. **Header가 컴포넌트로 분리되어 있지 않음** — 현재 `app/[locale]/page.tsx`에 인라인. Home/`/request`/(신규)Legal 3곳에서 동일 헤더+분기 로직을 써야 하므로 `components/Header.tsx`(client component, 플로우 상태를 읽어야 함)로 추출 필요 — 순수 시각 스펙 밖의 사항이지만 시안 실행을 위한 전제조건이라 명시한다.
3. **Hero의 "Step 1 of 3" 라벨을 그대로 노출하면 방문 직후 심리적 마찰**을 줄 수 있어 Hero variant에서 숨기도록 설계했다(§2.1) — Step1 컴포넌트에 `variant` prop 도입 필요.
4. **`secondaryButtonClass`에 `disabled:` variant가 없음**(`styles.ts`) — "새 요청 시작" 버튼 외 다른 곳에서도 향후 필요할 수 있으므로 `styles.ts` 자체에 추가하는 것을 권장(§6.1).

---

## 11. ux-writer에게 필요한 카피 목록

플로우 스펙 §11이 나열한 항목 + 본 시안에서 구체화되며 새로 드러난 항목:

| # | 위치 | 필요한 카피 | 비고 |
|---|---|---|---|
| 1 | Hero CTA(idle/step1_active) | "Start My Request" 류 문구 | `dict.hero.ctaText` 갱신(en/ja) |
| 2 | Hero recap eyebrow | "Your request" 류 소형 라벨 | 신규 dictionary 키 필요(예: `hero.recapLabel`) |
| 3 | Hero recap → 패널 이동 CTA | "Continue My Request" | 신규 키(예: `hero.continueCtaText`) |
| 4 | Hero/패널 recap의 "Edit" 버튼 | "Edit" | 신규 키, Step1/Step2 recap 공용 가능(예: `requestForm.recap.editLabel`) |
| 5 | 패널 Step1 recap eyebrow | 예: "Your request"(Hero와 동일 문구 재사용 여부 확인) | Hero recap eyebrow와 동일 카피 재사용 권장(일관성) |
| 6 | 패널 Step2 recap eyebrow | 예: "Details" | 신규 키 |
| 7 | 헤더 "Request" 진입점 라벨 | "Request" 류 짧은 단어(4~8자 내외 — 375px 폭 제약, §4.3) | 신규 키(예: `header.requestNav`) |
| 8 | `/request` 페이지 한 줄 컨텍스트 | 1문장, `max-w-[600px]` 폭에 자연스럽게 들어가는 길이 | 신규 키 |
| 9 | Success 화면 "새 요청 시작" 버튼 | "Start a New Request" 류 | 신규 키(예: `requestForm.buttons.startNew`) |
| 10 | 언어전환 confirm 다이얼로그 문구 | 경고 문장 1개 + OK/Cancel은 브라우저 기본 버튼 라벨 사용(§8 결정 — 커스텀 버튼 라벨 지정 불가) | en/ja 각각. **주의**: `window.confirm()`은 OK/Cancel 버튼 텍스트를 브라우저가 자체 로컬라이즈하므로 별도 라벨 카피가 필요 없다(메시지 문장만 필요) — ux-writer가 이 점을 인지해야 함(플로우 스펙 §11의 "취소/계속 버튼 라벨 포함" 요청과 배치되는 부분이므로 명시적으로 알림) |
| 11 | Categories 카드 `aria-label` | "{카테고리명} — 이 카테고리로 요청을 시작합니다" 류, 스크린리더 전용 문구 | 신규 키, en/ja, 화면에는 보이지 않음(액션 설명용) |

> **10번 관련 중요 정정**: 플로우 스펙 §11은 "취소/계속 버튼 라벨 포함"을 ux-writer 카피 항목으로 남겼으나, 본 시안에서 native `confirm()` 채택을 결정했으므로(§8) **버튼 라벨은 카피 대상이 아니다**(브라우저가 OS/브라우저 로케일 기준으로 자체 렌더링, 웹페이지가 제어 불가). ux-writer는 경고 메시지 문장 1개만 준비하면 된다.

---

## 12. frontend-developer 핸드오프 — 파일별 변경 사항

| 파일 | 변경 내용 |
|---|---|
| `components/Hero.tsx` | Step1(variant="hero") 삽입, idle/recap 상태 분기 렌더링(§2) |
| `components/RequestForm/Step1.tsx` | `variant?: 'hero' \| 'panel'` prop 추가 — "Step 1 of 3" 라벨 표시 여부, 버튼 정렬(§2.1) |
| `components/RequestForm/RequestForm.tsx` | `/request` 페이지 재사용 시 상단 패딩 조정 지점 확인(§5) — Home용 신규 오케스트레이터와는 별도 유지 |
| (신규) `components/RequestFormContinuation.tsx` 또는 유사 | `#request-form` 패널, recap 카드 포함(§3) |
| (신규) `components/RequestForm/RecapCard.tsx`(권장) | Hero/패널에서 공유하는 recap 카드 컴포넌트(§2.3, §3.2) — Hero recap과 패널 Step1/Step2 recap 3곳에서 재사용 |
| (신규) `components/Header.tsx` | 로고 + Request 진입점 + LanguageSwitcher, Home/`/request`/Legal 3곳 공용(§4, §10-2) — 플로우 상태 읽기 필요 |
| (신규) `components/RequestNavEntry.tsx`(또는 Header 내부) | §4.2 상태별 스타일, §5의 분기 로직(플로우 스펙 §5) 연결 |
| `components/Categories.tsx` | `<div>` → `<button>`, hover/focus 스타일, `aria-label`(§7) |
| `components/RequestForm/SubmitStatus.tsx` | success 케이스에 아이콘 + "새 요청 시작" 버튼 추가(§6.1), `onReset` prop 필요 |
| `components/RequestForm/styles.ts` | `secondaryButtonClass`에 `disabled:` variant 추가 권장(§10-4) |
| `components/LanguageSwitcher.tsx` | `onClick`에 `window.confirm()` 분기 추가(§8.3), 플로우 상태 참조 필요 |
| `components/LegalPage.tsx` | Header 컴포넌트 추가(§4.4, §10-1) |
| (신규) `app/[locale]/request/page.tsx` | §5 레이아웃, 기존 `RequestForm` 재사용 |
| `lib/i18n/types.ts`, `en.ts`, `ja.ts` | §11 카피 목록에 대응하는 신규 dictionary 키 추가(카피는 ux-writer, 키 구조는 frontend-developer) |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-08-25 | 초안 — Hero recap/패널 recap/헤더 진입점/`/request` 레이아웃/success 리셋/Categories hover/언어전환 confirm 결정 전체 확정 | ui-ux-designer |
