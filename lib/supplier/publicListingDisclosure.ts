// Design Ref: docs/03-security/partner-supplier-app-ui-privacy-review.md §1.4 —
// "'공개되지 않는 정보' 목록은 추측이 아니라 partner_public 뷰의 컬럼 목록에서 그대로 도출한
// 것이다 ... frontend-developer는 이 목록을 lib/ 상수로 두고 뷰 정의와 함께 관리할 것."
//
// Source of truth (UPDATED, BP-20): public.partner_public was SPLIT into
// public.partner_list_public (anon) + public.partner_detail_buyer (SEEPN 로그인 회원)
// by supabase/migrations/20260910100000_seepn_buyer_web_p5a.sql §8 — the old 2-bucket
// "공개 / 비공개" model no longer matches reality, so this is now 3 buckets. Keep in sync with
// BOTH views' SELECT lists — if a column is added/removed there, this constant (and therefore
// SUP-13's disclosure block AND the buyer privacy policy §7-equivalent section) goes stale
// until updated by hand.
export const PUBLIC_LISTING_ANON_FIELDS =
  '회사명(국/영문), 소재지(시/도), 버티컬(제품/서비스), 서비스유형, 대응 언어, 해외거래 경험 유무, SEEPN 등록일'

export const PUBLIC_LISTING_BUYER_ONLY_FIELDS =
  '설립연도, 임직원 규모, 홈페이지, 해외거래 국가, 회사소개, 대표 제품/서비스, 보유 인증, 역량정보(제품/서비스 상세, MOQ/가격밴드/리드타임 또는 프로젝트 최소규모/과금모델 등), 레퍼런스 프로젝트, 표준 카테고리'

export const PUBLIC_LISTING_HIDDEN_FIELDS =
  '담당자 이름·직함·이메일·전화번호, 대표자명, 사업자등록번호, 첨부한 증빙 문서'

// Backward-compat alias — old callers that only distinguished "공개/비공개" (SUP-13 as it
// exists before this round's frontend work) can keep working: "노출되는 정보 전체"는 anon +
// buyer-only 버킷의 합이다. New/updated call sites should show the 3 buckets separately
// instead of using this (BP-20 — 파트너에게 "정확히 무엇이 어디까지 보이는지"를 알려주는 것이
// 동의의 내용이므로, 뭉뚱그린 표시는 회귀다).
export const PUBLIC_LISTING_EXPOSED_FIELDS = `${PUBLIC_LISTING_ANON_FIELDS}, ${PUBLIC_LISTING_BUYER_ONLY_FIELDS}`
