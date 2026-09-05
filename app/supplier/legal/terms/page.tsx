import type { Metadata } from 'next'
import { SupplierLegalPage } from '@/components/supplier/SupplierLegalPage'
import { PARTNER_TERMS_CONSENT_VERSION } from '@/lib/legal/partnerConsentVersions'

// Design Ref: screen-spec §3.2 — "[필수] 파트너 이용약관 동의 ... 전문 보기" links here in a new
// tab, and privacy review §2.2 item 5 requires that link to resolve to the real text, not a
// placeholder, before sign-up opens. Renders docs/legal/<PARTNER_TERMS_CONSENT_VERSION>-ko.md
// directly so the page and the consented-to version string can never drift apart.
export const metadata: Metadata = {
  title: 'SEEPN 파트너 이용약관',
}

export default function SupplierTermsPage() {
  return <SupplierLegalPage documentVersion={PARTNER_TERMS_CONSENT_VERSION} />
}
