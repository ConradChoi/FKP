// Design Ref: E3-R5 (권한관리 > 메뉴관리 — 메뉴 CRUD, 계층/정렬/노출). Fetches raw public.menu
// rows directly (not my_menu_tree(), which filters to is_active=true only — an operator
// managing menus needs to see inactive ones too, to reactivate them).
import { redirect } from 'next/navigation'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { buildMenuTree, flattenMenuTree } from '@/lib/admin/menuTree'
import { MenuRowEditor } from './MenuRowEditor'
import { NewMenuForm } from './NewMenuForm'

export interface MenuRecord {
  id: string
  code: string
  parent_id: string | null
  display_name: string
  path: string | null
  menu_type: string
  sort_order: number
  is_active: boolean
}

export default async function MenusPage() {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  const { data: menus, error } = await supabase
    .from('menu')
    .select('id, code, parent_id, display_name, path, menu_type, sort_order, is_active')
    .order('sort_order')

  const tree = buildMenuTree<MenuRecord>(menus ?? [])
  const flat = flattenMenuTree(tree)
  const parentOptions = (menus ?? []).filter((m) => m.menu_type === 'group')

  return (
    <div className="mx-auto max-w-[900px]">
      <h1 className="text-h3 text-primary-900">메뉴관리</h1>
      <p className="mt-1 text-body-sm text-neutral-600">
        여기서 관리하는 메뉴가 사이드바 내비게이션과 접근 권한 판정의 기준입니다.
      </p>

      {error && <p className="mt-4 text-body-sm text-error">목록을 불러오지 못했습니다: {error.message}</p>}

      <NewMenuForm parentOptions={parentOptions} />

      <div className="mt-6 overflow-x-auto rounded-card border border-neutral-200 bg-neutral-0">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="px-4 py-3 font-medium">표시명</th>
              <th className="px-4 py-3 font-medium">코드</th>
              <th className="px-4 py-3 font-medium">경로</th>
              <th className="px-4 py-3 font-medium">정렬</th>
              <th className="px-4 py-3 font-medium">노출</th>
              <th className="px-4 py-3 font-medium">삭제</th>
            </tr>
          </thead>
          <tbody>
            {flat.map(({ node, depth, isFirst, isLast }) => (
              <MenuRowEditor key={node.id} menu={node} depth={depth} isFirst={isFirst} isLast={isLast} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
