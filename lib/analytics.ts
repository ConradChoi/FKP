// Design Ref: §2.1 Component Diagram — gtag 페이지뷰/CTA/폼제출 이벤트 헬퍼
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', eventName, params)
}

export function trackPageView(path: string) {
  trackEvent('page_view', { page_path: path })
}
