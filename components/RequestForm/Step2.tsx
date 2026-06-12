// Design Ref: §5.4 Request Form — Step2 (partnerType/purpose/description/budget/timeline/englishSpeaking)
'use client'

import type { Dictionary } from '@/lib/i18n/types'
import type { RequestFormState } from '@/types/request-form'
import { FormField } from './FormField'
import { inputClass, primaryButtonClass, secondaryButtonClass } from './styles'

interface Step2Props {
  dict: Dictionary['requestForm']
  formData: RequestFormState
  errors: Record<string, string>
  onChange: (field: keyof RequestFormState, value: string) => void
  onNext: () => void
  onBack: () => void
}

export function Step2({ dict, formData, errors, onChange, onNext, onBack }: Step2Props) {
  const { step2, selectPlaceholder } = dict

  return (
    <div className="flex flex-col gap-5">
      <p className="text-label-button text-primary-600">{step2.label}</p>

      <FormField label={step2.partnerType.label} error={errors.partnerType}>
        <select
          className={inputClass}
          value={formData.partnerType}
          onChange={(e) => onChange('partnerType', e.target.value)}
        >
          <option value="">{selectPlaceholder}</option>
          {Object.entries(step2.partnerType.options).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label={step2.purpose.label} error={errors.purpose}>
        <input
          type="text"
          className={inputClass}
          placeholder={step2.purpose.placeholder}
          value={formData.purpose}
          onChange={(e) => onChange('purpose', e.target.value)}
        />
      </FormField>

      <FormField label={step2.description.label} error={errors.description}>
        <textarea
          className={inputClass}
          rows={4}
          placeholder={step2.description.placeholder}
          value={formData.description}
          onChange={(e) => onChange('description', e.target.value)}
        />
      </FormField>

      <FormField label={step2.budget.label} error={errors.budget}>
        <select
          className={inputClass}
          value={formData.budget}
          onChange={(e) => onChange('budget', e.target.value)}
        >
          <option value="">{selectPlaceholder}</option>
          {Object.entries(step2.budget.options).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label={step2.timeline.label} error={errors.timeline}>
        <select
          className={inputClass}
          value={formData.timeline}
          onChange={(e) => onChange('timeline', e.target.value)}
        >
          <option value="">{selectPlaceholder}</option>
          {Object.entries(step2.timeline.options).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label={step2.englishSpeaking.label} error={errors.englishSpeaking}>
        <select
          className={inputClass}
          value={formData.englishSpeaking}
          onChange={(e) => onChange('englishSpeaking', e.target.value)}
        >
          <option value="">{selectPlaceholder}</option>
          {Object.entries(step2.englishSpeaking.options).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </FormField>

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className={secondaryButtonClass}>
          {dict.buttons.back}
        </button>
        <button type="button" onClick={onNext} className={primaryButtonClass}>
          {dict.buttons.next}
        </button>
      </div>
    </div>
  )
}
