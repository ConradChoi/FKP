'use client'

import { usePathname } from 'next/navigation'
import { flattenMenuTree, findMenuForPath } from '@/lib/admin/menuTree'
import { Avatar } from '@/components/admin/Avatar'
import { NotificationBell } from './NotificationBell'
import type { MenuNode } from './layout'

export function AdminTopbar({
  menuTree,
  displayName,
  roleCodes,
  pendingAccessRequests,
}: {
  menuTree: MenuNode[]
  displayName: string
  roleCodes: string[]
  pendingAccessRequests: number
}) {
  const pathname = usePathname()
  const currentMenu = findMenuForPath(flattenMenuTree(menuTree), pathname)

  return (
    <header className="flex h-16 items-center justify-between border-b border-neutral-200 bg-neutral-0 px-6">
      <h1 className="admin-heading-2 text-neutral-900">{currentMenu?.display_name ?? 'FKP Admin'}</h1>
      <div className="flex items-center gap-4">
        {/* Design Ref: seepn-admin-ui-design-system.spec.md OQ-5 — no search target defined yet
            (leads? partners? categories? all of them?), so this stays disabled until
            service-planner specifies scope. */}
        <input
          type="search"
          disabled
          placeholder="검색 (준비 중)"
          className="hidden w-56 rounded-input border border-neutral-200 bg-neutral-50 px-3 py-1.5 admin-body-sm text-neutral-400 placeholder:text-neutral-400 sm:block"
        />
        <NotificationBell pendingAccessRequests={pendingAccessRequests} />
        <div className="flex items-center gap-2">
          <Avatar name={displayName} size="sm" />
          <div className="hidden leading-tight sm:block">
            <p className="admin-body-sm text-neutral-700">{displayName}</p>
            <p className="admin-label-sm text-neutral-400">{roleCodes.join(', ')}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
