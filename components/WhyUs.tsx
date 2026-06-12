// Design Ref: §5.4 Why us — 3개 신뢰 포인트, 각 포인트: 제목 + 1~2문장 설명
import type { Dictionary } from '@/lib/i18n/types'

export function WhyUs({ dict }: { dict: Dictionary['whyUs'] }) {
  return (
    <section className="bg-neutral-50 px-section-x-mobile py-section-y lg:px-section-x">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="text-h2 text-neutral-900">{dict.title}</h2>
        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {dict.points.map((point) => (
            <div key={point.title} className="rounded-card bg-primary-50 p-6">
              <h3 className="text-h3 text-primary-900">{point.title}</h3>
              <p className="mt-3 text-body text-neutral-600">{point.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
