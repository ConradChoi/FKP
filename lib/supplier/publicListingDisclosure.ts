// Design Ref: docs/03-security/partner-supplier-app-ui-privacy-review.md §1.4 —
// "'공개되지 않는 정보' 목록은 추측이 아니라 partner_public 뷰의 컬럼 목록에서 그대로 도출한
// 것이다 ... frontend-developer는 이 목록을 lib/ 상수로 두고 뷰 정의와 함께 관리할 것."
// Source of truth: supabase/migrations/20260829140000_partner_schema.sql, `create ... view
// public.partner_public` (§11). Keep this list in sync with that view's SELECT list — if a
// column is added/removed there, this constant (and therefore SUP-13's disclosure block) is
// now stale until updated by hand.
export const PUBLIC_LISTING_EXPOSED_FIELDS =
  '회사명(국/영문), 설립연도, 임직원 규모, 소재지(시/도), 홈페이지, 대응 언어, 해외거래 경험, 회사소개, 대표 제품/서비스, 보유 인증, 역량정보(제품/서비스 상세)'

export const PUBLIC_LISTING_HIDDEN_FIELDS =
  '담당자 이름·직함·이메일·전화번호, 대표자명, 사업자등록번호, 첨부한 증빙 문서'
