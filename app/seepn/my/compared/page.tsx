// Design Ref: Figma U-11 마이페이지 side menu "비교 공급사" — 사용자가 비교 화면에서 저장한 공급사
// 조합 목록 (2026-09-24 대표 결정: 자동 이력이 아니라 저장 버튼). Session gate: my/layout.tsx.
import { requireBuyerSession } from '@/lib/seepn/session'
import { SavedComparisonList, type SavedComparisonItem } from '@/components/seepn/SavedComparisonList'

export const dynamic = 'force-dynamic'

export default async function SeepnMyComparedPage() {
  const { supabase } = await requireBuyerSession()

  const { data: saved } = await supabase.from('buyer_saved_comparison').select('id, partner_ids, created_at').order('created_at', { ascending: false })
  const rows = (saved ?? []) as { id: string; partner_ids: string[]; created_at: string }[]

  const allIds = Array.from(new Set(rows.flatMap((r) => r.partner_ids)))
  const nameById = new Map<string, string>()
  if (allIds.length > 0) {
    const { data: partners } = await supabase.from('partner_list_public').select('id, company_name_ko').in('id', allIds)
    for (const p of (partners ?? []) as { id: string; company_name_ko: string | null }[]) nameById.set(p.id, p.company_name_ko ?? '(회사명 미공개)')
  }

  const items: SavedComparisonItem[] = rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    partners: r.partner_ids.map((id) => ({ id, name: nameById.get(id) ?? '(비공개 파트너)', listed: nameById.has(id) })),
  }))

  return (
    <div>
      <h1 className="text-h3 text-neutral-900">비교 공급사</h1>
      <p className="mt-1 text-body-sm text-neutral-500">비교 화면에서 저장한 공급사 조합입니다. 최대 20개까지 저장할 수 있으며, 공급사는 회원님이 저장한 비교 내역을 볼 수 없습니다. 삭제하거나 탈퇴하시면 즉시 삭제됩니다.</p>
      <div className="mt-6">
        <SavedComparisonList initialItems={items} />
      </div>
    </div>
  )
}
