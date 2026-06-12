---
template: design
version: 1.3
description: PDCA Design phase document for fkp-landing-page
variables:
  - feature: fkp-landing-page
  - date: 2026-06-11
  - author: ylia
  - project: Find Korean Partners (FKP)
  - version: 0.1.0
---

# fkp-landing-page Design Document

> **Summary**: 해외 기업·기관이 한국 파트너(교육/IT/콘텐츠/뷰티/비즈니스)를 요청하면 한국 업체를 리서치·매칭해주는 FKP 서비스의 첫 영문/일문 랜딩페이지 + 3단계 접수폼
>
> **Project**: Find Korean Partners (FKP)
> **Version**: 0.1.0
> **Author**: ylia
> **Date**: 2026-06-11
> **Status**: Draft
> **Planning Doc**: [fkp-landing-page.plan.md](../01-plan/features/fkp-landing-page.plan.md)

### Pipeline References (if applicable)

| Phase | Document | Status |
|-------|----------|--------|
| Phase 1 | Schema Definition | N/A (정적 사이트, DB 없음) |
| Phase 2 | Coding Conventions | ❌ (본 문서 §10에서 정의) |
| Phase 3 | Mockup (Figma MCP) | ❌ (Do 단계 진입 전 별도 진행 권장) |
| Phase 4 | API Spec | N/A (Apps Script 외부 엔드포인트, 본 문서 §4 참조) |

---

## Context Anchor

> Plan 문서(Executive Summary, Requirements, Risks)에서 추출.

| Key | Value |
|-----|-------|
| **WHY** | FKP의 핵심 가치("해외 요청을 받아 한국 파트너를 찾아 연결")를 전달할 첫 접점이 없음. 첫 리드 채널 확보 + 카테고리별 수요 데이터 수집이 목적 |
| **WHO** | 일본·싱가포르·동남아·미국 스타트업 창업자/사업개발 담당자(en), 일본어권 사용자(ja), 폼 알림을 받는 운영자(YLIA) |
| **RISK** | en/ja 동시 카피 작업으로 일정 지연 위험; Apps Script Web App의 CORS/배포 핸드오프 이슈; Figma 디자인 단계 디테일 매몰 위험 |
| **SUCCESS** | 폼 제출 → Sheets 기록 + 운영자 이메일 알림 정상 동작; Lighthouse Perf/A11y/SEO 90+; 375/768/1440 반응형; `/en` `/ja` 정적 빌드·배포 성공; GA4 이벤트 수집 |
| **SCOPE** | In: 6섹션(Hero/HowItWorks/Categories/WhyUs/RequestForm/Footer) + 3단계 폼 + en/ja + GA4 + Apps Script(Sheets+이메일) + Figma 시안 기반 구현 / Out: 추가 언어, 로그인·DB, 블로그, AI 자동매칭 |

---

## 1. Overview

### 1.1 Design Goals

- Figma MCP로 확정한 디자인 토큰을 Tailwind 설정에 그대로 이관해 픽셀 수준으로 구현 가능한 구조를 만든다
- en/ja 카피를 단일 dictionary 구조로 관리해 두 locale의 정적 페이지를 `generateStaticParams`로 동시 생성한다
- 3단계 RequestForm을 클라이언트 컴포넌트로 격리하고, 나머지 섹션은 모두 서버 컴포넌트로 유지해 정적 export 빌드를 단순하게 유지한다
- Apps Script Web App(외부 서비스)과의 통신을 단일 모듈(`lib/forms/submitRequest.ts`)로 캡슐화해, 엔드포인트 변경/CORS 이슈 대응을 한 곳에서 처리한다
- GA4 이벤트 트래킹을 헬퍼 함수로 통일해, 페이지뷰/CTA클릭/폼제출 이벤트가 누락 없이 호출되도록 한다

### 1.2 Design Principles

- **정적 우선**: SSR/서버 로직 없이 `output: 'export'`로 빌드 가능한 구조만 사용
- **카피-코드 분리**: 텍스트는 `lib/i18n/{locale}.ts`에만 존재, 컴포넌트는 dictionary 키만 참조
- **YAGNI**: hooks/services/domain 등 불필요한 계층 분리 없이, 정적 랜딩에 맞는 최소 구조(Option C) 유지
- **단일 진실 공급원**: 폼 항목(타입/카테고리/예산/일정 등 select 옵션)은 `lib/i18n/{locale}.ts`의 dictionary에서만 정의하고 컴포넌트에 하드코딩하지 않음

---

## 2. Architecture Options

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Clean | Option C: Pragmatic |
|----------|:-:|:-:|:-:|
| **Approach** | 단일 `page.tsx`에 6개 섹션 inline, 폼도 단일 컴포넌트 | hooks/services/domain 4계층 엄격 분리 | 섹션별 컴포넌트 + RequestForm 내부 3단계 분리, lib/i18n·lib/analytics |
| **New Files** | ~9 | ~28 | ~20 |
| **Modified Files** | 0 | 0 | 0 |
| **Complexity** | Low | High | Medium |
| **Maintainability** | Low | High (과함) | High |
| **Effort** | Low | High | Medium |
| **Risk** | Medium (확장 시 재작업) | Low (과한 추상화) | Low |
| **Recommendation** | 빠른 프로토타입 | 장기 플랫폼 확장 전제 | **기본 선택** |

**Selected**: Option C — Pragmatic Balance
**Rationale**: Plan §8.3에서 사용자 승인을 받은 컴포넌트 구조와 정확히 일치한다. 정적 랜딩페이지(Starter 레벨)에 4계층 분리(Option B)는 과도한 추상화(YAGNI 위반)이고, 단일 page.tsx(Option A)는 6섹션+3단계폼+2언어를 감당하기 어렵다.

> 이하 상세 설계는 Option C 기준으로 작성한다.

### 2.1 Component Diagram

```
┌──────────────────────────────────────────────────────────┐
│  app/[locale]/layout.tsx                                  │
│   - <html lang={locale}>, GA4 스크립트, LanguageSwitcher  │
│                                                            │
│  app/[locale]/page.tsx                                    │
│   ┌──────────┐ ┌──────────────┐ ┌──────────────┐         │
│   │ Hero     │ │ HowItWorks   │ │ Categories   │         │
│   └──────────┘ └──────────────┘ └──────────────┘         │
│   ┌──────────┐ ┌──────────────┐ ┌──────────────┐         │
│   │ WhyUs    │ │ RequestForm  │ │ Footer       │         │
│   └──────────┘ │ (client)     │ └──────────────┘         │
│                 │  Step1→2→3   │                          │
│                 │  → SubmitStatus│                        │
│                 └──────┬───────┘                          │
└────────────────────────┼──────────────────────────────────┘
                          │ submitRequest() — fetch POST
                          ▼
            ┌────────────────────────────┐
            │ Google Apps Script Web App  │
            │  doPost(e):                 │
            │   - honeypot 검사            │
            │   - Sheets row append        │
            │   - MailApp 운영자 알림      │
            └────────────────────────────┘

  lib/i18n/{en,ja}.ts ──▶ 모든 섹션·폼의 텍스트/옵션 소스
  lib/analytics.ts ──▶ gtag 페이지뷰/CTA/폼제출 이벤트
  AWS Amplify Hosting ──▶ output:'export' 정적 빌드 배포
```

### 2.2 Data Flow

```
1) 방문
   /en 또는 /ja 접속 → layout.tsx가 locale 파라미터로 dictionary 선택
   → GA4 page_view 이벤트 (lib/analytics.trackPageView)

2) 탐색
   Hero~WhyUs 스크롤 → CTA 버튼 클릭 시 #request-form으로 스크롤
   → GA4 cta_click 이벤트

3) 폼 작성 (RequestForm, client component)
   Step1(무엇을 찾는지+카테고리) → Step2(파트너유형/목적/설명/예산/일정/영어가능여부)
   → Step3(회사명·웹사이트/연락처 + honeypot hidden)
   각 Step "Next" 클릭 시 해당 Step 필드만 클라이언트 검증 → 통과 시 다음 Step 노출

4) 제출
   Step3 "Submit" → 버튼 비활성화 + SubmitStatus="loading"
   → lib/forms/submitRequest(formData) 호출
      → fetch(NEXT_PUBLIC_FORM_ENDPOINT, { method:'POST', body: JSON.stringify({...formData, locale, honeypot}) })
   → Apps Script doPost:
       a. honeypot이 비어있지 않으면 무시(스팸) — 클라이언트에는 성공으로 응답
       b. Sheets에 timestamp + locale + 10개 항목 append
       c. MailApp.sendEmail(운영자, "New FKP Request", 요약)
   → 성공: SubmitStatus="success" 화면 + GA4 form_submit 이벤트
   → 실패(네트워크 오류): SubmitStatus="error" + 재시도 버튼, 버튼 재활성화

5) 배포
   next build (output:'export') → /en, /ja 정적 페이지 생성(generateStaticParams)
   → AWS Amplify Hosting 배포 (amplify.yml)
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `app/[locale]/page.tsx` | `lib/i18n/dictionaries.ts`, 모든 section 컴포넌트 | locale별 페이지 조립 |
| `app/[locale]/layout.tsx` | `lib/i18n/dictionaries.ts`, `lib/analytics.ts`, `LanguageSwitcher` | 메타데이터, GA4, 언어 전환 |
| `RequestForm` | `lib/i18n/dictionaries.ts` (옵션 목록), `lib/forms/submitRequest.ts`, `lib/analytics.ts` | 3단계 폼 상태 관리, 제출, 이벤트 |
| `lib/forms/submitRequest.ts` | `process.env.NEXT_PUBLIC_FORM_ENDPOINT` | Apps Script Web App 호출 캡슐화 |
| `apps-script/Code.gs` | Google Sheets, Gmail(MailApp) | 데이터 저장 + 알림 (FKP 프로젝트와 별도 배포) |

---

## 3. Data Model

> 자체 DB 없음. 폼 데이터는 클라이언트 → Apps Script → Google Sheets로 흐른다. 아래는 코드 상의 타입 정의와 Sheets 스키마.

### 3.1 Entity Definition

```typescript
// lib/i18n/types.ts
export type Locale = 'en' | 'ja';

export type Category =
  | 'education'        // Education & EdTech
  | 'it-ai'             // IT & AI
  | 'content-media'     // Content & Media
  | 'beauty-lifestyle'  // Beauty & Lifestyle
  | 'business-services';// Business Services

export type PartnerType = 'purchase' | 'partnership' | 'license' | 'other';

export type Budget =
  | 'under-500'
  | '500-1500'
  | '1500-3000'
  | 'over-3000'
  | 'not-sure';

export type Timeline =
  | 'asap'
  | 'within-1-month'
  | '1-3-months'
  | '3-6-months'
  | 'flexible';

export type EnglishSpeaking = 'required' | 'preferred' | 'not-needed';

// types/request-form.ts
export interface RequestFormData {
  whatLookingFor: string;       // Step1 - free text
  category: Category;           // Step1 - select
  partnerType: PartnerType;     // Step2 - select
  purpose: string;               // Step2 - free text
  description: string;           // Step2 - textarea
  budget: Budget;                 // Step2 - select
  timeline: Timeline;             // Step2 - select
  englishSpeaking: EnglishSpeaking; // Step2 - select
  companyNameWebsite: string;    // Step3 - free text
  contact: string;                // Step3 - email/contact
}

export interface RequestFormPayload extends RequestFormData {
  locale: Locale;
  honeypot: string;               // 항상 빈 문자열이어야 함
}
```

### 3.2 Entity Relationships

```
[RequestFormPayload] ──submit──▶ [Google Sheets Row] (1:1, append-only)
                      └─trigger─▶ [운영자 이메일 알림] (1:1)
```

### 3.3 Google Sheets Schema (Apps Script가 append하는 컬럼)

| Column | Source | Type | Description |
|--------|--------|------|-------------|
| Timestamp | `apps-script` 자동 생성 | ISO datetime | 제출 시각 |
| Locale | `payload.locale` | `en \| ja` | 제출 언어 |
| WhatLookingFor | `payload.whatLookingFor` | string | 무엇을 찾는지 |
| Category | `payload.category` | string | 카테고리 |
| PartnerType | `payload.partnerType` | string | 파트너 유형 |
| Purpose | `payload.purpose` | string | 목적 |
| Description | `payload.description` | string | 상세 설명 |
| Budget | `payload.budget` | string | 예산 범위 |
| Timeline | `payload.timeline` | string | 일정 |
| EnglishSpeaking | `payload.englishSpeaking` | string | 영어 가능 파트너 필요 여부 |
| CompanyNameWebsite | `payload.companyNameWebsite` | string | 회사명/웹사이트 |
| Contact | `payload.contact` | string | 연락처 |

> `honeypot`이 비어있지 않은 제출은 Sheets에 기록하지 않고 무시한다 (Apps Script `doPost` 1단계에서 필터링).

---

## 4. API Specification

> 자체 서버 API 없음. Google Apps Script Web App을 외부 엔드포인트로 사용한다.

### 4.1 Endpoint List

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `{NEXT_PUBLIC_FORM_ENDPOINT}` (Apps Script Web App URL) | RequestFormPayload 제출 → Sheets append + 이메일 알림 | 없음 (Web App "Anyone" 배포) |

### 4.2 Detailed Specification

#### `POST {NEXT_PUBLIC_FORM_ENDPOINT}`

**Request:**
```json
{
  "whatLookingFor": "Looking for a Korean EdTech company for AI curriculum licensing",
  "category": "education",
  "partnerType": "license",
  "purpose": "Curriculum licensing for our online platform",
  "description": "We run an online learning platform in Japan and want to license Korean AI-based coding curriculum.",
  "budget": "1500-3000",
  "timeline": "1-3-months",
  "englishSpeaking": "preferred",
  "companyNameWebsite": "Acme EdTech / https://acme.example.jp",
  "contact": "biz@acme.example.jp",
  "locale": "en",
  "honeypot": ""
}
```

**Response (200 OK)**:
```json
{ "success": true }
```

**Response (success=false, 스팸 또는 처리 오류)**:
```json
{ "success": false, "message": "string" }
```

> **CORS 주의사항**: Apps Script Web App은 브라우저 fetch에 대해 표준 CORS 프리플라이트를 지원하지 않는 경우가 많다. Do 단계에서는 다음 중 하나를 선택해 구현한다:
> 1. `Content-Type: text/plain;charset=utf-8`로 POST하여 단순 요청(simple request)으로 프리플라이트 회피 + Apps Script `doPost`에서 `JSON.parse(e.postData.contents)`로 파싱
> 2. 위 방식으로도 응답을 읽지 못하면, 요청 전송 자체가 throw 없이 완료된 경우 낙관적으로 성공 처리(`SubmitStatus="success"`)하고, 실제 기록 여부는 운영자가 Sheets/이메일로 확인
>
> 이 선택은 Do 단계에서 `lib/forms/submitRequest.ts` 구현 시 확정하고 본 문서에 갱신한다.

**Error Responses (네트워크 레벨)**:
- `fetch` reject (네트워크 오류, 타임아웃) → 클라이언트에서 `SubmitStatus="error"` 표시, 재시도 버튼 노출

---

## 5. UI/UX Design

### 5.1 Screen Layout

```
┌────────────────────────────────────────────┐
│ Header: Logo/Wordmark         [EN | JA]     │  ← LanguageSwitcher
├────────────────────────────────────────────┤
│ Hero                                        │
│  - Headline / Subheadline / CTA 버튼        │
├────────────────────────────────────────────┤
│ How it works (4 steps, 가로/세로 배치)       │
├────────────────────────────────────────────┤
│ Categories (5 cards)                        │
├────────────────────────────────────────────┤
│ Why us (3 trust points)                     │
├────────────────────────────────────────────┤
│ Request Form (3-step)                       │
│  Step1 → Step2 → Step3 → SubmitStatus       │
├────────────────────────────────────────────┤
│ Footer: 소개 1문장 + 연락 이메일             │
└────────────────────────────────────────────┘
```

### 5.2 User Flow

```
/en or /ja 접속 → Hero CTA 클릭 → #request-form으로 스크롤
  → Step1 작성 → Next → Step2 작성 → Next → Step3 작성 → Submit
  → 성공: SubmitStatus(완료 화면) / 실패: 에러 + 재시도
언어 전환: Header의 [EN | JA] 클릭 → 동일 페이지의 다른 locale로 이동 (/ja ↔ /en)
```

### 5.3 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `LanguageSwitcher` | `components/LanguageSwitcher.tsx` | 현재 locale 표시 + `/en` ↔ `/ja` 전환 링크 |
| `Hero` | `components/Hero.tsx` | 헤드라인/서브헤드/CTA, CTA 클릭 시 `#request-form` 스크롤 + GA4 cta_click |
| `HowItWorks` | `components/HowItWorks.tsx` | 4단계 진행 방식 카드 |
| `Categories` | `components/Categories.tsx` | 5개 카테고리 카드 (이름 + 예시 키워드) |
| `WhyUs` | `components/WhyUs.tsx` | 신뢰 섹션 3포인트 |
| `RequestForm` | `components/RequestForm/RequestForm.tsx` | 3단계 폼 상태(`step`, `formData`, `status`) 관리, client component |
| `Step1` | `components/RequestForm/Step1.tsx` | 무엇을 찾는지 + 카테고리 select |
| `Step2` | `components/RequestForm/Step2.tsx` | 파트너유형/목적/설명/예산/일정/영어가능여부 |
| `Step3` | `components/RequestForm/Step3.tsx` | 회사명·웹사이트/연락처 + honeypot(hidden) |
| `SubmitStatus` | `components/RequestForm/SubmitStatus.tsx` | idle/loading/success/error 상태 UI |
| `Footer` | `components/Footer.tsx` | 소개 1문장 + 연락 이메일 |

### 5.4 Page UI Checklist

> 모든 텍스트는 `lib/i18n/{locale}.ts`에서 가져오며, en/ja 양쪽에 동일 키가 존재해야 한다.

#### Landing Page (`/en`, `/ja`) — Header

- [ ] LanguageSwitcher: `/en`(EN), `/ja`(JA) 두 개 링크, 현재 locale은 비활성/강조 표시

#### Hero

- [ ] Headline (8단어 이내, dictionary key: `hero.headline`)
- [ ] Subheadline (2문장, `hero.subheadline`)
- [ ] CTA 버튼 (`hero.ctaText`) — 클릭 시 `#request-form`으로 스크롤 + `trackEvent('cta_click', {location:'hero'})`

#### How it works

- [ ] 4단계 카드, 각 카드: 제목(3단어 이내) + 설명(1문장)
  - Step 1: Submit request
  - Step 2: We research
  - Step 3: You get shortlist
  - Step 4: We connect

#### Categories

- [ ] 5개 카테고리 카드, 각 카드: 이름 + 예시 키워드 3~4개
  - Education & EdTech
  - IT & AI
  - Content & Media
  - Beauty & Lifestyle
  - Business Services

#### Why us

- [ ] 3개 신뢰 포인트, 각 포인트: 제목 + 1~2문장 설명

#### Request Form — Step1 (`request-form.step1`)

- [ ] Textarea: "What are you looking for?" (`whatLookingFor`, required)
- [ ] Select: 카테고리 (`category`, 5개 옵션 — Education & EdTech / IT & AI / Content & Media / Beauty & Lifestyle / Business Services, required)
- [ ] Button: "Next" (Step1 필드 검증 통과 시 Step2로 이동)

#### Request Form — Step2 (`request-form.step2`)

- [ ] Select: 파트너 유형 (`partnerType`, 옵션: Purchase / Partnership / License / Other, required)
- [ ] Input: 목적 (`purpose`, required)
- [ ] Textarea: 상세 설명 (`description`, required)
- [ ] Select: 예산 범위 (`budget`, 옵션: Under $500 / $500–$1,500 / $1,500–$3,000 / Over $3,000 / Not sure, required)
- [ ] Select: 일정 (`timeline`, 옵션: ASAP / Within 1 month / 1–3 months / 3–6 months / Flexible, required)
- [ ] Select: 영어 가능 파트너 필요 여부 (`englishSpeaking`, 옵션: Required / Preferred / Not needed, required)
- [ ] Button: "Back" / "Next"

#### Request Form — Step3 (`request-form.step3`)

- [ ] Input: 회사명/웹사이트 (`companyNameWebsite`, required)
- [ ] Input: 연락처 (`contact`, required, 이메일 형식 검증)
- [ ] Hidden input: honeypot 필드 (이름은 일반적인 필드명으로 위장, 예: `website_url`, CSS로 숨김)
- [ ] Button: "Back" / "Submit"

#### Request Form — SubmitStatus

- [ ] Loading 상태: Submit 버튼 비활성화 + 스피너/텍스트
- [ ] Success 상태: 완료 메시지(`request-form.successMessage`) + 추가 CTA 없음
- [ ] Error 상태: 에러 메시지(`request-form.errorMessage`) + "Retry" 버튼

#### Footer

- [ ] 소개 1문장 (`footer.intro`)
- [ ] 연락 이메일 (`footer.contactEmail`)

---

## 6. Error Handling

### 6.1 Error Code Definition

| Code | Message | Cause | Handling |
|------|---------|-------|----------|
| FORM_VALIDATION | "Please fill in all required fields." / "Please enter a valid email." | Step별 필수 입력 누락 또는 이메일 형식 오류 | 해당 필드 하단에 인라인 에러 표시, 다음 Step 이동 차단 |
| SUBMIT_NETWORK_ERROR | "Something went wrong. Please try again." | `submitRequest` fetch 실패/타임아웃 | `SubmitStatus="error"` + Retry 버튼, 폼 데이터 유지 |
| SUBMIT_SPAM_IGNORED | (사용자에게 노출 안 함) | honeypot 필드가 채워짐 | Apps Script에서 무시, 클라이언트에는 success로 응답 |
| I18N_MISSING_KEY | (빌드 타임 에러) | `en.ts`/`ja.ts` 간 키 불일치 | 빌드 시 타입 에러로 차단 (양쪽 dictionary가 동일 인터페이스 구현) |

### 6.2 Error Response Format

```json
{
  "success": false,
  "message": "Validation failed: contact email is invalid"
}
```

> 클라이언트 검증은 Apps Script 호출 이전에 수행되므로, 위 형식은 Apps Script 자체 오류(예: Sheets 쓰기 실패)에 한정된다.

---

## 7. Security Considerations

- [ ] honeypot hidden 필드로 봇 스팸 1차 방어 (CSS `display:none`/`position:absolute; left:-9999px` 등으로 숨김, `tabindex="-1"`, `autocomplete="off"`)
- [ ] 클라이언트 입력 검증: 모든 필수 필드 + `contact` 이메일 형식 정규식 검증
- [ ] HTML 인젝션 방지: 폼 입력값을 DOM에 직접 렌더링하지 않음(React 기본 이스케이핑에 의존, `dangerouslySetInnerHTML` 사용 금지)
- [ ] HTTPS 강제: AWS Amplify Hosting 기본 HTTPS 사용
- [ ] Apps Script Web App은 "Execute as: Me / Who has access: Anyone"으로 배포하되, 코드 내에서 honeypot 외에 추가 신뢰 검증(Origin 헤더 체크 등)은 1차 범위에서는 생략 — Out of Scope로 Plan에 기록되지 않았으나 v2 검토 항목으로 메모
- [ ] 환경변수(`NEXT_PUBLIC_FORM_ENDPOINT`, `NEXT_PUBLIC_GA_ID`)는 클라이언트에 노출되는 값이므로 비밀정보(API Key 등)를 포함하지 않음 — Apps Script Web App URL 자체는 공개되어도 무방한 설계(인증 없이 Anyone 접근 전제)
- [ ] Rate Limiting: Apps Script 자체 quota(일일 실행 한도)에 의존, 별도 구현 없음 (1주차 트래픽 규모상 충분)

---

## 8. Test Plan

### 8.1 Test Scope

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| L1: Endpoint Test | Apps Script Web App `doPost` | curl | Do (배포 후) |
| L2: UI Action Tests | 섹션 렌더링, 폼 스텝 이동, 검증, 언어 전환 | Playwright | Do |
| L3: E2E Scenario Tests | 전체 제출 플로우, i18n 전환, 반응형 | Playwright | Do |

### 8.2 L1: Endpoint Test Scenarios

> Apps Script Web App 배포 후, 운영자 환경에서 수행. URL은 `NEXT_PUBLIC_FORM_ENDPOINT`.

| # | Endpoint | Method | Test Description | Expected Result |
|---|----------|--------|-----------------|-------------------|
| 1 | `{FORM_ENDPOINT}` | POST | 정상 페이로드 전송 | Sheets에 새 row 추가, 운영자 이메일 수신, 응답 `{success:true}` (또는 §4.2 낙관적 처리 시 요청 성공) |
| 2 | `{FORM_ENDPOINT}` | POST | `honeypot` 필드에 값 채워서 전송 | Sheets에 row 추가되지 않음, 이메일 발송 안 됨 |
| 3 | `{FORM_ENDPOINT}` | POST | 필수 필드 누락 페이로드 전송 | Sheets에 빈 값으로라도 기록되거나, Apps Script가 `{success:false}` 반환 (둘 중 Do 단계에서 확정한 정책 준수) |

### 8.3 L2: UI Action Test Scenarios

| # | Page | Action | Expected Result | Data Verification |
|---|------|--------|----------------|-------------------|
| 1 | `/en` | Load page | §5.4 Header~Footer 모든 요소 노출 | 텍스트가 `lib/i18n/en.ts` 값과 일치 |
| 2 | `/ja` | Load page | §5.4 모든 요소가 일본어로 노출 | 텍스트가 `lib/i18n/ja.ts` 값과 일치 |
| 3 | `/en` | Header `[JA]` 클릭 | `/ja`로 이동 | URL이 `/ja`로 변경 |
| 4 | `/en` | Hero CTA 클릭 | `#request-form`으로 스크롤 | RequestForm Step1이 뷰포트에 들어옴 |
| 5 | `/en#request-form` | Step1 비우고 "Next" 클릭 | 인라인 검증 에러 표시, Step2로 이동 안 함 | 에러 메시지 노출 |
| 6 | `/en#request-form` | Step1~3 모두 채우고 "Submit" | SubmitStatus가 loading → success로 전환 | Submit 버튼 비활성화 확인(중복 제출 방지) |
| 7 | `/en#request-form` | Step3 `contact`에 잘못된 이메일 입력 후 Submit | "Please enter a valid email." 에러 표시, 제출 차단 | - |

### 8.4 L3: E2E Scenario Test Scenarios

| # | Scenario | Steps | Success Criteria |
|---|----------|-------|-----------------|
| 1 | Guest 전체 플로우 (en) | `/en` 접속 → 전 섹션 스크롤 → CTA 클릭 → Step1~3 입력 → Submit | SubmitStatus="success" 화면 노출, GA4 `form_submit` 이벤트 발생 |
| 2 | i18n 전환 | `/en` → LanguageSwitcher로 `/ja` 이동 → 전 섹션 텍스트가 일본어 → Step1~3 입력(일본어 옵션) → Submit | `/ja` 페이지에서도 동일 플로우 정상 동작 |
| 3 | 검증/에러 처리 | Step1 빈 값으로 Next 시도 → Step2에서 잘못된 예산 미선택 → Step3에서 잘못된 이메일 | 각 단계에서 적절한 인라인 에러 노출, 최종 제출 전까지 진행 차단 |
| 4 | 반응형 | 375px / 768px / 1440px 뷰포트에서 `/en`, `/ja` 로드 | 모든 섹션이 가로 스크롤/요소 겹침 없이 렌더링 |
| 5 | 네트워크 오류 처리 | `submitRequest` 호출을 강제 실패시킨 상태에서 Submit | SubmitStatus="error" + Retry 버튼 노출, Retry 클릭 시 재시도 가능 |

### 8.5 Seed Data Requirements

> DB 없음. 대신 폼 제출 테스트용 샘플 페이로드를 정의한다.

| Locale | Sample Payload | Purpose |
|--------|-----------------|---------|
| en | §4.2 Request 예시 그대로 | L1#1, L2#6, L3#1 |
| ja | 동일 구조의 일본어 입력값 (`whatLookingFor`, `description`, `companyNameWebsite`, `contact` 등 일본어/로마자 혼용) | L3#2 |
| (spam) | en 샘플 + `honeypot: "http://spam.example"` | L1#2 |

---

## 9. Clean Architecture

> 정적 랜딩페이지 특성상 Domain/Application 계층은 최소화한다.

### 9.1 Layer Structure

| Layer | Responsibility | Location |
|-------|---------------|----------|
| **Presentation** | 섹션 컴포넌트, RequestForm 단계별 컴포넌트, layout/page | `components/`, `app/[locale]/` |
| **Application** | 폼 상태 관리(단일 컴포넌트 내 useState/useReducer로 충분, 별도 hooks 폴더 불필요) | `components/RequestForm/RequestForm.tsx` |
| **Domain** | 폼 데이터 타입, locale/카테고리 등 enum 타입 | `types/request-form.ts`, `lib/i18n/types.ts` |
| **Infrastructure** | i18n dictionary, GA4 헬퍼, Apps Script 호출 모듈 | `lib/i18n/`, `lib/analytics.ts`, `lib/forms/submitRequest.ts` |

### 9.2 Dependency Rules

```
┌─────────────────────────────────────────────────────────────┐
│                    Dependency Direction                      │
├─────────────────────────────────────────────────────────────┤
│   Presentation ──→ Domain                                    │
│   Presentation ──→ Infrastructure (lib/i18n, lib/analytics,  │
│                     lib/forms)                                │
│   Infrastructure ──→ Domain (타입만 참조)                     │
│                                                                │
│   Rule: Domain은 외부 의존성 없는 순수 타입만 포함            │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 File Import Rules

| From | Can Import | Cannot Import |
|------|-----------|---------------|
| Presentation (`components/`, `app/`) | Domain types, Infrastructure (`lib/`) | - |
| Infrastructure (`lib/`) | Domain types | Presentation |
| Domain (`types/`) | 없음 (순수 타입) | 모든 외부 레이어 |

### 9.4 This Feature's Layer Assignment

| Component | Layer | Location |
|-----------|-------|----------|
| `Hero`, `HowItWorks`, `Categories`, `WhyUs`, `Footer`, `LanguageSwitcher` | Presentation | `components/` |
| `RequestForm`, `Step1~3`, `SubmitStatus` | Presentation (+ 내부 Application 로직) | `components/RequestForm/` |
| `RequestFormData`, `RequestFormPayload`, `Locale`, `Category` 등 | Domain | `types/request-form.ts`, `lib/i18n/types.ts` |
| `lib/i18n/en.ts`, `lib/i18n/ja.ts`, `lib/i18n/dictionaries.ts` | Infrastructure | `lib/i18n/` |
| `lib/analytics.ts` | Infrastructure | `lib/analytics.ts` |
| `lib/forms/submitRequest.ts` | Infrastructure | `lib/forms/` |
| `apps-script/Code.gs` | Infrastructure (외부 서비스, 별도 배포) | `apps-script/` |

---

## 10. Coding Convention Reference

> 신규 프로젝트로 기존 컨벤션 없음 (Plan §9.1). 본 문서에서 최초 정의한다.

### 10.1 Naming Conventions

| Target | Rule | Example |
|--------|------|---------|
| Components | PascalCase | `RequestForm`, `LanguageSwitcher` |
| Functions | camelCase | `submitRequest()`, `trackEvent()` |
| Constants | UPPER_SNAKE_CASE | `FORM_ENDPOINT`, `MAX_DESCRIPTION_LENGTH` |
| Types/Interfaces | PascalCase | `RequestFormData`, `Locale` |
| Files (component) | PascalCase.tsx | `Hero.tsx`, `Step1.tsx` |
| Files (utility) | camelCase.ts | `submitRequest.ts`, `analytics.ts` |
| Folders | kebab-case | `request-form/` (단, 컴포넌트 그룹 폴더는 `RequestForm/`처럼 PascalCase 허용) |
| i18n dictionary key | camelCase, 섹션 prefix | `hero.headline`, `requestForm.step1.categoryLabel` |

### 10.2 Import Order

```typescript
// 1. External libraries (React, Next.js)
import { useState } from 'react'
import Link from 'next/link'

// 2. Internal absolute imports (@/)
import { Hero } from '@/components/Hero'
import { getDictionary } from '@/lib/i18n/dictionaries'

// 3. Relative imports
import { Step1 } from './Step1'

// 4. Type imports
import type { RequestFormData, Locale } from '@/types/request-form'

// 5. Styles
import './styles.css'
```

### 10.3 Environment Variables

| Prefix | Purpose | Scope | Example |
|--------|---------|-------|---------|
| `NEXT_PUBLIC_` | 클라이언트에서 접근 가능 | Browser | `NEXT_PUBLIC_FORM_ENDPOINT`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_SITE_URL` |

> **확정 정보**: 도메인 `https://findkoreanpartners.com` (`NEXT_PUBLIC_SITE_URL`, SEO canonical/OG URL에 사용), 운영자 연락 이메일 `jhc@ylia.io` (Footer 및 Apps Script `MailApp` 알림 수신 주소)

> 정적 export + 외부 서비스(Apps Script) 구조이므로 서버 전용 환경변수(`DB_*`, `AUTH_*`)는 사용하지 않는다.

### 10.4 This Feature's Conventions

| Item | Convention Applied |
|------|-------------------|
| Component naming | 섹션명 = 컴포넌트명 (Hero, Categories 등), PascalCase |
| File organization | Option C (섹션별 컴포넌트 + RequestForm 하위 폴더) |
| State management | RequestForm 내부 `useState`/`useReducer`만 사용, 전역 상태 관리 라이브러리 없음 |
| i18n | `lib/i18n/{locale}.ts`가 동일 인터페이스(`Dictionary`)를 구현, `getDictionary(locale)`로 조회 |
| Error handling | §6 Error Code Definition 기준, 폼 내부 인라인 표시 |

---

## 11. Implementation Guide

### 11.1 File Structure

```
fkp-landing-page/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx          # html lang, GA4 스크립트, LanguageSwitcher
│   │   └── page.tsx             # generateStaticParams(['en','ja']), 섹션 조립
│   └── globals.css
├── components/
│   ├── LanguageSwitcher.tsx
│   ├── Hero.tsx
│   ├── HowItWorks.tsx
│   ├── Categories.tsx
│   ├── WhyUs.tsx
│   ├── Footer.tsx
│   └── RequestForm/
│       ├── RequestForm.tsx
│       ├── Step1.tsx
│       ├── Step2.tsx
│       ├── Step3.tsx
│       └── SubmitStatus.tsx
├── lib/
│   ├── i18n/
│   │   ├── types.ts             # Dictionary 인터페이스, Locale/Category 등 타입
│   │   ├── en.ts
│   │   ├── ja.ts
│   │   └── dictionaries.ts      # getDictionary(locale)
│   ├── analytics.ts              # trackPageView, trackEvent
│   └── forms/
│       └── submitRequest.ts      # Apps Script Web App 호출
├── types/
│   └── request-form.ts           # RequestFormData, RequestFormPayload
├── apps-script/
│   └── Code.gs                   # doPost: honeypot 검사 + Sheets append + MailApp
├── public/
├── tailwind.config.ts            # Figma 디자인 토큰 반영 (Do 진입 전 토큰 확정 필요)
├── amplify.yml
└── next.config.ts                # output:'export', i18n 라우팅
```

### 11.2 Implementation Order

1. [ ] `lib/i18n/types.ts` + `types/request-form.ts` — 타입/Dictionary 인터페이스 정의
2. [ ] `lib/i18n/en.ts`, `lib/i18n/ja.ts`, `dictionaries.ts` — copy.md 기반 카피 작성 (en 확정 후 ja 번역)
3. [ ] `next.config.ts`, `app/[locale]/layout.tsx`, `app/[locale]/page.tsx` — 라우팅/메타데이터 골격
4. [ ] `tailwind.config.ts` — Figma 디자인 토큰 반영
5. [ ] 정적 섹션 컴포넌트: `Hero`, `HowItWorks`, `Categories`, `WhyUs`, `Footer`, `LanguageSwitcher`
6. [ ] `RequestForm` 및 `Step1~3`, `SubmitStatus` — 클라이언트 상태/검증
7. [ ] `lib/forms/submitRequest.ts` + `apps-script/Code.gs` — 제출 연동
8. [ ] `lib/analytics.ts` + 각 컴포넌트에 GA4 이벤트 호출 연결
9. [ ] `amplify.yml` + SEO/OG 메타태그
10. [ ] L2/L3 Playwright 테스트 작성 및 실행, 반응형/Lighthouse 점검

### 11.3 Session Guide

#### Module Map

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|-------------|:---------------:|
| Foundation & i18n | `module-1` | 타입 정의, en/ja dictionary, next.config, layout/page 골격, tailwind 토큰 | 30-40 |
| Static Sections | `module-2` | Hero/HowItWorks/Categories/WhyUs/Footer/LanguageSwitcher | 30-40 |
| Request Form | `module-3` | RequestForm + Step1~3 + SubmitStatus + 클라이언트 검증 | 40-50 |
| Integrations | `module-4` | submitRequest + Code.gs + GA4 analytics 연결 | 30-40 |
| Deploy & QA | `module-5` | amplify.yml, SEO/OG, Playwright L2/L3, Lighthouse, 반응형 검수 | 30-40 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 | Plan + Design | 전체 | 완료 |
| Session 2 | Do | `--scope module-1,module-2` | 60-80 |
| Session 3 | Do | `--scope module-3` | 40-50 |
| Session 4 | Do | `--scope module-4` | 30-40 |
| Session 5 | Do | `--scope module-5` | 30-40 |
| Session 6 | Check + Report | 전체 | 30-40 |

> **참고**: Do 진입 전, Figma MCP 세션에서 와이어프레임/하이파이 시안과 디자인 토큰을 먼저 확정하는 것을 권장한다 (Plan §2.3 Decision Rationale). 토큰이 확정되면 `tailwind.config.ts`(module-1)에 반영한다.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-06-11 | Initial draft (Option C selected) | ylia |
