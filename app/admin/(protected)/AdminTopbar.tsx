'use client'

import { usePathname } from 'next/navigation'
import { flattenMenuTree, findMenuForPath } from '@/lib/admin/menuTree'
import { Avatar } from '@/components/admin/Avatar'
import { NotificationBell } from './NotificationBell'
import { SignOutButton } from './SignOutButton'
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
        <NotificationBell pendingAccessRequests={pendingAccessRequests} />
        <div className="flex items-center gap-2">
          <Avatar name={displayName} size="sm" />
          <div className="hidden leading-tight sm:block">
            <p className="admin-body-sm text-neutral-700">{displayName}</p>
            <p className="admin-label-sm text-neutral-400">{roleCodes.join(', ')}</p>
          </div>
        </div>
        <SignOutButton />
      </div>
    </header>
  )
}
