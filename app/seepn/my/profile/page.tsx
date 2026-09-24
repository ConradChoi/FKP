// Design Ref: Figma U-11 마이페이지 side menu "회원정보 변경" (2026-09-24 request): 표시명 수정 +
// 마케팅 수신 동의 (the standalone /seepn/my/settings page was merged in here; see
// docs/02-design/features/seepn-buyer-marketing-consent-settings.screen-spec.md for the consent
// behaviour, unchanged). Session gate comes from app/seepn/my/layout.tsx.
import { requireBuyerSession } from '@/lib/seepn/session'
import type { BuyerConsentsByType } from '@/lib/seepn/types'
import { DisplayNameForm } from '@/components/seepn/DisplayNameForm'
import { MarketingConsentSettings } from '@/components/seepn/MarketingConsentSettings'

export const dynamic = 'force-dynamic'

export default async function SeepnMyProfilePage() {
  const session = await requireBuyerSession()
  const { data: consentsData, error: consentsError } = await session.supabase.rpc('get_own_buyer_consents')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-h3 text-neutral-900">회원정보 변경</h1>
        <div className="mt-6">
          <DisplayNameForm accountId={session.account.id} initialDisplayName={session.account.display_name} email={session.email} />
        </div>
      </div>

      <section>
        <h2 className="text-body font-semibold text-neutral-900">마케팅 수신 동의</h2>
        <div className="mt-3">
          <MarketingConsentSettings
            initialConsents={consentsError ? null : ((consentsData ?? {}) as BuyerConsentsByType)}
            initialLoadFailed={Boolean(consentsError)}
          />
        </div>
      </section>
    </div>
  )
}
