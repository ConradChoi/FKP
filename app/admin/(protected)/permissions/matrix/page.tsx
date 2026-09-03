// Design Ref: E3-R6 (권한관리 > 메뉴권한관리 — 역할 × 메뉴 매트릭스). super_admin's row is
// shown read-only (always full access) — INV-4 means role_menu_permission is never
// consulted for that role, so editing it here would have zero effect either way;
// set_role_menu_permission's own guard also refuses the write, this is just UI clarity.
import { redirect } from 'next/navigation'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { buildMenuTree, flattenMenuTree } from '@/lib/admin/menuTree'
import { PermissionMatrix } from './PermissionMatrix'

export default async function PermissionMatrixPage() {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  const [{ data: roles, error: rolesError }, { data: menus, error: menusError }, { data: permissions, error: permError }] =
    await Promise.all([
      supabase.from('role').select('id, code, display_name').order('display_name'),
      supabase
        .from('menu')
        .select('id, code, parent_id, display_name, menu_type, sort_order')
        .eq('is_active', true)
        .order('sort_order'),
      supabase.from('role_menu_permission').select('role_id, menu_id, can_read, can_create, can_update, can_delete, can_export'),
    ])

  const error = rolesError ?? menusError ?? permError
  const tree = buildMenuTree(menus ?? [])
  const flatMenus = flattenMenuTree(tree)

  return (
    <div>
      <p className="admin-body-sm text-neutral-600">역할별로 메뉴에 대한 읽기/생성/수정/삭제/내보내기 권한을 지정합니다.</p>

      {error && <p className="mt-4 admin-body-sm text-error">불러오지 못했습니다: {error.message}</p>}

      <PermissionMatrix roles={roles ?? []} flatMenus={flatMenus} permissions={permissions ?? []} />
    </div>
  )
}
