import Link from 'next/link'

// Design Ref: docs/03-security/partner-supplier-app-ui-privacy-review.md §7.1 (UI-B8) —
// "인증 후 셸 하단에 최소 푸터 추가: 이용약관 · 개인정보처리방침 · 고객센터 ... 비인증
// 셸(§2.1 카드)에도 카드 아래에 동일 링크". Used by both the unauthenticated card shell
// (app/supplier/layout.tsx wraps every /supplier/* page, so this single component covers both
// without duplicating the link list) and the authenticated profile shell.
//
// The linked pages are intentionally minimal placeholders (app/supplier/legal/*,
// app/supplier/support) — the actual Korean partner terms/privacy document BODIES have not
// been written yet (lib/legal/partnerConsentVersions.ts's own PLACEHOLDER note, backend notes
// §UI-B8 item 4: "가입 오픈 블로커의 재확인"). This footer's job is only to make the
// REQUIRED-TO-EXIST navigation path reachable in 2 clicks from every screen (P1 DoD gate,
// privacy review §9) — it does not resolve the open "who is CPO / what phone number" question
// from ceo-decisions.md §3 Q-A/Q-B, which is a content decision, not a routing one.
export function SupplierFooter() {
  return (
    <footer className="border-t border-neutral-200 py-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-6 text-label-caption text-neutral-500">
        <Link href="/supplier/legal/terms" className="hover:text-neutral-700 hover:underline">
          이용약관
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/supplier/legal/privacy" className="hover:text-neutral-700 hover:underline">
          개인정보처리방침
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/supplier/support" className="hover:text-neutral-700 hover:underline">
          고객센터
        </Link>
      </div>
    </footer>
  )
}
