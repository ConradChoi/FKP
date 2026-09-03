---
template: ui-screen-spec
version: 1.0
feature: seepn-unified-platform-v1.0
phase: Admin UI 전면 재구성 — seepn_2.0 Figma 디자인 시스템 도입
description: Figma "Seepn 2.0 — UI Design"(IEnOaPxIdGMKoIZ1rMWv06)에서 추출한 디자인 토큰/컴포넌트/화면 코드를 FKP 기존 tailwind.config.ts·Admin 코드베이스와 대조해 최종 채택 토큰, tailwind.config.ts 변경안, Admin Shell(사이드바+상단바) 재구성 스펙, 공용 컴포넌트 스펙, 화면별 재구성 우선순위, CategoryTree 컴포넌트 스펙을 확정한다.
variables:
  - feature: seepn-unified-platform-v1.0
  - date: 2026-08-29
  - author: ui-ux-designer
  - project: SEEPN Unified Platform (FKP + SEEPN) — Admin
  - version: 1.0.0
  - status: Draft (Open Questions 답변 대기 — §7)
---

# SEEPN Admin UI 디자인 시스템 도입 스펙

| 항목 | 내용 |
|------|------|
| 문서 종류 | UI Screen Spec / Design System Spec (PDCA Design phase) |
| 작성자 | ui-ux-designer |
| 작성일 | 2026-08-29 |
| 상태 | Draft — §7 Open Questions 확인 후 Final 전환 |
| 입력 문서 | [seepn-unified-platform-v1.0.prd.md](../../01-plan/features/seepn-unified-platform-v1.0.prd.md) §3.3 (Admin 기능), §3.3.3(A1-R1~R13), §3.3.4(A2-R1~R8), Figma "Seepn 2.0 — UI Design"(IEnOaPxIdGMKoIZ1rMWv06) — 프롬프트로 전달된 Design Tokens + 실측 화면 코드 |
| 후속 담당 | ux-writer(사이드바 문구/상태 라벨 확인) → backend-developer(menu 시드 데이터·CategoryTree API 계약) → frontend-developer(구현) → qa-reviewer |
| 디자인 툴 | Figma 원본 링크는 있으나 본 세션은 접근 권한 없음 — 요청자가 MCP로 조회해 전달한 토큰/코드를 1차 사료로 사용. 코드 구현은 본 문서 범위 밖 |

### Pipeline References

| Phase | Document | Status |
|-------|----------|--------|
| Plan | [seepn-unified-platform-v1.0.prd.md](../../01-plan/features/seepn-unified-platform-v1.0.prd.md) | ✅ Draft (대표 승인 대기, OQ-1~4 확정 완료) |
| Design (본 문서) | Admin UI 디자인 시스템 도입 스펙 | 🟡 Draft |
| Design (화면 흐름) | service-planner의 공급사관리/카테고리관리 화면 흐름 스펙 (SP-1~SP-10) | ❌ 미착수 — 본 문서와 병행 가능, 단 §5 우선순위는 그 결과에 따라 조정될 수 있음 |
| Code | backend-developer(API/menu 시드) → frontend-developer(구현) | ❌ 미착수 |

---

## 0. 이 문서의 전제와 범위

- **In**: 디자인 토큰 채택안, `tailwind.config.ts` 변경안(diff), Admin Shell(사이드바/상단바) 재구성 스펙, 공용 컴포넌트(Badge/Button/Table/Progress) 스펙, 기존+신규 Admin 화면 전체의 재구성 우선순위, CategoryTree 컴포넌트 UI 패턴.
- **Out**: 실제 `.tsx` 파일 수정(후속 frontend-developer), 공급사 관리·카테고리 관리 화면의 상세 필드/엣지케이스 정의(service-planner SP-1~SP-10 소관), API 계약(backend-developer 소관), 카피 확정(ux-writer 소관).
- **전제**: PRD D-5 "신규 Admin 기능은 기존 FKP 메뉴관리(동적 메뉴 트리 + RBAC) 위에 추가", CLAUDE.md 하드코딩 금지 원칙(v0.2 INV-2)을 그대로 유지한다. 이 문서는 **시각 스타일(색/타이포/레이아웃)만** 재정의하며, `public.menu` / `role_menu_permission` 기반 동적 렌더링 로직은 건드리지 않는다.
- **읽은 코드베이스**: `tailwind.config.ts`, `app/admin/layout.tsx`, `app/admin/(protected)/layout.tsx`, `AdminSidebar.tsx`, `NotificationBell.tsx`, `page.tsx`(대시보드), `leads/page.tsx`, `leads/[id]/page.tsx`, `permissions/menus/page.tsx`, `MenuRowEditor.tsx`, `content/page.tsx`, `content/CategoryRow.tsx`, `lib/admin/labels.ts`, `lib/admin/translationStatus.ts`, `components/RequestForm/styles.ts`, `app/[locale]/layout.tsx`, `app/globals.css`. 스크린샷(`figma-seepn-admin/dashboard.png`, 12화면 그리드)도 확인함.

---

## 1. 디자인 토큰 매핑표

### 1.1 Primary — 변경 없음

Figma Primary Blue(50~900)는 FKP `tailwind.config.ts`의 기존 `primary`와 **10단계 전부 hex 1:1 일치**. 조치 없음.

### 1.2 Neutral — **FKP 기존 `neutral`(Slate) 유지, Figma Gray로 교체하지 않는다 (결론)**

| Step | FKP `neutral` (기존) | Figma `Neutral Gray` | ΔE(육안 체감) |
|---|---|---|---|
| 50 | #F8FAFC | #F9FAFB | 거의 무차이 |
| 100 | #F1F5F9 | #F3F4F6 | 거의 무차이 |
| 200 | #E2E8F0 | #E5E7EB | 거의 무차이 |
| 300 | #CBD5E1 | #D1D5DB | 미세 |
| 400 | #94A3B8 | #9CA3AF | 미세 |
| 500 | #64748B | #6B7280 | 미세 |
| 600 | #475569 | #4B5563 | 미세 |
| 700 | #334155 | #374151 | 미세 |
| 800 | #1E293B | #1F2937 | 거의 무차이 |
| 900 | #0F172A | #111827 | 거의 무차이 |

**결론(채택안): 새 `gray` 토큰을 별도로 추가하지 않는다. 기존 `neutral`(Tailwind slate 계열)을 Admin·User 공통으로 계속 사용한다.**

**이유**:
1. `tailwind.config.ts`는 `app/[locale]/**`(User)와 `app/admin/**`(Admin)이 **하나의 파일을 공유**한다. Admin이 자체 root layout(`app/admin/layout.tsx`)을 갖고 있어 폰트 로딩은 레이아웃별로 분리할 수 있지만(§2.3), **색상 토큰은 정적 컴파일되는 단일 Tailwind 설정이라 라우트별로 다른 값을 줄 수 없다.** `neutral`을 Figma 값으로 바꾸면 `Header.tsx`, `components/RequestForm/styles.ts`, `Categories.tsx` 등 **User-facing 전체가 함께 바뀐다** — 이번 요청 범위(Admin UI 재구성)를 벗어난다.
2. 10단계 전부 ΔE가 육안 식별이 어려운 수준(같은 "cool gray" 계열, Slate vs Gray)이다. 굳이 두 번째 회색 스케일(`neutral` + `gray`)을 병존시키면 "이 화면엔 어떤 토큰을 써야 하나"라는 판단 비용만 늘고, 실제로 얻는 시각적 이득은 거의 없다.
3. **결정적 근거**: Figma 실측 화면 코드의 사이드바 배경 `#0F172A`는 FKP 기존 `neutral-900`과 **완전히 동일한 hex**다. Figma 디자이너도 사실상 이 계열의 값을 그대로 쓰고 있었다는 정황 증거로 본다.
4. 대안(라우트 스코프 CSS 변수로 Admin만 다른 회색을 쓰게 하는 방법)은 기술적으로 가능하지만(§7 OQ-1), `tailwind.config.ts`를 hex 리터럴에서 CSS 변수 참조로 전면 재작성해야 하는 큰 리팩터링이며, 위 1~3의 효과 대비 비용이 맞지 않는다.

→ **Admin 신규/재구성 화면은 계속 `neutral-*` 클래스를 그대로 쓴다.** Figma 문서의 "Neutral Gray" 언급은 앞으로 "이미 충족된 것"으로 간주하고 별도 작업하지 않는다.

### 1.3 Secondary(Emerald) — 신규 채택

FKP에 대응 토큰 없음. `secondary` 이름으로 10단계 그대로 추가(§2.1).

### 1.4 Semantic — 대부분 기존 토큰과 병합 가능

| Figma 시맨틱 | hex | FKP 기존 대응 | 조치 |
|---|---|---|---|
| Success | #16A34A | `success: '#16A34A'` **완전 일치** | 값 변경 없음. `-bg` 보조값만 추가 |
| Success BG | #DCFCE7 | 없음 | `success` 확장(§2.1) |
| Warning | #D97706 | `accent.600: '#D97706'` **완전 일치** | 신규 `warning` 토큰 만들지 않고 **`accent`를 Warning 역할로 채택**(§2.1) |
| Warning BG | #FEF3C7 | 없음 | `accent.100`으로 추가 |
| Error | #DC2626 | `error: '#DC2626'` **완전 일치** | 값 변경 없음. `-bg` 보조값만 추가 |
| Error BG | #FEE2E2 | 없음 | `error` 확장(§2.1) |
| Info | #2563EB | `primary.600: '#2563EB'` **완전 일치** | 신규 토큰 불필요. **`primary-600`을 Info 역할로 그대로 사용** |
| Info BG | #DBEAFE | `primary.100: '#DBEAFE'` **완전 일치** | 신규 토큰 불필요 |

→ Figma의 4개 시맨틱 색 중 **Warning·Info는 이미 FKP에 정확히 같은 hex로 존재**한다(각각 `accent-600`, `primary-600`/`primary-100`). 새 이름을 또 만들면 같은 색이 두 이름(`warning` vs `accent`, `info` vs `primary-600`)으로 중복 존재하게 되므로, **기존 이름을 그대로 의미상 재활용**하고 부족한 BG 틴트만 보강한다.

### 1.5 사이드바 전용 색상 — 6개 중 5개가 이미 FKP에 존재

| Figma 실측값 | 용도 | FKP 기존 동일 토큰 |
|---|---|---|
| #0F172A | 사이드바 배경 | `neutral-900` (완전 일치) |
| #0A1022 | 로고/유저푸터 배경 | **없음 — 유일한 신규 값** |
| #1E3A8A | 활성 메뉴 배경 | `primary-900` (완전 일치) |
| #3B82F6 | 활성 메뉴 좌측 액센트바 | `primary-500` (완전 일치) |
| #93C5FD | 활성 메뉴 아이콘 | `primary-300` (완전 일치) |
| #94A3B8 | 비활성 메뉴 텍스트 | `neutral-400` (완전 일치) |
| #64748B | 섹션 라벨 텍스트 | `neutral-500` (완전 일치) |
| #334155 | 비활성 아이콘 | `neutral-700` (완전 일치) |

→ **신규 hex 값은 `#0A1022` 단 하나뿐이다.** 나머지는 전부 기존 `primary`/`neutral` 스케일 재참조. 그래도 `bg-neutral-900`/`bg-primary-900` 같은 클래스가 "사이드바"라는 의도를 코드에서 바로 읽히지 않으므로, 가독성을 위해 **의미론적 별칭(semantic alias) `sidebar.*`를 추가**하되 값은 중복 정의하지 않고 기존 스케일을 그대로 참조한다(§2.1).

### 1.6 Typography — 이름 충돌 다수. **레거시 스케일 유지 + `admin-*` 신규 스케일 병행**

Figma 스케일과 FKP 기존 `fontSize`를 항목별로 대조한 결과, 사이즈가 완전히 같은 항목도 있고(별칭 처리 가능), 완전히 새 사이즈도 있고(추가 필요), **같은 폰트사이즈(14px, 12px)인데 줄간격/의미가 다른 항목도 있어 이름을 그대로 재사용하면 충돌**한다.

| Figma 토큰 | size/lh/weight | FKP 기존 대응 | 판정 |
|---|---|---|---|
| Display 1 (Hero) | 48/56/700 | `display-hero` 48/56/700 | **완전 일치** — 별칭 |
| Display 2 (섹션헤더) | 36/44/700 | `h1` 36/44/700 | **완전 일치** — 별칭 |
| Display 3 (페이지타이틀) | 30/38/700 | 없음 (h1=36 다음이 h2=28) | **신규 필요** |
| Heading 1 (카드타이틀·모달헤더) | 24/32/600 | 없음 | **신규 필요** |
| Heading 2 (서브섹션) | 20/28/600 | `h3` 20/28/600 | **완전 일치** — 별칭 |
| Heading 3 (리스트헤더) | 18/26/600 | 없음 | **신규 필요** |
| Body Large | 16/24 | `body` 16/24 | **완전 일치** — 별칭 |
| Body | 14/22 | `body-sm` 14/**20** | **크기 같고 줄간격만 다름 — 이름 재사용 시 충돌** |
| Body Small | 12/18 | 없음 | **신규 필요** (FKP `label-caption` 12/16과 다름, 혼동 주의) |
| Label (버튼·태그) | 14/20/600 | 없음 (FKP `label-button`은 16/24/600, 사이즈 다름) | **신규 필요** |
| Label SM (작은버튼·배지) | 12/16 | `label-caption` 12/16 | **완전 일치** — 별칭 |
| Code | 13/20, mono | 없음 | **신규 필요** |

**채택안**: 기존 `h1`/`h3`/`body`/`display-hero`/`label-caption`은 **건드리지 않는다**(User-facing이 이미 이 이름들을 광범위하게 쓰고 있고, 값도 정확히 일치하므로 굳이 바꿀 이유가 없다). 대신 **`admin-*` 접두어로 완전히 새로운 스케일 12종을 추가**하고, 새로 짓는 Admin 화면은 전부 이 `admin-*` 스케일만 참조한다.

**왜 `body-sm`을 14/22로 값만 바꾸지 않는가**: `body-sm`은 이미 `leads/page.tsx`, `content/CategoryRow.tsx`, `permissions/menus/*` 등 기존 Admin 화면 전역과 User-facing 일부에서 14/20으로 쓰이고 있다. 줄간격을 20→22로 슬쩍 바꾸면 기존 화면 전체의 표 행 높이가 미세하게 밀리는 회귀가 전면 재검증 없이 발생한다. **이름을 공유하지 않고 `admin-body`(14/22)를 별도로 추가**하는 편이 안전하다.

**왜 `label-button`(16/24)을 Figma `Label`(14/20)로 바꾸지 않는가**: `label-button`은 User-facing 요청폼의 큰 CTA 버튼(`primaryButtonClass`)용으로, 마케팅 히어로 버튼에 맞는 크기다. Admin의 조밀한 버튼은 더 작은 14px가 맞다 — **역할이 다르므로 병합하지 않고 별도 이름(`admin-label`)을 쓴다.**

---

## 2. `tailwind.config.ts` 변경안 (diff, 파일 미수정 — 제안만)

```diff
 const config: Config = {
   content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
   theme: {
     extend: {
       colors: {
         primary: { /* 변경 없음 */ },
         neutral: { /* 변경 없음 — §1.2 결론 참조 */ },
         accent: {
           500: '#F59E0B',
           600: '#D97706',
+          // Figma "Warning" 시맨틱 색과 완전 일치(#D97706). 새 warning 토큰을 만들지 않고
+          // accent를 Warning 역할로 채택한다(§1.4). 100은 Figma "Warning BG".
+          100: '#FEF3C7',
         },
-        success: '#16A34A',
-        error: '#DC2626',
+        // 문자열 → 스케일 객체로 확장. `success`/`text-success`/`bg-success`는 DEFAULT로
+        // 계속 동작(하위호환), `bg-success-100`이 새로 가능해진다(Figma Success BG).
+        success: { DEFAULT: '#16A34A', 100: '#DCFCE7' },
+        error: { DEFAULT: '#DC2626', 100: '#FEE2E2' },
+        // Figma "Info"(#2563EB)/"Info BG"(#DBEAFE)는 primary-600/primary-100과 완전 일치
+        // (§1.4) — 신규 토큰 없음. Admin 컴포넌트에서 Info 역할이 필요하면 primary-600/
+        // primary-100을 그대로 쓴다.
+        secondary: {
+          // Figma "Secondary — Emerald" 그대로 10단계 신규 추가. FKP에 대응 토큰 없음(§1.3).
+          50: '#ECFDF5', 100: '#D1FAE5', 200: '#A7F3D0', 300: '#6EE7B7', 400: '#34D399',
+          500: '#10B981', 600: '#059669', 700: '#047857', 800: '#065F46', 900: '#064E3B',
+        },
+        sidebar: {
+          // 값 대부분은 기존 primary/neutral 재참조(§1.5) — 새 hex를 만들지 않고 "이건
+          // 사이드바 용도다"라는 의도만 이름으로 드러낸다. bg-sidebar-footer(#0A1022)만
+          // 유일한 신규 hex.
+          DEFAULT: '#0F172A',      // = neutral.900, 사이드바 본체 배경
+          footer: '#0A1022',       // 신규 — 로고 영역 + 하단 유저 정보 영역 배경
+          active: '#1E3A8A',       // = primary.900, 활성 메뉴 배경
+          accentBar: '#3B82F6',    // = primary.500, 활성 메뉴 좌측 3px 바
+          activeIcon: '#93C5FD',   // = primary.300, 활성 메뉴 아이콘
+          textInactive: '#94A3B8',  // = neutral.400
+          textSection: '#64748B',   // = neutral.500, 그룹 라벨
+          iconInactive: '#334155',  // = neutral.700
+        },
       },
       fontFamily: {
-        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
+        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'], // 변경 없음(User 전용 유지)
+        // Admin 전용. app/admin/layout.tsx에서만 --font-pretendard를 주입하므로(§2.3)
+        // User 사이트에는 영향 없음. Inter를 우선 적용하고(라틴/숫자), 브라우저가 Inter에
+        // 없는 한글 글리프만 자동으로 Pretendard로 폴백한다(순서상 Pretendard를 앞에 두지
+        // 않는 이유 — Figma 스펙: "Primary Font Inter, 한글 보조 폰트 Pretendard").
+        'admin-sans': [
+          'var(--font-inter)',
+          'var(--font-pretendard)',
+          'Pretendard Variable',
+          'Pretendard',
+          'Noto Sans KR',
+          'sans-serif',
+        ],
       },
       fontSize: {
         'display-hero': [ /* 변경 없음 */ ],
         h1: [ /* 변경 없음 */ ],
         h2: [ /* 변경 없음 */ ],
         h3: [ /* 변경 없음 */ ],
         'body-lg': [ /* 변경 없음 */ ],
         body: [ /* 변경 없음 */ ],
         'body-sm': [ /* 변경 없음 — §1.6 이유로 값 유지 */ ],
         'label-button': [ /* 변경 없음 */ ],
         'label-caption': [ /* 변경 없음 */ ],
+
+        // ── Admin 전용 신규 스케일 (seepn_2.0) — §1.6. 값이 겹치는 항목도 기존 이름을
+        // 별칭하지 않고 전부 새 이름으로 통일해, Admin 화면을 만들 때 "이 스케일만 보면
+        // 된다"는 단일 참조를 만든다.
+        'admin-display-1': ['48px', { lineHeight: '56px', fontWeight: '700' }], // = display-hero
+        'admin-display-2': ['36px', { lineHeight: '44px', fontWeight: '700' }], // = h1
+        'admin-display-3': ['30px', { lineHeight: '38px', fontWeight: '700' }], // 신규
+        'admin-heading-1': ['24px', { lineHeight: '32px', fontWeight: '600' }], // 신규(카드타이틀·모달헤더)
+        'admin-heading-2': ['20px', { lineHeight: '28px', fontWeight: '600' }], // = h3(상단바 페이지타이틀)
+        'admin-heading-3': ['18px', { lineHeight: '26px', fontWeight: '600' }], // 신규(리스트헤더)
+        'admin-body-lg':   ['16px', { lineHeight: '24px' }],                    // = body
+        'admin-body':      ['14px', { lineHeight: '22px' }],                    // 신규(body-sm과 lh 다름)
+        'admin-body-sm':   ['12px', { lineHeight: '18px' }],                    // 신규
+        'admin-label':     ['14px', { lineHeight: '20px', fontWeight: '600' }], // 신규(버튼·태그)
+        'admin-label-sm':  ['12px', { lineHeight: '16px', fontWeight: '600' }], // ≈ label-caption(weight만 600 추가)
+        'admin-code':      ['13px', { lineHeight: '20px' }],                    // 신규, font-mono와 함께 사용
       },
       borderRadius: {
         input: '8px', // 변경 없음 — Figma "md"(Button/Card) 값과 일치, Admin Button/Card에 재사용
         card: '12px', // 변경 없음 — Figma "lg"(Modal/Panel) 값과 일치, Admin Modal/Panel에 재사용
+        sm: '4px',   // 신규 — Figma "sm"(Input/Badge). Status Badge, Admin 소형 Input에 사용
+        xl: '16px',  // 신규 — Figma "xl"(Sheet). Drawer/Sheet류 컴포넌트용
+        // 'full'은 Tailwind 코어에 이미 존재(rounded-full) — 추가 불필요
       },
       spacing: { /* 변경 없음 — Figma 4/8/12/16/20/24/32/40/48/64px는 이미 Tailwind 기본 스케일과 사실상 동일 */ },
     },
   },
   plugins: [],
 }
```

### 2.1 정리 — 실제로 "새로 생기는" hex 값은 몇 개뿐이다

색상 중 진짜 신규 hex는 `#0A1022`(sidebar footer), `secondary` 10단계, `accent.100`/`success.100`/`error.100`(BG 틴트 3개)뿐이다. 나머지(`sidebar.*`의 6개 항목, Warning/Info)는 전부 기존 스케일 재참조다. **이 사실 자체가 "Figma 디자인이 FKP 토큰과 별개가 아니라 사실상 같은 뿌리 위에 있다"는 근거이며, 마이그레이션 리스크가 처음 우려보다 훨씬 작다는 뜻이다.**

### 2.2 Pretendard 로딩 — Admin 전용, User 사이트 영향 없음

`app/admin/layout.tsx`는 이미 `app/[locale]/layout.tsx`와 **완전히 독립된 root layout**(각자 `<html>`/`<body>`를 가짐, Next.js가 disjoint top-level 세그먼트에 대해 지원하는 다중 root layout 패턴)이다. 따라서 폰트 로딩은 파일 단위로 자연스럽게 분리된다 — 색상 토큰(§1.2)과 달리 **별도 리스크 판단이 필요 없다.**

```diff
 // app/admin/layout.tsx
 import type { Metadata } from 'next'
 import { Inter } from 'next/font/google'
+import localFont from 'next/font/local'
 import '../globals.css'

 const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
+// public/fonts/PretendardVariable.woff2 — 가변폰트 1개 파일로 전 weight 커버.
+// (자산 다운로드/저장은 frontend-developer 작업. 공식 배포: github.com/orioncactus/pretendard)
+const pretendard = localFont({
+  src: '../../public/fonts/PretendardVariable.woff2',
+  variable: '--font-pretendard',
+  display: 'swap',
+  weight: '45 920', // variable font weight range
+})

 export default function AdminLayout({ children }: { children: React.ReactNode }) {
   return (
-    <html lang="ko" className={inter.variable}>
-      <body className="font-sans">{children}</body>
+    <html lang="ko" className={`${inter.variable} ${pretendard.variable}`}>
+      <body className="font-admin-sans">{children}</body>
     </html>
   )
 }
```

**주의**: `body`의 `font-sans` → `font-admin-sans` 전환은 Admin 전체 텍스트 렌더링에 영향을 준다. 기존 Admin 화면(리드관리 등)이 재구성되기 전이라도 이 변경 하나만으로 한글 폰트가 Pretendard로 즉시 바뀐다 — 이는 의도된 동작이다(§5의 우선순위와 무관하게 폰트만은 즉시 전체 적용 가능. 리스크가 낮고 시각적 이득이 즉각적이므로 Admin Shell 작업(§3)과 같은 PR에서 처리 권장).

---

## 3. Admin Shell 재구성 스펙

### 3.1 핵심 원칙 — 데이터 로직 100% 유지, className만 교체

`app/admin/(protected)/layout.tsx`의 `buildMenuTree(menuRows)` → `AdminSidebar` prop 전달 구조, `AdminSidebar.tsx`의 `NavItem` 재귀 렌더링(`isGroup`/`isActive` 판정, `usePathname()` 비교)은 **한 줄도 바꾸지 않는다.** 바뀌는 것은 각 분기의 `className` 문자열뿐이다. 이는 곧 이 스펙이 **CSS/마크업 레이어의 순수 리스킨**이며, DB 기반 메뉴 트리(v0.2 INV-2)를 전혀 건드리지 않는다는 뜻이다.

### 3.2 AdminSidebar.tsx — 재구성 후 구조

```tsx
// 폭 240px(w-60), 다크 배경. 기존 224px(w-56)에서 폭 변경 — Figma 실측값 그대로.
<nav className="flex w-60 shrink-0 flex-col bg-sidebar">
  {/* 로고 영역 — 높이 64px, 배경 #0A1022. 기존 "FKP Admin" 단일 텍스트를
      2줄 워드마크로 교체 (그대로 유지 여부는 §7 OQ-3) */}
  <div className="flex h-16 flex-col justify-center bg-sidebar-footer px-4">
    <p className="admin-heading-3 text-white">FKP Admin</p>
    <p className="admin-body-sm text-sidebar-textInactive">Seepn Platform</p>
  </div>

  {/* 메뉴 트리 — 기존 menuTree.map(...) 구조 그대로, 스크롤 가능 영역만 분리 */}
  <div className="flex-1 overflow-y-auto px-3 py-4">
    {menuTree.map((node) => (
      <NavItem key={node.id} node={node} depth={1} />
    ))}
  </div>

  {/* 유저 푸터 — 배경 #0A1022. 기존에는 존재하지 않던 영역(현재는 상단바에 표시 중) —
      §3.3에서 상단바 쪽 표시와 중복이 생기므로 배치를 최종 결정해야 함(§7 OQ-4) */}
  <div className="flex items-center gap-2 bg-sidebar-footer px-4 py-3">
    <Avatar size="sm" initials={initialsOf(displayName)} />
    <div className="min-w-0">
      <p className="admin-body-sm truncate text-white">{displayName}</p>
      <p className="admin-body-sm truncate text-sidebar-textInactive">{roleCodes.join(', ')}</p>
    </div>
  </div>
</nav>
```

**NavItem 그룹(라벨) — className만 교체**:

```diff
- <p className="px-3 text-body-sm font-semibold text-neutral-500">{node.display_name}</p>
+ <p className="px-3 admin-label-sm uppercase tracking-wide text-sidebar-textSection">{node.display_name}</p>
```

**NavItem 링크(메뉴 항목) — className만 교체, 아이콘 슬롯 추가**:

```diff
  <Link
    href={node.path!}
-   className={`rounded-input px-3 py-2 text-body-sm transition-colors ${
-     isActive ? 'bg-primary-50 font-medium text-primary-700' : 'text-neutral-600 hover:bg-neutral-100'
-   }`}
+   className={`relative flex h-9 items-center gap-2 rounded-input px-3 admin-body transition-colors ${
+     isActive
+       ? 'bg-sidebar-active font-medium text-white'
+       : 'text-sidebar-textInactive hover:bg-white/5 hover:text-white'
+   }`}
    style={{ marginLeft: depth > 1 ? `${(depth - 1) * 12}px` : undefined }}
  >
+   {/* 활성 시 좌측 3px 액센트바. 절대위치이므로 부모(Link)가 relative여야 함 */}
+   {isActive && <span className="absolute -left-3 top-0 h-full w-[3px] rounded-r bg-sidebar-accentBar" />}
+   <MenuIcon code={node.icon} className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-sidebar-activeIcon' : 'text-sidebar-iconInactive'}`} />
    {node.display_name}
  </Link>
```

**신규로 필요한 것 — `MenuIcon` 컴포넌트**: 현재 `NavItem`은 `node.icon`(string) 필드를 아예 렌더링하지 않는다(값은 DB에 있어도 무시됨). Figma는 항목마다 14px 아이콘을 요구한다. 코드베이스에 아이콘 라이브러리 의존성이 전혀 없고(`NotificationBell.tsx`가 인라인 SVG를 직접 그리는 기존 컨벤션 확인) `package.json`에 `lucide-react` 등도 없으므로, **기존 컨벤션을 따라 외부 의존성을 추가하지 않고** `components/admin/MenuIcon.tsx`에 `node.icon` 코드 문자열 → 인라인 SVG 매핑 테이블을 만드는 것을 권장한다(24 viewBox, `strokeWidth 1.75`, `stroke="currentColor"` — `NotificationBell`과 동일 스타일 통일). 매핑에 없는 `icon` 코드는 fallback 점(•) 아이콘으로 처리해 신규 메뉴 추가 시 아이콘 누락으로 렌더링이 깨지지 않게 한다.

### 3.3 상단바(Topbar) — `app/admin/(protected)/layout.tsx`의 `<header>`

현재 상단바는 **우측 정렬 요소만 있고 좌측 페이지 타이틀이 없다.** 각 페이지가 자기 콘텐츠 안에 `<h1 className="text-h3 ...">제목</h1>`을 개별적으로 그리는 구조다. Figma는 상단바 좌측에 페이지 타이틀이 항상 떠 있는 구조를 요구한다.

**권장 구현 방식**: `AdminSidebar`가 이미 `usePathname()` + 메뉴 트리로 활성 항목을 판정하는 것과 동일한 패턴으로, **`AdminTopbar` 클라이언트 컴포넌트가 flatten된 메뉴 트리에서 현재 pathname과 일치하는 `display_name`을 찾아 타이틀로 렌더링**한다(새로운 "페이지 타이틀 context"를 만들 필요 없음 — 메뉴 트리가 이미 SSOT).

```tsx
// app/admin/(protected)/AdminTopbar.tsx (신규)
'use client'
export function AdminTopbar({ menuTree, displayName, roleCodes, pendingAccessRequests }: Props) {
  const pathname = usePathname()
  const currentTitle = findMenuByPath(flattenMenuTree(menuTree), pathname)?.display_name ?? ''

  return (
    <header className="flex h-16 items-center justify-between border-b border-neutral-200 bg-neutral-0 px-6">
      <h1 className="admin-heading-2 text-neutral-900">{currentTitle}</h1>
      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="검색"
          className="w-40 rounded-input border-none bg-neutral-100 px-3 py-1.5 admin-body-sm text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
          disabled // §7 OQ-5 — 검색 대상 모델 미정. 확정 전까지 비활성 placeholder로 노출
        />
        <NotificationBell pendingAccessRequests={pendingAccessRequests} />
        <Avatar size="sm" initials={initialsOf(displayName)} />
      </div>
    </header>
  )
}
```

- **중복 타이틀 처리(전환기)**: `AdminTopbar`가 타이틀을 그리기 시작하면, 각 페이지 본문 상단의 기존 `<h1>제목</h1>`은 **중복이 되므로 해당 페이지가 재구성될 때(§5) 함께 제거**한다. Shell 작업과 개별 페이지 재구성을 같은 PR에서 동시에 끝낼 필요는 없다 — 전환 기간 동안 타이틀이 잠깐 두 번 보이는 것은 감내 가능한 수준의 임시 상태로 본다.
- **검색창**: Figma는 160px 검색박스를 topbar에 배치했지만, PRD/service-planner 어디에도 "Admin 전역 검색이 무엇을 검색하는지"(파트너? 리드? 메뉴? 전체?)가 정의되어 있지 않다. **UI만 만들고 기능은 비워두는 것(disabled placeholder)을 권장** — 가짜로 동작하는 것처럼 보이는 미완성 UI보다 명확히 비활성 상태로 보이는 편이 사용자 신뢰를 해치지 않는다(§7 OQ-5).
- **알림벨**: 기존 `NotificationBell.tsx` 로직·배지 카운트 그대로 재사용. 색상만 `bg-error`(이미 일치) 유지, 위치를 topbar 우측으로 이동.
- **아바타**: 신규 `Avatar` 컴포넌트(§4) 도입. 사진 URL 필드가 `admin_user`에 없으므로 이니셜 폴백만 우선 지원.
- **유저 정보 중복**: 사이드바 하단 유저 푸터(§3.2)와 topbar 우측 아바타가 같은 사람 정보를 두 곳에 보여주게 된다. Figma 스크린샷도 이 구조(사이드바 하단 + topbar 우측)를 그대로 쓰고 있어 의도된 중복으로 보이나, 확정은 §7 OQ-4에서 다룬다.

### 3.4 사이드바 IA(그룹/메뉴) 정렬 — 이건 코드가 아니라 데이터 작업

Figma의 목표 IA(대시보드 / 회원관리[회원 목록·신고제재] / 공급사[승인관리·인증관리·공급사목록] / 콘텐츠[카테고리·인사이트·TOP100] / 시스템[운영자관리·시스템로그])는 **`public.menu` 테이블의 행과 `sort_order`로 결정되는 것이지 `AdminSidebar.tsx` 코드로 결정되는 게 아니다.** 이 스펙 문서는 "목표 그룹/순서가 이렇다"까지만 정의하고, **실제 `menu` 테이블 UPSERT(그룹 신설, 신규 페이지 `partner_management`/`standard_category_management` 삽입, sort_order 재배열)는 backend-developer 작업**이다. PRD §3.3.1이 이미 신규 메뉴 코드(`partner_management`, `standard_category_management`)를 정의했으므로 그대로 따르되, **회원관리(신고·제재)/콘텐츠 그룹의 인사이트·TOP100은 PRD §3.3.2가 "백로그"로 명시**했으니 Figma 스크린샷에 있다고 지금 만들지 않는다(§5).

---

## 4. 공용 컴포넌트 스펙

`components/RequestForm/styles.ts`와 동일한 "이름 붙은 클래스 문자열 export" 패턴을 따라 `components/admin/styles.ts`(신규)를 제안한다.

```ts
// components/admin/styles.ts (제안, 미생성)
export const adminInputClass =
  'rounded-input border border-neutral-300 bg-neutral-0 px-3 py-2 admin-body text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'

export const adminButtonPrimaryClass =
  'rounded-input bg-primary-600 px-4 py-2 admin-label text-neutral-0 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300'

export const adminButtonSecondaryClass =
  'rounded-input border border-neutral-300 bg-neutral-0 px-4 py-2 admin-label text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50'

export const adminButtonDestructiveClass =
  'rounded-input border border-error px-4 py-2 admin-label text-error transition-colors hover:bg-error-100 disabled:cursor-not-allowed disabled:opacity-50'

export const adminButtonGhostClass =
  'rounded-input px-4 py-2 admin-label text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50'
```

### 4.1 Status Badge — 실측 hex 그대로

Figma "공급사 승인 관리" 화면에서 상태별 pill 배지 색이 명시적으로 다르다(단순히 success/warning/error 3색이 아니라 **상태 의미별로 별도 배정**). 아래를 그대로 코드화한다.

| 상태 | 배경 | 텍스트 | 채택 토큰 |
|---|---|---|---|
| 신규신청 | #EFF6FF | primary-700 | `bg-primary-50 text-primary-700` |
| 재신청 | #FFFBEB | amber-700 계열 | `bg-accent-100 text-accent-700`(§7 OQ-2 — `accent`에 700 없음, 추가 필요) |
| 서류보완 | #FEF2F2 | error | `bg-error-100 text-error` |
| 승인완료 | — (success 계열 추정, 스크린샷상 초록 pill) | success | `bg-success-100 text-success` |
| 반려 | — (error 계열 추정) | error | `bg-error-100 text-error` |

```tsx
// components/admin/StatusBadge.tsx (제안)
type Tone = 'new' | 'reapplied' | 'docs-needed' | 'approved' | 'rejected'
const TONE_CLASS: Record<Tone, string> = {
  new: 'bg-primary-50 text-primary-700',
  reapplied: 'bg-accent-100 text-accent-700',
  'docs-needed': 'bg-error-100 text-error',
  approved: 'bg-success-100 text-success',
  rejected: 'bg-error-100 text-error',
}
export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-sm px-2 py-0.5 admin-label-sm ${TONE_CLASS[tone]}`}>{children}</span>
}
```

`rounded-sm`(4px, §2 신규 토큰)을 사용 — 기존 Admin 배지(`leads/page.tsx`)는 `rounded-full`을 쓰고 있었으나, Figma 실측은 pill이 아니라 **살짝 둥근 사각형(sm radius)**이다. 기존 `/admin/leads` 상태 배지도 §5 우선순위에 따라 재구성 시 함께 전환한다.

기존 `lib/admin/translationStatus.ts`의 `TONE_CLASS`(neutral/warning/success/info 4톤)는 **패턴은 그대로 두되 warning 매핑만 `accent-500/10`(opacity 방식) → `bg-accent-100 text-accent-600`(Figma 실측 flat 톤)으로 재구성 시 통일 권장.** 이건 필수 아님 — 콘텐츠관리 화면 자체가 §5에서 후순위이므로 급하지 않다.

### 4.2 Button — 4종, 3사이즈

Figma 카탈로그는 Primary/Secondary/Destructive/Ghost × 3사이즈(sm/md/lg)를 정의한다. 위 §4의 클래스는 기본(md) 사이즈만 우선 정의했다 — sm/lg 패딩값은 Figma 컴포넌트 카탈로그(23종 목록에 있으나 실측 스펙은 이번 요청에 포함되지 않음)를 **재조회해야 정확한 padding 수치를 확정할 수 있다**(§7 OQ-6). 지금은 `px-4 py-2`(md 추정)만 확정.

### 4.3 Table — 어드민 목록 공통 행 구조

기존 `leads/page.tsx`의 테이블 구조(순수 `<table>`, thead에 `border-b border-neutral-200 text-left text-neutral-500`, tbody 행에 `border-b border-neutral-100 last:border-0 hover:bg-neutral-50`)는 Figma의 "공급사 승인 관리" 테이블과 **레이아웃 골격이 동일**하다(체크박스 → 아바타+회사명 → 속성 컬럼들 → 상태뱃지 → 액션 순서). 재구성 시 골격을 새로 짜지 않고 아래만 바꾼다:

- `thead th`: `text-body-sm font-medium` → `admin-body-sm font-medium uppercase tracking-wide text-neutral-500`
- `tbody td`: `text-body-sm` → `admin-body`
- 행 좌측에 체크박스 열 추가(일괄승인 액션용, A1-R5/A1-R10 대응)
- 회사명 셀: 아바타(이니셜, `Avatar size="sm"`) + 회사명(`admin-body font-medium text-neutral-900`) + 그 아래 업종/대표자(`admin-body-sm text-neutral-500`) 2줄 구조로 확장 — 기존 `leads` 테이블은 회사명 단일 텍스트라 이 부분만 신규 마크업 필요

### 4.4 Progress Bar — 서류 진행률

```tsx
// components/admin/ProgressBar.tsx (제안)
export function ProgressBar({ value, total, tone }: { value: number; total: number; tone: 'complete' | 'in-progress' }) {
  const pct = Math.min(100, Math.round((value / total) * 100))
  const fillClass = tone === 'complete' ? 'bg-secondary-500' : 'bg-accent-500' // #10B981 완료 / #F59E0B 진행중(Figma 실측)
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-neutral-200">
        <div className={`h-full ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="admin-body-sm text-neutral-500">{value}/{total}</span>
    </div>
  )
}
```

완료색 `#10B981`은 신규 `secondary-500`(Emerald)과 정확히 일치 — Figma가 "인증 완료"류 신호에 Success(#16A34A)가 아니라 별도로 Emerald(#10B981)를 쓰고 있다는 뜻이므로, **Secondary(Emerald)의 실제 용도가 여기서 드러난다**: 단순 "성공(success)" 상태가 아니라 "인증·신뢰(verification/trust)" 신호 전용 색이다. Capability Completeness 표시(A1-R4), verification_state 관련 배지에도 Emerald를 우선 검토할 것을 권장한다.

---

## 5. 화면별 재구성 우선순위

### 5.1 전체 인벤토리 (기존 9개 + 신규 2개)

| # | 화면 | 현재 경로 | Figma 대응 |
|---|---|---|---|
| 1 | 대시보드 | `/admin` | 대시보드(Desktop/Tablet/Mobile) |
| 2 | 리드(요청) 관리 목록 | `/admin/leads` | **공급사 승인 관리**(레이아웃 패턴 동일) |
| 3 | 리드 상세 | `/admin/leads/[id]` | 없음(Figma 그리드엔 상세화면 없음) — 카드/필드 스타일만 이식 |
| 4 | 메뉴관리 | `/admin/permissions/menus` | 없음(Figma엔 메뉴관리 화면 없음) — 트리 UI 패턴은 CategoryTree가 역으로 참고(§6) |
| 5 | 권한매트릭스 | `/admin/permissions/matrix` | 운영자 권한 관리(체크박스 매트릭스, 레이아웃 유사) |
| 6 | 가입요청 검토 | `/admin/access-requests` | 없음 |
| 7 | 콘텐츠관리(카테고리+랜딩카피) | `/admin/content` | 부분적으로 표준 카테고리 관리와 개념 중복(PRD §3.3.2 A-05) |
| 8 | 게시판(블로그/사례/FAQ) | `/admin/board/*` | 없음 |
| 9 | (신규) 공급사 관리 | `/admin/partners` | **공급사 승인 관리 + 공급사 인증관리 + 공급사 목록** 3화면 통합 |
| 10 | (신규) 표준 카테고리 관리 | `/admin/categories` | 없음(그리드에 없음) — CategoryTree 컴포넌트만 참고 |
| 11 | 대시보드 확장(매칭 지표) | `/admin`(PRD §3.3.1) | 대시보드 KPI 카드 4개 패턴 재사용 |

### 5.2 권장 순서와 근거

```
0순위 (병행, 즉시 착수 가능) — Admin Shell + 토큰
  ├─ tailwind.config.ts 토큰 추가(§2)
  ├─ AdminSidebar.tsx / layout.tsx 리스킨(§3)
  └─ components/admin/styles.ts, StatusBadge, Avatar, ProgressBar 등 공용 컴포넌트 신규 작성(§4)

1순위 — /admin/leads (목록 + 상세)
2순위 — /admin/partners (신규, PRD P1)
3순위 — /admin/categories (신규, PRD P2)
4순위 — /admin (대시보드, PRD 매칭 지표 확장과 함께)
5순위 — /admin/permissions/matrix, /admin/permissions/menus
6순위 — /admin/content, /admin/board/*, /admin/access-requests
```

**근거**:

1. **0순위가 선행되지 않으면 이후 모든 화면 작업이 "토큰 없이 만들고 나중에 고치는" 재작업이 된다.** Shell + 공용 컴포넌트가 먼저 나와야 1순위부터 바로 새 토큰을 쓸 수 있다.
2. **`/admin/leads`를 1순위로 두는 이유는 리스크가 아니라 "이미 존재하는 화면이라 학습효과가 가장 크다"는 데 있다.** `/admin/leads`는 Figma "공급사 승인 관리"와 **테이블 골격이 사실상 동일**(§5.3에서 상세 매핑)하다. 이 화면을 먼저 재구성하면서 나온 컴포넌트(Table, StatusBadge, Filter bar)를 그대로 `/admin/partners`(2순위)에 재사용할 수 있다 — 순서를 바꿔 `/admin/partners`부터 하면 아직 검증 안 된 신규 컴포넌트를 신규 화면과 신규 데이터 모델(PRD P1, 아직 스키마도 없음) 위에서 동시에 만드는 이중 리스크가 생긴다.
3. **`/admin/partners`(2순위)가 `/admin/categories`(3순위)보다 앞서는 이유**: PRD §4.3 로드맵도 P1(파트너)을 P2(카테고리)와 "거의 동시에" 진행하되 P1을 우선한다고 명시했다. 카테고리 트리(CategoryTree, §6)는 파트너 등록 폼의 하위 위젯으로도 쓰이므로, 파트너 화면의 정보구조가 먼저 잡혀야 카테고리 선택 UI가 어디에 어떻게 박히는지 결정할 수 있다.
4. **대시보드(4순위)가 뒤로 밀리는 이유**: 대시보드는 리드 KPI에 매칭 지표(PRD D-7)가 더해져야 완성되는데, 매칭 지표는 P4(Human Matching, leads 상세 확장) 완료 후에나 실측 데이터가 생긴다. 지금 재스킨해도 "숫자만 카드에 넣은" 상태로 두 번 작업하게 된다 — 스타일만 먼저 입히는 것도 가능하지만 우선순위상 리드/파트너/카테고리보다 급하지 않다.
5. **권한매트릭스/메뉴관리(5순위)는 대표(운영자)만 보는 화면이고 사용 빈도가 낮다.** Figma의 "운영자 권한 관리" 스크린샷은 체크박스 매트릭스 레이아웃이 이미 상당히 유사해 이식 비용이 낮다 — 급하지 않지만 어렵지도 않은 항목이라 뒤쪽에 배치.
6. **콘텐츠관리/게시판/가입요청(6순위)은 Figma 대응 화면이 아예 없다.** PRD §3.3.2도 이 영역들을 "완전 중복(이식 불필요)" 또는 "백로그"로 분류했다. 새 디자인을 적용할 명분(Figma 근거)이 약하므로 가장 뒤로 미루고, 필요하면 §4 공용 컴포넌트(Badge/Table/Button)만 나중에 기계적으로 교체해도 충분하다.

### 5.3 `/admin/leads` ↔ Figma "공급사 승인 관리" 상세 매핑

| Figma 요소 | `/admin/leads` 현재 대응 | 재구성 방식 |
|---|---|---|
| 상태 탭 필터(전체/신규/서류보완/재신청/승인완료/반려, 활성 탭 밑줄) | `LeadFilters.tsx`의 status select/버튼(코드 미확인이나 쿼리파라미터 `status` 기반 필터로 추정) | select/버튼 → 밑줄 탭(`border-b-2 border-primary-600`) UI로 교체. `content/ContentTabs.tsx`가 이미 이 정확한 밑줄탭 패턴을 갖고 있음(§ 재사용) |
| 필터바(검색 280px + 정렬 + "일괄승인" 버튼) | 검색 인풋만 존재(추정), 정렬/일괄액션 없음 | 검색 폭 조정 + 정렬 드롭다운 신규 + 일괄승인은 A1-R5(검증 큐)의 파트너 관리 전용 기능이라 `/admin/leads` 자체엔 이식 안 함(리드는 승인 개념이 없음, `status` 전이만 있음) — **Figma 필터바 패턴만 참고하고 액션 버튼은 화면 성격에 맞게 재정의** |
| 테이블(회사명 아바타+이니셜/대표자/업종/신청일/서류진행률/상태/액션) | `req.company_name_website` 단일 컬럼, 아바타 없음 | §4.3 Table 스펙대로 아바타+2줄 텍스트 셀로 확장. "서류 진행률"(ProgressBar)은 리드 데이터에 대응 개념이 없음 — **이식하지 않는다**(리드는 서류 제출 프로세스가 없는 인테이크 폼). 이 항목은 `/admin/partners`(2순위)에서만 사용 |
| 승인버튼(solid)/반려버튼(outline)/상세링크 | 없음(상세 페이지 내 `StatusAssigneeForm`으로 상태 변경) | 리드는 "승인/반려" 개념이 없고 `STATUS_LABELS`(신규접수/검토중/파트너매칭중/매칭완료/보류/종료)라는 별도 상태 체계다. **Figma의 승인/반려 버튼 자체는 이식하지 않고, 상태 배지 색상 체계(§4.1)와 상세링크 스타일만 이식** |

→ **결론**: `/admin/leads`는 Figma "공급사 승인 관리"와 **테이블 골격(아바타+회사명, 필터바, 상태배지, 탭)은 거의 그대로 이식 가능**하지만, **승인/반려 액션과 서류 진행률은 리드의 도메인 모델과 맞지 않아 이식하지 않는다.** 반대로 `/admin/partners`(신규)는 이 두 요소까지 포함해 Figma 화면을 훨씬 더 그대로 따르게 된다.

---

## 6. CategoryTree 컴포넌트 스펙

PRD A2-R1: "계층 트리 CRUD(L0~L3), 정렬순서 이동 — **기존 `/admin/permissions/menus`의 트리 UI 패턴 재사용**"이 이미 명시적으로 지시하고 있으므로, 새 트리 컴포넌트를 처음부터 설계하지 않고 **기존 `permissions/menus/page.tsx` + `MenuRowEditor.tsx`의 검증된 패턴을 확장**한다.

### 6.1 기존 메뉴관리 트리 패턴에서 재사용하는 것

| 기존 패턴 | 파일 | CategoryTree에서의 역할 |
|---|---|---|
| `buildMenuTree`/`flattenMenuTree` + `depth`/`isFirst`/`isLast` 계산 | `lib/admin/menuTree.ts` | 동일 알고리즘을 `lib/admin/categoryTree.ts`로 이식(제네릭이면 그대로 재사용 가능 — backend-developer 확인 필요, §7 OQ-7) |
| 들여쓰기 `style={{ paddingLeft: 16 + depth * 20 }}` | `MenuRowEditor.tsx` | L0~L3 깊이 들여쓰기에 그대로 적용 |
| 위/아래 화살표로 형제간 순서 변경(`▲`/`▼`, `isFirst`/`isLast`로 비활성화) | `MenuRowEditor.tsx` `move()` | A2-R1 "정렬순서 이동" 요구사항 그대로 이식 |
| hover 시에만 테두리 보이는 인라인 편집 셀(`cellInputClass`, border-transparent 기본) | `MenuRowEditor.tsx` | 카테고리명(ko/en/ja) 인라인 편집에 재사용 |
| 활성/비활성 체크박스 | `MenuRowEditor.tsx` | A2-R2(노드별 활성/비활성)에 그대로 이식 |

### 6.2 CategoryTree가 메뉴관리와 달라야 하는 지점

메뉴 트리는 최대 2~3단계, 수십 개 노드 규모이지만 표준 카테고리는 **374노드+신설분(~380~390)**이다(PRD §3.5.3). 같은 플랫 테이블 UI를 그대로 쓰면 스크롤이 수백 행이 되어 사실상 못 쓴다. 따라서:

| 요구 | 메뉴관리(기존) | CategoryTree(신규 필요) |
|---|---|---|
| 규모 | 수십 행 | ~380~390행 |
| 기본 펼침 상태 | 전체 펼침(행 적어서 문제 없음) | **L1까지만 기본 펼침, L2/L3는 클릭해 펼침(accordion)** — 그렇지 않으면 초기 렌더가 압도적 |
| 검색/필터 | 없음 | **노드명 검색 필수** — 380개 중 하나를 찾는데 스크롤은 비현실적 |
| 체크박스 다중 선택 | 없음(단순 CRUD) | **필요** — A2-R4 "FKP 노출 큐레이션"이 여러 L1 노드를 체크박스로 다중 선택하는 UI(PRD 원문: "정확히 PRD의 표준 카테고리 관리 화면에 필요한 컴포넌트... L1→L2→L3 체크박스 트리") |
| 출처 배지 | 없음 | **필요** — A2-R8 "나라장터 표준" vs "SEEPN 자체 신설" 배지 (§4.1 Badge 패턴 재사용, tone은 neutral/info 정도로 충분) |
| 참조 카운트 표시 | 없음 | A2-R5(카테고리별 등록 파트너 수) — 각 행 우측에 `admin-body-sm text-neutral-400` 텍스트로 카운트 표시, 0인 노드는 시각적으로 옅게(`opacity-50`) 처리해 "빈 카테고리"를 한눈에 구분 |

### 6.3 화면 레이아웃 제안 (와이어프레임 수준)

```
┌─ 표준 카테고리 관리 ────────────────────────────────────────────┐
│ [검색: 카테고리명 또는 코드]              [출처: 전체 ▾] [활성: 전체 ▾] │
│                                                                    │
│ ┌─ 트리 패널 (좌, ~60%) ──────────┐ ┌─ 노드 상세 패널 (우, ~40%) ──┐ │
│ │ ▾ □ 마케팅/홍보 (L1) [나라장터]  │ │ 선택된 노드: 마케팅/홍보     │ │
│ │   ▾ □ 광고대행 (L2)              │ │  - 명칭(ko/en/ja) 인라인편집 │ │
│ │     □ 온라인광고 (L3) · 12곳     │ │  - FKP 노출 토글(exposed_   │ │
│ │     □ 오프라인광고 (L3) · 3곳    │ │    to_fkp) — A2-R4          │ │
│ │   ▸ □ PR (L2, 접힘)              │ │  - 활성/비활성               │ │
│ │ ▾ □ 정보통신 (L1) [나라장터]     │ │  - 정렬순서(▲▼)              │ │
│ │   ▾ □ AI/빅데이터 (L2)           │ │  - 등록 파트너 수: 0곳       │ │
│ │     ☑ AI 서비스 (L3) · 0곳       │ │    → "삭제" 대신 "비활성화"  │ │
│ │ ▾ □ 번역·로컬라이제이션 (L1)     │ │    안내(A2-R7 참조무결성)    │ │
│ │     [SEEPN 자체 신설]            │ │                             │ │
│ └───────────────────────────────┘ └─────────────────────────────┘ │
│                                          [+ 신설 카테고리 추가]     │
└────────────────────────────────────────────────────────────────┘
```

- **좌우 분할(마스터-디테일) 레이아웃을 제안하는 이유**: 메뉴관리는 행 내부에 인라인 편집 셀을 바로 넣어도 화면이 안 복잡했지만(수십 행), 380행 트리에 ko/en/ja 3개 언어 편집 필드까지 인라인으로 펼치면 한 행의 실제 편집 상태 높이가 감당 안 된다. 클릭한 노드 하나만 우측 패널에서 편집하는 구조가 380행 규모에서 더 안전하다.
- **체크박스의 이중 의미 주의**: 좌측 트리의 체크박스는 A2-R4(FKP 노출 큐레이션)용 다중선택이다. 이는 "이 노드를 선택해서 지금 무언가를 실행한다"가 아니라 "이 노드는 FKP 요청폼에 노출된다"는 **영속 상태(토글)**다. 메뉴관리의 활성 체크박스와 시각적으로 유사해 보이지만 의미가 다르므로, **체크박스 옆에 작은 "FKP 노출" 라벨 아이콘을 병기**해 혼동을 줄일 것을 권장한다(정확한 카피는 ux-writer).
- **실측 데이터 필요 항목은 backend-developer로 이관**: 374노드 xlsx 임포트 후 실제 트리 깊이/노드당 자식 수 분포, 검색 인덱싱 방식(클라이언트 필터 vs 서버 쿼리), 체크박스 상태 저장 API(`exposed_to_fkp` PATCH 방식 — 단건씩인지 일괄인지)는 **본 문서가 결정하지 않는다.** 위 레이아웃은 "이런 모양이어야 380개를 다룰 수 있다"는 UI 패턴 수준의 스펙이다.

---

## 7. Open Questions

| # | 질문 | 왜 확신이 없는가 | 필요한 답변 주체 |
|---|---|---|---|
| **OQ-1** | Neutral 팔레트를 Figma 값(Gray)으로 교체하는 대신 기존 `neutral`(Slate)을 유지하기로 결론냈는데(§1.2), 이것이 **User-facing 화면(`components/RequestForm/styles.ts`, `Header.tsx`, `Categories.tsx` 등)에 영향을 주지 않는다는 전제가 맞는지 재확인 필요.** `tailwind.config.ts`가 User/Admin 공유 파일이라는 사실 자체는 코드로 확인했으나, "정말 Admin 전용 회색 스케일이 필요 없을 만큼 차이가 미미한가"는 실제 화면에 나란히 렌더링해 육안 비교하기 전까지는 100% 확신하기 어렵다 | 대표(또는 QA 단계에서 스크린샷 비교) |
| **OQ-2** | `accent`(Warning 역할) 스케일에 700 weight가 없다(현재 500/600만 존재). §4.1 "재신청" 배지의 텍스트 색으로 `accent-700`을 썼는데 미정의 상태다 | 실제 hex 미확보(Figma accent 700 미제공) | frontend-developer가 Figma 재조회 시 확인, 또는 `accent-600`으로 대체해도 대비 충분한지 QA 확인 |
| **OQ-3** | 사이드바 로고 영역 워드마크를 Figma 그대로 "Seepn / Admin Console"로 바꿀지, 기존 "FKP Admin"을 유지할지(§3.2) | 이건 순수 UI 스펙 범위를 넘는 **제품 브랜딩 결정**이다. PRD는 D-5에서 메뉴명만 "공급사(파트너) 관리"로 확정했을 뿐, Admin 제품 자체를 "Seepn"으로 리브랜딩하라는 지시는 없었다 | 대표 / ux-writer |
| **OQ-4** | 유저 정보를 사이드바 하단 + topbar 우측 **두 곳에 동시 표시**할지(Figma 스크린샷 그대로), 한쪽만 남길지(§3.2, §3.3) | 화면 크기가 작아질수록(Tablet/Mobile) 중복 표시가 공간 낭비가 될 수 있다. Figma는 Desktop 기준 스크린샷만 확인했고 Mobile 그리드 이미지의 유저 정보 위치는 축소되어 육안 판독이 어려웠다 | ui-ux-designer 재확인(Figma Mobile 프레임 재조회) 또는 실행 시 판단 |
| **OQ-5** | Topbar 검색창의 대상 모델(전역 검색 vs 특정 엔티티 검색)이 정의되어 있지 않아 비활성 placeholder로 제안했다(§3.3) — 이대로 방치할지, 이번 라운드에 범위를 정의할지 | PRD/service-planner 문서 어디에도 "Admin 전역 검색"이 언급되지 않음. 만들 가치가 있는지조차 불확실 | product-manager/service-planner |
| **OQ-6** | Button 컴포넌트의 sm/lg 사이즈 정확한 padding·font-size 수치(§4.2)를 확정하지 못했다 | Figma "06 Components" 카탈로그 프레임은 이번 프롬프트에 실측 코드로 전달되지 않고 이름과 용도만 나열됐다("Button(Primary/Secondary/Destructive/Ghost/Disabled, 3사이즈)") | Figma 재조회(get_design_context) 필요 — 다음 라운드 |
| **OQ-7** | `lib/admin/menuTree.ts`의 `buildMenuTree`/`flattenMenuTree`가 제네릭 구현이라 `MenuRecord` 대신 카테고리 레코드 타입에도 그대로 재사용 가능한지(§6.1) | 코드를 함수 시그니처까지 상세히 읽지 않았다(`page.tsx`에서 `buildMenuTree<MenuRecord>(...)` 제네릭 호출부만 확인) — 실제 재사용 가능 여부는 backend/frontend-developer가 구현 시점에 확인해야 함 | backend-developer / frontend-developer |
| **OQ-8** | Pretendard 폰트 파일을 저장소에 직접 포함(self-host)할지, CDN `<link>` 방식(예: jsdelivr)을 쓸지(§2.2) — 이 문서는 Next.js 공식 권장(`next/font/local`, self-host)을 기본값으로 제안했지만 라이선스/배포 크기 확인은 안 됐다 | Pretendard 폰트 파일 자체를 이번 세션에서 다운로드/검증하지 않음 | frontend-developer |
| **OQ-9** | `accent`를 Warning 역할로 겸용하는 것(§1.4)이 기존 `accent`의 원래 용도(User-facing 어딘가에서 이미 accent를 다른 의미로 쓰고 있을 가능성)와 충돌하지 않는지 | `accent` 토큰의 기존 사용처를 전수 조사하지 않았다 — 존재는 확인했지만(`translationStatus.ts`가 `accent-500/10`을 "번역 필요" warning 톤으로 이미 쓰고 있어 오히려 이 결정을 뒷받침하는 정황은 있음) 전체 사용 범위는 미확인 | frontend-developer가 `grep -r "accent-"` 전수 확인 권장 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-08-29 | 초안 작성 — Figma seepn_2.0 디자인 토큰/화면 코드를 FKP 기존 tailwind.config.ts·Admin 코드베이스와 대조. Neutral 팔레트는 기존 유지(신규 gray 미도입) 결론, Typography는 `admin-*` 신규 스케일 병행 결론, tailwind.config.ts diff, Admin Shell(사이드바+상단바) 재구성 스펙(DB 기반 동적 메뉴 로직 유지 명시), 공용 컴포넌트(Badge/Button/Table/Progress) 스펙, 기존 9화면+신규 2화면 전체 재구성 우선순위 및 `/admin/leads`↔"공급사 승인 관리" 상세 매핑, CategoryTree 컴포넌트 스펙(메뉴관리 트리 패턴 재사용 + 380노드 규모 대응 마스터-디테일 레이아웃), Open Questions 9건 | ui-ux-designer |
