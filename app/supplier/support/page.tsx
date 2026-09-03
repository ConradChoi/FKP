import { SupplierFooter } from '@/components/supplier/SupplierFooter'

// Design Ref: privacy review §7.1 (UI-B8) item 2 — "고객센터 경로를 하나로 확정 ... 모든
// '고객센터로 문의해주세요' 문구를 이 경로로 링크". The actual contact channel (email vs.
// phone, and whose) is ceo-decisions.md §3 Q-B — unanswered in this repository, so this page
// intentionally does not print a specific phone number yet (printing one now would preempt
// that decision). Every "고객센터" reference elsewhere in this app links here.
export default function SupplierSupportPage() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="text-h3 text-neutral-900">고객센터</h1>
        <p className="mt-4 text-body-sm text-neutral-600">
          문의사항은 아래 이메일로 연락해주세요. 개인정보 열람·정정·삭제·처리정지·동의철회
          요구도 같은 창구에서 접수합니다.
        </p>
        <p className="mt-4 text-body font-medium text-neutral-900">support@seepn.me</p>
      </main>
      <SupplierFooter />
    </div>
  )
}
