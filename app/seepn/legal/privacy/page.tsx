import type { Metadata } from 'next'
import { SeepnLegalPage } from '@/components/seepn/SeepnLegalPage'
import { SEEPN_BUYER_PRIVACY_CONSENT_VERSION } from '@/lib/legal/buyerConsentVersions'

export const metadata: Metadata = {
  title: 'SEEPN 개인정보처리방침',
}

export default function SeepnPrivacyPage() {
  return <SeepnLegalPage documentVersion={SEEPN_BUYER_PRIVACY_CONSENT_VERSION} />
}
