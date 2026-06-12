// Design Ref: §2.2 Data Flow (1) 방문 — GA4 page_view 이벤트 (gtag config의 자동 page_view는
// layout.tsx에서 send_page_view:false로 끄고, 이 컴포넌트가 마운트 시 한 번 전송한다.
'use client'

import { useEffect } from 'react'
import { trackPageView } from '@/lib/analytics'

export function AnalyticsPageView({ path }: { path: string }) {
  useEffect(() => {
    trackPageView(path)
  }, [path])

  return null
}
