// Design Ref: §5.4 Categories — 5개 카테고리 카드, 각 카드: 이름 + 예시 키워드 3~4개
import type { Dictionary } from '@/lib/i18n/types'

export function Categories({ dict }: { dict: Dictionary['categories'] }) {
  const items = Object.values(dict.items)

  return (
    <section className="px-section-x-mobile py-section-y lg:px-section-x">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="text-h2 text-neutral-900">{dict.title}</h2>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {items.map((item) => (
            <div key={item.name} className="rounded-card border border-neutral-200 p-6">
              <h3 className="text-h3 text-neutral-900">{item.name}</h3>
              <ul className="mt-3 space-y-1 text-body-sm text-neutral-600">
                {item.keywords.map((keyword) => (
                  <li key={keyword}>{keyword}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
