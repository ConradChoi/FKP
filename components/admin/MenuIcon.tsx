// Design Ref: seepn-admin-ui-design-system.spec.md §3.2 (AdminSidebar NavItem) — inline-SVG
// icon-code lookup, matching NotificationBell.tsx's existing inline-SVG convention (no icon
// library). `public.menu.icon` is currently null on every seeded row (no migration has ever
// populated it), so AdminSidebar passes `node.icon ?? node.code` — this lets icons render today
// by matching on the stable `code` values already in the DB, without needing a schema-data
// migration just to unblock the visual re-skin. Any code with no entry below falls back to a
// plain dot glyph rather than rendering nothing.
const PATHS: Record<string, string> = {
  dashboard: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z',
  lead_management: 'M4 6h16M4 12h16M4 18h9',
  content_management: 'M6 4h9l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm8 0v5h5',
  operator_management: 'M16 11a4 4 0 1 0-4-4M6 20v-1a4 4 0 0 1 4-4h1m9 5v-1a4 4 0 0 0-3-3.87M9 7a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z',
  permission_management: 'M12 3l7 3v6c0 4.5-3 8.25-7 9-4-.75-7-4.5-7-9V6l7-3Z',
  menu_management: 'M4 6h16M4 12h16M4 18h16',
  role_menu_permission_management: 'M9 5H4v14h16V5h-5M9 5v14M9 5l3-2 3 2',
  access_requests: 'M15 17h5l-1.6-1.6a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9',
  board_blog: 'M4 19V7a2 2 0 0 1 2-2h9l5 5v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Zm4-8h8m-8 4h5',
  board_example: 'M4 5h16v10H4V5Zm4 14h8m-4-4v4',
  board_faq: 'M12 18h.01M9.5 9a2.5 2.5 0 1 1 3.5 2.29c-.83.38-1.5 1.1-1.5 2.21v.5',
  partner_management: 'M3 21V9l9-6 9 6v12h-6v-7H9v7H3Z',
  standard_category_management: 'M4 5h7v7H4V5Zm9 0h7v4h-7V5ZM4 15h4v4H4v-4Zm7 0h9v4h-9v-4Z',
}

export function MenuIcon({ code, className = 'h-5 w-5' }: { code: string | null; className?: string }) {
  const d = code ? PATHS[code] : undefined

  if (!d) {
    return (
      <span className={`flex items-center justify-center ${className}`} aria-hidden="true">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      </span>
    )
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}
