// Minimal, dependency-free renderer for docs/legal/*.md (no markdown library —
// User-facing pages stay Tailwind-only per PRD OQ-7). Handles exactly the
// subset of markdown used in those files: #/## headings, **bold** lines and
// inline bold, "- " bullet lists, "1. " numbered lists, and "| ... |" tables.
// Rendering straight from the .md file (not a re-typed copy) keeps the
// published page and the version-pinned source text identical — the binding
// that privacy review §4.3 note 1 requires for consent_version.
import type { ReactNode } from 'react'

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part
  )
}

export function renderLegalMarkdown(markdown: string): ReactNode[] {
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
        <h2 key={key++} className="mt-8 text-h4 text-primary-900">
          {renderInline(line.slice(3))}
        </h2>
      )
      i++
      continue
    }

    if (line.startsWith('# ')) {
      blocks.push(
        <h1 key={key++} className="text-h2 text-primary-900">
          {renderInline(line.slice(2))}
        </h1>
      )
      i++
      continue
    }

    if (/^\*\*.+\*\*$/.test(trimmed)) {
      blocks.push(
        <p key={key++} className="mt-1 text-body-sm font-semibold text-neutral-600">
          {renderInline(trimmed)}
        </p>
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
      !/^\d+\.\s/.test(lines[i].trim()) &&
      !/^\*\*.+\*\*$/.test(lines[i].trim())
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
