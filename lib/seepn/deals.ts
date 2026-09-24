// 거래 공급사 = 내 문의 중 운영자가 처리에 착수한 건(status <> 'new': 처리중/완료)에 포함된 공급사
// (2026-09-24 대표 정의: "바이어와 공급사 간 진행 데이터가 있을 경우 거래"). 새 테이블 없이 본인
// 문의(RLS: 본인 행만)에서 파생한다. 기존 match/outcome 데이터는 계정 없는 FKP 요청용이라 SEEPN
// 회원 계정과 연결되어 있지 않아 사용하지 않는다.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface DealPartner {
  partnerId: string
  name: string
  listed: boolean
  inquiryCount: number
  latestStatus: string
  latestAt: string
}

export async function fetchDealPartners(supabase: SupabaseClient): Promise<DealPartner[]> {
  const { data: inquiries } = await supabase
    .from('seepn_inquiry')
    .select('id, status, created_at')
    .neq('status', 'new')
    .order('created_at', { ascending: false })
  const rows = (inquiries ?? []) as { id: string; status: string; created_at: string }[]
  if (rows.length === 0) return []

  const { data: links } = await supabase
    .from('seepn_inquiry_partner')
    .select('inquiry_id, partner_id')
    .in('inquiry_id', rows.map((r) => r.id))
  const linkRows = (links ?? []) as { inquiry_id: string; partner_id: string }[]

  const inquiryById = new Map(rows.map((r) => [r.id, r]))
  const byPartner = new Map<string, DealPartner>()
  // rows are newest-first, so the first inquiry seen per partner is its latest.
  for (const r of rows) {
    for (const l of linkRows.filter((x) => x.inquiry_id === r.id)) {
      const existing = byPartner.get(l.partner_id)
      if (existing) existing.inquiryCount += 1
      else byPartner.set(l.partner_id, { partnerId: l.partner_id, name: '', listed: false, inquiryCount: 1, latestStatus: inquiryById.get(r.id)!.status, latestAt: r.created_at })
    }
  }

  const partnerIds = Array.from(byPartner.keys())
  if (partnerIds.length > 0) {
    const { data: partners } = await supabase.from('partner_list_public').select('id, company_name_ko').in('id', partnerIds)
    const nameById = new Map((partners ?? []).map((p: { id: string; company_name_ko: string | null }) => [p.id, p.company_name_ko ?? '(회사명 미공개)']))
    for (const d of byPartner.values()) {
      d.listed = nameById.has(d.partnerId)
      d.name = nameById.get(d.partnerId) ?? '(비공개 파트너)'
    }
  }
  return Array.from(byPartner.values()).sort((a, b) => b.latestAt.localeCompare(a.latestAt))
}
