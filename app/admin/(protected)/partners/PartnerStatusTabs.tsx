// Design Ref: screen-spec §2.2.2 — LeadStatusTabs.tsx 패턴을 그대로 복제하되 상태 집합만
// verification_state 5종으로 교체(`suspended`는 G-5로 도달 불가능한 값이라 탭에서 제외).
// "검증대기" 탭은 submitted+under_review를 `state=pending_review` 하나로 묶는다(G-6 — 두 상태를
// 가르는 RPC가 없어 화면상 구분하지 않는 것이 이 문서의 정책).
import Link from 'next/link'

const TABS: { state?: string; label: string }[] = [
  { label: '전체' },
  { state: 'pending_review', label: '검증대기' },
  { state: 'verified', label: '승인완료' },
  { state: 'rejected', label: '반려' },
  { state: 'draft', label: '임시저장' },
]

export function PartnerStatusTabs({
  currentState,
  otherParams,
}: {
  currentState?: string
  otherParams: Record<string, string | undefined>
}) {
  function hrefFor(state: string | undefined) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(otherParams)) {
      if (v) params.set(k, v)
    }
    if (state) params.set('state', state)
    const qs = params.toString()
    return qs ? `/admin/partners?${qs}` : '/admin/partners'
  }

  return (
    <div className="flex flex-wrap gap-1 border-b border-neutral-200">
      {TABS.map((tab) => {
        const isActive = tab.state === currentState || (!tab.state && !currentState)
        return (
          <Link
            key={tab.state ?? 'all'}
            href={hrefFor(tab.state)}
            className={`border-b-2 px-4 py-2 admin-body-sm font-medium transition-colors ${
              isActive ? 'border-primary-600 text-primary-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
