// Design Ref: fkp-v0.2-phase2-request-flow.spec.md §5 (header nav scroll routing),
// fkp-v0.2-phase2-request-ui.spec.md §6.2 (success reset sequence, prefers-reduced-motion)
'use client'

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function smoothScrollToId(id: string) {
  if (typeof document === 'undefined') return
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
}

export function scrollToTop() {
  if (typeof window === 'undefined') return
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}

/** Focuses the first input/textarea/select found within the element with the given id. */
export function focusFirstFieldWithin(id: string) {
  if (typeof document === 'undefined') return
  const container = document.getElementById(id)
  const field = container?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    'input, textarea, select',
  )
  field?.focus()
}
