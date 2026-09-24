// Design Ref: Figma U-11 마이페이지 side menu "비밀번호 변경" — 현재 비밀번호, 새 비밀번호, 새
// 비밀번호 확인 (2026-09-24 request). Session gate comes from app/seepn/my/layout.tsx.
import { requireBuyerSession } from '@/lib/seepn/session'
import { PasswordChangeForm } from '@/components/seepn/PasswordChangeForm'

export const dynamic = 'force-dynamic'

export default async function SeepnMyPasswordPage() {
  const session = await requireBuyerSession()
  return (
    <div>
      <h1 className="text-h3 text-neutral-900">비밀번호 변경</h1>
      <div className="mt-6">
        <PasswordChangeForm email={session.email} />
      </div>
    </div>
  )
}
