'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setMenuPermissionAction, type PermissionFlag } from './actions'

interface Role {
  id: string
  code: string
  display_name: string
}

interface MenuNode {
  id: string
  code: string
  display_name: string
  menu_type: string
}

interface PermissionRow {
  role_id: string
  menu_id: string
  can_read: boolean
  can_create: boolean
  can_update: boolean
  can_delete: boolean
  can_export: boolean
}

const FLAGS: { key: PermissionFlag; label: string }[] = [
  { key: 'can_read', label: '읽기' },
  { key: 'can_create', label: '생성' },
  { key: 'can_update', label: '수정' },
  { key: 'can_delete', label: '삭제' },
  { key: 'can_export', label: '내보내기' },
]

export function PermissionMatrix({
  roles,
  flatMenus,
  permissions,
}: {
  roles: Role[]
  flatMenus: { node: MenuNode; depth: number }[]
  permissions: PermissionRow[]
}) {
  const router = useRouter()
  const [activeRoleId, setActiveRoleId] = useState(roles[0]?.id ?? '')
  const [pending, setPending] = useState<string | null>(null)
  const activeRole = roles.find((r) => r.id === activeRoleId)
  const isSuperAdmin = activeRole?.code === 'super_admin'

  function getFlag(menuId: string, flag: PermissionFlag): boolean {
    if (isSuperAdmin) return true
    const row = permissions.find((p) => p.role_id === activeRoleId && p.menu_id === menuId)
    return row?.[flag] ?? false
  }

  async function toggle(menuId: string, flag: PermissionFlag, current: boolean) {
    const key = `${menuId}:${flag}`
    setPending(key)
    await setMenuPermissionAction(activeRoleId, menuId, flag, !current)
    setPending(null)
    router.refresh()
  }

  return (
    <div className="mt-6">
      <div className="flex gap-2 border-b border-neutral-200">
        {roles.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setActiveRoleId(r.id)}
            className={`border-b-2 px-4 py-2 admin-body-sm font-medium transition-colors ${
              r.id === activeRoleId ? 'border-primary-600 text-primary-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {r.display_name}
          </button>
        ))}
      </div>

      {isSuperAdmin && (
        <p className="mt-3 admin-body-sm text-neutral-500">
          super_admin은 이 매트릭스와 무관하게 항상 전체 권한을 가집니다 (읽기 전용으로 표시).
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-card border border-neutral-200 bg-neutral-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200 text-left">
              <th className="px-4 py-3 admin-body-sm font-medium uppercase tracking-wide text-neutral-500">메뉴</th>
              {FLAGS.map((f) => (
                <th key={f.key} className="px-4 py-3 text-center admin-body-sm font-medium uppercase tracking-wide text-neutral-500">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {flatMenus.map(({ node, depth }) => (
              <tr key={node.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2 admin-body" style={{ paddingLeft: `${16 + depth * 20}px` }}>
                  {node.display_name}
                  {node.menu_type === 'group' && <span className="ml-1 admin-label-sm text-neutral-400">(그룹)</span>}
                </td>
                {FLAGS.map((f) => {
                  const key = `${node.id}:${f.key}`
                  const value = getFlag(node.id, f.key)
                  return (
                    <td key={f.key} className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={value}
                        disabled={isSuperAdmin || pending === key}
                        onChange={() => toggle(node.id, f.key, value)}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
