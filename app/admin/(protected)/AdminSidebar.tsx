'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { MenuNode } from './layout'
import { MenuIcon } from '@/components/admin/MenuIcon'
import { SignOutButton } from './SignOutButton'

function NavItem({ node, depth }: { node: MenuNode; depth: number }) {
  const pathname = usePathname()
  const isGroup = node.menu_type === 'group' || !node.path
  const isActive = node.path === pathname

  if (isGroup) {
    return (
      <div className="mt-4 first:mt-0">
        <p className="px-3 admin-label-sm uppercase tracking-wide text-sidebar-textSection">{node.display_name}</p>
        {node.children.length > 0 && (
          <div className="mt-1 flex flex-col gap-0.5">
            {node.children.map((child) => (
              <NavItem key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link
      href={node.path!}
      className={`relative flex items-center gap-2.5 rounded-input px-3 py-2 admin-body-sm transition-colors ${
        isActive ? 'bg-sidebar-active font-medium text-neutral-0' : 'text-sidebar-textInactive hover:bg-white/5 hover:text-neutral-0'
      }`}
      style={{ marginLeft: depth > 1 ? `${(depth - 1) * 12}px` : undefined }}
    >
      {isActive && <span className="absolute -left-3 top-0 h-full w-[3px] rounded-r bg-sidebar-accentBar" />}
      <MenuIcon
        code={node.icon ?? node.code}
        className={`h-5 w-5 shrink-0 ${isActive ? 'text-sidebar-activeIcon' : 'text-sidebar-iconInactive'}`}
      />
      <span className="truncate">{node.display_name}</span>
    </Link>
  )
}

export function AdminSidebar({ menuTree, displayName }: { menuTree: MenuNode[]; displayName: string }) {
  return (
    <nav className="flex w-60 shrink-0 flex-col bg-sidebar">
      <div className="flex flex-col gap-0.5 bg-sidebar-footer px-4 py-5">
        <p className="admin-heading-3 text-neutral-0">FKP Admin</p>
        <p className="admin-body-sm text-sidebar-textSection">Seepn Platform</p>
      </div>
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-4">
        {menuTree.map((node) => (
          <NavItem key={node.id} node={node} depth={1} />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 bg-sidebar-footer px-4 py-3">
        <p className="admin-body-sm truncate text-neutral-0">{displayName}</p>
        <SignOutButton />
      </div>
    </nav>
  )
}
