// Design Ref: §5.4 Request Form — Step1 (whatLookingFor + category). Phase 2: also rendered
// inside the Hero (variant="hero") — fkp-v0.2-phase2-request-ui.spec.md §2.1.
'use client'

import { useEffect, useState } from 'react'
import type { Dictionary } from '@/lib/i18n/types'
import type { RequestFormState } from '@/types/request-form'
import { FormField } from './FormField'
import { CustomSelect } from './CustomSelect'
import { inputClass, primaryButtonClass } from './styles'

const CATEGORY_HIGHLIGHT_MS = 1200

interface Step1Props {
  dict: Dictionary['requestForm']
  categoriesDict: Dictionary['categories']
  formData: RequestFormState
  errors: Record<string, string>
  onChange: (field: keyof RequestFormState, value: string) => void
  onNext: () => void
  /** 'hero': used inside the Hero mini-form — hides the "Step 1 of 3" label and left-aligns
   * the CTA (ui spec §2.1). 'panel' (default): original behavior, used in the continuation
   * panel's [Edit] mode and the /request page's flat form. */
  variant?: 'hero' | 'panel'
  /** Overrides the button label (Hero uses hero.ctaText, e.g. "Start My Request", instead
   * of the generic "Next" — copy spec §1). Defaults to dict.buttons.next. */
  nextLabel?: string
  /** Fired on first focus of either field — used to mark form_start (flow spec §6). */
  onFieldFocus?: () => void
  /** Bumps to flash the category field — used when a Categories card click prefills
   * `category` while Hero is already visible, so the change isn't silent (flow spec §5.1). */
  categoryHighlightKey?: number
}

export function Step1({
  dict,
  categoriesDict,
  formData,
  errors,
  onChange,
  onNext,
  variant = 'panel',
  nextLabel,
  onFieldFocus,
  categoryHighlightKey,
}: Step1Props) {
  const { step1, selectPlaceholder } = dict
  const isHero = variant === 'hero'
  const buttonLabel = nextLabel ?? dict.buttons.next

  const [categoryHighlighted, setCategoryHighlighted] = useState(false)
  useEffect(() => {
    if (!categoryHighlightKey) return
    setCategoryHighlighted(true)
    const timer = window.setTimeout(() => setCategoryHighlighted(false), CATEGORY_HIGHLIGHT_MS)
    return () => window.clearTimeout(timer)
  }, [categoryHighlightKey])

  return (
    <div className="flex flex-col gap-5">
      {!isHero && <p className="text-label-button text-primary-600">{step1.label}</p>}

      <FormField label={step1.whatLookingFor.label} error={errors.whatLookingFor}>
        <textarea
          className={inputClass}
          rows={3}
          placeholder={step1.whatLookingFor.placeholder}
          value={formData.whatLookingFor}
          onChange={(e) => onChange('whatLookingFor', e.target.value)}
          onFocus={onFieldFocus}
        />
      </FormField>

      <FormField label={step1.category.label} error={errors.category}>
        <CustomSelect
          className={`transition-shadow duration-300 ${categoryHighlighted ? 'ring-2 ring-primary-400 ring-offset-2' : ''}`}
          value={formData.category}
          onChange={(value) => onChange('category', value)}
          onFocus={onFieldFocus}
          placeholder={selectPlaceholder}
          options={Object.entries(categoriesDict.items).map(([key, info]) => ({ value: key, label: info.name }))}
        />
      </FormField>

      {isHero ? (
        <button type="button" onClick={onNext} className={`${primaryButtonClass} self-start`}>
          {buttonLabel}
        </button>
      ) : (
        <div className="flex justify-end">
          <button type="button" onClick={onNext} className={primaryButtonClass}>
            {buttonLabel}
          </button>
        </div>
      )}
    </div>
  )
}
