import { NextResponse } from 'next/server'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authClient = await getSupabaseAuthServerClient()
  if (!authClient) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })

  const {
    data: { user },
  } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: context } = await authClient.rpc('get_my_admin_context')
  const adminId = context?.admin_user_id as string | undefined
  if (!adminId) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let body: { reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  if (!body.reason || body.reason.trim().length === 0) {
    return NextResponse.json({ error: 'reason_required' }, { status: 400 })
  }

  // reject_admin_access_request re-checks has_menu_permission('operator_management','update')
  // itself (§ finalize/reject symmetry) — no separate pre-check needed here, unlike approve
  // (which must gate BEFORE calling the Auth Admin API, since that side effect can't be undone).
  const { error } = await authClient.rpc('reject_admin_access_request', {
    p_request_id: id,
    p_rejected_by_admin_id: adminId,
    p_rejection_reason: body.reason.trim().slice(0, 1000),
  })

  if (error) {
    const status = error.message?.includes('insufficient_permission') ? 403 : 409
    return NextResponse.json({ error: error.message }, { status })
  }

  return NextResponse.json({ success: true })
}
