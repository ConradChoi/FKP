---
template: copy-guide
version: 1.0
feature: fkp-v0.2-platform-foundation
phase: Phase 2 — User 접수 UX 개선 (E2), 카피
description: fkp-v0.2-phase2-request-ui.spec.md §11 카피 요청 표(11항목)를 입력으로 받아 en/ja 확정 문구와 dictionary 키 구조를 정의한다.
variables:
  - feature: fkp-v0.2-platform-foundation
  - date: 2026-08-25
  - author: ux-writer
  - project: Find Korean Partners (FKP)
  - version: 0.2.0
  - status: Final (구현 준비 완료)
---

# FKP v0.2 Phase 2 — 접수 플로우 확정 카피 (ux-writer)

| 항목 | 내용 |
|------|------|
| 문서 종류 | Copy Guide (PDCA Design phase, 카피) |
| 작성자 | ux-writer |
| 작성일 | 2026-08-25 |
| 상태 | Final |
| 입력 문서 | [fkp-v0.2-phase2-request-flow.spec.md](./fkp-v0.2-phase2-request-flow.spec.md) §11, [fkp-v0.2-phase2-request-ui.spec.md](./fkp-v0.2-phase2-request-ui.spec.md) §11 |
| 톤 참고 | `lib/i18n/en.ts` / `ja.ts` (기존 확정 카피), `copy.md` (프로젝트 루트, 초기 랜딩 카피 원본) |
| 후속 담당 | frontend-developer(구현) → qa-reviewer |

### Pipeline References

| Phase | Document | Status |
|-------|----------|--------|
| Design (플로우 스펙) | [fkp-v0.2-phase2-request-flow.spec.md](./fkp-v0.2-phase2-request-flow.spec.md) | ✅ Final |
| Design (시안) | [fkp-v0.2-phase2-request-ui.spec.md](./fkp-v0.2-phase2-request-ui.spec.md) | ✅ Final |
| Design (본 문서, 카피) | ux-writer 카피 확정 | ✅ Final |
| Code | frontend-developer 구현 | ❌ 미착수 |

---

## 0. 진행 방식 및 전제

- ui-ux-designer의 §11 카피 요청 표(11개 항목)를 그대로 다룬다. 항목 10(언어전환 confirm)은 문서에 정정된 대로 **버튼 라벨은 카피 대상이 아니며, 메시지 본문만** 작성한다(`window.confirm()`의 OK/Cancel은 브라우저가 자체 로컬라이즈).
- `copy.md`의 관례(Option A ★ Recommended / Option B, 추천 이유)를 그대로 따른다 — 이 프로젝트에 이미 확립된 카피 리뷰 포맷이므로 새 포맷을 만들지 않는다.
- 기존 dictionary(`lib/i18n/en.ts`, `ja.ts`)의 톤을 유지한다: 과장·느낌표 없음, 짧은 문장, "you/your" 2인칭 중심 설명문 + 동사 중심 버튼 라벨, 같은 개념은 같은 단어로 통일(용어집은 §5 참고).
- 코드 파일은 수정하지 않았다. 아래 §4에 "그대로 옮겨 붙일 수 있는" 키-값과 `types.ts` 확장안을 제공한다.

---

## 1. 발견한 문제 — 기존 `hero.ctaText`("Submit Your Request")를 그대로 쓰면 안 되는 이유

카피 작업 전에 먼저 짚어야 할 용어 충돌이 있다: 현재 `hero.ctaText`는 `"Submit Your Request"`이고, `requestForm.buttons.submit`(Step3 최종 제출 버튼)도 `"Submit Request"`다. Phase 2에서 Hero CTA는 더 이상 제출을 실행하지 않고 Step1 통과 후 이어가기 패널로 넘기는 역할만 한다(플로우 스펙 §4.1). 기존 문구를 그대로 두면:

- 사용자가 Hero에서 "Submit Your Request"를 눌렀는데 아무것도 제출되지 않고 화면만 스크롤되면 **"진짜 제출된 건가?"라는 혼란**이 생긴다.
- 같은 페이지 안에 "Submit"이라는 단어를 쓰는 버튼이 두 개(Hero CTA, Step3 제출) 존재하게 되어, 어느 것이 진짜 최종 제출인지 구분이 안 된다.

따라서 Hero CTA는 "제출(submit)"이 아니라 "시작(start)" 동사로 반드시 교체해야 한다 — 이는 이번 카피 작업에서 가장 중요한 변경이다.

---

## 2. 항목별 카피 옵션

### 2-1. Hero CTA 텍스트 (idle / step1_active)

| 옵션 | en | ja | 뉘앙스 |
|---|---|---|---|
| A ★ 추천 | **Start My Request** | **リクエストを始める** | 1인칭 "My"는 버튼 카피에서 검증된 전환율 패턴(사용자가 자신의 행동으로 소유하는 느낌)이며, recap CTA "Continue My Request"와 짝을 이뤄 "내 요청을 시작 → 이어간다"는 하나의 서사를 만든다. 시안 예시안과 동일 |
| B | Start Your Request | リクエストを開始する | 나머지 카피 전반의 2인칭("your business", "your company name") 관례와 통일감은 있지만, recap 카드 CTA와 짝을 이룰 때 "Your"→"Your"보다 "My"→"My"가 더 자연스러운 연속 동작감을 준다(추천 이유 참고) |
| C | Get Started | 始める | 가장 짧지만 "무엇을" 시작하는지가 빠져 헤드라인/서브헤드라인 없이 단독으로 보일 때(예: 접근성 도구의 버튼 목록) 의미가 불분명해짐 |

**추천**: A. `hero.ctaText` 값을 `Submit Your Request` → `Start My Request`로 교체(§1 근거). "My"로 인해 나머지 설명문의 "your" 관례와 어긋나는 것은 의도된 예외로 남긴다 — Hero/recap CTA 두 곳에 한정된 예외이며, 나머지 라벨/설명문은 계속 "your"를 쓴다.

### 2-2. Step2 진입 후 Hero 요약 카드의 CTA 텍스트

| 옵션 | en | ja | 뉘앙스 |
|---|---|---|---|
| A ★ 추천 | **Continue My Request** | **リクエストを続ける** | 시안 예시안 그대로. "Start" → "Continue"로 동사만 바뀌어 같은 요청이 이어지고 있음을 명확히 전달 |
| B | Continue to Step 2 | ステップ2に進む | 스텝 번호를 노출 — Hero의 "Step 1 of 3" 라벨을 일부러 숨긴 결정(§2-8, 시안 §2.1)과 모순된다. Hero에서는 끝까지 "몇 단계 남았는지"를 노출하지 않는 게 일관적 |

**추천**: A.

### 2-3. 헤더 내비 진입점 라벨

| 옵션 | en | ja | 뉘앙스 |
|---|---|---|---|
| A ★ 추천 | **Request** | **リクエスト** | 명사형. "Pricing"/"Contact"처럼 목적지를 가리키는 내비게이션 라벨 관례에 맞고, `/request` URL과 그대로 대응되어 헷갈리지 않는다. 시안 §4.3의 폭 계산도 이 라벨 길이를 전제로 이미 산정됨 |
| B | Start Request | リクエストする | 동사형이라 행동을 더 강하게 유도하지만, 길이가 늘어나 375px 폭 예산(시안 §4.3)을 압박한다 |

**추천**: A. 헤더는 "지금 이 서비스를 어디서 시작/이어갈 수 있는지"를 알려주는 목적지 라벨이면 충분하고, 실제 행동 유도는 Hero/패널의 CTA가 담당한다.

### 2-4. `/request` 페이지 한 줄 컨텍스트 문구

| 옵션 | en | ja | 뉘앙스 |
|---|---|---|---|
| A ★ 추천 | **Tell us what you're looking for in Korea, and we'll connect you with the right partner.** | **韓国で探しているものをお知らせください。最適なパートナーとのマッチングをサポートします。** | Hero 서브헤드라인의 핵심 약속("discover, compare, connect")을 한 문장으로 압축. 마케팅 섹션이 없는 페이지에서 방문자가 "여기가 뭐 하는 곳인지" 한 번에 파악하도록 한다 |
| B | Start your request below. | 以下からリクエストを送信できます。 | 더 짧지만 "이 서비스가 무엇을 해주는지"에 대한 설명이 전혀 없어, 아웃리치 링크로 처음 도착한 방문자(맥락 없이 클릭한 경우)에게는 불충분할 수 있음 |
| C | Submit your request below. It usually takes a few minutes. | 以下からリクエストを送信してください。所要時間は数分です。 | 소요 시간 약속은 실측 데이터 없이 넣으면 근거 없는 주장이 되어 "과장 금지" 원칙에 위배 — 채택하지 않음 |

**추천**: A. B는 컨텍스트가 부족하고 C는 검증되지 않은 시간 약속을 포함하므로 제외.

### 2-5. "새 요청 시작" 버튼 라벨 (success 화면)

| 옵션 | en | ja | 뉘앙스 |
|---|---|---|---|
| A ★ 추천 | **Start a New Request** | **新しいリクエストを始める** | "New"가 명시적이라 "이전 요청은 끝났고 완전히 새로 시작한다"는 리셋 의미가 분명함. Hero CTA의 "Start"와 동사를 통일해 같은 행동임을 알림 |
| B | Submit Another Request | 別のリクエストを送る | "Another"는 반복 제출을 자연스럽게 유도하는 뉘앙스가 있지만 실제 동작(폼 전체가 빈 값으로 리셋되는 것)과는 거리가 있음 — "Start"가 실제 동작(초기화 후 재입력)을 더 정확히 예측시킴 |

**추천**: A.

### 2-6. Hero recap / 패널 recap 공용 요소: eyebrow 라벨, "Edit" 버튼

시안 §2.3·§3.2에 따라 Hero recap과 패널 Step1 recap은 **동일 eyebrow 카피를 재사용**해야 하고(일관성), 패널 Step2 recap은 별도 라벨("Details")을 쓴다. "Edit" 버튼은 Hero recap·패널 Step1 recap·패널 Step2 recap 3곳에서 완전히 동일한 텍스트를 재사용한다.

| 요소 | 옵션 | en | ja | 뉘앙스 |
|---|---|---|---|---|
| Step1 recap eyebrow (Hero + 패널 공용) | A ★ 추천 | **Your request** | **入力内容** | en은 제품 전체에서 이미 통용되는 단어 "request"를 재사용(용어 일관성). ja는 "あなたのリクエスト"처럼 직역하면 작은 eyebrow 라벨치고 길고 어색해, "入力内容"(입력하신 내용)으로 자연스럽게 현지화 — 같은 정보를 가리키므로 의미 손실 없음 |
| | B | What you're looking for | あなたのリクエスト | en은 필드 라벨과 거의 동일해 중복감. ja는 A보다 길어 eyebrow 라벨(`text-label-caption`, uppercase tracking)로 쓰기엔 부담 |
| Step2 recap eyebrow (패널 전용) | A ★ 추천 | **Details** | **詳細** | 기존 `requestForm.step2.label`("Step 2 of 3 — Details" / "ステップ2/3 — 詳細情報")에 이미 쓰인 단어를 재사용 — 새 용어를 만들지 않고 기존 용어집과 일치시킴(용어 일관성 원칙) |
| Edit 버튼 (3곳 공용) | A ★ 추천 | **Edit** | **編集** | 표준적인 짧은 동사. 별도 대안 불필요할 만큼 명확함 |

### 2-7. 언어 전환 경고 — `window.confirm()` 메시지 본문

버튼 라벨은 브라우저가 자동 로컬라이즈하므로 대상이 아니다(시안 §11 정정 사항, 본 문서도 동일하게 따름). 메시지 문장만 작성한다. `window.confirm()`은 OK를 누르면 "지금 설명한 동작"이 실행되고 Cancel을 누르면 취소되므로, 문장 자체가 "무엇이 실행될지"를 명확히 설명해야 한다(버튼에 별도 설명이 없기 때문).

| 옵션 | en | ja | 뉘앙스 |
|---|---|---|---|
| A ★ 추천 | **Switching language will clear your in-progress request. Continue?** | **言語を切り替えると、入力中のリクエスト内容が消去されます。続けますか？** | "Continue?"로 끝나 OK 버튼(브라우저 로컬라이즈 시 보통 "OK"/"확인"/"はい" 등)을 눌렀을 때 일어날 일이 문장과 자연스럽게 이어짐 |
| B | You have unsaved changes. Switching language will discard them. | 保存されていない入力があります。言語を切り替えると破棄されます。 | "unsaved changes"라는 표현이 폼 상황보다는 문서 편집기(에디터) 맥락에 더 어울려 사용자 혼란 가능성 — 이 서비스에는 "저장" 개념 자체가 없으므로(임시 상태만 존재) A가 더 정확 |

**추천**: A. "저장되지 않은 변경사항"이 아니라 "입력 중인 요청 내용"이라는 이 제품의 실제 용어(`request`)를 그대로 사용해 명확성을 높인다.

### 2-8. Categories 카드 hover 힌트 — 화면 문구 불필요, aria-label만 필요

**판단: 화면에 보이는 hover 힌트 문구는 추가하지 않는다.**

- 시안 §4.4가 "카드 콘텐츠 자체는 변경 없음"을 이미 명시했고, hover 시 테두리·배경색 변화(`hover:border-primary-300 hover:bg-primary-50`) + 커서 포인터만으로 클릭 가능성이 충분히 전달된다. 여기에 "Click to start your request" 같은 문구를 얹으면 카드마다 안 그래도 있는 키워드 리스트 아래 시각적 잡음이 하나 더 늘어나 §4.4가 지키려는 "콘텐츠 밀도 유지" 원칙에 어긋난다.
- 다만 시각적 신호만으로는 스크린리더 사용자에게 "이 버튼이 무엇을 하는지"가 전달되지 않으므로, **화면에 보이지 않는 `aria-label`은 반드시 필요하다**(시안 §7.1 항목 11과 동일 지적). 아래는 그 카피다.

| 옵션 | en (suffix, `${name} — ${suffix}`로 조합) | ja (suffix, `${name} — ${suffix}`로 조합) | 뉘앙스 |
|---|---|---|---|
| A ★ 추천 | **Start a request in this category** | **このカテゴリーでリクエストを開始します** | 동사 중심으로 클릭 시 정확히 무슨 일이 일어나는지("이 카테고리로 요청을 시작한다")를 예측 가능하게 서술 |
| B | Use this category to start your request | このカテゴリーを使ってリクエストを開始 | A보다 약간 길고 "use"가 불필요하게 완곡함 |

**추천**: A. `categories.selectHint` 하나만 dictionary에 두고 컴포넌트에서 `${item.name} — ${dict.categories.selectHint}`로 조합한다(카테고리마다 별도 문자열 10개를 만들 필요 없음 — 단일 진실 공급원 유지).

### 2-9. Hero variant의 "Step 1 of 3" 라벨 — 대안 카피가 필요한가

**판단: 대안 카피 없이, ui-ux-designer의 결정(완전 생략)을 그대로 따른다.**

이유:
- Hero에는 이미 Headline("Find the right Korean partner for your business.")과 Subheadline이 "이게 무엇을 위한 입력인지"를 충분히 설명하고 있고, 미니입력 2개 필드 자체의 라벨(`whatLookingFor.label`, `category.label`)도 각 필드가 무엇을 묻는지 명확하다. "Step 1 of 3"이 없어도 사용자가 "이게 뭘 위한 입력인지" 헤매지 않는다.
- 대체 문구(예: "Quick start", "2가지만 알려주세요" 류)를 넣는 방안도 검토했으나, 방문 직후 시점에 이런 보조 카피를 추가하면 오히려 "왜 굳이 이런 안내가 필요하지?"라는 의문을 유발할 수 있고, 실제로 소요 시간이나 절차를 수치로 약속하는 문구("30초면 끝나요" 등)는 검증되지 않은 주장이라 과장 금지 원칙에 걸린다.
- 결론적으로 "없는 것이 최선"이라는 ui-ux-designer의 판단에 카피 관점에서도 동의한다. 이 항목은 **dictionary 변경이 필요 없다** — `requestForm.step1.label`("Step 1 of 3 — What You're Looking For")은 기존 값 그대로 두되, `Step1` 컴포넌트가 `variant='hero'`일 때 이 라벨을 렌더링하지 않는 것으로 처리한다(패널 재편집 시의 `variant='panel'`에서는 기존 라벨을 그대로 사용).

---

## 3. 용어집 (Glossary) — 이번 작업으로 새로 등장한 용어 통일

| 개념 | 확정 용어 (en) | 확정 용어 (ja) | 비고 |
|---|---|---|---|
| Hero/패널에서 입력을 "시작"하는 동작 | Start | 始める | `hero.ctaText`, `requestForm.buttons.startNew`에 공통 적용 |
| 이미 시작한 입력을 "이어가는" 동작 | Continue | 続ける | `hero.continueCtaText` |
| 최종 제출(서버로 전송) | Submit | 送信 | 기존 `requestForm.buttons.submit`만 이 단어를 쓴다. Hero/recap CTA에는 절대 "Submit"을 쓰지 않는다(§1) |
| recap 카드에서 값을 되돌아가 고치는 동작 | Edit | 編集 | Hero recap, 패널 Step1/Step2 recap 3곳 공용 |
| 이 서비스에서 사용자가 넣는 데이터 전체를 가리키는 명사 | Request | リクエスト | 헤더 내비, Hero CTA, 언어전환 경고 문구 등에서 일관되게 사용. "inquiry", "form"류 대체어 사용하지 않음 |

---

## 4. `lib/i18n` 반영안 — frontend-developer용 정확한 키-값

### 4.1 `types.ts` 확장 (추가되는 필드만 표시)

```ts
export interface Dictionary {
  // ...기존 필드 유지...
  header: {
    logo: string
    requestNav: string // NEW
    languageSwitcher: {
      en: string
      ja: string
      switchWarning: string // NEW — window.confirm() 메시지 본문
    }
  }
  hero: {
    headline: string
    subheadline: string
    ctaText: string // 값 변경(키는 동일)
    continueCtaText: string // NEW
  }
  categories: {
    title: string
    items: Record<Category, CategoryInfo>
    selectHint: string // NEW — aria-label 조합용 suffix
  }
  requestForm: {
    // ...기존 필드 유지...
    recap: {
      // NEW
      step1Label: string
      step2Label: string
      editLabel: string
    }
    buttons: {
      next: string
      back: string
      submit: string
      submitting: string
      retry: string
      startNew: string // NEW
    }
    // ...
  }
  requestPage: {
    // NEW 최상위 섹션
    intro: string
  }
  // ...나머지 기존 필드 유지...
}
```

### 4.2 `en.ts` — 변경/추가분

```ts
header: {
  logo: 'Find Korean Partners',
  requestNav: 'Request', // NEW
  languageSwitcher: {
    en: 'EN',
    ja: 'JA',
    switchWarning: "Switching language will clear your in-progress request. Continue?", // NEW
  },
},
hero: {
  headline: 'Find the right Korean partner for your business.',
  subheadline:
    'Tell us what you are looking for in Korea. We help you discover, compare, and connect with trusted Korean companies, education providers, and service partners.',
  ctaText: 'Start My Request', // CHANGED (was 'Submit Your Request')
  continueCtaText: 'Continue My Request', // NEW
},
categories: {
  title: 'Categories',
  items: { /* 기존 그대로 */ },
  selectHint: 'Start a request in this category', // NEW
},
requestForm: {
  // ...기존 필드 그대로...
  recap: {
    step1Label: 'Your request', // NEW
    step2Label: 'Details', // NEW
    editLabel: 'Edit', // NEW
  },
  buttons: {
    next: 'Next',
    back: 'Back',
    submit: 'Submit Request',
    submitting: 'Submitting...',
    retry: 'Retry',
    startNew: 'Start a New Request', // NEW
  },
  // ...
},
requestPage: {
  intro: "Tell us what you're looking for in Korea, and we'll connect you with the right partner.", // NEW
},
```

### 4.3 `ja.ts` — 변경/추가분

```ts
header: {
  logo: 'Find Korean Partners',
  requestNav: 'リクエスト', // NEW
  languageSwitcher: {
    en: 'EN',
    ja: 'JA',
    switchWarning: '言語を切り替えると、入力中のリクエスト内容が消去されます。続けますか？', // NEW
  },
},
hero: {
  headline: '貴社に最適な韓国のパートナーを見つけます。',
  subheadline:
    '韓国で探しているものをお知らせください。信頼できる韓国の企業、教育機関、サービスパートナーを比較・発見し、つながるお手伝いをします。',
  ctaText: 'リクエストを始める', // CHANGED (was 'リクエストを送信する')
  continueCtaText: 'リクエストを続ける', // NEW
},
categories: {
  title: '対応カテゴリー',
  items: { /* 기존 그대로 */ },
  selectHint: 'このカテゴリーでリクエストを開始します', // NEW
},
requestForm: {
  // ...기존 필드 그대로...
  recap: {
    step1Label: '入力内容', // NEW
    step2Label: '詳細', // NEW
    editLabel: '編集', // NEW
  },
  buttons: {
    next: '次へ',
    back: '戻る',
    submit: 'リクエストを送信',
    submitting: '送信中...',
    retry: '再試行',
    startNew: '新しいリクエストを始める', // NEW
  },
  // ...
},
requestPage: {
  intro: '韓国で探しているものをお知らせください。最適なパートナーとのマッチングをサポートします。', // NEW
},
```

### 4.4 Categories `aria-label` 조합 예시 (구현 참고, 컴포넌트 코드)

```tsx
<button
  aria-label={`${item.name} — ${dict.categories.selectHint}`}
  ...
>
```

en 예: `IT & AI — Start a request in this category`
ja 예: `IT・AI — このカテゴリーでリクエストを開始します`

---

## 5. frontend-developer / qa-reviewer 참고 사항 (카피 범위 밖이지만 검토 중 발견)

- `hero.ctaText` 값이 "Submit"에서 "Start"로 바뀌므로, 기존 e2e 테스트(`tests/e2e/fkp-landing-page-e2e.spec.ts`, `fkp-landing-page-actions.spec.ts`)가 `en.hero.ctaText`를 동적으로 참조하고 있어 텍스트 자체는 자동으로 맞춰지지만, **현재 이 버튼은 `getByRole('link', ...)`로 조회된다.** Phase 2에서 Hero CTA는 페이지 이동 없이 클라이언트 검증을 실행하는 동작으로 바뀌므로(`<Link>` → `<button>` 전환 가능성), role이 `link`에서 `button`으로 바뀐다면 관련 e2e 테스트의 로케이터도 함께 갱신되어야 한다. 이는 카피가 아니라 마크업 변경 이슈이므로 frontend-developer/qa-reviewer가 인지할 것.
- `requestForm.step1.label`(Step 표시 라벨)은 **값을 바꾸지 않는다** — Hero에서는 `variant='hero'`일 때 이 필드를 아예 렌더링하지 않는 방식으로 처리한다(§2-9). 새 dictionary 키를 추가하지 않는다.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-08-25 | 초안 — 시안 §11 11개 항목 전수 확정(en/ja), 언어전환 confirm 정정사항 반영, Hero CTA "Submit"→"Start" 용어 충돌 해소, Categories aria-label 단일 키 설계, Step1 라벨 생략 판단, `types.ts`/`en.ts`/`ja.ts` 반영안, 용어집 신설 | ux-writer |
