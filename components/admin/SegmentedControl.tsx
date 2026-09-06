// Design Ref: human-matching.ui-spec.md §4.2/§8 item 2 — 판정(judge_status) 세그먼트 버튼.
// Generalized (not judge_status-specific) per the UI spec's explicit instruction: "이 화면
// 외에 향후 다른 3지선다 상태에도 재사용 가능성이 있으므로 judge_status 전용으로 하드코딩하지
// 말 것". Renders as `inline-flex rounded-input border border-neutral-300 overflow-hidden`
// with `border-l` dividers between options (ui-spec §4.2).
export interface SegmentedControlOption<T extends string> {
  value: T
  label: string
  activeClassName: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: SegmentedControlOption<T>[]
  value: T
  onChange: (next: T) => void
  disabled?: boolean
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-input border border-neutral-300">
      {options.map((opt, idx) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 admin-body-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            idx > 0 ? 'border-l border-neutral-300' : ''
          } ${value === opt.value ? opt.activeClassName : 'bg-neutral-0 text-neutral-500 hover:bg-neutral-50'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
