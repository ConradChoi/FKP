// Design Ref: §5.4 How it works — 4단계 카드, 각 카드: 제목(3단어 이내) + 설명(1문장)
import type { Dictionary } from '@/lib/i18n/types'

export function HowItWorks({ dict }: { dict: Dictionary['howItWorks'] }) {
  return (
    <section className="bg-neutral-50 px-section-x-mobile py-section-y lg:px-section-x">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="text-h2 text-neutral-900">{dict.title}</h2>
        <ol className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {dict.steps.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-label-button text-primary-700">
                {i + 1}
              </span>
              <h3 className="text-h3 text-neutral-900">{step.title}</h3>
              <p className="text-body text-neutral-600">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
