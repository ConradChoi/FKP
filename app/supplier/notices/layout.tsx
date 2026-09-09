// Design Ref: notice-board.screen-spec.md §4.1 — requireSupplierSession() only (email
// verification NOT required, unlike app/supplier/profile/layout.tsx's interstitial): notices are
// already anon-readable public data once published (NS-1), so gating them behind email
// verification would just delay a partner who's already curious "why is my review taking so
// long" (P-N3) from reading an answer that isn't secret in the first place.
import { requireSupplierSession } from '@/lib/supplier/session'
import { SupplierNoticesShell } from '@/components/supplier/SupplierNoticesShell'

export default async function SupplierNoticesLayout({ children }: { children: React.ReactNode }) {
  const { account } = await requireSupplierSession()

  return <SupplierNoticesShell displayName={account.display_name}>{children}</SupplierNoticesShell>
}
