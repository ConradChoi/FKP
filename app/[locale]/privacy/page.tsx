import { getDictionary, locales } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/types'
import { LegalPage } from '@/components/LegalPage'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function PrivacyPolicyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const dict = getDictionary(locale as Locale)

  return (
    <LegalPage
      locale={locale as Locale}
      slug="privacy"
      headerDict={dict.header}
      backToHomeLabel={dict.legal.backToHome}
    />
  )
}
