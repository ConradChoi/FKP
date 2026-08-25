// Design Ref: fkp-v0.2-privacy-review-phase3-rbac.md INV-2 ("메뉴 트리는 DB가 SSOT... 로그인
// 후 API 1회 호출로 사이드바를 그린다") — the sidebar below is built entirely from
// public.my_menu_tree(), never a hardcoded array. Hiding a menu here is a UX convenience
// only (INV-3); every page/route this sidebar links to re-checks its own permission
// independently, so a stale or manipulated client can't grant access the DB wouldn't.
import { redirect } from 'next/navigation'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { AdminSidebar } from './AdminSidebar'
import { SignOutButton } from './SignOutButton'
import { NotificationBell } from './NotificationBell'

export interface MenuNode {
  id: string
  code: string
  parent_id: string | null
  display_name: string
  path: string | null
  icon: string | null
  menu_type: string
  sort_order: number
  children: MenuNode[]
}

function buildTree(rows: Omit<MenuNode, 'children'>[]): MenuNode[] {
  const byId = new Map<string, MenuNode>(rows.map((r) => [r.id, { ...r, children: [] }]))
  const roots: MenuNode[] = []
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  const { data: menuRows } = await supabase.rpc('my_menu_tree')
  const menuTree = buildTree(menuRows ?? [])

  const { count: pendingAccessRequests } = await supabase
    .from('admin_access_request')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <AdminSidebar menuTree={menuTree} />
      <div className="flex-1">
        <header className="flex items-center justify-end border-b border-neutral-200 bg-neutral-0 px-6 py-3">
          <div className="flex items-center gap-3">
            <p className="text-body-sm text-neutral-600">
              {context.display_name}님 ({(context.role_codes as string[])?.join(', ')})
            </p>
            <NotificationBell pendingAccessRequests={pendingAccessRequests ?? 0} />
            <SignOutButton />
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
