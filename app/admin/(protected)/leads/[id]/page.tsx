// Design Ref: E3-R2 (요청관리 — 상세, 상태변경, 담당자지정, 내부메모). Every field shown here
// is exactly what requests_admin_select's column-scoped GRANT allows (raw `contact` is
// excluded by design — see RevealContact.tsx for the audited reveal path, §7.3).
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import {
  CATEGORY_LABELS,
  PARTNER_TYPE_LABELS,
  BUDGET_LABELS,
  TIMELINE_LABELS,
  ENGLISH_SPEAKING_LABELS,
  label,
} from '@/lib/admin/labels'
import { StatusAssigneeForm } from './StatusAssigneeForm'
import { InternalNote } from './InternalNote'
import { RevealContact } from './RevealContact'
import { DeleteClosedLeadButton } from '../DeleteClosedLeadButton'

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  // Explicit column list, not `*` — `contact` has zero GRANT to authenticated (privacy
  // review §7.3), so a `select('*')` here would error out entirely rather than just
  // omitting it (Postgres column-level GRANT: SELECT * fails if any column is ungranted).
  const { data: req, error } = await supabase
    .from('requests')
    .select(
      'id, what_looking_for, category, partner_type, purpose, description, budget, timeline, english_speaking, company_name_website, status, assignee_id, source, locale, contact_masked, created_at, hidden_at',
    )
    .eq('id', id)
    .single()
  if (error || !req) notFound()

  const { data: admins } = await supabase.rpc('list_admin_users_for_assignment')
  const { data: internalNote } = await supabase.rpc('get_request_internal_note', { p_request_id: id })

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link href="/admin/leads" className="admin-body-sm text-primary-600 hover:underline">
          ← 요청관리 목록으로
        </Link>
        {req.status === 'closed' && !req.hidden_at && (
          <DeleteClosedLeadButton requestId={id} redirectAfter="/admin/leads" />
        )}
      </div>
      {req.hidden_at && (
        <p className="mt-2 rounded-input bg-neutral-100 px-3 py-2 admin-body-sm text-neutral-500">
          이 요청은 목록에서 삭제(숨김) 처리되었습니다. ({new Date(req.hidden_at).toLocaleString('ko-KR')})
        </p>
      )}
      <p className="mt-2 admin-body-sm text-neutral-500">
        접수일: {new Date(req.created_at).toLocaleString('ko-KR')} · source: {req.source} · locale: {req.locale}
      </p>

      <StatusAssigneeForm
        requestId={id}
        currentStatus={req.status}
        currentAssigneeId={req.assignee_id}
        admins={admins ?? []}
      />

      <section className="mt-6 rounded-card border border-neutral-200 bg-neutral-0 p-6">
        <h2 className="admin-heading-3 text-neutral-900">요청 내용</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="찾으시는 것" value={req.what_looking_for} />
          <Field label="카테고리" value={label(CATEGORY_LABELS, req.category)} />
          <Field label="파트너 유형" value={label(PARTNER_TYPE_LABELS, req.partner_type)} />
          <Field label="예산" value={label(BUDGET_LABELS, req.budget)} />
          <Field label="희망 시기" value={label(TIMELINE_LABELS, req.timeline)} />
          <Field label="영어 소통" value={label(ENGLISH_SPEAKING_LABELS, req.english_speaking)} />
          <Field label="목적" value={req.purpose} full />
          <Field label="상세 설명" value={req.description} full />
        </dl>
      </section>

      <section className="mt-6 rounded-card border border-neutral-200 bg-neutral-0 p-6">
        <h2 className="admin-heading-3 text-neutral-900">연락처</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="회사명 / 웹사이트" value={req.company_name_website} />
          <div>
            <dt className="admin-label-sm text-neutral-500">연락처</dt>
            <dd className="mt-1 admin-body text-neutral-900">
              <RevealContact requestId={id} maskedContact={req.contact_masked} canAccessPii={!!context.can_access_pii} />
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-card border border-neutral-200 bg-neutral-0 p-6">
        <h2 className="admin-heading-3 text-neutral-900">내부 메모</h2>
        <p className="mt-1 admin-label-sm text-neutral-400">이 메모는 신청자에게 노출되지 않습니다.</p>
        <InternalNote requestId={id} initialNote={internalNote ?? ''} />
      </section>
    </div>
  )
}

function Field({ label: fieldLabel, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <dt className="admin-label-sm text-neutral-500">{fieldLabel}</dt>
      <dd className="mt-1 whitespace-pre-wrap admin-body text-neutral-900">{value}</dd>
    </div>
  )
}
