// Design Ref: docs/02-design/features/seepn-buyer-web-p5a.screen-spec.md §6.1 (EDGE-B6) —
// "비로그인으로 직접 URL 접근 ... 페이지 레벨에서도 방어적으로 requireBuyerSession()으로 즉시
// 로그인 게이트 표시(복귀 URL 포함)". lib/seepn/session.ts's requireBuyerSession() (backend-
// provided, not to be modified) redirects to a bare `/seepn/login` with no `?redirect=` — this
// helper does the session-PRESENCE check itself first (cheap: one getUser() call) so pages can
// carry the visitor back to where they came from, then still call requireBuyerSession() for the
// deeper account-status (withdrawn/suspended) re-check that helper alone provides.
import { redirect } from 'next/navigation'
import { getBuyerAuthServerClient, getBuyerUser } from '@/lib/supabase/buyerServerAuthClient'

export async function redirectToLoginIfNoBuyerSession(returnPath: string): Promise<void> {
  const authClient = await getBuyerAuthServerClient()
  if (!authClient) redirect(`/seepn/login?redirect=${encodeURIComponent(returnPath)}`)

  const user = await getBuyerUser(authClient.supabase, authClient.accessToken)
  if (!user) redirect(`/seepn/login?redirect=${encodeURIComponent(returnPath)}`)
}
