// Design Ref: §11.1 File Structure — html lang, GTM 스크립트, LanguageSwitcher(module-2)
// Plan SC: `/en` `/ja` 정적 빌드, GA4 이벤트 수집
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import { getDictionary, locales } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/types'
import '../globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://findkoreanpartners.com'
const GA_ID = process.env.NEXT_PUBLIC_GA_ID
const GTM_ID = 'GTM-5ZLWG9R8'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const dict = getDictionary(locale as Locale)

  return {
    title: dict.meta.title,
    description: dict.meta.description,
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: `${SITE_URL}/${locale}`,
      languages: {
        en: `${SITE_URL}/en`,
        ja: `${SITE_URL}/ja`,
      },
    },
    openGraph: {
      title: dict.meta.title,
      description: dict.meta.description,
      url: `${SITE_URL}/${locale}`,
      locale: locale === 'ja' ? 'ja_JP' : 'en_US',
      type: 'website',
    },
  }
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <html lang={locale} className={inter.variable}>
      <body className="font-sans">
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {children}
        <Script id="gtm-init" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', { send_page_view: false });
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  )
}
