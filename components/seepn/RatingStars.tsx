// Read-only 1~5 star display (rounded to the nearest star). Purely presentational.
export function RatingStars({ value, className }: { value: number; className?: string }) {
  const filled = Math.round(value)
  return (
    <span className={className} role="img" aria-label={`5점 만점에 ${value.toFixed(1)}점`}>
      <span className="text-accent-600">{'★'.repeat(filled)}</span>
      <span className="text-neutral-300">{'★'.repeat(5 - filled)}</span>
    </span>
  )
}
