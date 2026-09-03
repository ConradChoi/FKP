// Plain CSS bar (no charting library — Admin UI hasn't needed one yet, and this is simple
// enough not to justify adding a dependency for it now).
export function DistributionBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between admin-body-sm">
        <span className="text-neutral-700">{label}</span>
        <span className="text-neutral-500">
          {count}건 ({pct}%)
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
