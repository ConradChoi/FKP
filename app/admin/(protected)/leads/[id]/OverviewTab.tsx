// Design Ref: human-matching.screen-spec.md §4.1 / ui-spec §1 — "개요 탭 내용: 현재
// leads/[id]/page.tsx가 렌더링하는 3개 섹션을 그대로 옮긴다 — 섹션 내부 마크업 변경 없음".
// This is a byte-for-byte move of the pre-tab page.tsx body, no logic changes.
import { CATEGORY_LABELS, PARTNER_TYPE_LABELS, BUDGET_LABELS, TIMELINE_LABELS, ENGLISH_SPEAKING_LABELS, label } from '@/lib/admin/labels'
import { StatusAssigneeForm } from './StatusAssigneeForm'
import { InternalNote } from './InternalNote'
import { RevealContact } from './RevealContact'

export interface OverviewTabRequest {
  id: string
  what_looking_for: string
  category: string
  partner_type: string
  purpose: string
  description: string
  budget: string
  timeline: string
  english_speaking: string
  company_name_website: string
  status: string
  assignee_id: string | null
  contact_masked: string
}

export function OverviewTab({
  req,
  admins,
  internalNote,
  canAccessPii,
  matchCount,
}: {
  req: OverviewTabRequest
  admins: { id: string; display_name: string }[]
  internalNote: string
  canAccessPii: boolean
  matchCount: number
}) {
  return (
    <div>
      <StatusAssigneeForm
        requestId={req.id}
        currentStatus={req.status}
        currentAssigneeId={req.assignee_id}
        admins={admins}
        matchCount={matchCount}
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
              <RevealContact requestId={req.id} maskedContact={req.contact_masked} canAccessPii={canAccessPii} />
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-card border border-neutral-200 bg-neutral-0 p-6">
        <h2 className="admin-heading-3 text-neutral-900">내부 메모</h2>
        <p className="mt-1 admin-label-sm text-neutral-400">이 메모는 신청자에게 노출되지 않습니다.</p>
        <InternalNote requestId={req.id} initialNote={internalNote} />
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
