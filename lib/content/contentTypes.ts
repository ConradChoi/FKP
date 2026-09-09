// Design Ref: fkp-v0.2-phase5d-blog-case-faq.spec.md §2.2 — content_type (DB, snake_case)
// <-> public URL segment (kebab-case, may differ intentionally, e.g. case_study -> case-studies)
// mapping, fixed as a single pair of constants so the two never drift independently.

// notice-board-v1.0.prd.md (v3.0 Final) §7.3 — blog was physically converted to notice
// (0 published posts confirmed, so no data/URL asset to preserve, A-2). 'blog' is REMOVED
// from this union on purpose (not just left unused) so any lingering reference to it (a
// stray CONTENT_TYPE_URL_SEGMENT.blog, an old contentType="blog" prop, etc.) becomes a
// compile error instead of a silent dead route — see the same PRD's §7.5 G-5 regression
// warning about case_study sharing these constants/components with the removed blog board.
//
// §7.5 G-2/G-2′, §3.1 — 'notice' shares the title/excerpt/body_markdown shape (D-N2, blog
// shape carried over) so it belongs in this union, but it has NO public FKP route (D-N0-1:
// FKP is explicitly excluded; partner notices live behind auth at /supplier/notices,
// seepn_user notices have no consumption screen yet at all, Phase 1/WS-4). Deliberately NOT
// added to CONTENT_TYPE_URL_SEGMENT / URL_SEGMENT_TO_CONTENT_TYPE below — those two maps are
// typed to exclude it, so adding a 'notice' entry there is a compile error rather than a
// silent "public URL that doesn't exist" bug.
export type ArticleContentType = 'case_study' | 'notice'

export const CONTENT_TYPE_URL_SEGMENT: Record<Exclude<ArticleContentType, 'notice'>, string> = {
  case_study: 'case-studies',
}

export const URL_SEGMENT_TO_CONTENT_TYPE: Record<string, Exclude<ArticleContentType, 'notice'>> = {
  'case-studies': 'case_study',
}

const SLUG_PATTERN = /^[a-z][a-z0-9-]{1,64}$/

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug)
}

// §2.1: content_key = "{content_type}.{slug}" — enforced here, not just by the DB's
// generic content_key regex, so the convention can't drift silently.
export function toContentKey(contentType: string, slug: string): string {
  return `${contentType}.${slug}`
}

export function slugFromContentKey(contentType: string, contentKey: string): string {
  return contentKey.slice(contentType.length + 1)
}
