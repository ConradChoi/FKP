# SEEPN 오픈 전 운영 준비 체크리스트

작성일 2026-09-26 · 대상: seepn.me 오픈 · 상태: 코드로 확인 가능한 항목은 확인 완료, **DB·콘솔에서만 볼 수 있는 항목은 담당자 확인 필요**로 표시

## 1. 배치·크론 (개인정보 파기가 실제로 도는지)

| 항목 | 확인 방법 | 상태 |
|---|---|---|
| 일일 보관기간 배치 `run_daily_retention_batches()` (pg_cron `fkp-daily-retention-batches`, 매일 18:00 UTC = 03:00 KST) | SQL Editor: `select jobname, schedule, active from cron.job;` 에 행이 있고 `active = true` | **담당자 확인 필요** |
| 배치 최근 실행 성공 | `select status, start_time, return_message from cron.job_run_details order by start_time desc limit 5;` | **담당자 확인 필요** (pg_cron이 꺼져 있으면 휴면 전환·삭제, 문의 파기가 전부 멈춤) |
| 휴면 전환 동작 | 배치가 `buyer_account`를 `dormant`로 바꾸는 것은 마지막 로그인 1년 후라 오픈 직후에는 대상 없음. 로그인 후 `select status from buyer_account` 로 `active` 유지만 확인 | 코드 확인 완료 |
| 파트너 서류 파기 크론 (GitHub Actions `purge-partner-documents`, 15분) | Actions 탭에서 최근 실행 초록색 | **담당자 확인 필요** |
| 휴면 삭제 후 로그인 계정 정리 (`purge-dormant-buyers`, 매일 03:30 KST) | Actions 탭에서 `workflow_dispatch`로 1회 수동 실행 → HTTP 200 (`scanned: 0`) | **담당자 확인 필요** |
| 크론 시크릿 | GitHub 저장소 Secrets `PARTNER_APP_SITE_URL`, `PARTNER_DOC_PURGE_CRON_SECRET` 이 Amplify 환경변수와 같은 값 (두 크론이 공용) | **담당자 확인 필요** |

## 2. 환경변수 (Amplify)

`next.config.js`의 `env` 블록에 있어야 SSR 런타임에 전달되는 변수(프로젝트 메모리의 Amplify 버그 참고):
`SUPABASE_SERVICE_ROLE_KEY`, `PARTNER_DOC_PURGE_CRON_SECRET`, `GOOGLE_TRANSLATE_*` — 코드상 모두 등록되어 있음(확인 완료).
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` 은 seepn.me 도메인에서도 운영 값인지 **담당자 확인 필요**. 이 3개가 seepn.me와 기존 도메인에서 같은 앱을 서빙하므로 값이 하나뿐이어야 한다.

## 3. 관리자 메뉴·권한

권한은 **메뉴 코드 기준**으로 DB 함수가 검사한다(메뉴 경로 등록과 별개). 새로 만든 화면이 쓰는 코드:

| 화면 | 권한 코드 | 필요한 동작 |
|---|---|---|
| 게시판관리 > 공지·인사이트·FAQ, 커뮤니티 운영 | `content_management` | read / update |
| 문의 관리(스팸 표시 포함) | `lead_management` | read / update |
| 공급사 상세 > 리뷰 탭 | `partner_management` | read / update |
| 감사 로그 조회 | `audit_log` | read |

확인 항목:
1. 역할별(최고관리자·운영자·뷰어) 권한 매트릭스에서 위 코드에 read/update가 의도대로 부여됐는지 (역할메뉴권한관리 화면).
2. 커뮤니티 신고 처리와 게시중단 처리를 **실제로 할 담당자**에게 `content_management` update가 있는지. 없으면 신고가 와도 숨김 처리를 못 한다.
3. 게시판관리 하위에 `board_seepn_insight`, `board_seepn_faq`, `board_community` 메뉴가 등록·노출되는지(등록 완료라고 들었으나 오픈 전 재확인).
4. 담당자 전원 MFA(AAL2) 등록 — 모든 관리자 RPC가 AAL2를 요구한다.

## 4. 초기 콘텐츠 (비어 있으면 화면이 "-"·빈 목록으로 보이는 곳)

| 위치 | 필요한 것 | 권장 최소 |
|---|---|---|
| 홈 KPI(등록 공급사·품목·평점·리뷰) | 공개(승인) 공급사 데이터 | 공급사 수십 곳. 평점·리뷰는 오픈 직후 0/"-"가 정상 |
| 홈·공지 | 공지(대상 `seepn_user`) 게시 | 오픈 공지 1건 이상 |
| 인사이트 | 인사이트 게시글 | 3~5건 |
| FAQ | FAQ 게시글 | 8~10건(가입·문의·리뷰·탈퇴·휴면 해제 포함) |
| 공급사 찾기·TOP100 | 공개 공급사, 추천(운영자 추천) 공급사 지정 | 운영자 추천 5곳 이상 |
| 커뮤니티 | 카테고리별 운영자 첫 글 | 카테고리당 1~2건(빈 게시판 방지). 운영자 글도 닉네임 규칙을 따름 |
| 약관·처리방침 | `docs/legal` 문서가 앱에 게시되어 있고 버전 상수가 일치 | `lib/legal/buyerConsentVersions.ts`와 문서 버전 동일(확인 완료) |

## 5. 운영 체계 (사람이 정해야 하는 것)

- **문의 창구**: 모든 대외 이메일이 `info@ylia.io`로 통일됨. 메일함 수신·담당자·응답 기한 지정.
- **게시중단 요청**: `docs/03-security/community-takedown-runbook.md`(초안, 변호사 검토 대상). 담당자, 접수 대장 위치, 임시조치 30일 만료 관리 방법 지정.
- **문의(1:1) 처리**: 오픈 후 첫 문의를 누가 언제까지 `진행 중`으로 바꾸는지. 이것이 리뷰 작성 자격을 여는 트리거이므로 스팸 문의는 반드시 스팸 표시.
- **유출 사고 대응**: `data-breach-response-procedure-v1.0.md` 담당자 연락처 최신화.
- **휴면 안내 메일 없음(대표 결정)**: 고객이 문의할 때 "1년 미이용 시 휴면, 이후 1년 미해제 시 삭제"를 안내할 수 있도록 FAQ에 반영.

## 6. 오픈 당일 스모크 테스트 (운영 화면)

1. seepn.me 홈 → 로그인 → 마이페이지 각 메뉴 이동
2. 가입(메일 인증) → 로그인 → 비밀번호 변경 → 탈퇴 사유 선택 없이도 탈퇴 가능
3. 공급사 찾기 → 상세 → 관심등록 → 👍 추천 숫자 증가, 비교 저장
4. 문의 작성 → 관리자에서 `진행 중` → 해당 공급사에 리뷰 작성 가능 → 스팸 표시하면 작성 불가
5. 커뮤니티 글·댓글·좋아요·신고 → 관리자에서 숨김/해제, 감사 로그 기록
6. 휴면 해제 화면: 테스트 계정을 SQL로 `dormant` 처리 후 로그인 → 해제 화면 → 비밀번호 변경·재동의 → 이용 가능(테스트 후 정리)
7. 휴대폰 너비: 헤더 가로 메뉴, 홈, 공급사 상세, 커뮤니티
8. supplier.seepn.me → 리다이렉트, 기존 FKP·공급사 앱 로그인 회귀 없음

## 7. 알려진 미해소 사항 (오픈을 막지는 않음)

- 법률 검토 대기 항목 전체는 `docs/03-security/legal-review-queue.md` (변호사 질의서는 마지막 단계에서 정리).
- 파트너·FKP 계정에는 휴면 정책 미적용.
- 이용약관·처리방침은 오픈 전이므로 제자리 수정 상태(버전 v1.0 유지). 오픈 이후 변경은 사전 공지 절차 필요.
