// Design Ref: fkp-v0.2-phase5d-blog-case-faq.spec.md §2.2 — content_type (DB, snake_case)
// <-> public URL segment (kebab-case, may differ intentionally, e.g. case_study -> case-studies)
// mapping, fixed as a single pair of constants so the two never drift independently.

export type ArticleContentType = 'blog' | 'case_study'

export const CONTENT_TYPE_URL_SEGMENT: Record<ArticleContentType, string> = {
  blog: 'blog',
  case_study: 'case-studies',
}

export const URL_SEGMENT_TO_CONTENT_TYPE: Record<string, ArticleContentType> = {
  blog: 'blog',
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
