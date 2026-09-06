---
template: ui-screen-spec
version: 1.0
feature: seepn-unified-platform-v1.0
phase: /admin/leads/[id] "매칭" 탭 — 시각/레이아웃 스펙 (P4, D-7)
description: human-matching.screen-spec.md §4~§9(화면 정보구조/플로우/화면 정의서/엣지케이스)를 실제 레이아웃·컴포넌트·상태 분기·색상 매핑으로 구체화한다. seepn-admin-ui-design-system.spec.md의 admin-* 토큰과 기존 Admin 탭/테이블/모달 패턴을 그대로 재사용한다.
variables:
  - feature: seepn-unified-platform-v1.0
  - date: 2026-09-06
  - author: ui-ux-designer
  - project: SEEPN Unified Platform (FKP + SEEPN) — Admin
  - version: 1.0.0
  - status: Draft — service-planner §0 Gap(G-1~G-8) 해소 전까지 frontend-developer 착수 보류(입력 문서와 동일 조건)
---

# `/admin/leads/[id]` 매칭 탭 UI 스펙

| 항목 | 내용 |
|---|---|
| 문서 종류 | UI Spec (레이아웃 / 컴포넌트 / 상태별 시각 분기 / 색상 매핑) |
| 작성자 | ui-ux-designer |
| 입력 문서 | [human-matching.screen-spec.md](human-matching.screen-spec.md)(service-planner, §4~§9 전체) · [seepn-admin-ui-design-system.spec.md](seepn-admin-ui-design-system.spec.md)(§1~§4 토큰/컴포넌트) |
| 참조 코드 | `PartnerDetailTabs.tsx`/`BasicInfoTab.tsx`/`CapabilityTab.tsx`(탭·폼 패턴) · `leads/[id]/page.tsx`/`RevealContact.tsx`/`StatusAssigneeForm.tsx`(개요 탭 이관 대상) · `StatusBadge.tsx`/`ProgressBar.tsx`/`CategoryPicker.tsx`/`Avatar.tsx`(재사용 컴포넌트) · `partners/PartnerFilters.tsx`/`PartnerStatusTabs.tsx`(6종+ 필터바·탭 선례) · `partners/VerificationRowActions.tsx`(모달 선례) |
| 스코프 | screen-spec §6의 (a)~(d) 4개 영역 시각 스펙, §7(M-R9 모달), 색상 매핑 전체. §2(데이터 모델)/§10(감사로그)/§11(OQ)은 범위 밖(그대로 유지) |
| 후속 담당 | ux-writer(라벨/문구 확정) → frontend-developer(구현) → qa-reviewer |

---

## 0. 설계 원칙 — 새 패턴을 만들지 않는다

이 화면은 **이 프로젝트에서 처음 등장하는 화면 유형이 아니다.** `/admin/partners`(목록+상세)가 이미 "6종 이상 필터 + 탭 + 테이블 + 모달 + 세그먼트형 상태" 조합을 겪었고, Admin 화면 전반이 한 차례 "폭이 좁다"는 피드백을 받아 **`max-w-*` 컨테이너로 본문을 가두지 않고 `flex-1` 전체 폭 + `overflow-x-auto`로 대응**하는 공통 레이아웃(`app/admin/(protected)/layout.tsx`의 `<main className="p-6">`, 사이드바 고정 `w-60`)으로 이미 정착되어 있다. 이번 스펙은 그 결론을 뒤집지 않고 그대로 따른다 — **본 문서 전체에서 신규 `max-w` 래퍼를 도입하지 않는다.**

이 원칙에 따라 아래 4개 영역 모두 기존 컴포넌트/패턴을 1:1 매핑한다.

| 영역 | 재사용 대상 | 비고 |
|---|---|---|
| 탭 전환 | `PartnerDetailTabs.tsx`의 로컬 `useState` + 밑줄탭 | screen-spec §4.1 지시사항, 그대로 복제 |
| (a) 필터바 | `PartnerFilters.tsx`(7필드 다단 wrap 레이아웃) | 6종 필터+검색어 구조가 사실상 동일 |
| (a) 카테고리 선택 | `CategoryPicker.tsx` | 수정 없이 그대로 |
| (a)/(b) 상태 배지 | `StatusBadge.tsx` + `VERIFICATION_STATE_TONE` | 수정 없이 그대로 |
| (a) 진행률 | `ProgressBar.tsx` | 수정 없이 그대로 |
| (a)/(b) 아바타 | `Avatar.tsx` | 수정 없이 그대로 |
| (b) PII 열람 | `RevealContact.tsx` | 컴포넌트 로직 그대로, props만 `match` 컨텍스트로 교체 |
| (c)/(d) 모달 | `VerificationRowActions.tsx`의 `fixed inset-0 z-50 bg-neutral-900/40` 오버레이 패턴 | 그대로 재사용 |
| 폼 인풋 | `adminInputClass`/`adminButtonPrimaryClass`/`adminButtonSecondaryClass`(`components/admin/styles.ts`) | 그대로 |

---

## 1. 탭 전환 — 개요 / 매칭

`PartnerDetailTabs.tsx`와 완전히 동일한 마크업으로 `LeadDetailTabs.tsx`(신규)를 만든다.

```
border-b border-neutral-200
[ 개요 ]  [ 매칭 ]
 밑줄(border-b-2 border-primary-600, text-primary-600) = 활성
 비활성 = border-transparent text-neutral-500 hover:text-neutral-700
```

- 기본 선택 탭: **개요**(현행 유지). 매칭 탭은 클릭 시에만 진입 — 딥링크 없음(screen-spec §4.1과 동일 이유).
- **개요 탭 내용**: 현재 `leads/[id]/page.tsx`가 렌더링하는 3개 섹션(`StatusAssigneeForm` / 요청 내용 카드 / 연락처 카드 `RevealContact` / 내부 메모 `InternalNote`)을 그대로 옮긴다 — 섹션 내부 마크업 변경 없음, 페이지 최상위 `<div>`를 탭 콘텐츠로 감싸는 리팩터링만 발생.
- **매칭 탭 내용**: 아래 §2~§5.

---

## 2. 매칭 탭 전체 레이아웃

screen-spec §4.2의 세로 4영역을 그대로 따르되, 각 영역을 독립 `<section>` 카드(`rounded-card border border-neutral-200 bg-neutral-0 p-5`, `BasicInfoTab.tsx` 섹션 카드와 동일 톤)로 분리한다 — 이미 이 프로젝트 전역이 "섹션 = 카드" 컨벤션을 쓰고 있어(리드 개요 탭도 섹션마다 카드) 매칭 탭만 다른 골격을 쓸 이유가 없다.

```
┌ 매칭 탭 ──────────────────────────────────────────────────────┐
│ (M-R9 인라인 배너 — 조건부, §5.5)                                │
│                                                                  │
│ ┌ (a) 후보 검색/필터 카드 ────────────────────────────────────┐ │
│ │ 헤더 행: "후보 검색" [담긴 후보 N건] ...... [+ 후보 더 찾기 / 접기] │
│ │ (펼침 시) 필터바 + 검색결과 리스트                              │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌ (b) 담은 후보 목록 카드 ────────────────────────────────────┐ │
│ │ 정렬 토글                                                     │ │
│ │ 테이블: 회사명 | 검증상태 | 판정 | 태그/메모 | 연락처 | 관리      │ │
│ │  (판정 변경 시 아코디언 서브행 펼침 — §4.2)                     │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌ (c) Top3 확정 카드 ─────────────────────────────────────────┐ │
│ │ 상태 배너 + [Top3 확정/수정] 버튼                              │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌ (d) Outcome 타임라인 (파트너별 반복) ───────────────────────┐ │
│ │ 파트너 A 카드: 9노드 트래커 + 인라인 폼 슬롯 + 이력 리스트        │ │
│ │ 파트너 B 카드: ...                                            │ │
│ └───────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
카드 간 세로 간격: mt-6 (기존 BasicInfoTab의 space-y-6과 동일 리듬)
```

---

## 3. (a) 후보 검색/필터 패널

### 3.1 접힘/펼침 — 상태와 트랜지션

| 상태 | 진입 조건 | 표시 |
|---|---|---|
| 펼침(기본) | 담은 후보 0건 (screen-spec §5 플로우 B) | 필터바 + 검색결과 전체 렌더 |
| 접힘(기본) | 담은 후보 1건 이상으로 재진입 | 헤더 행만 렌더, 필터바/결과 숨김 |
| 펼침(사용자 조작) | 접힘 상태에서 "+ 후보 더 찾기" 클릭 | 위와 동일하게 펼침 |

- **구현**: `useState<boolean>(candidates.length === 0)` 하나로 제어하는 조건부 렌더링. **CSS 애니메이션/트랜지션을 넣지 않는다** — `CategoryPicker.tsx`의 드롭다운, `VerificationRowActions.tsx`의 모달 모두 이 프로젝트에서 열림/닫힘에 트랜지션을 쓴 전례가 없다(`transition-colors`는 hover 등 색 전환에만 사용). 새 애니메이션 패턴을 이 화면에서 처음 도입하면 "왜 여기만 부드럽게 열리나"라는 일관성 문제가 생기므로, 즉시 표시/숨김으로 통일한다.
- **헤더 행**(카드 최상단, 접힘/펼침 공통 표시):

```
"후보 검색"  ·  담긴 후보 {N}건                    [+ 후보 더 찾기]  (접힘일 때)
"후보 검색"  ·  담긴 후보 {N}건                    [▴ 접기]         (펼침일 때, N>0인 경우만 접기 가능)
```

  N=0(최초 진입, 강제 펼침)일 때는 접기 버튼을 아예 렌더링하지 않는다 — 후보가 하나도 없는데 패널을 접으면 화면에 아무 것도 남지 않는 막다른 상태가 되므로 원천 차단.

### 3.2 필터바 레이아웃 — `PartnerFilters.tsx` 구조 재사용

6종 필터(카테고리/버티컬/국가/언어/지역/검증상태) + 검색어 = 7필드. `PartnerFilters.tsx`가 이미 7필드(검색어/버티컬/지역/해외경험/유입경로/정렬/언어/카테고리)를 아래처럼 4행으로 나눠 좁은 화면에서도 줄바꿈만 되고 잘리지 않게 처리한 전례를 그대로 이식한다.

```
행1 (flex flex-wrap gap-3 — select류 + 검색어, 한 줄에 다 안 들어가면 자동 줄바꿈):
  [검색어 입력 w-64] [버티컬: 전체▾] [지역: 전체▾]

행2 (flex flex-wrap gap-2 — 언어 다중 체크, 칩처럼 나열):
  대응언어  [ ] 한국어 [ ] 영어 [ ] 일본어 [ ] 중국어 ...

행3 (flex flex-wrap items-center gap-3 — 검증상태 다중체크 + 별도 토글, 시각적으로 구분):
  검증상태  [x]검증대기 [x]검증전(임시저장) [x]승인완료   |   [ ] 제외된 파트너도 보기(반려/중단)
  → 세로 구분선(border-l border-neutral-200 pl-3 ml-1)으로 "일반 필터"와 "opt-in 토글"을 시각적으로 분리한다.
    엣지케이스 3(§9)이 정의한 "기본 제외, 명시적 opt-in" 정책을 배지 색만으로는 구분이 안 되므로
    구분선 + 별도 라벨로 "이건 다른 종류의 필터"임을 드러낸다.

행4 (국가 — 자유 텍스트 기반 다중 chip, BasicInfoTab의 해외국가 입력 패턴 재사용):
  국가  [텍스트 입력_______] [추가]   (선택된 국가: [베트남 ×] [태국 ×] ...)

행5 (카테고리 — CategoryPicker, 자체 드롭다운이라 독립 행 필요):
  카테고리  [CategoryPicker, max-w-md]

행6 (액션):
  [검색] [필터 초기화]
```

- **언어 필터의 프리필 안내**(screen-spec §6.1): 프리필된 경우 행2 바로 아래에 `admin-label-sm text-neutral-400` 톤으로 "요청 locale 기준 추정값 — 필요시 수정하세요" 1줄 안내. 안내가 있다고 필터 자체 색을 바꾸지 않는다(체크박스는 다른 필터와 동일 톤 — "추정값"은 문구로만 전달, 색으로 경고성을 주면 "뭔가 잘못됐다"는 오인을 유발하므로).
- **검색 결과 리스트**: `/admin/partners` 목록 테이블과 동일한 행 구조(아바타+2줄 텍스트, 배지, ProgressBar, 우측 액션)를 그대로 쓰되 마지막 컬럼만 "담기" 버튼으로 교체.

| 컬럼 | 내용 | 비고 |
|---|---|---|
| 회사명 | `Avatar` + `company_name_ko`(진하게) / `company_name_en` + `vertical`/`business_entity_type` 배지(2번째 줄, `admin-body-sm text-neutral-400`) | `/admin/partners` 테이블 1열과 동일 마크업 |
| 검증상태 | `StatusBadge tone={VERIFICATION_STATE_TONE[...]}` | 기존 토큰 그대로 |
| 지역/언어 | `admin-body-sm text-neutral-600`, 언어는 콤마 나열 | — |
| Completeness | `ProgressBar` | 기존 그대로 |
| 담기 | 버튼(`adminButtonSecondaryClass` 사이즈 sm) / 이미 담김이면 `disabled` + 라벨 "담김" | §9 엣지케이스4 |
| — (행 하단 보조) | "다른 요청에서도 후보 중(N)" | `admin-label-sm text-neutral-400`, 배지 아님(비차단 정보이므로 굳이 색을 넣지 않음 — 색을 넣으면 "주의해야 할 것"처럼 보여 엣지케이스1의 "정상 동작"이라는 정책과 충돌) |

- **빈 결과 / 로딩 / 에러**: `/admin/partners`·`/admin/leads` 목록의 `<tr><td colSpan={n}>` 안내 패턴과 동일 톤(`text-neutral-400`) 재사용, 에러만 `text-error`.

---

## 4. (b) 담은 후보 목록

### 4.1 테이블 골격

`/admin/partners` 목록 테이블(`table-fixed` + `colgroup`)과 동일 골격, 컬럼만 교체.

```
colgroup: 회사명(w-64) 검증상태(w-28) 판정(w-52) 태그/메모(w-auto) 연락처(w-64) 관리(w-24)
```

| 컬럼 | 표시 | 비고 |
|---|---|---|
| 회사명 | `Avatar` + `company_name_ko` + `added_at`/`added_by` 툴팁(`title` 속성, 별도 UI 없이 네이티브 툴팁 — 이 정보는 부가정보라 커스텀 툴팁 컴포넌트를 새로 만들 정도의 가치가 없음) | `verification_state`가 draft/submitted/under_review면 회사명 옆에 ⚠ 아이콘(§5 참고) |
| 검증상태 | `StatusBadge` | — |
| 판정 | 세그먼트 버튼 3개(§4.2) | — |
| 태그/메모 | 접힘: 태그 칩 요약(최대 2개 + `+N`) 또는 "-" · 펼침 트리거 아이콘(연필) | 클릭 시 §4.3 아코디언 |
| 연락처 | `RevealContact` 그대로 재사용(props만 `partner_id` 기준으로 교체) | ⚠ G-7 — `partner_management:read` 권한 별도 확인 필요(screen-spec 그대로) |
| 관리 | "제거" 텍스트 링크(`text-error`) | §9 엣지케이스6 경고 모달 트리거 |

### 4.2 판정(judge_status) 세그먼트 버튼 — 색 매핑

3버튼 1그룹, `inline-flex rounded-input border border-neutral-300 overflow-hidden`(경계 하나만 그리고 내부는 버튼 사이 `border-l`로 구분 — Figma에 없는 신규 소형 패턴이지만 기존 `rounded-input`/`border-neutral-300` 토큰만 사용하므로 새 토큰 불필요).

| 상태 | 활성 시 클래스 | 근거 |
|---|---|---|
| 보류(pending) | `bg-neutral-100 text-neutral-700` | 아직 판단 전 — 중립. `StatusBadge`의 neutral 톤과 동일 계열 |
| 추천(shortlisted) | `bg-success-100 text-success` (버튼 텍스트만 진하게 `font-medium` 추가) | `StatusBadge` success 톤 재사용 — "추천"은 곧 Top3 후보군이므로 긍정 신호 |
| 제외(excluded) | `bg-error-100 text-error font-medium` | `StatusBadge` error 톤 재사용 |
| 비활성(미선택) 공통 | `bg-neutral-0 text-neutral-500 hover:bg-neutral-50` | — |

**신규 색을 만들지 않는다** — 이미 `StatusBadge`/`VERIFICATION_STATE_TONE`가 정의한 success/error 톤을 그대로 재사용해 "추천=success, 제외=error"라는 의미가 화면 전체(검증상태 배지, 판정 버튼, 이후 Top3 배너까지)에서 일관되게 통한다.

### 4.3 태그/메모 편집 영역 — 아코디언(서브 행) 방식으로 확정

**결정: 테이블 셀 내부 확장이 아니라, 판정 변경 시 해당 행 바로 아래 `colSpan` 전체폭 서브 행(`<tr><td colSpan={6}>`)이 열리는 아코디언으로 구현한다.**

이유:
- 태그 목록은 최대 8개(추천 기준, §3.1)이고 각 태그가 한국어 4~6자 칩이다. "태그/메모" 컬럼 하나(`w-auto`, 실질 200~280px 예상)에 8개 칩 + 500자 textarea를 다 넣으면 칩이 3~4줄로 쌓이고 행 높이가 컬럼 하나만 비정상적으로 길어져, 옆의 회사명/검증상태/연락처 셀에 큰 빈 여백이 생긴다(테이블은 행 단위로 높이가 맞춰지므로).
- 서브 행으로 펼치면 칩을 테이블 전체 폭(≈900px 이상)에서 가로로 자연스럽게 나열할 수 있어 2줄 이내로 수렴하고, 다른 컬럼 폭에 전혀 영향을 주지 않는다.
- `/admin/partners`의 반려 사유 입력이 "모달"이었던 것과 달리 여기는 **판정마다 반복적으로 여닫는 가벼운 인라인 작업**이라 모달을 쓰면 클릭 피로가 커진다(§0 원칙 — 최소 클릭). 아코디언이 이 화면의 반복 작업 성격에 더 맞는다.

**서브 행 마크업**:

```
<tr className="bg-neutral-50">
  <td colSpan={6} className="px-4 py-4">
    태그 선택 영역 (판정에 따라 추천/제외 목록 중 하나만 노출)
    [✓ 카테고리 적합] [ MOQ 충족] [✓ 언어 대응] [ 해외경험] ... (체크박스 칩, CapabilityTab의
    서비스유형 체크박스-칩 패턴과 동일: `flex flex-wrap gap-3`, 각 항목 `admin-body-sm`)

    메모 (textarea, adminInputClass, rows=3, 500자 카운터 우측 하단)

    [저장 중 상태: "미저장" 배지] ... [취소] [저장]
  </td>
</tr>
```

- **"미저장" 표시**: 태그/메모를 바꿨는데 아직 저장 버튼을 안 누른 상태 → 서브 행 헤더 우측에 `StatusBadge tone="warning" label="미저장"` 배지. 저장 완료 시 서브 행이 접히며 부모 행의 태그 칩 요약이 즉시 갱신된다.
- **검증 실패**(태그 0개 + 메모 입력): 저장 버튼 `disabled` + 서브 행 하단에 `admin-body-sm text-error`로 "태그를 최소 1개 선택하세요" — `BasicInfoTab.tsx`의 인라인 에러 문구 패턴과 동일 위치(폼 하단, 버튼 바로 위)로 통일.
- **좌측 상태 바**: 서브 행 `<td>`에 `border-l-4` + 판정 색(`border-l-success` 또는 `border-l-error`)을 주어, 접혀 있을 때 사라졌던 "지금 이게 추천/제외 작업 중이다"라는 맥락을 서브 행이 열려 있는 동안 계속 시야에 남긴다.
- **정렬 토글**(screen-spec §6.2 "judge_status별 그룹")은 테이블 위 우측에 작은 텍스트 링크 두 개로: `등록순` / `추천 먼저` — 별도 드롭다운을 만들지 않는다(옵션 2개뿐이라 select는 과함, `PartnerFilters`의 sort select와 달리 여긴 select를 쓸 만큼 옵션이 많지 않음).

### 4.4 검증 전 경고 아이콘

`verification_state ∈ {draft, submitted, under_review}`인 행의 회사명 셀에 회사명 바로 뒤 인라인으로 `⚠`(`text-accent-600`, `title="검증 전 파트너"`) 표시. **배지 톤과는 별개의 신호**다 — `submitted`/`under_review`는 이미 `StatusBadge`가 info/warning 톤으로 구분해 보여주고 있어서, 이 셋 전부에 공통으로 걸리는 "Top3 확정 시 게이트 대상"이라는 사실은 배지 색만으로는 한눈에 안 보인다. 별도 고정 아이콘으로 "이 셋은 결국 같은 주의사항을 공유한다"를 드러낸다.

---

## 5. (c) Top 3 확정

### 5.1 상태 배너 — 톤 결정: 미확정=중립, 확정=성공

| 상태 | 톤 | 근거 |
|---|---|---|
| 미확정 | `bg-neutral-50 border border-neutral-200 text-neutral-600` | 미확정은 "문제"가 아니라 아직 도달하지 않은 정상 단계다. `warning`/`error` 톤을 쓰면 운영자에게 불필요한 압박을 주고, 실제로 막힌 것도 없다(추천 후보가 있으면 언제든 확정 가능) |
| 확정됨 | `bg-success-100 border border-success/30 text-success`(텍스트) + 좌측 체크 아이콘 | Top3 확정은 이 화면의 존재 이유(Time to Shortlist)를 만족시킨 긍정적 마일스톤 — `StatusBadge` success 톤과 동일 계열로 "완료됨"을 명확히 표시 |

배너 문구/레이아웃(문구는 ux-writer 확정, 자리만 정의):

```
[미확정]  ⓘ 아직 Top3가 확정되지 않았습니다              [Top3 확정] (버튼, shortlisted 0건이면 disabled)

[확정됨]  ✓ 확정됨 · 2026-09-06 14:22 · 김운영 · Time to Shortlist: 3일 4시간
          최초 확정 이후 2회 수정됨                        [Top3 수정] (버튼)
```

- 버튼은 배너 우측 고정(`flex items-center justify-between`) — 상태를 다 읽지 않아도 액션 버튼 위치가 항상 같은 곳에 있어야 반복 방문 시 클릭 동선이 짧아진다.
- `disabled` 버튼에는 `title`이 아니라 **버튼 바로 아래 고정 텍스트**로 "추천으로 판정된 후보가 없습니다"를 노출한다(hover 전용 tooltip은 터치/스크린리더 접근성이 떨어지므로 §0의 접근성 기본 원칙에 따라 상시 텍스트로 대체).

### 5.2 확정 모달 레이아웃

`VerificationRowActions.tsx`의 모달 오버레이(`fixed inset-0 z-50 bg-neutral-900/40`, `max-w-md rounded-card bg-neutral-0 p-6`)를 그대로 재사용하되, 폭만 `max-w-lg`로 확대(체크리스트+경고 문구가 `max-w-md`에는 좁음).

```
┌ Top3 확정 ─────────────────────────────────  (h3, admin-heading-3) ┐
│ shortlisted 후보 중 최대 3개를 선택하세요.        선택됨: 2/3         │
│                                                                      │
│ [x] 회사명A   [승인완료]                                             │
│ [x] 회사명B   [검증대기] ⚠                                          │
│ [ ] 회사명C   [승인완료]                                             │
│ (pending/excluded 후보는 목록에 렌더되지 않음 — §9 엣지케이스5)        │
│                                                                      │
│ ── (검증 전 파트너가 선택 집합에 있을 때만 출현) ──────────────────    │
│ ⚠ 검증 전 파트너가 포함되어 있습니다.                                 │
│ [ ] 검증 전 파트너가 포함되어 있음을 확인했습니다.  (필수 체크)         │
│                                                                      │
│                                          [취소]  [확정하기] (disabled│
│                                           until 위 체크 or 조건 미충족)│
└──────────────────────────────────────────────────────────────────┘
```

- 4개째 체크 시도 시: 체크박스 자체를 막지 않고(입력 좌절감 방지) 체크 직후 즉시 `admin-body-sm text-error`로 "최대 3개까지 확정할 수 있습니다" 노출 + 방금 시도한 체크를 즉시 원복(체크 상태가 잠깐 반짝였다 풀리는 게 아니라, 애초에 4번째 클릭이 `checked` state를 바꾸지 않도록 이벤트 핸들러에서 차단 — 그래야 "체크했는데 왜 풀리지" 혼란이 없다).
- 검증 전 경고 블록은 `bg-accent-100 border border-accent-200 rounded-input p-3` — `accent`가 Warning 역할이라는 design-system §1.4 결론 그대로.

### 5.3 M-R9 상태 전이 확인 모달 (screen-spec §7)

동일 모달 오버레이 패턴 재사용, `max-w-sm`(내용이 짧음).

```
┌ 요청 상태 변경 ──────────────────────────────────┐
│ Top 3가 확정되었습니다. 이 요청 상태를              │
│ '파트너매칭중' → '매칭완료'로 변경할까요?           │
│                                                    │
│                          [나중에]  [지금 변경]      │
└────────────────────────────────────────────────┘
```

- `[지금 변경]` = `adminButtonPrimaryClass`, `[나중에]` = `adminButtonSecondaryClass`(취소가 아니라 "보류"이므로 destructive 톤 아님).
- `requests.status`가 `matching`이 아닐 때는 모달 대신 매칭 탭 상단(§2 레이아웃의 최상단)에 닫기 가능한 인라인 배너: `bg-primary-50 border border-primary-100 text-primary-700`(info 톤 — 경고가 아니라 참고 정보이므로 accent/warning 대신 info 계열).

---

## 6. (d) Outcome 타임라인

### 6.1 파트너별 카드 반복 구조

확정된 Top3 각 파트너마다 독립 카드(회사명 헤더 + 트래커 + 인라인 폼 슬롯 + 이력 리스트)를 세로로 반복. 확정 전 상태에서는 이 영역 전체가 아래 안내 하나로 대체된다.

```
┌ (d) 영역, Top3 미확정 시 ───────────────────────┐
│  Top3 확정 후 이용 가능합니다.  (text-neutral-400)  │
└─────────────────────────────────────────────────┘
```

### 6.2 9노드 트래커 — 반응형 처리 결정

**결정: 가로 스크롤(`overflow-x-auto`) 채택. 줄바꿈(wrap)도 축약 표시도 채택하지 않는다.**

| 검토한 안 | 기각/채택 사유 |
|---|---|
| 2줄로 줄바꿈 | 기각 — 스테퍼(단계 흐름)를 2줄로 끊으면 5번째→6번째 노드가 "다음 줄 첫 칸"으로 시각적 단절이 생겨 좌→우 시간 순서라는 핵심 은유가 깨진다. 또한 줄바꿈 지점이 화면 폭에 따라 매번 달라져 레이아웃이 불안정하다 |
| 라벨 축약(아이콘만) | 기각 — 9개 상태명이 서로 뜻이 가깝고(응답함/미팅/견적/샘플처럼 유사 도메인 단어) 아이콘만으로 구분하면 오독 위험이 크다. 이 트래커는 이 화면의 핵심 장치(§4.2)이므로 정보 손실이 있는 축약은 부적절 |
| **가로 스크롤** | **채택** — `/admin/leads`·`/admin/partners` 테이블이 이미 `overflow-x-auto`로 좁은 화면에 대응하는 이 프로젝트의 표준 패턴이다. 새 반응형 전략을 발명하지 않고 기존 관용구를 그대로 재사용 |

**구현 세부**:
- 트래커 컨테이너: `overflow-x-auto` + 내부 `flex items-center` 로우, 각 노드 `min-w-[92px] shrink-0`(9 × 92px ≈ 828px — 사이드바(240px) 제외 실사용 폭이 1000px 안팎인 노트북에서는 대부분 스크롤 없이 들어가고, 더 좁아지면 자연스럽게 스크롤).
- **현재 상태는 항상 화면에 보여야 한다** — 스크롤 밖으로 밀려나면 "지금 뭐가 진행 중인지" 한눈에 안 보이는 문제가 생기므로, 트래커 카드 최상단에 스크롤 위치와 무관한 고정 텍스트 `admin-body font-medium text-neutral-900`로 "현재 상태: {상태 라벨}"을 별도로 표시한다. 마운트 시 트래커도 현재 노드가 보이도록 `scrollIntoView({ inline: 'center' })`(현재 노드 ref) 1회 실행.
- 노드 사이 연결선: `h-0.5` 가로 바, 도달한 구간까지 색이 채워짐(스테퍼 관용구). 노드 원(`h-8 w-8 rounded-full`) 아래 라벨(`admin-label-sm`, 2줄까지 허용 `text-center leading-tight`).

### 6.3 노드 색상 매핑

| 노드 상태 | 클래스 | 근거 |
|---|---|---|
| 미도달(한 번도 안 감) | `bg-neutral-100 border border-neutral-200 text-neutral-400` | 중립 — "아직 없음"은 문제 상태가 아님 |
| 도달한 적 있음(현재 아님) | `bg-neutral-0 border-2 border-success text-success` | screen-spec §6.4 "초록 테두리" 원문 그대로 |
| 현재 상태 | `bg-success border-success text-neutral-0`(채움) | screen-spec §6.4 "현재는 채움" 원문 그대로 |
| **현재 상태가 `deal` 또는 `repeat`일 때** | 위 success 대신 `bg-secondary-500 border-secondary-500 text-neutral-0` (도달 이력만 있을 때는 `border-2 border-secondary-500 text-secondary-600`) | **의도적 예외.** `deal`(성사)·`repeat`(재구매)는 이 화면의 두 번째 북극성 지표(Match-to-Meeting Rate와 함께 매출 실현 신호)가 실제로 찍히는 유일한 지점이다. 나머지 7개 노드와 같은 초록으로 두면 운영자가 여러 파트너 카드를 훑어볼 때 "돈이 된 매칭"과 "그냥 진행 중인 매칭"을 색만으로 구분할 수 없다. `secondary`(Emerald)는 이미 `ProgressBar`의 `complete` 톤으로 "완결/신뢰"를 의미하는 토큰으로 자리 잡았으므로, 새 색을 만들지 않고 그 의미를 여기서도 재사용한다 |
| 연결선(구간 채움) | `bg-success`(일반), 마지막 두 구간(quote→sample은 일반, negotiation→deal, deal→repeat 구간)은 도달 시 `bg-secondary-500` | 위와 동일 논리 연장 |

노드 클릭은 상태와 무관하게 항상 가능 — `cursor-pointer` + `hover:ring-2 hover:ring-primary-300`(하나의 hover 톤으로 통일, 노드 색이 이미 3~4갈래로 나뉘어 있어 hover까지 색을 분기하면 과함).

### 6.4 노드 클릭 → 인라인 폼

**결정: 모달이 아니라 트래커 바로 아래, 이력 리스트 위의 고정 슬롯에 인라인 폼이 열린다.**

근거:
- Top3는 최대 3장의 카드가 세로로 나열되고, 한 카드 안에서도 폼을 열어둔 채 다른 카드(다른 파트너)의 현재 상태를 참고해야 하는 경우가 실제 운영 흐름상 자연스럽다(예: A사 미팅 일자를 B사 이력과 비교). 모달은 화면 전체를 가려 이 비교를 막는다.
- Top3 확정 모달(§5.2)이 이미 이 화면의 "무거운 액션" 자리를 모달로 차지하고 있다. Outcome 기록은 반복적이고 가벼운 액션이므로 같은 무게의 UI(모달)를 또 쓰면 "이것도 신중해야 하는 액션인가"라는 오인을 유발한다 — 위계를 다르게 가져간다.
- 폼이 뜨는 위치는 **클릭한 노드마다 다르게 뜨지 않고 항상 트래커 바로 아래 동일 위치**로 고정한다. 노드별로 폼이 노드 아래마다 다르게 뜨면(9개 위치 중 하나) 시선이 매번 다른 곳으로 이동해야 해 반복 작업 피로가 커진다.

```
[트래커, §6.2]
─────────────────────────────────────
(노드 클릭 시 여기 슬롯에 등장, bg-neutral-50 rounded-card p-4)
  기록할 상태: {클릭한 노드 라벨}                             [닫기 ×]
  일시  [datetime-local, adminInputClass]  (기본값 now)
  메모  [textarea, 선택]
  (meeting일 때) 미팅일자 [date]  미팅메모 [text]
  (quote일 때)   견적금액 [number, 선택]  통화 [select, 선택]
  (deal일 때)    [ ] 딜 성사 여부   금액[number]  통화[select]  (모두 선택)
                                                    [취소]  [기록 저장]
─────────────────────────────────────
[이력 리스트, §6.5]
```

- 저장 실패 시: 폼이 접히지 않고 그대로 유지 + 폼 하단 `text-error` 인라인 에러(§9 엣지케이스7 "부분 저장 없음, 입력값 보존"과 일치).
- 재방문(이미 지난 노드 재클릭)도 동일 폼을 그대로 사용 — 폼 자체에 "재방문" 여부를 구분하는 별도 UI를 넣지 않는다(신규 이벤트로 추가된다는 사실은 이력 리스트에 자연히 드러나므로, 입력 폼 단계에서 경고를 추가하면 반복 기록이라는 정상 행위에 불필요한 마찰을 만든다).

### 6.5 이력 리스트

트래커/폼 아래, 시간 역순 리스트. 각 행: `admin-body-sm`, `상태 라벨 배지(작게) · 일시 · 기록자 · 메모(있으면)`. 상태 배지는 §6.3 색을 그대로 축소 재사용(`StatusBadge`처럼 `rounded-sm px-2 py-0.5`이지만 outcome 9종 전용이므로 `StatusBadge`의 `Tone` 유니온을 그대로 쓰지 않고 별도 매핑 함수 필요 — §7 참고). 0건일 때: `text-neutral-400` "아직 기록된 진행 상황이 없습니다".

---

## 7. 색상 매핑 총정리 (frontend-developer 빠른 참조용)

| 도메인 | 값 | 톤/클래스 |
|---|---|---|
| `judge_status` | `pending` | `bg-neutral-100 text-neutral-700` |
| | `shortlisted` | `bg-success-100 text-success` |
| | `excluded` | `bg-error-100 text-error` |
| `verification_state` (배지, 기존 `VERIFICATION_STATE_TONE` 그대로) | `draft` | neutral |
| | `submitted` | info |
| | `under_review` | warning |
| | `verified` | success |
| | `rejected`/`suspended` | error / neutral |
| `verification_state` 경고 아이콘(배지와 별개, §4.4) | `draft`/`submitted`/`under_review` 공통 | `⚠ text-accent-600` |
| Top3 확정 배너 | 미확정 | `bg-neutral-50 text-neutral-600` |
| | 확정됨 | `bg-success-100 text-success` |
| Outcome 노드 | 미도달 | `bg-neutral-100 text-neutral-400` |
| | 도달(과거) — `deal`/`repeat` 제외 | `border-2 border-success text-success` |
| | 현재 — `deal`/`repeat` 제외 | `bg-success text-neutral-0` |
| | 도달(과거) — `deal`/`repeat` | `border-2 border-secondary-500 text-secondary-600` |
| | 현재 — `deal`/`repeat` | `bg-secondary-500 text-neutral-0` |
| M-R9 인라인 배너(상태가 matching 아님) | — | `bg-primary-50 text-primary-700`(info) |
| M-R9 확인 모달 | — | 중립(색 없음), 버튼만 primary/secondary |

신규로 필요한 hex/토큰: **없음.** 위 표 전부 `seepn-admin-ui-design-system.spec.md` §2가 이미 정의한 `success`/`error`/`accent`/`secondary`/`primary`/`neutral` 스케일 조합만으로 충당된다.

---

## 8. Frontend 인계 메모

1. **`components/admin/StatusBadge.tsx`는 수정하지 않는다.** `judge_status`/Outcome 9종은 `StatusBadge`의 `Tone` 5종(`neutral/info/warning/success/error`)에 억지로 끼워 맞추기보다, `lib/admin/matchLabels.ts`(신규, `lib/admin/partnerLabels.ts`와 동일 패턴)에 `JUDGE_STATUS_TONE`/`OUTCOME_STATE_TONE` 맵을 만들고 `StatusBadge`의 `tone` prop에 넘긴다(§4.2/§6.3 색은 이미 기존 5톤 팔레트 안에서 표현 가능하므로 `StatusBadge` 자체 변경 불필요 — 단 Outcome의 `deal`/`repeat` 채움색(`secondary-500`)은 5톤에 없는 신규 색이라 **이 두 상태만은 `StatusBadge`를 쓰지 않고 §6.3 전용 노드 컴포넌트에서 직접 클래스를 적용**한다. 배지 형태의 소형 표기(이력 리스트, §6.5)에서는 secondary 톤을 못 쓰므로 `deal`/`repeat`도 편의상 success 배지로 표기하고, 색 구분은 트래커 노드에서만 강조한다 — 리스트까지 이중 색 체계를 넣으면 오히려 시각적 일관성이 떨어진다).
2. **세그먼트 버튼(§4.2)은 신규 컴포넌트**(`components/admin/SegmentedControl.tsx` 정도로 일반화 권장) — 이 화면 외에 향후 다른 3지선다 상태(예: `public_listing_state`)에도 재사용 가능성이 있으므로 `judge_status` 전용으로 하드코딩하지 말 것.
3. **아코디언 서브 행(§4.3)**은 `<table>` 안에서 `<tr>`을 조건부로 추가/제거하는 방식으로 구현 가능(별도 라이브러리 불필요, `CategoryPicker`의 조건부 드롭다운과 동일한 "그냥 JSX 조건부 렌더" 수준).
4. **Outcome 트래커(§6.2)**는 신규 컴포넌트(`components/admin/OutcomeTracker.tsx` 제안) — `match_id`, `events[]`, `onNodeClick(state)`만 받는 순수 프레젠테이션 컴포넌트로 만들어 Top3 카드 반복 렌더(§6.1)에서 그대로 재사용.
5. **`RevealContact.tsx`는 로직 변경 없이 재사용**하되, 현재 시그니처가 `requestId` 기준이므로 매칭 탭에서는 `partnerId` 기준 `get_partner_contact` RPC를 호출하는 얇은 래퍼(`RevealPartnerContact.tsx`)를 새로 만드는 편이 기존 파일을 매칭 탭 전용으로 오염시키지 않는다(⚠ G-7 권한 이슈는 backend 확정 후 반영).
6. **필터바(§3.2)는 `PartnerFilters.tsx`를 복붙 후 필드만 교체**하지 말고, 두 화면(파트너 목록 필터 / 매칭 후보 검색 필터)이 검증상태·언어·지역·카테고리 필터 UI를 그대로 공유하므로 공통 훅/서브컴포넌트로 뽑아내는 것을 권장(예: `VerificationStateFilterGroup`, `LanguageFilterGroup`) — 이번 작업 범위는 아니지만 중복 코드 누적을 막기 위해 기록.
7. **모달 오버레이**는 이미 두 군데(파트너 반려 모달, 이번 Top3 확정/M-R9 모달)에서 동일 마크업이 반복되므로 `components/admin/Modal.tsx`로 뽑아내는 리팩터링을 이번 기회에 함께 검토할 것을 권장(필수 아님, 이번 스펙은 기존 마크업 그대로 복붙해도 동작에는 문제 없음).
8. 본 문서는 screen-spec의 Gap(G-1~G-8)·Open Questions(SP-M1~SP-M5)를 해소하지 않는다 — 특히 G-7(연락처 열람 권한 번들링)과 SP-M4(judge_status를 pending으로 되돌리는 정책)는 이 UI 스펙의 세그먼트 버튼/연락처 컴포넌트 동작에 직접 영향을 주므로, 구현 착수 전 반드시 재확인 필요.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-09-06 | 초안 작성 — (a)검색/필터 패널의 6행 레이아웃과 접힘/펼침 무-애니메이션 정책, (b)판정 세그먼트 버튼 색 매핑 및 태그/메모 아코디언(서브 행) 확정과 근거, (c)Top3 배너 톤(미확정=중립/확정=success) 및 확정·M-R9 모달 레이아웃(기존 모달 패턴 재사용), (d)Outcome 9노드 가로 스크롤 반응형 결정(줄바꿈/축약 기각 근거 포함)과 인라인 폼 위치(모달 대신 트래커 하단 고정 슬롯) 결정, deal/repeat 노드에 secondary(Emerald) 색을 예외 적용하는 근거, 전체 색상 매핑 총정리표, frontend 인계 메모 8건 | ui-ux-designer |
