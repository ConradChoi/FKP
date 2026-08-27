// Design Ref: fkp-v0.2-phase5d-blog-case-faq.spec.md §5 — dependency-free markdown
// renderer for blog/case_study body_markdown, adapted from lib/legal/renderMarkdown.tsx
// (kept as a separate module rather than sharing code directly: the legal renderer's
// output is bound 1:1 to a specific consent_version's source text and must never change
// behavior as a side effect of a content-management feature touching it).
//
// Supported subset (§5.3): #/## headings, **bold**, "- " bullets, "1. " numbered lists,
// "| ... |" tables, and (new here) [text](url) links. Anything else (images, code
// blocks, blockquotes, raw HTML) is left as plain text — never thrown as an error.
import type { ReactNode } from 'react'

function isSafeUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')
}

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
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
