// Design Ref: E3-R2 (요청관리 — 목록/검색/필터/정렬/페이지네이션). RLS
// (requests_admin_select, lead_management read) already scopes visibility; this page adds
// no additional client-side filtering of what rows to show, only how to browse them.
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_ORDER, STATUS_TONE, label } from '@/lib/admin/labels'
import { LeadFilters } from './LeadFilters'
import { LeadStatusTabs } from './LeadStatusTabs'
import { DeleteClosedLeadButton } from './DeleteClosedLeadButton'
import { Avatar } from '@/components/admin/Avatar'
import { StatusBadge } from '@/components/admin/StatusBadge'

const PAGE_SIZE = 20

interface SearchParams {
  status?: string
  q?: string
  page?: string
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { status, q, page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)

  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  const { data: admins } = await supabase.rpc('list_admin_users_for_assignment')
  const adminNameById = new Map<string, string>(
    (admins ?? []).map((a: { id: string; display_name: string }) => [a.id, a.display_name]),
  )

  let query = supabase
    .from('requests')
    .select('id, what_looking_for, category, status, assignee_id, company_name_website, contact_masked, created_at', {
      count: 'exact',
    })
    .is('hidden_at', null)

  if (status && STATUS_ORDER.includes(status as (typeof STATUS_ORDER)[number])) {
    query = query.eq('status', status)
  }
  if (q && q.trim()) {
    const term = q.trim().replace(/[%_]/g, '')
    query = query.or(`company_name_website.ilike.%${term}%,what_looking_for.ilike.%${term}%`)
  }

  const from = (page - 1) * PAGE_SIZE
  const { data: requests, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  return (
    <div>
      <p className="admin-body-sm text-neutral-500">총 {count ?? 0}건</p>

      <div className="mt-4">
        <LeadStatusTabs currentStatus={status} currentQuery={q} />
      </div>
      <LeadFilters currentStatus={status} currentQuery={q} />

      {error && <p className="mt-6 admin-body-sm text-error">목록을 불러오지 못했습니다: {error.message}</p>}

      <div className="mt-4 overflow-x-auto rounded-card border border-neutral-200 bg-neutral-0">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-28" />
            <col className="w-32" />
            <col />
            <col className="w-56" />
            <col className="w-28" />
            <col className="w-28" />
            <col className="w-20" />
          </colgroup>
          <thead>
            <tr className="border-b border-neutral-200 text-left">
              <th className="whitespace-nowrap px-4 py-3 admin-body-sm font-medium uppercase tracking-wide text-neutral-500">접수일</th>
              <th className="whitespace-nowrap px-4 py-3 admin-body-sm font-medium uppercase tracking-wide text-neutral-500">카테고리</th>
              <th className="whitespace-nowrap px-4 py-3 admin-body-sm font-medium uppercase tracking-wide text-neutral-500">회사명</th>
              <th className="whitespace-nowrap px-4 py-3 admin-body-sm font-medium uppercase tracking-wide text-neutral-500">연락처</th>
              <th className="whitespace-nowrap px-4 py-3 admin-body-sm font-medium uppercase tracking-wide text-neutral-500">상태</th>
              <th className="whitespace-nowrap px-4 py-3 admin-body-sm font-medium uppercase tracking-wide text-neutral-500">담당자</th>
              <th className="whitespace-nowrap px-4 py-3 admin-body-sm font-medium uppercase tracking-wide text-neutral-500">관리</th>
            </tr>
          </thead>
          <tbody>
            {(requests ?? []).map((req) => (
              <tr key={req.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                <td className="px-4 py-3 admin-body">
                  <Link href={`/admin/leads/${req.id}`} className="block text-primary-600 hover:underline">
                    {new Date(req.created_at).toLocaleDateString('ko-KR')}
                  </Link>
                </td>
                <td className="px-4 py-3 admin-body">{label(CATEGORY_LABELS, req.category)}</td>
                <td className="px-4 py-3 admin-body">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={req.company_name_website} size="sm" />
                    <span className="truncate">{req.company_name_website}</span>
                  </div>
                </td>
                <td className="px-4 py-3 admin-body text-neutral-500">{req.contact_masked}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={STATUS_TONE[req.status as keyof typeof STATUS_TONE]} label={label(STATUS_LABELS, req.status)} />
                </td>
                <td className="px-4 py-3 admin-body">
                  {req.assignee_id ? (adminNameById.get(req.assignee_id) ?? '(권한 밖 계정)') : '-'}
                </td>
                <td className="px-4 py-3">
                  {req.status === 'closed' ? <DeleteClosedLeadButton requestId={req.id} /> : <span className="text-neutral-300">-</span>}
                </td>
              </tr>
            ))}
            {(requests ?? []).length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center admin-body text-neutral-400">
                  조건에 맞는 요청이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 admin-body-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/leads?${new URLSearchParams({ ...(status && { status }), ...(q && { q }), page: String(p) })}`}
              className={`rounded-input px-3 py-1.5 ${p === page ? 'bg-primary-600 text-neutral-0' : 'text-neutral-600 hover:bg-neutral-100'}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
