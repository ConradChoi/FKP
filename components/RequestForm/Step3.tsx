// Design Ref: §5.4 Request Form — Step3 (companyNameWebsite/contact) + §7 honeypot
'use client'

import Link from 'next/link'
import type { Dictionary, Locale } from '@/lib/i18n/types'
import type { ConsentState, RequestFormState } from '@/types/request-form'
import { FormField } from './FormField'
import { errorTextClass, inputClass, primaryButtonClass, secondaryButtonClass } from './styles'

interface Step3Props {
  dict: Dictionary['requestForm']
  formData: RequestFormState
  errors: Record<string, string>
  onChange: (field: keyof RequestFormState, value: string) => void
  consent: ConsentState
  onConsentChange: (field: keyof ConsentState, value: boolean) => void
  onBack: () => void
  locale: Locale
}

export function Step3({ dict, formData, errors, onChange, consent, onConsentChange, onBack, locale }: Step3Props) {
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

      {/* Design Ref: privacy review §4.2 — 개인정보 동의 / 이용약관 동의는 별도 체크박스로
          분리, 기본 미체크, 각 체크박스 옆 전문 링크(새 창) 병기. */}
      <div className="flex flex-col gap-2 rounded-input border border-neutral-200 p-4">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={consent.privacy}
            onChange={(e) => onConsentChange('privacy', e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-body-sm text-neutral-700">
            {step3.consent.privacy.before}
            <Link
              href={`/${locale}/privacy`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary-600"
              onClick={(e) => e.stopPropagation()}
            >
              {step3.consent.privacy.linkText}
            </Link>
            {step3.consent.privacy.after}
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={consent.terms}
            onChange={(e) => onConsentChange('terms', e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-body-sm text-neutral-700">
            {step3.consent.terms.before}
            <Link
              href={`/${locale}/terms`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary-600"
              onClick={(e) => e.stopPropagation()}
            >
              {step3.consent.terms.linkText}
            </Link>
            {step3.consent.terms.after}
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={consent.marketing}
            onChange={(e) => onConsentChange('marketing', e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-body-sm text-neutral-700">{step3.consent.marketingLabel}</span>
        </label>
        {errors.consent && <span className={errorTextClass}>{errors.consent}</span>}
      </div>

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
