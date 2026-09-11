// Design Ref: seepn-buyer-web-p5b.screen-spec.md §4.4 — "로딩 중: 스켈레톤 컬럼(선택 개수만큼)".
// Route-level loading.tsx (Next.js App Router convention) shown while the page.tsx server
// component awaits its Supabase queries. The exact column count isn't known at this layer (no
// access to `?ids=` here), so a generic 3-column skeleton is used — same tradeoff as
// PartnerCardSkeleton elsewhere in this codebase (approximate shape, not exact).
export default function CompareLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <div className="border-b border-neutral-200 bg-neutral-0 px-4 py-4">
        <div className="mx-auto h-5 w-24 max-w-5xl animate-pulse rounded bg-neutral-200" />
      </div>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <div className="h-7 w-40 animate-pulse rounded bg-neutral-200" />
        <div className="mt-6 overflow-hidden rounded-card border border-neutral-200 bg-neutral-0">
          <div className="grid grid-cols-4 gap-px bg-neutral-100">
            {Array.from({ length: 4 }).map((_, col) => (
              <div key={col} className="space-y-3 bg-neutral-0 p-4">
                {Array.from({ length: 6 }).map((_, row) => (
                  <div key={row} className="h-4 animate-pulse rounded bg-neutral-100" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
