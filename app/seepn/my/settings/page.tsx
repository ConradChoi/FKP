// Design Ref: docs/02-design/features/seepn-buyer-marketing-consent-settings.screen-spec.md
// §1 (레이아웃의 requireBuyerSession() 가드에 얹혀가되, 이 페이지도 다른 my/* 페이지와 동일하게
// 자기 요청에서 재검증), §2 (초기 로드는 get_own_buyer_consents(), RPC error는 조용히 삼키지
//않고 클라이언트 컴포넌트로 그대로 넘겨 "불러오지 못함" 상태를 명시적으로 렌더시킨다 —
// app/supplier/profile/settings/page.tsx의 `(consentsData ?? {})` 방식과 의도적으로 다름).
import { requireBuyerSession } from '@/lib/seepn/session'
import type { BuyerConsentsByType } from '@/lib/seepn/types'
import { MarketingConsentSettings } from '@/components/seepn/MarketingConsentSettings'

export const dynamic = 'force-dynamic'

export default async function SeepnMySettingsPage() {
  const session = await requireBuyerSession()

  const { data: consentsData, error: consentsError } = await session.supabase.rpc('get_own_buyer_consents')

  return (
    <div>
      <h1 className="text-h3 text-neutral-900">설정</h1>

      <div className="mt-6">
        <MarketingConsentSettings
          initialConsents={consentsError ? null : ((consentsData ?? {}) as BuyerConsentsByType)}
          initialLoadFailed={Boolean(consentsError)}
        />
      </div>
    </div>
  )
}
