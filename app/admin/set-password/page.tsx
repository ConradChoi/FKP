// Design Ref: fkp-v0.2-privacy-review-phase3-rbac.md §6.6 (invite flow) — landing page for
// the link in the Supabase Auth invite email (auth.admin.inviteUserByEmail, called from
// app/api/admin/access-requests/[id]/approve/route.ts). Supabase's invite email link points
// here with `token_hash` + `type=invite` as query params (its documented verifyOtp() flow) —
// NEEDS LIVE VERIFICATION once an actual invite is sent; if the project's email template
// instead uses the older hash-fragment flow, this page will need a client-side fallback.
import { SetPasswordForm } from './SetPasswordForm'

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>
}) {
  const { token_hash: tokenHash, type } = await searchParams

  if (!tokenHash || type !== 'invite') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="w-full max-w-md rounded-card bg-neutral-0 p-8 shadow-lg">
          <h1 className="text-h3 text-primary-900">유효하지 않은 초대 링크</h1>
          <p className="mt-2 text-body-sm text-neutral-600">
            링크가 만료되었거나 잘못되었습니다. 최고관리자에게 재초대를 요청해주세요.
          </p>
        </div>
      </main>
    )
  }

  return <SetPasswordForm tokenHash={tokenHash} />
}
