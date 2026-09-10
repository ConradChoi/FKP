import type { Metadata } from 'next'
import { SeepnLegalPage } from '@/components/seepn/SeepnLegalPage'
import { SEEPN_BUYER_TERMS_CONSENT_VERSION } from '@/lib/legal/buyerConsentVersions'

export const metadata: Metadata = {
  title: 'SEEPN 이용약관',
}

export default function SeepnTermsPage() {
  return <SeepnLegalPage documentVersion={SEEPN_BUYER_TERMS_CONSENT_VERSION} />
}
