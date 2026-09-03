// Design Ref: seepn-admin-ui-design-system.spec.md §4.4 — document-progress indicator, used
// only on /admin/partners (leads have no document-submission workflow to track).
export function ProgressBar({
  value,
  total,
  tone,
}: {
  value: number
  total: number
  tone: 'complete' | 'in-progress'
}) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  const fillClass = tone === 'complete' ? 'bg-secondary-500' : 'bg-accent-500'

  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-neutral-200">
        <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="admin-body-sm text-neutral-500">
        {value}/{total}
      </span>
    </div>
  )
}
