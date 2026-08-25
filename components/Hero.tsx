// Design Ref: fkp-v0.2-phase2-request-flow.spec.md §13 (v1.2) — Hero now hosts the entire 3-step
// carousel (Panel1=Step1, Panel2=Step2, Panel3=Step3) instead of only Step1 + a scroll-away
// continuation panel. Panels live in an overflow-hidden track and slide via translateX; exactly
// one panel is interactive at a time (the rest get aria-hidden + inert, §13.2). Step3's submit
// button opens ConfirmSubmitModal (rendered by HomeFlowProvider, §13.3) instead of submitting
// directly. Headline/Subheadline stay put across every step (§7 principle 1).
'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Dictionary, Locale } from '@/lib/i18n/types'
import { useHomeFlow } from './RequestFlow/HomeFlowContext'
import { Step1 } from './RequestForm/Step1'
import { Step2 } from './RequestForm/Step2'
import { Step3 } from './RequestForm/Step3'
import { SubmitStatus } from './RequestForm/SubmitStatus'
import { focusFirstFieldWithin, prefersReducedMotion } from '@/lib/dom/scrollTo'

interface HeroProps {
  dict: Dictionary['hero']
  requestFormDict: Dictionary['requestForm']
  categoriesDict: Dictionary['categories']
  locale: Locale
}

// Panel-local ids, used to focus the newly-visible panel's first field after a slide
// transition (flow spec §2.2 step3's intent carried over into §13.2 — the difference is the
// focus target moves within the Hero card instead of scrolling to a separate section).
// 'hero-mini-form' is kept as Panel 1's id since Header/prefillCategory already reference it.
const PANEL_IDS = ['hero-mini-form', 'hero-panel-2', 'hero-panel-3'] as const

export function Hero({ dict, requestFormDict, categoriesDict, locale }: HeroProps) {
  const flow = useHomeFlow()
  const { step, status, formData, errors, consent } = flow
  const prevStepRef = useRef(step)
  const panelRefs = useRef<(HTMLDivElement | null)[]>([null, null, null])
  const [trackHeight, setTrackHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (prevStepRef.current !== step) {
      const reduce = prefersReducedMotion()
      const id = PANEL_IDS[step - 1]
      const timer = window.setTimeout(() => focusFirstFieldWithin(id), reduce ? 0 : 320)
      prevStepRef.current = step
      return () => window.clearTimeout(timer)
    }
    prevStepRef.current = step
  }, [step])

  // Design Ref: 대표 피드백(2026-08-25) — 카루셀 트랙이 flex row라서 컨테이너 높이가
  // 항상 가장 긴 패널(Step2, 필드 6개)에 맞춰지고, Step1만 보이는 첫 진입 시(특히
  // 모바일)에 그 차이만큼 빈 공간이 남았다. 활성 패널의 실제 높이(scrollHeight)만
  // 측정해서 바깥 컨테이너 높이로 명시 지정하고, 전환 시 그 값이 바뀌며 부드럽게
  // 늘어나거나(길어지는 패널로) 줄어들게(짧아지는 패널로) 한다. 나머지 패널의 초과
  // 높이는 바깥 컨테이너의 overflow-hidden으로 가려진다. 검증 에러 메시지가 붙거나
  // 빠질 때도 활성 패널 높이가 바뀌므로 formData/errors 변경 시에도 재측정한다.
  useLayoutEffect(() => {
    function measure() {
      const active = panelRefs.current[step - 1]
      if (active) setTrackHeight(active.scrollHeight)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [step, formData, errors, consent])

  return (
    <section id="hero" className="px-section-x-mobile py-section-y lg:px-section-x">
      <div className="mx-auto max-w-[1200px]">
        <h1 className="text-display-hero text-neutral-900">{dict.headline}</h1>
        <p className="mt-4 max-w-2xl text-body-lg text-neutral-600">{dict.subheadline}</p>

        <div className="mt-8 max-w-xl">
          {status === 'success' ? (
            <SubmitStatus dict={requestFormDict} status="success" onRetry={flow.retry} onReset={flow.startNewRequest} />
          ) : (
            <div
              className="overflow-hidden transition-[height] duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0"
              style={{ height: trackHeight }}
            >
              <div
                className="flex items-start transition-transform duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0"
                style={{ transform: `translateX(-${(step - 1) * 100}%)` }}
              >
                <div
                  ref={(el) => {
                    panelRefs.current[0] = el
                  }}
                  id={PANEL_IDS[0]}
                  className="w-full shrink-0 basis-full"
                  aria-hidden={step !== 1}
                  inert={step !== 1}
                >
                  <Step1
                    dict={requestFormDict}
                    categoriesDict={categoriesDict}
                    formData={formData}
                    errors={errors}
                    onChange={flow.handleChange}
                    onNext={flow.handleStep1Submit}
                    onFieldFocus={flow.handleFieldFocus}
                    variant="hero"
                    nextLabel={dict.ctaText}
                    categoryHighlightKey={flow.categoryHighlightKey}
                  />
                </div>

                <div
                  ref={(el) => {
                    panelRefs.current[1] = el
                  }}
                  id={PANEL_IDS[1]}
                  className="w-full shrink-0 basis-full"
                  aria-hidden={step !== 2}
                  inert={step !== 2}
                >
                  <Step2
                    dict={requestFormDict}
                    formData={formData}
                    errors={errors}
                    onChange={flow.handleChange}
                    onNext={flow.handleStep2Submit}
                    onBack={flow.handleBackFromStep2}
                  />
                </div>

                <div
                  ref={(el) => {
                    panelRefs.current[2] = el
                  }}
                  id={PANEL_IDS[2]}
                  className="w-full shrink-0 basis-full"
                  aria-hidden={step !== 3}
                  inert={step !== 3}
                >
                  <Step3
                    dict={requestFormDict}
                    formData={formData}
                    errors={errors}
                    onChange={flow.handleChange}
                    consent={consent}
                    onConsentChange={flow.handleConsentChange}
                    onBack={flow.handleBackFromStep3}
                    onSubmit={flow.handleStep3Submit}
                    locale={locale}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
