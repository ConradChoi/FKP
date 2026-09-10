// Design Ref: lib/legal/partnerConsentVersions.ts (the pattern this file follows verbatim, per
// docs/03-security/seepn-buyer-web-p5a-privacy-review.md §8.3 BP-9 "바인딩" instruction) +
// PRD D-14③ (ceo-advisor, 2026-09-10) — P5a opens ko ONLY, en/ja sign-up stays closed until
// TR-4"-2b (partner-profile auto-translation) is resolved AND the en/ja legal docs exist.
//
// The naming rule is `docs/legal/<version string>-<locale>.md`, so each constant below is
// SUPPOSED to resolve to exactly one file — but as of this migration round those files DO NOT
// YET EXIST (privacy-security-officer has not authored them; see background note in the task
// this file was written under). That is why SEEPN_BUYER_SIGNUP_ENABLED below is `false`.
//
// docs/legal/seepn-buyer-terms-v1.0-2026-09-ko.md   <- SEEPN_BUYER_TERMS_CONSENT_VERSION
// docs/legal/seepn-buyer-privacy-v1.0-2026-09-ko.md <- SEEPN_BUYER_PRIVACY_CONSENT_VERSION
//
// Do NOT bump either string without also adding the corresponding dated file — bumping
// speculatively breaks "past consent is provable against the exact text agreed to", the whole
// reason this indirection exists.
export const SEEPN_BUYER_TERMS_CONSENT_VERSION = 'seepn-buyer-terms-v1.0-2026-09'
export const SEEPN_BUYER_PRIVACY_CONSENT_VERSION = 'seepn-buyer-privacy-v1.0-2026-09'

// No standalone marketing-consent document, same reasoning as
// PARTNER_MARKETING_CONSENT_VERSION: the marketing-consent text lives inside the privacy
// policy itself, so this points at the same version string rather than inventing one with no
// file behind it.
export const SEEPN_BUYER_MARKETING_CONSENT_VERSION = SEEPN_BUYER_PRIVACY_CONSENT_VERSION

// GATE — privacy review §8.3 BP-9 (치명적): "켜는 로케일 = 약관·처리방침 문서가 실제로 존재하는
// 로케일". This flag exists so the code/schema for buyer sign-up can be built and reviewed NOW
// (this task's explicit scope) while the actual sign-up SCREEN stays unreachable by real users
// until docs/legal/seepn-buyer-{terms,privacy}-v1.0-2026-09-ko.md both exist and this flag is
// flipped to `true` by whoever confirms that (privacy-security-officer sign-off expected).
//
// Enforcement point: app/api/seepn/signup/route.ts checks this flag before calling
// auth.admin.createUser() and returns 503 `legal_documents_not_ready` if false — this is a
// server-side gate, not merely a frontend one, because Supabase Auth's public sign-up toggle
// must stay OFF regardless (BP-3) and this route is the only other door.
export const SEEPN_BUYER_SIGNUP_ENABLED = false
