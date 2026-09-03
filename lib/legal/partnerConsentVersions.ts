// Partner-side counterpart to lib/legal/consentVersions.ts. Bound 1:1 to
// docs/legal/partner-terms-<version>-ko.md and
// docs/legal/partner-privacy-<version>-ko.md (privacy review §4 PR-3, §6.3 —
// ko is mandatory; en/ja are optional follow-ups, unlike the buyer-facing
// docs which are en/ja only).
//
// PLACEHOLDER VALUES ONLY — the actual partner-facing terms/privacy document
// bodies have NOT been written yet (privacy review §6.1: "스키마 블로커가
//아니라 파트너 가입 오픈 블로커다"). partner_consent.document_version stores
// whatever string is exported here, so the column is ready before the
// documents exist; do NOT open partner sign-up to real users until:
//   1. docs/legal/partner-terms-<version>-ko.md and
//      docs/legal/partner-privacy-<version>-ko.md are written and reviewed
//      (checklist: privacy review §6.3), and
//   2. the version strings below are bumped to match those files' actual
//      filenames/dates (keep the old ones on a bump, same rule as the buyer
//      consentVersions.ts file).
//
// Bumping either string below without also adding the corresponding dated
// file breaks the "past consent is provable against the exact text agreed
// to" guarantee this pattern exists for — do not bump speculatively.

export const PARTNER_PRIVACY_CONSENT_VERSION = 'partner-privacy-v1.0-PLACEHOLDER'
export const PARTNER_TERMS_CONSENT_VERSION = 'partner-terms-v1.0-PLACEHOLDER'

// Design Ref: partner-supplier-app-ui-privacy-review.md §2.3 / UI-R6 — marketing consent's
// `partner_grant_consent` call previously passed no document_version at all (always null),
// which makes the 정보통신망법 제50조 제8항 2-year reconfirmation UX ("무엇에 동의했는지
// 특정할 수 없다") impossible. SUP-13's marketing toggle passes this string.
export const PARTNER_MARKETING_CONSENT_VERSION = 'partner-marketing-v1.0-PLACEHOLDER'
