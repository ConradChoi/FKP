import { SupplierFooter } from '@/components/supplier/SupplierFooter'

// Design Ref: screen-spec §3.2 + ceo-decisions.md §3 — the actual Korean partner privacy
// policy body (including the CPO name/contact field) is blocked on a representative decision
// (Q-A/Q-B) that has not been made in this repository yet. Placeholder only — do not open
// partner sign-up to real users until this is replaced (same gate as the terms placeholder).
export default function SupplierPrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="text-h3 text-neutral-900">개인정보 수집·이용 동의</h1>
        <p className="mt-4 text-body-sm text-neutral-600">
          파트너 개인정보처리방침 본문은 아직 준비 중입니다. 게시 전까지는 이 페이지가 최종
          문서가 아니며, 정식 오픈 시 실제 처리방침(개인정보 보호책임자 연락처 포함)으로
          교체됩니다.
        </p>
      </main>
      <SupplierFooter />
    </div>
  )
}
