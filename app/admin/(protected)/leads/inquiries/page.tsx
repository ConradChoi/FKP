// Design Ref: docs/02-design/features/seepn-buyer-web-p5a.screen-spec.md §8 (BY-A1) — "목록:
// 상태 탭(신규/처리중/완료), 검색(회사명/바이어명), 목록 테이블" + privacy review §5.3(d)
// "목록에 본문 미리보기 없음(기본값 채택)" — enforced structurally: admin_list_seepn_inquiries()'s
// return shape has NO body column at all (see its comment in the migration), so there is no way
// for this page to render a preview even by mistake.
// GAP-C1 (2026-09-10, 20260910180000): a single partner column was replaced by `partners`
// (1..5 referenced partners) — rendered here as "{first partner} 외 N건", full list only on
// the detail page. This is intentionally minimal (scope: backend-led schema change, not a P5b
// comparison-flow UI pass — that is a separate frontend-developer task).
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { INQUIRY_STATUS_LABELS } from '@/lib/seepn/partnerLabels'
import type { AdminSeepnInquiryListRow } from '@/lib/seepn/types'

const STATUS_TABS: { value: string | undefined; label: string }[] = [
  { value: undefined, label: '전체' },
  { value: 'new', label: '신규' },
  { value: 'in_progress', label: '처리중' },
  { value: 'closed', label: '완료' },
]

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'success'> = {
  new: 'info',
  in_progress: 'neutral',
  closed: 'success',
}

export default async function AdminSeepnInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const { status, q } = await searchParams

  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  const { data: rows, error } = await supabase.rpc('admin_list_seepn_inquiries', {
    p_status: status ?? null,
    p_search: q ?? null,
    p_limit: 100,
    p_offset: 0,
  })

  const inquiries = (rows ?? []) as AdminSeepnInquiryListRow[]

  function tabHref(value: string | undefined) {
    const params = new URLSearchParams()
    if (value) params.set('status', value)
    if (q) params.set('q', q)
    const qs = params.toString()
    return qs ? `/admin/leads/inquiries?${qs}` : '/admin/leads/inquiries'
  }

  return (
    <div>
      <h1 className="admin-heading-2 text-neutral-900">운영자 문의 (SEEPN)</h1>

      <div className="mt-4 flex gap-2 border-b border-neutral-200">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.label}
            href={tabHref(tab.value)}
            className={`px-3 py-2 admin-body-sm ${
              status === tab.value || (!status && !tab.value)
                ? 'border-b-2 border-primary-600 font-medium text-primary-700'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <form className="mt-4 flex gap-2" action="">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="회사명 또는 바이어 표시명 검색"
          className="rounded-input border border-neutral-300 bg-neutral-0 px-3 py-2 admin-body"
        />
        {status && <input type="hidden" name="status" value={status} />}
        <button type="submit" className="admin-body-sm text-primary-600 hover:underline">
          검색
        </button>
      </form>

      {error && <p className="mt-6 admin-body-sm text-error">목록을 불러오지 못했습니다: {error.message}</p>}

      <div className="mt-4 overflow-x-auto rounded-card border border-neutral-200 bg-neutral-0">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-48" />
            <col className="w-40" />
            <col className="w-24" />
            <col className="w-32" />
            <col className="w-28" />
          </colgroup>
          <thead>
            <tr className="border-b border-neutral-200 text-left">
              <th className="whitespace-nowrap px-4 py-3 admin-body-sm font-medium uppercase tracking-wide text-neutral-500">파트너</th>
              <th className="whitespace-nowrap px-4 py-3 admin-body-sm font-medium uppercase tracking-wide text-neutral-500">바이어(마스킹)</th>
              <th className="whitespace-nowrap px-4 py-3 admin-body-sm font-medium uppercase tracking-wide text-neutral-500">상태</th>
              <th className="whitespace-nowrap px-4 py-3 admin-body-sm font-medium uppercase tracking-wide text-neutral-500">담당자</th>
              <th className="whitespace-nowrap px-4 py-3 admin-body-sm font-medium uppercase tracking-wide text-neutral-500">접수일</th>
            </tr>
          </thead>
          <tbody>
            {inquiries.map((row) => (
              <tr key={row.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                <td className="px-4 py-3 admin-body">
                  <Link href={`/admin/leads/inquiries/${row.id}`} className="text-primary-600 hover:underline">
                    {(row.partners?.[0]?.company_name_ko ?? '(회사명 미공개)') +
                      (row.partners && row.partners.length > 1 ? ` 외 ${row.partners.length - 1}건` : '')}
                  </Link>
                </td>
                <td className="px-4 py-3 admin-body-sm text-neutral-600">{row.buyer_display_name_masked}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={STATUS_TONE[row.status] ?? 'neutral'} label={INQUIRY_STATUS_LABELS[row.status] ?? row.status} />
                </td>
                <td className="px-4 py-3 admin-body-sm text-neutral-600">{row.assigned_admin_name ?? '미지정'}</td>
                <td className="px-4 py-3 admin-body-sm text-neutral-500">{new Date(row.created_at).toLocaleDateString('ko-KR')}</td>
              </tr>
            ))}
            {inquiries.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center admin-body text-neutral-400">
                  조건에 맞는 문의가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
