// Partner-side counterpart to lib/legal/consentVersions.ts. Bound 1:1 to
// docs/legal/partner-terms-<version>-ko.md and
// docs/legal/partner-privacy-<version>-ko.md (privacy review §4 PR-3, §6.3 —
// ko is mandatory; en/ja are optional follow-ups, unlike the buyer-facing
// docs which are en/ja only).
//
// The naming rule is `docs/legal/<version string>-ko.md`, so each constant
// below resolves to exactly one file that exists in this repository:
//   PARTNER_TERMS_CONSENT_VERSION   -> docs/legal/partner-terms-v1.0-2026-09-ko.md
//   PARTNER_PRIVACY_CONSENT_VERSION -> docs/legal/partner-privacy-v1.0-2026-09-ko.md
// app/supplier/legal/{terms,privacy}/page.tsx render those same files directly
// (never a re-typed copy), so the published page and the version-pinned text a
// partner consented to stay byte-identical — the same binding the buyer-side
// components/LegalPage.tsx already relies on.
//
// Bumping either string below without also adding the corresponding dated
// file breaks the "past consent is provable against the exact text agreed
// to" guarantee this pattern exists for — do not bump speculatively. On a
// bump, keep the old file (never edit a published one in place).

export const PARTNER_PRIVACY_CONSENT_VERSION = 'partner-privacy-v1.0-2026-09'
export const PARTNER_TERMS_CONSENT_VERSION = 'partner-terms-v1.0-2026-09'

// Design Ref: partner-supplier-app-ui-privacy-review.md §2.3 / UI-R6 — marketing consent's
// `partner_grant_consent` call previously passed no document_version at all (always null),
// which makes the 정보통신망법 제50조 제8항 2-year reconfirmation UX ("무엇에 동의했는지
// 특정할 수 없다") impossible. SUP-13's marketing toggle passes this string.
//
// There is NO standalone marketing-consent document: the text a partner actually agrees to
// for marketing lives inside the privacy policy (partner-privacy-v1.0-2026-09-ko.md §3-7
// 처리 목적 and §4 동의 항목의 구분, which state the channel (email), the purpose, and
// "동의하지 않으셔도 서비스 이용에 제한이 없습니다"). So this deliberately points at that
// same document rather than inventing a `partner-marketing-*` version string with no file
// behind it — a version string that does not resolve to a real file is worse than useless
// as consent evidence. Consequence, and it is intended: get_own_partner_consents() returns
// the SAME document_version for `privacy` and `marketing`, because it is the same document.
//
// If a standalone marketing-consent document is ever written, change this to that file's own
// version string (and only then will these two diverge).
export const PARTNER_MARKETING_CONSENT_VERSION = 'partner-privacy-v1.0-2026-09'
