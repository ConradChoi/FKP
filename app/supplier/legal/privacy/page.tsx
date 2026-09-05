import type { Metadata } from 'next'
import { SupplierLegalPage } from '@/components/supplier/SupplierLegalPage'
import { PARTNER_PRIVACY_CONSENT_VERSION } from '@/lib/legal/partnerConsentVersions'

// Design Ref: screen-spec §3.2 ("[필수] 개인정보 수집·이용 동의 ... 전문 보기") + privacy review
// §7.1 (UI-B8 item 3: the CPO name/contact and the 열람·정정·삭제·처리정지·동의철회 접수 방법 must
// be reachable from every screen). Renders
// docs/legal/<PARTNER_PRIVACY_CONSENT_VERSION>-ko.md directly — the same file
// partner_consent.document_version pins, so the published text and the consent evidence stay
// byte-identical.
export const metadata: Metadata = {
  title: '파트너 개인정보 수집·이용 및 처리방침',
}

export default function SupplierPrivacyPage() {
  return <SupplierLegalPage documentVersion={PARTNER_PRIVACY_CONSENT_VERSION} />
}
