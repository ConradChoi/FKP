// Design Ref: docs/02-design/features/seepn-buyer-web-p5a.screen-spec.md §8 (BY-A1 상세) —
// "문의 본문 전문, 참조 파트너 링크, 바이어 정보(마스킹, 원문 열람은 감사 RPC 경유), 상태 변경,
// 담당자 배정" + privacy review §5.4 "Admin 문의 상세에 '바이어 식별정보를 파트너에게 전달하지
// 마세요' 운영 가이드 문구를 노출". get_seepn_inquiry_detail() itself is audited on every call
// (INQ-7 — opening the detail IS the body-reveal event), so this page must call it exactly once
// per navigation, not per re-render (a Server Component's render body already satisfies that).
// GAP-C1 (2026-09-10, 20260910180000): "참조 파트너" is now a list (1..5 partners), each
// rendered as its own link, instead of a single partner_id link.
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { INQUIRY_STATUS_LABELS } from '@/lib/seepn/partnerLabels'
import type { AdminSeepnInquiryDetail } from '@/lib/seepn/types'
import { RevealInquiryContact } from './RevealInquiryContact'
import { InquiryStatusAssignForm } from './InquiryStatusAssignForm'

export default async function AdminSeepnInquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  const { data: detail, error } = await supabase.rpc('get_seepn_inquiry_detail', { p_inquiry_id: id })
  if (error || !detail) notFound()

  const inquiry = detail as unknown as AdminSeepnInquiryDetail
  const [{ data: adminsRaw }, { data: canUpdate }] = await Promise.all([
    supabase.rpc('list_admin_users_for_assignment'),
    supabase.rpc('has_menu_permission_check', { p_menu_code: 'lead_management', p_action: 'update' }),
  ])
  const admins = (adminsRaw ?? []) as { id: string; display_name: string }[]

  return (
    <div className="max-w-2xl">
      <Link href="/admin/leads/inquiries" className="admin-body-sm text-neutral-500 hover:underline">
        ← 목록으로
      </Link>

      <h1 className="mt-2 admin-heading-2 text-neutral-900">문의 상세</h1>

      <div className="mt-4 rounded-card border border-accent-200 bg-accent-50 px-4 py-3 admin-body-sm text-accent-800">
        바이어 식별정보(이름·이메일·연락처·소속)를 파트너에게 전달하지 마세요. 파트너에게는 익명화된 니즈 요약만
        전달하고, 실제 연결이 필요한 경우 대표 승인을 거쳐 별도 동의를 받은 후에만 전달합니다.
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 rounded-card border border-neutral-200 bg-neutral-0 p-4 admin-body-sm">
        <div>
          <dt className="admin-label-sm text-neutral-500">참조 파트너 ({inquiry.partners.length}건)</dt>
          <dd className="flex flex-col gap-1">
            {inquiry.partners.map((p) => (
              <Link key={p.id} href={`/admin/partners/${p.id}`} className="text-primary-600 hover:underline">
                {p.company_name_ko ?? '(회사명 미공개)'}
              </Link>
            ))}
          </dd>
        </div>
        <div>
          <dt className="admin-label-sm text-neutral-500">바이어</dt>
          <dd>
            <RevealInquiryContact inquiryId={id} maskedName={inquiry.buyer_display_name} />
          </dd>
        </div>
        <div>
          <dt className="admin-label-sm text-neutral-500">상태</dt>
          <dd>{INQUIRY_STATUS_LABELS[inquiry.status] ?? inquiry.status}</dd>
        </div>
        <div>
          <dt className="admin-label-sm text-neutral-500">접수일</dt>
          <dd>{new Date(inquiry.created_at).toLocaleString('ko-KR')}</dd>
        </div>
      </dl>

      <div className="mt-4 rounded-card border border-neutral-200 bg-neutral-0 p-4">
        <p className="admin-label-sm text-neutral-500">문의 내용</p>
        <p className="mt-2 whitespace-pre-wrap admin-body text-neutral-800">{inquiry.body}</p>
      </div>

      <div className="mt-4">
        {canUpdate ? (
          <InquiryStatusAssignForm
            inquiryId={id}
            currentStatus={inquiry.status}
            currentAssignedAdminId={inquiry.assigned_admin_id}
            admins={admins}
          />
        ) : (
          <p className="admin-body-sm text-neutral-400">담당자: {inquiry.assigned_admin_name ?? '미지정'} (viewer 역할은 상태/담당자 변경 불가)</p>
        )}
      </div>
    </div>
  )
}
