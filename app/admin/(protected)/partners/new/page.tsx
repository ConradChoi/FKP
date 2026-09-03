// Design Ref: screen-spec §2.4 (신규 등록 — admin_entry, A1-R2/SP-1). "통화 중 입력" 제약을
// 반영한 1단계 짧은 폼 — admin_create_partner_entry가 받는 파라미터가 정확히 이 폼의 전체
// 필드다(나머지 Capability는 상세 화면에서 이어쓴다, SS-6 부분저장 철학).
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { NewPartnerEntryForm } from './NewPartnerEntryForm'

export default async function NewPartnerPage() {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  // Fix (qa pass, 2026-09-03) — 화면정의서 §1.2: create 권한 없는 역할은 이 화면 자체에
  // 접근하지 못해야 한다(서버 RPC는 이미 막지만, 화면 접근 자체는 막혀있지 않았음).
  const { data: canCreate } = await supabase.rpc('has_menu_permission_check', {
    p_menu_code: 'partner_management',
    p_action: 'create',
  })
  if (!canCreate) redirect('/admin/partners')

  return (
    <div>
      <Link href="/admin/partners" className="admin-body-sm text-primary-600 hover:underline">
        ← 공급사 관리 목록으로
      </Link>
      <h1 className="mt-2 admin-heading-2 text-neutral-900">신규 등록 (예외입력)</h1>
      <p className="mt-1 admin-body-sm text-neutral-500">
        전화/대면으로 확보한 최소 정보만 입력합니다. 나머지 Capability 항목은 저장 후 상세 화면에서 이어서 입력할 수 있습니다.
      </p>
      <div className="mt-6">
        <NewPartnerEntryForm />
      </div>
    </div>
  )
}
