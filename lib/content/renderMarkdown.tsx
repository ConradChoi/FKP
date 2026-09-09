// Design Ref: fkp-v0.2-phase5d-blog-case-faq.spec.md §5 — dependency-free markdown
// renderer for blog/case_study body_markdown, adapted from lib/legal/renderMarkdown.tsx
// (kept as a separate module rather than sharing code directly: the legal renderer's
// output is bound 1:1 to a specific consent_version's source text and must never change
// behavior as a side effect of a content-management feature touching it).
//
// Supported subset (§5.3): #/## headings, **bold**, "- " bullets, "1. " numbered lists,
// "| ... |" tables, [text](url) links, and (new here) ![alt](url) images (notice-board-v1.0.prd.md
// N-R16/C-3 — the notice editor's image upload feature needs somewhere to render the markdown it
// produces; PRD §7.6/C-3 ③ calls this out explicitly as a required renderer extension, not
// optional). Anything else (code blocks, blockquotes, raw HTML) is left as plain text — never
// thrown as an error.
import type { ReactNode } from 'react'

function isSafeUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')
}

// notice-board-privacy-review.md §6.4 NB-R6 — links may point anywhere http(s)/relative (existing
// isSafeUrl above), but an <img src> is a materially different risk: an external host embedded in
// a notice body causes the reading admin/partner's browser to make a request (leaking IP/UA to a
// third party we don't control) every time the notice renders, with no user action taken —
// unlike a link, which requires an explicit click. Image src is therefore restricted to our own
// Storage's public host, not "any https URL" — specifically the content-image bucket's public
// object path (lib/content/stripImageMetadata.ts / uploadNoticeImageAction in
// app/admin/(protected)/board/actions.ts are the only legitimate source of these URLs).
function isSafeImageUrl(url: string): boolean {
  if (!url.startsWith('https://')) return false // also rules out http:// (would be blocked as
  // mixed content anyway once the app itself is served over https, per NB-R6) and any non-URL
  // scheme.

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return false

  let imageOrigin: string
  let supabaseOrigin: string
  try {
    imageOrigin = new URL(url).origin
    supabaseOrigin = new URL(supabaseUrl).origin
  } catch {
    return false
  }
  if (imageOrigin !== supabaseOrigin) return false

  // Origin match alone would still accept a URL pointing at some OTHER bucket/endpoint on the
  // same Supabase project (e.g. partner-doc, or an admin/auth endpoint) — narrow further to the
  // exact public-object path this feature is allowed to embed.
  return url.includes('/storage/v1/object/public/content-image/')
}

function renderInline(text: string): ReactNode {
  // notice-board-privacy-review.md §6.4 NB-R6 "파싱 충돌 주의": the image alternative
  // (`!\[...\]\(...\)`) is listed BEFORE the link alternative so an occurrence of `![alt](url)`
  // is captured whole by the image branch — without it, split() matches `[alt](url)` (the link
  // pattern) starting one character after the `!`, leaving a stray `!` in the output and
  // rendering the image markdown as a clickable link instead of an image.
  const parts = text.split(/(\*\*[^*]+\*\*|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\))/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    const imageMatch = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(part)
    if (imageMatch) {
      const [, alt, url] = imageMatch
      // Falls back to the alt text (never the raw URL, never a broken <img>) for anything that
      // isn't our own Storage's public content-image path — same "fail to plain text, never
      // throw" stance as the existing link handling below.
      if (!isSafeImageUrl(url)) return alt
      // eslint-disable-next-line @next/next/no-img-element -- external Storage URL, not a local
      // asset next/image can optimize; this mirrors the plain <a> handling just below.
      return <img key={i} src={url} alt={alt} loading="lazy" className="mt-2 max-w-full rounded-input border border-neutral-200" />
    }
    const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
    if (linkMatch) {
      const [, label, url] = linkMatch
      if (!isSafeUrl(url)) return label
      return (
        <a key={i} href={url} className="underline hover:text-primary-600" target={url.startsWith('/') ? undefined : '_blank'} rel={url.startsWith('/') ? undefined : 'noopener noreferrer'}>
          {label}
        </a>
      )
    }
    return part
  })
}

export function renderContentMarkdown(markdown: string): ReactNode[] {
  const lines = markdown.split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed === '') {
      i++
      continue
    }

    if (line.startsWith('## ')) {
      blocks.push(
        <h2 key={key++} className="mt-8 text-h3 text-neutral-900">
          {renderInline(line.slice(3))}
        </h2>
      )
      i++
      continue
    }

    if (line.startsWith('# ')) {
      blocks.push(
        <h1 key={key++} className="mt-8 text-h2 text-neutral-900">
          {renderInline(line.slice(2))}
        </h1>
      )
      i++
      continue
    }

    if (trimmed.startsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim())
        i++
      }
      const rows = tableLines
        .filter((l) => !/^\|[\s-:|]+\|$/.test(l))
        .map((l) =>
          l
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((cell) => cell.trim())
        )
      const [header, ...body] = rows
      blocks.push(
        <div key={key++} className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-body-sm">
            <thead>
              <tr>
                {header.map((cell, ci) => (
                  <th key={ci} className="border border-neutral-200 bg-neutral-50 p-2 text-left">
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-neutral-200 p-2 align-top">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ''))
        i++
      }
      blocks.push(
        <ol key={key++} className="mt-2 list-decimal space-y-1 pl-5 text-body text-neutral-700">
          {items.map((item, ii) => (
            <li key={ii}>{renderInline(item)}</li>
          ))}
        </ol>
      )
      continue
    }

    if (trimmed.startsWith('- ')) {
      const items: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(lines[i].trim().slice(2))
        i++
      }
      blocks.push(
        <ul key={key++} className="mt-2 list-disc space-y-1 pl-5 text-body text-neutral-700">
          {items.map((item, ii) => (
            <li key={ii}>{renderInline(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].trim().startsWith('|') &&
      !lines[i].trim().startsWith('- ') &&
      !/^\d+\.\s/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i])
      i++
    }
    blocks.push(
      <p key={key++} className="mt-4 text-body text-neutral-700">
        {renderInline(paraLines.join(' '))}
      </p>
    )
  }

  return blocks
}
