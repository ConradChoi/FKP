// Design Ref: §4.2 POST {NEXT_PUBLIC_FORM_ENDPOINT} — CORS 프리플라이트 회피를 위해
// text/plain 단순 요청으로 전송, 응답 본문은 읽지 않고 throw 여부로 성공/실패를 판단한다.
import type { RequestFormPayload } from '@/types/request-form'

export interface SubmitResult {
  success: boolean
}

export async function submitRequest(payload: RequestFormPayload): Promise<SubmitResult> {
  const endpoint = process.env.NEXT_PUBLIC_FORM_ENDPOINT
  if (!endpoint) {
    return { success: false }
  }

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    })
    return { success: true }
  } catch {
    return { success: false }
  }
}
