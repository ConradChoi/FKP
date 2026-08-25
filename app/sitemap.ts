// Design Ref: §10.3 Environment Variables — NEXT_PUBLIC_SITE_URL, locales(en/ja)
import type { MetadataRoute } from 'next'
import { locales } from '@/lib/i18n/dictionaries'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://findkoreanpartners.com'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((locale) => [
    { url: `${SITE_URL}/${locale}`, lastModified: new Date() },
    // Phase 2 (fkp-v0.2-phase2-request-flow.spec.md §3) — dedicated outreach URL.
    { url: `${SITE_URL}/${locale}/request`, lastModified: new Date() },
  ])
}
