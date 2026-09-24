// Design Ref: Figma U-11 마이페이지 side menu "회원 탈퇴" — reason selection/input, consent, then
// withdrawal (2026-09-24 request). Session gate comes from app/seepn/my/layout.tsx.
import { WithdrawForm } from '@/components/seepn/WithdrawForm'

export default function SeepnMyWithdrawPage() {
  return (
    <div>
      <h1 className="text-h3 text-neutral-900">회원 탈퇴</h1>
      <div className="mt-6 max-w-2xl">
        <WithdrawForm />
      </div>
    </div>
  )
}
