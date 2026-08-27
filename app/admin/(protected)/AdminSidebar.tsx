'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { MenuNode } from './layout'

function NavItem({ node, depth }: { node: MenuNode; depth: number }) {
  const pathname = usePathname()
  const isGroup = node.menu_type === 'group' || !node.path
  const isActive = node.path === pathname

  if (isGroup) {
    return (
      <div className="mt-4 first:mt-0">
        <p className="px-3 text-body-sm font-semibold text-neutral-500">{node.display_name}</p>
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
      className={`rounded-input px-3 py-2 text-body-sm transition-colors ${
        isActive ? 'bg-primary-50 font-medium text-primary-700' : 'text-neutral-600 hover:bg-neutral-100'
      }`}
      style={{ marginLeft: depth > 1 ? `${(depth - 1) * 12}px` : undefined }}
    >
      {node.display_name}
    </Link>
  )
}

export function AdminSidebar({ menuTree }: { menuTree: MenuNode[] }) {
  return (
    <nav className="flex w-56 shrink-0 flex-col gap-0.5 border-r border-neutral-200 bg-neutral-0 p-4">
      <p className="mb-4 px-3 text-body font-semibold text-primary-900">FKP Admin</p>
      {menuTree.map((node) => (
        <NavItem key={node.id} node={node} depth={1} />
      ))}
    </nav>
  )
}
