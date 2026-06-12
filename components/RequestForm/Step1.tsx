// Design Ref: §5.4 Request Form — Step1 (whatLookingFor + category)
'use client'

import type { Dictionary } from '@/lib/i18n/types'
import type { RequestFormState } from '@/types/request-form'
import { FormField } from './FormField'
import { inputClass, primaryButtonClass } from './styles'

interface Step1Props {
  dict: Dictionary['requestForm']
  categoriesDict: Dictionary['categories']
  formData: RequestFormState
  errors: Record<string, string>
  onChange: (field: keyof RequestFormState, value: string) => void
  onNext: () => void
}

export function Step1({ dict, categoriesDict, formData, errors, onChange, onNext }: Step1Props) {
  const { step1 } = dict

  const { selectPlaceholder } = dict

  return (
    <div className="flex flex-col gap-5">
      <p className="text-label-button text-primary-600">{step1.label}</p>

      <FormField label={step1.whatLookingFor.label} error={errors.whatLookingFor}>
        <textarea
          className={inputClass}
          rows={3}
          placeholder={step1.whatLookingFor.placeholder}
          value={formData.whatLookingFor}
          onChange={(e) => onChange('whatLookingFor', e.target.value)}
        />
      </FormField>

      <FormField label={step1.category.label} error={errors.category}>
        <select
          className={inputClass}
          value={formData.category}
          onChange={(e) => onChange('category', e.target.value)}
        >
          <option value="">{selectPlaceholder}</option>
          {Object.entries(categoriesDict.items).map(([key, info]) => (
            <option key={key} value={key}>
              {info.name}
            </option>
          ))}
        </select>
      </FormField>

      <div className="flex justify-end">
        <button type="button" onClick={onNext} className={primaryButtonClass}>
          {dict.buttons.next}
        </button>
      </div>
    </div>
  )
}
