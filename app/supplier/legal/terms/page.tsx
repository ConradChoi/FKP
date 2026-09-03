import { SupplierFooter } from '@/components/supplier/SupplierFooter'

// Design Ref: screen-spec §3.2 — "[필수] 파트너 이용약관 동의 ... 링크는 '준비 중' placeholder
// 페이지로 연결, 실서비스 오픈 전 반드시 교체" + lib/legal/partnerConsentVersions.ts's own
// PLACEHOLDER note. Do not open partner sign-up to real users until this page's content is
// replaced with the actual reviewed terms document (privacy review §6.1/§7.1 item 4).
export default function SupplierTermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="text-h3 text-neutral-900">파트너 이용약관</h1>
        <p className="mt-4 text-body-sm text-neutral-600">
          파트너 이용약관 본문은 아직 준비 중입니다. 게시 전까지는 이 페이지가 최종 약관이
          아니며, 정식 오픈 시 실제 약관 문서로 교체됩니다.
        </p>
      </main>
      <SupplierFooter />
    </div>
  )
}
