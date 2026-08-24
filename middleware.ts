// Hotfix: root(`/`) 404 방지용 임시 리다이렉트.
// Phase 4 국가별 자동 언어감지(ko/zh/ja/en)로 대체 예정 — 그 전까지 `/en` 고정.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  return NextResponse.redirect(new URL('/en', request.url))
}

export const config = {
  matcher: '/',
}
