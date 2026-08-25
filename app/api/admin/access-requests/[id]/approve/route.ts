// Design Ref: fkp-v0.2-privacy-review-phase3-rbac.md §6.6 — the one place in this codebase
// that legitimately needs the service_role key: creating a real Supabase Auth user is an
// Auth Admin API operation, unreachable from SQL. Authorization is checked TWICE (INV-8):
// once here against the caller's own session (has_menu_permission_check), and again by
// finalize_admin_access_approval's own logic — though that function trusts this route's
// admin id, so the check here is the real gate. Never let this route be reachable without it.
import { NextResponse } from 'next/server'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { getSupabaseAdminClient } from '@/lib/supabase/adminClient'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://findkoreanpartners.com'
const ALLOWED_ROLES = new Set(['operator', 'viewer'])

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authClient = await getSupabaseAuthServerClient()
  if (!authClient) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })

  const {
    data: { user },
  } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: allowed } = await authClient.rpc('has_menu_permission_check', {
    p_menu_code: 'operator_management',
    p_action: 'update',
  })
  if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { data: context } = await authClient.rpc('get_my_admin_context')
  const approverAdminId = context?.admin_user_id as string | undefined
  if (!approverAdminId) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let body: { roleCode?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const roleCode = body.roleCode
  if (!roleCode || !ALLOWED_ROLES.has(roleCode)) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
  }

  const { data: reqRow, error: fetchError } = await authClient
    .from('admin_access_request')
    .select('id, email, status')
    .eq('id', id)
    .single()

  if (fetchError || !reqRow) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (reqRow.status !== 'pending') return NextResponse.json({ error: 'not_pending' }, { status: 409 })

  const adminClient = getSupabaseAdminClient()
  if (!adminClient) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })

  const { data: invite, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(reqRow.email, {
    redirectTo: `${SITE_URL}/admin/set-password`,
  })
  if (inviteError || !invite?.user) {
    return NextResponse.json({ error: inviteError?.message ?? 'invite_failed' }, { status: 500 })
  }

  const { error: finalizeError } = await adminClient.rpc('finalize_admin_access_approval', {
    p_request_id: id,
    p_auth_user_id: invite.user.id,
    p_role_code: roleCode,
    p_approved_by_admin_id: approverAdminId,
  })

  if (finalizeError) {
    // The auth user now exists but DB linkage failed — surface this clearly rather than
    // silently losing track of it; manual cleanup/retry is needed via the Supabase console.
    return NextResponse.json(
      { error: `invite_created_but_finalize_failed: ${finalizeError.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true })
}
