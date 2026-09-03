# `/supplier` 파트너 자가등록 앱 — backend 구현 노트 (UI-B1/B2/B3/B4/B5/B6/B10)

작성: backend-developer · 2026-09-04
대상: [`partner-supplier-app-ui-privacy-review.md`](./partner-supplier-app-ui-privacy-review.md) blocking 7건(UI-B1/B2/B3/B4/B5/B6/B10) 구현
근거 마이그레이션: `supabase/migrations/20260904100000_supplier_app_privacy_fixes.sql`
수신: **frontend-developer**(착수 전 필독, 특히 §1) · qa-reviewer · privacy-security-officer(§3 검토 요청) · project-manager

> 이 문서는 "무엇을 만들었는가"의 요약이 아니라, 새 마이그레이션/라우트가 **강제하지 못하는 부분**(호출 순서, 문구, 배포 설정)을 다른 에이전트가 그대로 따라야 할 계약으로 남기기 위한 문서다.

---

## 1. [UI-B3] 공개노출 동의 철회 — frontend가 반드시 지킬 호출 순서

> **정정 (qa-reviewer, 2026-09-04)**: 아래 원래 판단("SQL 변경 없음")은 틀렸다. `partner_grant_consent`가 `private.current_partner_id()`(=`partner_account.id`)를 재조회 없이 그대로 `partner_consent.partner_id`(FK 대상은 `partner.id`, 별개 uuid)에 꽂고 있어 **호출할 때마다 100% FK 위반으로 실패**하는 버그가 20260829140000 원본부터 있었다(사용된 적이 없어 지금까지 드러나지 않았을 뿐). `supabase/migrations/20260904110000_fix_partner_grant_consent_fk_bug.sql`로 수정 완료(아직 미실행 — Supabase에 20260904100000 다음 순서로 실행 필요). 아래 호출 순서 설계 자체는 그대로 유효하다.

~~SQL 변경 없음(`partner_grant_consent`는 이미 존재하고 정확하다).~~ 문제는 화면의 호출 순서였다(+위 SQL 버그). **screen-spec §4.6을 아래로 교체한다.**

### 토글 OFF

```
① rpc('partner_set_public_listing', { p_partner_id, p_on: false })
② rpc('partner_grant_consent', { p_consent_type: 'public_listing', p_granted: false })
```

- **반드시 ① 먼저.** ①이 실패하면 ②를 호출하지 않는다(공개가 꺼지지 않았는데 동의만 철회된 것으로 표시하지 말 것).
- ①이 성공하면 화면은 즉시 OFF로 반영해도 된다(공개는 이미 중단됨).
- ②가 실패하면: 토스트로 에러를 알리고 재시도 버튼을 제공. **자동 재시도 루프는 만들지 말 것** — 사용자가 화면을 벗어나도 다음 로그인 시 SUP-13 진입 시점에 "OFF인데 최신 `public_listing` 동의 행이 `granted=true`"인 불일치를 감지해 백그라운드로 ②를 재시도하는 것을 권장(§1.2에서 채택된 `get_own_partner_consents()`의 `public_listing.granted` 값과 `partner.public_listing_state`를 비교해서 감지 가능).

### 토글 ON (기존 그대로, 변경 없음)

```
① rpc('partner_grant_consent', { p_consent_type: 'public_listing', p_granted: true, p_document_version })
② rpc('partner_set_public_listing', { p_partner_id, p_on: true })
```

### 토글 비활성화 조건 (§1.3 (2) 권장 조치 — screen-spec에 아직 미반영, frontend가 함께 처리)

| 상태 | 토글 | 보조 문구 |
|---|---|---|
| `verified` 아님 | disabled | `검증이 완료되면 공개 노출을 설정할 수 있습니다.` |
| `verified` + 사업자등록증 없음 | disabled | `사업자등록증을 첨부하면 공개 노출을 설정할 수 있습니다.` |
| `verified` + 증빙 있음 | 활성 | — |
| `suspended` | disabled | 기존 문구 유지 |

이 조건을 지키면 `not_verified`/`business_registration_cert_missing` RPC 에러는 정상 경로에서 도달하지 않는 방어코드로 격하된다(§1.3).

---

## 2. 새/변경된 RPC 계약 (frontend-developer용)

모두 `supabase.rpc(...)`로 호출. 별도 표기 없으면 `authenticated`에게 GRANT됨(파트너 로그인 세션에서 직접 호출 가능).

| RPC | 인자 | 반환 | 비고 |
|---|---|---|---|
| `get_own_partner_id()` | 없음 | `{ partner_account_id, partner_id }` (0행 = 파트너 아님) | 신규. 다른 화면에서도 자신의 partner_id가 필요하면 이걸 쓸 것 — 클라이언트가 partner_id를 별도로 캐싱/유추하지 말 것 |
| `get_own_partner_consents()` | 없음 | `{ terms?, privacy?, public_listing?, marketing? }`, 각 `{granted, collected_at, document_version}` | 신규(UI-B2). 이력 없는 타입은 키 자체가 없음(`null` 아님) |
| `partner_withdraw(p_partner_id)` | 기존과 동일 | — | **직접 호출 금지.** `POST /api/partner/withdraw`를 통해서만 트리거(§4 참고) |
| `check_business_registration_duplicate(...)` | — | — | **더 이상 `authenticated`에게 GRANT되지 않음.** 직접 `.rpc()` 호출 시 `permission denied` 에러. `POST /api/partner/check-brn`을 거칠 것(§5) |

`partner_detach_auth_principal` / `select_pending_deletion_documents` / `confirm_document_purged` / `record_partner_document_purge_run` / `partner_record_document_upload`는 **`service_role` 전용**이며 frontend/화면 코드에서 절대 호출 대상이 아니다.

---

## 3. [UI-B10] BRN 조회 범위 축소 — 판단 및 근거

`check_business_registration_duplicate`의 `where` 절을 `business_registration_number = p_brn`에서 `business_registration_number = p_brn and (owner_account_id is not null or verification_state = 'verified')`로 좁혔다(마이그레이션 §5의 주석에 전체 근거 기록).

**결론: 좁혔다.** ceo-advisor 메모(§2(b)-3)가 우려한 A1-R6 충돌은 **없다** — 관리자 화면의 중복 후보 조회(`checkDuplicateCandidatesAction`, `app/admin/(protected)/partners/actions.ts`)는 이 RPC를 전혀 호출하지 않고 `public.partner`를 관리자 권한으로 직접 쿼리하므로, 관리자는 축소 이전과 동일하게 **모든** 후보(미검증 admin_entry draft 포함)를 본다. PC-4의 부정 방지 목적도 self-service 경로는 `owner_account_id`가 가입 즉시(모든 verification_state에서) 채워지므로 그대로 유지된다.

**privacy-security-officer 검토 요청**: 이 판단은 backend-developer 단독 판단이며(ceo 메모가 지시한 "1일 내 회신"의 상대방이 부재), 위 근거에 동의하는지 확인 부탁드립니다. 동의하지 않으면 마이그레이션 §5의 `where` 절 조건에서 `and (owner_account_id is not null or verification_state = 'verified')`만 제거하면 원복(다른 부분 영향 없음).

---

## 4. [UI-B1] `POST /api/partner/withdraw` — 계약

- **요청**: body 없음 (세션 쿠키만). 파트너 세션 필수.
- **응답 200**: `{ success: true }` 또는 `{ success: true, authCleanup: 'pending' | 'failed_compensated' }` — 후자 두 값이 와도 **탈퇴 자체는 성공**했으므로 화면은 정상 탈퇴 흐름(로그아웃 + 안내)으로 처리할 것. 두 값은 운영 로그 확인용이며 화면 문구를 분기할 필요는 없음.
- **응답 4xx/5xx**: `{ error: string }` — 탈퇴 실패, 기존 흐름대로 에러 토스트.
- 프론트는 이 라우트 호출 **전에** SUP-14 확정 모달을 노출하고, 호출 성공 후 로컬 세션을 정리하고 로그인 화면으로 리다이렉트한다(서버가 이미 `auth.admin.signOut` + `deleteUser`를 수행했으므로 클라이언트의 `supabase.auth.signOut()` 호출은 best-effort로만, 실패해도 무시 가능).

**SUP-14 모달 문구 — ceo-advisor 조건 재확인**: "첨부 문서가 삭제됩니다" 줄은 **파기 워커(§6)가 실제로 배포되어 동작을 확인한 뒤에만** 화면에 추가할 것(ceo-decisions.md §4 조건 2). 이번 마이그레이션+라우트로 워커 코드는 존재하지만, **Supabase 실행 + GitHub Actions 시크릿 설정(§6) 전까지는 "아직 배포되지 않은" 상태**로 취급한다.

---

## 5. [UI-B10] `POST /api/partner/check-brn` — 계약

- **요청**: `{ businessRegistrationNumber: string }`
- **응답 200**: `{ duplicate: boolean }`
- **응답 429**: `{ error: 'rate_limited', message: string }` — 계정당 1일 10회 초과
- **응답 401/403/400/500**: `{ error: string }`
- 화면 문구(§6.1 point 1 확정안, ux-writer 최종 확정 필요): `이 사업자등록번호는 등록할 수 없습니다. 이미 등록된 회사의 담당자시라면 고객센터로 문의해주세요.` — "이미 등록된"은 조건절 안에서만 등장해야 한다(사실 확정 금지).
- **버튼 명시 확인만 지원, `onBlur` 자동확인 금지**(§6.1 point 5) — 호출 1회 = 레이트리밋 1회 소모이므로 프론트가 불필요하게 여러 번 호출하지 않도록 주의(디바운스는 UX용일 뿐 통제가 아님을 기억할 것 — 서버가 통제).

---

## 6. [UI-B4] `POST /api/partner/documents` — 계약

- **요청**: `multipart/form-data`, 필드 `docType`(`business_registration_cert`|`portfolio`|`certification`|`other`), `file`(PDF/JPEG/PNG, ≤10MB, 파트너 총합 ≤50MB).
- **응답 200**: `{ success: true, id: string }`
- **응답 400**: `invalid_doc_type` / `invalid_file` / `invalid_file_size` / `invalid_file_content`(매직바이트 불일치 — 확장자를 속인 SVG/HTML 등) / `partner_storage_quota_exceeded`
- **응답 401/403/500**: 기타
- **partnerId를 body/formData에 넣지 말 것** — 서버가 세션에서 자체 조회한다. 프론트가 보내도 무시된다(파라미터 자체가 없음).
- 업로드 진행바(ui-spec §3.9-2)는 이 라우트로의 `fetch`/`XMLHttpRequest` 진행률을 그대로 사용 가능 — 변경 없음.
- **클라이언트 측 MIME/용량 사전 검사는 UX 용도로만 유지**하고, 이것이 보안 통제가 아니라는 점을 구현 주석에 남길 것(§4.1 화면 영향 항목 그대로).

---

## 7. [UI-B5] 파기 워커 — 배포에 필요한 설정 (project-manager/ops 확인 필요)

코드(`app/api/cron/purge-partner-documents/route.ts` + `.github/workflows/purge-partner-documents.yml`)는 작성되었으나, **아래 두 가지가 설정되기 전까지는 실제로 동작하지 않는다**:

1. **AWS Amplify 환경변수**에 `PARTNER_DOC_PURGE_CRON_SECRET` 추가(서버 전용, `NEXT_PUBLIC_` 접두어 금지). 임의의 긴 랜덤 문자열.
2. **GitHub 저장소 Secrets**(Settings → Secrets and variables → Actions)에 동일한 `PARTNER_DOC_PURGE_CRON_SECRET` 값 + `PARTNER_APP_SITE_URL`(배포된 프로덕션 URL) 추가.

두 값이 일치하지 않으면 워크플로우는 401을 받고 실패한다(의도된 동작 — `fail closed`). 15분 주기(cron `*/15 * * * *`)로 실행되며, `workflow_dispatch`로 수동 트리거도 가능(GitHub Actions 탭에서 "Run workflow").

**Amplify Hosting에는 Vercel Cron 같은 내장 스케줄러가 없어** GitHub Actions 스케줄 워크플로우를 트리거로 채택했다(추가 AWS 인프라/IAM 설정 없이 이 저장소 안에서 완결). 추후 AWS EventBridge Scheduler로 교체하고 싶다면 `.github/workflows/purge-partner-documents.yml`을 비활성화하고 동일한 `Authorization: Bearer <secret>` 규약으로 같은 엔드포인트를 호출하도록 EventBridge 규칙만 추가하면 된다(라우트 코드 변경 불필요).

**P1 DoD 게이트(ceo-decisions.md §1) 충족 확인 절차**: 위 설정 완료 후, 테스트 파트너 계정으로 탈퇴 → 15분 이내 Supabase Storage 콘솔에서 해당 `p/{partnerId}/...` 객체가 사라졌는지, `retention_jobs`에 `job_type='partner_doc_storage_purge'` 행이 쌓였는지 확인.

---

## 8. 마이그레이션 실행 순서 관련 참고

`20260904100000_supplier_app_privacy_fixes.sql` 하나로 완결되며, 기존 마이그레이션(`20260829130000`/`20260829140000`/`20260829180000`)이 이미 실행되어 있다는 전제로 작성했다. 아직 로컬 untracked 상태인 그 세 파일보다 반드시 **나중에** 실행할 것.

---

## Version History

| Version | Date | Changes | Author |
|---|---|---|---|
| 1.0 | 2026-09-04 | 최초 작성 — UI-B1/B2/B3/B4/B5/B6/B10 백엔드 구현에 따른 API 계약, 호출 순서, BRN 스코프 축소 판단 근거, 배포 설정 안내 | backend-developer |
