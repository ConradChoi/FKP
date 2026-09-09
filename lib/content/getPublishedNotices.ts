// Design Ref: notice-board-v1.0.prd.md (v3.0 Final) §7.2/§7.5 G-1/G-2, notice-board.screen-spec.md
// §2/§4.2/§4.3/§4.4, notice-board-privacy-review.md §3 (G-1 read-path verdict) / §4.2 (NB-B6).
//
// Partner-facing notice reads (target_audience='partner' only — `seepn_user` has no
// consumption screen yet, Phase 1/WS-4, out of scope here). Three rules this file exists
// to enforce, all privacy-security-officer blocking items:
//
//   1. anon role, on purpose (G-1 / privacy review §3). getSupabaseServerClient() is the
//      SAME anon-key, persistSession:false client lib/content/getPublishedContent.ts
//      already uses for the public FKP site — it is reused here unchanged, NOT a new
//      client. A logged-in partner's own session is `authenticated`, which content_item /
//      content_translation's public RLS policies (`to anon`) do not match, so reading with
//      an authenticated client would return 0 rows (G-1). Do NOT "fix" that by adding a
//      `to authenticated` SELECT policy on content_item/content_translation — privacy
//      review NB-B3: that policy is OR-combined with the existing admin policy and would
//      let every logged-in partner (and every admin lacking content_management) read
//      content_item/content_translation directly via PostgREST, draft rows included.
//      Practical consequence: /supplier/notices' requireSupplierSession() login gate is a
//      UX placement decision, NOT an access-control boundary — everything this file
//      returns is already anon-readable, internet-public data once published (NS-1). Do
//      not put partner-identifying information in notice bodies on the strength of "it's
//      behind a login."
//   2. DB-level positive match only (NB-B6). `.eq('target_audience', 'partner')` is a
//      fail-closed filter — in Postgres, `target_audience = 'partner'` on a NULL row
//      evaluates to NULL, which excludes the row. A JS negative filter like
//      `row.targetAudience !== 'seepn_user'` would be fail-OPEN instead (`null !== 'x'` is
//      `true` in JS) and let a target_audience-less row leak into the partner list. Never
//      write that pattern here.
//   3. This is a DEDICATED query, not a detour through the generic
//      lib/content/getPublishedContent.ts functions. Once 'notice' is a valid
//      content_type, `getPublishedContentList('notice', locale)` becomes a type-legal call
//      that returns ALL notices (partner + seepn_user) with no target_audience filter at
//      all — see the runtime guard added at the top of that file's notice-related
//      functions. This file is the only sanctioned partner notice read path.
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { toContentKey } from './contentTypes'

// screen-spec §7.5 G-2 — lib/i18n/types.ts's `Locale` is `'en' | 'ja'` and is wired into the
// public FKP site's routing/dictionaries end-to-end; adding 'ko' to it would ripple through
// all of that for a feature that doesn't touch the FKP public site at all (D-N0-1: FKP is
// explicitly excluded from notice-board). A separate, notice-scoped locale type lives here
// instead, mirroring content_translation.locale's DB CHECK (en/ja/ko/zh) so it stays valid if
// a later phase (Phase 1 seepn.me, ko/en/ja) reuses this file's shape — but WS-1/WS-2's only
// actual value is 'ko' (partner notices are ko-only, PRD §3.1).
export type ContentLocale = 'ko' | 'en' | 'ja' | 'zh'

const PARTNER_NOTICE_LOCALE: ContentLocale = 'ko'
const PARTNER_AUDIENCE = 'partner' as const

type TranslationRow = { locale: string; body: Record<string, unknown> | null; status: string }
type NoticeItemRow = {
  id: string
  content_key: string
  target_audience: string | null
  created_at: string
  content_translation: TranslationRow[]
}

function pickPublishedKoBody(rows: TranslationRow[]): Record<string, unknown> | null {
  // partner notices are ko-only (no en/ja/zh rows ever exist for them) — no fallback-locale
  // logic needed here, unlike getPublishedContent.ts's pickTranslation(). Still re-checks
  // status==='published' in application code even though the anon RLS policy already
  // enforces it (privacy review NB-R1: don't rely on RLS alone for a query someone might
  // later swap onto an authenticated client).
  const row = rows.find((r) => r.locale === PARTNER_NOTICE_LOCALE && r.status === 'published')
  return row?.body ?? null
}

export interface PublishedPartnerNoticeListItem {
  slug: string
  title: string
  excerpt: string
  // §6.5 known limitation carried over unchanged from the blog/case_study/faq board:
  // content_item has no published_at column, so this is created_at used as a display-date
  // proxy (screen-spec §4.2/§4.3). Operational workaround is "write and publish same-day"
  // (PRD §6.5), not something this function can fix.
  createdAt: string
}

// screen-spec §4.2 (list) / §4.4 (profile-home preview, same function with limit=1 — "별도
// 함수 신설 불필요").
export async function getPublishedPartnerNotices(limit?: number): Promise<PublishedPartnerNoticeListItem[]> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return []

  let query = supabase
    .from('content_item')
    .select('id, content_key, target_audience, created_at, content_translation(locale, body, status)')
    .eq('content_type', 'notice')
    .eq('target_audience', PARTNER_AUDIENCE) // positive match only — see file header rule 2
    .eq('is_active', true) // RLS already guarantees this; NB-R1 asks for an explicit re-check
    .in('content_translation.locale', [PARTNER_NOTICE_LOCALE])
    .eq('content_translation.status', 'published') // ditto, mirrors the RLS predicate
    .order('sort_order', { ascending: false })

  if (typeof limit === 'number') {
    query = query.limit(limit)
  }

  const { data, error } = await query
  if (error || !data) return []

  const items: PublishedPartnerNoticeListItem[] = []
  for (const row of data as unknown as NoticeItemRow[]) {
    // Defense in depth, redundant with the .eq() above by design (rule 2) — if this ever
    // disagrees with the query filter, fail closed and drop the row rather than trust either
    // one alone.
    if (row.target_audience !== PARTNER_AUDIENCE) continue
    const body = pickPublishedKoBody(row.content_translation ?? [])
    const title = typeof body?.title === 'string' ? body.title : null
    if (!title) continue
    items.push({
      slug: row.content_key.slice('notice.'.length),
      title,
      excerpt: typeof body?.excerpt === 'string' ? body.excerpt : '',
      createdAt: row.created_at,
    })
  }
  return items
}

export interface PublishedPartnerNoticeDetail extends PublishedPartnerNoticeListItem {
  bodyMarkdown: string
}

// screen-spec §4.3 — detail. Returns null whenever target_audience isn't 'partner', or the
// item is draft/inactive: N-E8 requires a `seepn_user` notice's slug to 404 through this path
// even if someone guesses/knows it (G-1's key verification point) — this function collapses
// "wrong audience" and "not found" into the identical null result on purpose, so the caller
// can't distinguish them and accidentally leak which case it was.
export async function getPublishedPartnerNoticeBySlug(slug: string): Promise<PublishedPartnerNoticeDetail | null> {
  const supabase = getSupabaseServerClient()
  if (!supabase) return null

  const contentKey = toContentKey('notice', slug)

  const { data, error } = await supabase
    .from('content_item')
    .select('id, content_key, target_audience, created_at, content_translation(locale, body, status)')
    .eq('content_type', 'notice')
    .eq('content_key', contentKey)
    .eq('target_audience', PARTNER_AUDIENCE)
    .eq('is_active', true)
    .in('content_translation.locale', [PARTNER_NOTICE_LOCALE])
    .eq('content_translation.status', 'published')
    .maybeSingle()

  if (error || !data) return null

  const row = data as unknown as NoticeItemRow
  if (row.target_audience !== PARTNER_AUDIENCE) return null

  const body = pickPublishedKoBody(row.content_translation ?? [])
  const title = typeof body?.title === 'string' ? body.title : null
  if (!title) return null

  return {
    slug,
    title,
    excerpt: typeof body?.excerpt === 'string' ? body.excerpt : '',
    bodyMarkdown: typeof body?.body_markdown === 'string' ? body.body_markdown : '',
    createdAt: row.created_at,
  }
}
