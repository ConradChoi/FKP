// 휴면 전환 후 1년이 지나 삭제된 회원(buyer_account.auth_purge_pending)의 로그인 계정(auth.users)을
// 삭제한다. DB 쪽 데이터 삭제·비식별화는 run_daily_retention_batches()가 이미 끝냈고, SQL은
// auth.users를 지울 수 없어 이 라우트가 뒷정리를 맡는다(purge-partner-documents와 같은 호출 방식).
import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/adminClient'

const BATCH_LIMIT = 100

function isAuthorized(request: Request): boolean {
  const secret = process.env.PARTNER_DOC_PURGE_CRON_SECRET?.trim()
  if (!secret) return false // fail closed
  return (request.headers.get('authorization')?.trim() ?? '') === `Bearer ${secret}`
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const adminClient = getSupabaseAdminClient()
  if (!adminClient) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })

  const { data: pending, error: selectError } = await adminClient.rpc('select_buyer_auth_purge_pending', { p_limit: BATCH_LIMIT })
  if (selectError) {
    console.error(`purge-dormant-buyers: select failed: ${selectError.message}`)
    return NextResponse.json({ error: 'select_failed' }, { status: 500 })
  }

  const rows = (pending ?? []) as { account_id: string }[]
  let deleted = 0
  let failed = 0
  for (const row of rows) {
    // Detach first (buyer_account.auth_user_id has ON DELETE RESTRICT), then delete the auth user.
    const { data: authUserId, error: detachError } = await adminClient.rpc('buyer_detach_auth_principal', { p_account_id: row.account_id })
    if (detachError || !authUserId) {
      failed += 1
      console.error(`purge-dormant-buyers: detach failed for account=${row.account_id}: ${detachError?.message ?? 'no auth user'}`)
      continue
    }
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(authUserId as string)
    if (deleteError) {
      // Orphan login left behind: block it so it cannot be used, and report the failure.
      failed += 1
      console.error(`purge-dormant-buyers: deleteUser failed for auth_user=${authUserId}: ${deleteError.message}`)
      await adminClient.auth.admin.updateUserById(authUserId as string, { ban_duration: '876000h' })
      continue
    }
    deleted += 1
  }
  return NextResponse.json({ success: true, scanned: rows.length, deleted, failed })
}
