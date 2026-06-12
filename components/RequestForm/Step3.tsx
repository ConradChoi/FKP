// Design Ref: §5.4 Request Form — Step3 (companyNameWebsite/contact) + §7 honeypot
'use client'

import type { Dictionary } from '@/lib/i18n/types'
import type { RequestFormState } from '@/types/request-form'
import { FormField } from './FormField'
import { inputClass, primaryButtonClass, secondaryButtonClass } from './styles'

interface Step3Props {
  dict: Dictionary['requestForm']
  formData: RequestFormState
  errors: Record<string, string>
  onChange: (field: keyof RequestFormState, value: string) => void
  onBack: () => void
}

export function Step3({ dict, formData, errors, onChange, onBack }: Step3Props) {
  const { step3 } = dict

  return (
    <div className="flex flex-col gap-5">
      <p className="text-label-button text-primary-600">{step3.label}</p>

      <FormField label={step3.companyNameWebsite.label} error={errors.companyNameWebsite}>
        <input
          type="text"
          className={inputClass}
          placeholder={step3.companyNameWebsite.placeholder}
          value={formData.companyNameWebsite}
          onChange={(e) => onChange('companyNameWebsite', e.target.value)}
        />
      </FormField>

      <FormField label={step3.contact.label} error={errors.contact}>
        <input
          type="text"
          className={inputClass}
          placeholder={step3.contact.placeholder}
          value={formData.contact}
          onChange={(e) => onChange('contact', e.target.value)}
        />
      </FormField>

      <input
        type="text"
        name="website_url"
        value={formData.honeypot}
        onChange={(e) => onChange('honeypot', e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className={secondaryButtonClass}>
          {dict.buttons.back}
        </button>
        <button type="submit" className={primaryButtonClass}>
          {dict.buttons.submit}
        </button>
      </div>
    </div>
  )
}
