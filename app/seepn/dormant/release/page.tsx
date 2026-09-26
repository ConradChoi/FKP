// 휴면 계정 해제 화면. 로그인은 되었지만(세션 유지) 계정이 dormant인 회원만 머문다.
// 세션 없음 -> 로그인, 이미 active -> 홈, withdrawn/suspended -> 로그인.
import { redirect } from 'next/navigation'
import { getBuyerAuthServerClient, getBuyerUser } from '@/lib/supabase/buyerServerAuthClient'
import { AuthShell } from '@/components/seepn/AuthShell'
import { DormantReleaseForm } from '@/components/seepn/DormantReleaseForm'

export const dynamic = 'force-dynamic'

export default async function SeepnDormantReleasePage() {
  const authClient = await getBuyerAuthServerClient()
  if (!authClient) redirect('/seepn/login')
  const user = await getBuyerUser(authClient.supabase, authClient.accessToken)
  if (!user) redirect('/seepn/login')

  const { data: account } = await authClient.supabase.from('buyer_account').select('status').maybeSingle<{ status: string }>()
  if (!account) redirect('/seepn/login')
  if (account.status === 'active') redirect('/seepn/home')
  if (account.status !== 'dormant') redirect('/seepn/login')

  return (
    <AuthShell title="휴면 계정 해제" subtitle="마지막 로그인 후 1년 동안 이용이 없어 휴면 계정으로 전환되었습니다. 아래 절차를 마치면 다시 이용하실 수 있습니다.">
      <DormantReleaseForm />
    </AuthShell>
  )
}
