// 공급사 리뷰·평가 공용 헬퍼. 평가 지표 정의(대표 확정 2026-09-25): 4차원(품질·가격·납기·서비스)
// 1~5점, 종합 = 4차원 평균, 신뢰도 지수 = 종합 평균 x 20(100점 환산). 리뷰 3건 미만이면 수치가
// 표본 부족으로 오해를 주므로 신뢰도 지수는 표시하지 않는다.
import type { SupabaseClient } from '@supabase/supabase-js'

export const MIN_REVIEWS_FOR_TRUST_INDEX = 3
export const REVIEW_BODY_MAX = 1000

export const RATING_DIMENSIONS = [
  { key: 'quality', label: '품질', column: 'rating_quality' },
  { key: 'price', label: '가격', column: 'rating_price' },
  { key: 'leadTime', label: '납기', column: 'rating_lead_time' },
  { key: 'service', label: '서비스', column: 'rating_service' },
] as const

export type RatingDimensionKey = (typeof RATING_DIMENSIONS)[number]['key']

export interface RatingSummary {
  reviewCount: number
  avgQuality: number
  avgPrice: number
  avgLeadTime: number
  avgService: number
  avgOverall: number
}

export function averageOf(s: RatingSummary, key: RatingDimensionKey): number {
  return key === 'quality' ? s.avgQuality : key === 'price' ? s.avgPrice : key === 'leadTime' ? s.avgLeadTime : s.avgService
}

export function trustIndex(s: RatingSummary | null | undefined): number | null {
  if (!s || s.reviewCount < MIN_REVIEWS_FOR_TRUST_INDEX) return null
  return Math.round(s.avgOverall * 20)
}

interface SummaryRow {
  partner_id: string
  review_count: number
  avg_quality: number | string
  avg_price: number | string
  avg_lead_time: number | string
  avg_service: number | string
  avg_overall: number | string
}

export async function fetchRatingSummaries(supabase: SupabaseClient, partnerIds: string[]): Promise<Map<string, RatingSummary>> {
  const result = new Map<string, RatingSummary>()
  if (partnerIds.length === 0) return result
  const { data } = await supabase.from('partner_rating_summary').select('*').in('partner_id', partnerIds)
  for (const r of (data ?? []) as SummaryRow[]) {
    result.set(r.partner_id, {
      reviewCount: r.review_count,
      avgQuality: Number(r.avg_quality),
      avgPrice: Number(r.avg_price),
      avgLeadTime: Number(r.avg_lead_time),
      avgService: Number(r.avg_service),
      avgOverall: Number(r.avg_overall),
    })
  }
  return result
}

// Adds `rating` (overall average + count) to list/card rows; rows without reviews get null.
export async function attachRatings<T extends { id: string }>(supabase: SupabaseClient, rows: T[]): Promise<(T & { rating: { avg: number; count: number } | null })[]> {
  const summaries = await fetchRatingSummaries(supabase, rows.map((r) => r.id))
  return rows.map((r) => {
    const s = summaries.get(r.id)
    return { ...r, rating: s ? { avg: s.avgOverall, count: s.reviewCount } : null }
  })
}
