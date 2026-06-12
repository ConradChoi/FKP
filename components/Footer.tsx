// Design Ref: §5.4 Footer — 소개 1문장 + 연락 이메일
import type { Dictionary } from '@/lib/i18n/types'

export function Footer({ dict }: { dict: Dictionary['footer'] }) {
  return (
    <footer className="border-t border-neutral-200 px-section-x-mobile py-section-y lg:px-section-x">
      <div className="mx-auto max-w-[1200px]">
        <p className="text-body text-neutral-600">{dict.intro}</p>
        <p className="mt-2 text-body-sm text-neutral-500">{dict.contactEmail}</p>
      </div>
    </footer>
  )
}
