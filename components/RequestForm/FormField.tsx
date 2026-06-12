import type { ReactNode } from 'react'
import { errorTextClass } from './styles'

export function FormField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-body-sm font-medium text-neutral-700">{label}</span>
      {children}
      {error && <span className={errorTextClass}>{error}</span>}
    </label>
  )
}
