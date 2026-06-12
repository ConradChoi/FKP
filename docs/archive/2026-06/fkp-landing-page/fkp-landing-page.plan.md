---
template: plan-plus
version: 1.0
description: Brainstorming-enhanced PDCA Plan template with User Intent, Alternatives, and YAGNI sections
variables:
  - feature: fkp-landing-page
  - date: 2026-06-11
  - author: ylia
  - project: Find Korean Partners (FKP)
  - version: 0.1.0
---

# fkp-landing-page Planning Document

> **Summary**: 해외 기업·기관이 한국 파트너(교육/IT/콘텐츠/뷰티/비즈니스)를 요청하면 한국 업체를 리서치·매칭해주는 FKP 서비스의 첫 영문/일문 랜딩페이지 + 3단계 접수폼
>
> **Project**: Find Korean Partners (FKP)
> **Version**: 0.1.0
> **Author**: ylia
> **Date**: 2026-06-11
> **Status**: Draft
> **Method**: Plan Plus (Brainstorming-Enhanced PDCA)

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | FKP는 아직 해외 잠재 고객이 "한국에서 찾는 파트너"를 접수할 채널이 없다. 신뢰감 있는 첫 접점이 없으면 리드도, 시장 수요 데이터도 쌓이지 않는다. |
| **Solution** | Next.js + Tailwind 기반 정적 1페이지 랜딩(en/ja)을 Figma MCP로 시안 설계 후 구현하고, 3단계 접수폼 제출 시 Google Sheets 기록 + 운영자 이메일 알림으로 즉시 리드를 확보한다. |
| **Function/UX Effect** | 방문자가 Hero~Footer를 스크롤하며 핵심 메시지를 이해하고, 부담 없는 3단계 폼으로 요청을 제출. GA4로 페이지뷰/CTA/제출 전환을 추적해 카테고리별 수요를 파악한다. |
| **Core Value** | "해외의 요청을 받고, 한국의 맞는 파트너를 찾아 연결합니다"라는 핵심 가치를 절제된 B2B 톤으로 전달하고, 1주차 안에 아웃리치에 사용할 수 있는 첫 리드 채널을 확보한다. |

---

## 1. User Intent Discovery

### 1.1 Core Problem

FKP는 처음부터 특정 상품을 파는 것이 아니라 "해외 수요를 먼저 접수받고 → 한국 파트너를 찾아 연결"하는 구조다. 이 구조가 작동하려면 신뢰할 수 있는 접수 채널(랜딩페이지 + 폼)이 먼저 필요하며, 접수 데이터 자체가 향후 카테고리/방향을 좁히는 시장조사 역할을 한다.

### 1.2 Target Users

| User Type | Usage Context | Key Need |
|-----------|---------------|----------|
| 일본·싱가포르·동남아·미국의 스타트업 창업자/사업개발 담당자 | 검색·소개·아웃리치를 통해 랜딩 도달, 한국 파트너(교육/IT/콘텐츠/뷰티/비즈니스) 탐색 중 | 자신의 요구사항을 빠르고 부담 없이 전달하고, 신뢰할 수 있는 한국 업체 매칭을 받고 싶음 |
| 일본어권 사용자 | `/ja` 경로로 접근 | 모국어로 서비스 내용을 이해하고 폼을 작성하고 싶음 |
| FKP 운영자(YLIA) | 폼 제출 후 이메일 알림 + Sheets 확인 | 새 리드를 즉시 인지하고 빠르게 후속 리서치를 시작하고 싶음 |

### 1.3 Success Criteria

- [ ] 모바일 우선 반응형 (375 / 768 / 1440px)에서 레이아웃 깨짐 없음
- [ ] 프로덕션 빌드 기준 페이지 로딩 3초 이내, Lighthouse Performance/Accessibility/SEO 90점 이상
- [ ] 3단계 폼 제출 시 Google Sheets에 정확한 열로 기록되고, 운영자 이메일 알림이 발송됨
- [ ] `/en`, `/ja` 양쪽 페이지가 정상 빌드·배포되고 카피가 100% 일치함
- [ ] GA4로 페이지뷰, CTA 클릭, 폼 제출 이벤트가 수집됨

### 1.4 Constraints

| Constraint | Details | Impact |
|------------|---------|--------|
| 외부 의존성 최소화 | UI 컴포넌트 라이브러리 금지, Tailwind CSS만 사용 | Medium |
| 정적 호스팅 | AWS Amplify Hosting, SSR 불필요 → `output: 'export'` | High |
| 범위 제한 | 블로그/로그인/DB 없음, 다국어는 en/ja 2개로 한정 (PM 프롬프트상 범위 확장 금지 원칙) | Medium |
| 1주차 일정 | 카피 → 디자인 → 개발 → QA 순서 고정, 디자인 디테일에 3일 이상 소요 금지 | High |
| Google Apps Script 의존 | Sheets/이메일 연동은 운영자 본인 Google 계정에서 배포해야 함 (코드는 개발 단계에서 제공) | Medium |

---

## 2. Alternatives Explored

### 2.1 Approach A: 카피 확정 → Tailwind 직접 구현 (Figma 생략)

| Aspect | Details |
|--------|---------|
| **Summary** | 카피 확정 후 디자인 토큰만 정의하고 바로 Next.js + Tailwind로 구현 |
| **Pros** | 세션/도구 전환 없이 이 세션에서 Plan→Design→Do 연속 진행, 가장 빠름 |
| **Cons** | 시안을 사전에 시각적으로 검토할 수 없음, 디자인 톤 합의가 코드 단계에서야 가능 |
| **Effort** | Low |
| **Best For** | 1인 운영, 디자인 디테일보다 속도가 중요한 초고속 MVP |

### 2.2 Approach B: Figma MCP 와이어프레임 → 하이파이 시안 → 코드 구현 — Selected

| Aspect | Details |
|--------|---------|
| **Summary** | fkp_ai팀.md의 5단계 역할(PM→카피→디자인→개발→QA) 흐름 그대로, Figma MCP로 와이어프레임/하이파이 시안과 디자인 토큰을 먼저 확정한 뒤 구현 |
| **Pros** | Stripe/Linear 톤의 절제된 B2B 디자인을 사전에 시각적으로 합의 가능, 디자인 토큰을 tailwind.config에 그대로 이관해 재작업 위험 감소, 역할별 산출물(copy.md, Figma 링크, 디자인 토큰)이 명확 |
| **Cons** | 와이어프레임/하이파이 단계가 추가되어 Approach A보다 시간 소요 |
| **Effort** | Medium |
| **Best For** | 디자인 품질을 사전에 확정하고 싶고, fkp_ai팀.md에 정의된 역할 분리를 활용하려는 경우 |

### 2.3 Decision Rationale

**Selected**: Approach B
**Reason**: fkp_ai팀.md에 디자이너 역할(Figma MCP, 와이어프레임→하이파이→디자인 토큰)과 프롬프트가 이미 구체적으로 준비되어 있어 추가 비용이 거의 없고, "Stripe/Linear 톤, 여백 많고 색 적은 B2B" 디자인은 코드만으로 바로 만들기보다 Figma에서 레이아웃·토큰을 먼저 확정하는 편이 재작업을 줄인다.

---

## 3. YAGNI Review

### 3.1 Included (v1 Must-Have)

- [ ] 6개 섹션: Hero / How it works / Categories / Why us / Request Form / Footer
- [ ] 3단계 접수폼(Step1~3, 총 10개 항목) + 클라이언트 검증(필수항목, 이메일 형식)
- [ ] Google Apps Script 연동: 폼 제출 → Sheets row append
- [ ] 폼 제출 시 운영자 이메일 알림 (Apps Script `MailApp.sendEmail`)
- [ ] honeypot 필드 기반 스팸 방지
- [ ] GA4 애널리틱스 실연동 (페이지뷰 + CTA 클릭 + 폼 제출 이벤트)
- [ ] en/ja 2개 언어 전체 페이지 번역 (`/en`, `/ja` 라우트)
- [ ] Figma 와이어프레임 → 하이파이 시안 + 디자인 토큰(색상/폰트/간격)
- [ ] SEO 메타태그(title/description) + OG 태그 (locale별)
- [ ] 반응형 375 / 768 / 1440px
- [ ] AWS Amplify 배포 설정 (`amplify.yml`, 정적 export)
- [ ] QA 체크리스트: Lighthouse 90+, 폼 4케이스 테스트(전 항목/필수만/잘못된 이메일/빈 제출), 영문·일문 검수

### 3.2 Deferred (v2+ Maybe)

| Feature | Reason for Deferral | Revisit When |
|---------|---------------------|--------------|
| en/ja 외 추가 언어(예: 중국어, 베트남어) | 현재 우선 타깃(일본·싱가포르·동남아·미국) 커버에는 en/ja로 충분 | 특정 언어권 문의 비중이 높아질 때 |
| 사용자 대시보드/로그인 | 접수형 컨설팅 단계에서는 불필요, PM 프롬프트상 명시적 범위 외 | 플랫폼화(매칭 자동화) 단계 진입 시 |
| 블로그/콘텐츠 섹션 | 1주차 목표("아웃리치에 쓸 수 있는 페이지")와 무관 | SEO 트래픽 확보 전략 수립 시 |
| AI 기반 자동 매칭/견적 | 현재는 수동 리서치 + 비교표 단계 | 문의 데이터가 충분히 쌓여 카테고리가 좁혀진 후 |

### 3.3 Removed (Won't Do)

| Feature | Reason for Removal |
|---------|-------------------|
| 가짜 고객 후기/로고 | "아직 레퍼런스 고객이 없으므로 가짜 후기·가짜 로고를 만들지 마라" (fkp_ai팀.md 카피라이터 원칙) |
| UI 컴포넌트 라이브러리(MUI 등) | "외부 의존성 최소화: UI 라이브러리 금지, Tailwind만 사용" (fkp_ai팀.md 개발자 요구사항) |
| 과장 표현("best", "world-class" 등) | 카피 원칙상 과장 금지, 신뢰감 있는 B2B 톤 유지 |

---

## 4. Scope

### 4.1 In Scope

- [ ] Hero / How it works / Categories / Why us / Request Form / Footer 6개 섹션 (en/ja)
- [ ] 3단계 RequestForm + 클라이언트 검증 + honeypot
- [ ] Google Apps Script: Sheets append + 운영자 이메일 알림
- [ ] GA4 페이지뷰/CTA/폼제출 이벤트 트래킹
- [ ] Figma MCP 와이어프레임 → 하이파이 시안 → 디자인 토큰
- [ ] SEO/OG 메타태그 (locale별)
- [ ] 반응형 375/768/1440px
- [ ] AWS Amplify 정적 배포(amplify.yml)
- [ ] QA 체크리스트 수행 (Lighthouse, 폼 4케이스, 영/일문 검수)

### 4.2 Out of Scope

- en/ja 외 추가 언어 — (from YAGNI Review, v2 후보)
- 사용자 대시보드/로그인/DB — (from YAGNI Review, 플랫폼화 단계)
- 블로그/콘텐츠 섹션 — (from YAGNI Review, SEO 전략 수립 후)
- AI 기반 자동 매칭/견적 — (from YAGNI Review, 데이터 축적 후)
- 가짜 후기/로고, UI 라이브러리, 과장 카피 — (Removed)

---

## 5. Requirements

### 5.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | Hero/HowItWorks/Categories/WhyUs/Footer 5개 정적 섹션을 en/ja로 렌더링 | High | Pending |
| FR-02 | RequestForm 3단계(Step1: 무엇을 찾는지+카테고리, Step2: 목적/예산/일정/영어가능여부, Step3: 회사명/웹사이트/연락처) 구현 및 클라이언트 검증 | High | Pending |
| FR-03 | 폼 제출 시 Apps Script Web App으로 POST → Sheets row append + 운영자 이메일 알림 | High | Pending |
| FR-04 | honeypot 필드를 통한 스팸 제출 필터링 | Medium | Pending |
| FR-05 | GA4 연동: 페이지뷰, CTA 클릭, 폼 제출 완료 이벤트 트래킹 | Medium | Pending |
| FR-06 | `/en`, `/ja` locale 라우팅 및 언어 전환 UI | High | Pending |
| FR-07 | locale별 SEO 메타태그(title/description) 및 OG 태그 | Medium | Pending |
| FR-08 | Figma 디자인 토큰(색상/폰트/간격)을 tailwind.config에 반영 | High | Pending |
| FR-09 | AWS Amplify 정적 배포 설정(`amplify.yml`, `output: 'export'`) | High | Pending |

### 5.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | 프로덕션 빌드 기준 로딩 3초 이내, Lighthouse Performance 90+ | Lighthouse (Chrome DevTools / CI) |
| Accessibility | Lighthouse Accessibility 90+ | Lighthouse |
| SEO | Lighthouse SEO 90+, OG 태그 소셜 미리보기 정상 | Lighthouse + OG 디버거 |
| Responsive | 375 / 768 / 1440px에서 레이아웃 깨짐 없음 | 수동 스크린샷 검수 |
| Security | honeypot 기반 스팸 방지, 클라이언트 입력 검증 | 폼 4케이스 테스트 |
| i18n 정확성 | en/ja 카피가 copy.md/번역본과 100% 일치 | 텍스트 대조 검수 |

---

## 6. Success Criteria

### 6.1 Definition of Done

- [ ] FR-01~FR-09 모두 구현 완료
- [ ] `next build` 경고/에러 0
- [ ] 폼 제출 4케이스(전체 입력/필수만/잘못된 이메일/빈 제출) 테스트 통과 및 Sheets/이메일 확인
- [ ] AWS Amplify 배포 완료 및 라이브 URL에서 체크리스트 재검증
- [ ] 코드 리뷰 완료(QA 체크리스트 기준)

### 6.2 Quality Criteria

- [ ] Lighthouse Performance/Accessibility/SEO 각 90점 이상 (en/ja 양쪽)
- [ ] Zero lint errors, `next build` 성공
- [ ] 카피(en/ja) 오타·문법 오류 0건

---

## 7. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| en/ja 동시 카피 작성으로 카피라이터 작업량 2배 → 1주차 일정 지연 | Medium | High | 카피 단계에서 en 확정 후 ja는 동일 구조로 번역(신규 카피 구상 X), A/B 버전 생략하고 단일안으로 진행 |
| Figma 디자인 단계가 디테일에 매몰되어 지연 | Medium | Medium | PM이 "아웃리치용 페이지" 기준으로 와이어프레임 단계에서 조기 승인, 하이파이 디테일 3일 제한 준수 |
| Google Apps Script 배포가 운영자 본인 계정에서 이뤄져야 해 개발-배포 간 핸드오프 지연 | Medium | Medium | Apps Script 코드(`Code.gs`)를 개발 초기에 먼저 작성·전달, 운영자가 병렬로 배포 진행 |
| GA4 측정 ID 미발급 상태로 개발 시작 | Low | High | `NEXT_PUBLIC_GA_ID` 환경변수 placeholder로 구현, 발급 후 연결만 하면 되도록 분리 |
| i18n 라우팅(App Router `[locale]`)을 외부 라이브러리 없이 구현하며 정적 export와 충돌 가능 | Medium | Low | `generateStaticParams`로 `/en`, `/ja` 사전 생성, 자체 dictionary 객체 사용으로 라이브러리 의존성 회피 |

---

## 8. Architecture Considerations

### 8.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure (`components/`, `lib/`, `types/`) | Static sites, portfolios, landing pages | ✅ |
| **Dynamic** | Feature-based modules, BaaS integration (bkend.ai) | Web apps with backend, SaaS MVPs, fullstack apps | |
| **Enterprise** | Strict layer separation, DI, microservices | High-traffic systems, complex architectures | |

> 백엔드는 Google Apps Script(외부 서비스)에 위임하므로, 프로젝트 자체는 정적 랜딩페이지(Starter) 구조로 충분하다.

### 8.2 Key Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| 디자인 워크플로우 | Figma 생략 / Figma 원안 / 하이브리드 | Figma MCP 원안 (Approach B) | 디자인 품질 사전 확정, fkp_ai팀.md 역할 분리 활용 |
| i18n 구현 방식 | next-intl 등 라이브러리 / App Router 자체 `[locale]` + dictionary | 자체 `[locale]` + dictionary | "UI 라이브러리 금지" 제약, 정적 export 호환 |
| 폼 알림 방식 | Sheets만 / Sheets + 이메일 | Sheets + 이메일(MailApp) | 운영자가 즉시 리드 확인 가능, 추가 비용 없음 |
| 애널리틱스 | 주석 자리만 / GA4 실연동 | GA4 실연동 | 1주차부터 트래픽/전환 데이터 확보 (수요 파악이 사업 핵심) |
| 다국어 범위 | 언어 전환 배너만 / 전체 번역 / 제외 | en + ja 전체 번역 (`/ja` 전체 번역) | 일본 타깃 비중을 고려해 전체 번역, en/ja 2개로 한정해 작업량 제어 |

### 8.3 Component Overview

```
fkp-landing-page/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx          # locale별 lang/메타데이터, GA4 스크립트
│   │   └── page.tsx             # 섹션 조립 (generateStaticParams: en, ja)
│   └── globals.css
├── components/
│   ├── Hero.tsx
│   ├── HowItWorks.tsx
│   ├── Categories.tsx
│   ├── WhyUs.tsx
│   ├── RequestForm/
│   │   ├── RequestForm.tsx      # 3-step 상태 관리 (client component)
│   │   ├── Step1.tsx            # 무엇을 찾는지 + 카테고리
│   │   ├── Step2.tsx            # 목적/예산/일정/영어가능여부
│   │   ├── Step3.tsx            # 회사명/웹사이트/연락처 + honeypot
│   │   └── SubmitStatus.tsx     # 제출중/성공/실패 상태 UI
│   └── Footer.tsx
├── lib/
│   ├── i18n/
│   │   ├── en.ts                # 영문 카피 (copy.md 기반)
│   │   ├── ja.ts                # 일본어 카피
│   │   └── dictionaries.ts      # locale → dictionary 매핑
│   └── analytics.ts              # gtag 이벤트 헬퍼
├── apps-script/
│   └── Code.gs                   # doPost: Sheets append + MailApp 알림
├── public/
├── tailwind.config.ts            # Figma 디자인 토큰 반영
├── amplify.yml
└── next.config.ts                # output: 'export', [locale] 라우팅
```

### 8.4 Data Flow

```
1) 방문
   사용자가 /en 또는 /ja 접속
   → layout.tsx에서 locale 감지, dictionary 로드
   → GA4 페이지뷰 이벤트

2) 탐색
   Hero → How it works → Categories → Why us 스크롤
   → CTA 버튼 클릭 시 RequestForm 섹션으로 스크롤 이동 (+ GA4 CTA 이벤트)

3) 폼 작성 (RequestForm, 3-step)
   Step1: 무엇을 찾는지 + 카테고리 → Step2: 목적/예산/일정/영어가능여부
   → Step3: 회사명/웹사이트/연락처 + honeypot(hidden)
   → 각 스텝 클라이언트 검증(필수항목, 이메일 형식) 통과 시에만 다음 스텝 노출

4) 제출
   Step3 "Submit" → 버튼 비활성화(중복 제출 방지) + "제출 중" 상태
   → fetch POST → Apps Script Web App URL (NEXT_PUBLIC_FORM_ENDPOINT)
   → Apps Script(doPost):
       a. honeypot 값 확인 → 채워져 있으면 무시(스팸)
       b. Sheets에 타임스탬프 + 10개 항목 + locale row append
       c. MailApp.sendEmail()로 운영자 알림 메일 발송
   → 성공: SubmitStatus "완료" 화면 + GA4 폼제출 이벤트
   → 실패: 에러 메시지 + 재시도 버튼, 버튼 재활성화

5) 배포
   next build (output: export) → AWS Amplify Hosting
   /en, /ja 양쪽 정적 페이지 빌드(generateStaticParams)
```

---

## 9. Convention Prerequisites

### 9.1 Applicable Conventions

- [ ] 신규 프로젝트로 기존 컨벤션 없음 — `/pdca design fkp-landing-page` 단계에서 네이밍/폴더 구조 컨벤션을 수립한다
- [ ] 카피 키 네이밍 규칙(en.ts/ja.ts 구조) 정의 필요
- [ ] Tailwind 디자인 토큰 네이밍은 Figma 토큰명을 그대로 따른다

---

## 10. Next Steps

1. [ ] Write design document (`/pdca design fkp-landing-page`)
2. [ ] 카피라이터 단계: copy.md (en) 작성 → ja 번역
3. [ ] Figma MCP 세션에서 와이어프레임 → 하이파이 시안 + 디자인 토큰 산출
4. [ ] Start implementation (`/pdca do fkp-landing-page`)
5. [ ] QA/배포 단계 진행

---

## Appendix: Brainstorming Log

> Key decisions from Plan Plus Phases 1-4.

| Phase | Question | Answer | Decision |
|-------|----------|--------|----------|
| Intent (Q1) | 이번 Plan 문서에서 다룰 범위(feature)는? | FKP 랜딩페이지 전체 (1주차 목표) | feature명 `fkp-landing-page`로 확정 |
| Alternatives | 디자인·개발 진행 방식 | Figma MCP 원안 그대로 | Approach B 선택 (와이어프레임→하이파이→코드) |
| YAGNI | 추가 기능(이메일 알림/GA4/일본어 페이지) 포함 여부 | 모두 포함 | v1 Must-Have에 추가, 일정 영향(Risks 7) 명시 |
| YAGNI (후속) | 일본어 페이지 범위 | 전체 페이지 일본어 번역 (`/ja`) | i18n 라우팅(`[locale]` + dictionary) 구조 추가 |
| Design Validation | Architecture/컴포넌트 구조/데이터 흐름 | 모두 적절함으로 승인 | 8.2~8.4에 그대로 반영 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-06-11 | Initial draft (Plan Plus) | ylia |
