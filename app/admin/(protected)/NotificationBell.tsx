// Design Ref: 대표 피드백(2026-08-25) — 헤더에 알림 아이콘 추가. 지금 유일하게 존재하는
// "대기 중" 큐는 가입요청(admin_access_request)뿐이라 그 건수를 배지로 보여준다. 다음
// 라운드에서 알림 종류가 늘어나면(예: 요청관리 미처리 건수) 이 컴포넌트가 여러 소스를
// 합산하도록 확장하면 된다. RLS가 이미 super_admin 외에는 0건으로 필터링하므로 별도
// 권한 분기가 필요 없다.
import Link from 'next/link'

export function NotificationBell({ pendingAccessRequests }: { pendingAccessRequests: number }) {
  return (
    <Link
      href="/admin/access-requests"
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
      aria-label={`알림${pendingAccessRequests > 0 ? ` (대기 중 ${pendingAccessRequests}건)` : ''}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 17h5l-1.6-1.6a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
        />
      </svg>
      {pendingAccessRequests > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-semibold leading-none text-neutral-0">
          {pendingAccessRequests > 99 ? '99+' : pendingAccessRequests}
        </span>
      )}
    </Link>
  )
}
