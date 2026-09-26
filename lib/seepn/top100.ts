// TOP100 산정 (2026-09-26 대표 결정). 모든 입력은 공개 집계 뷰(partner_rating_summary,
// partner_bookmark_summary, partner_featured_public)라 anon으로 읽는다.
//   종합   : 리뷰 수를 반영한 보정 평점(베이지안 평균) — score = (v/(v+m))*R + (m/(v+m))*C
//            v=해당 공급사 리뷰 수, R=해당 공급사 평균, C=전체 리뷰 가중 평균, m=BAYES_PRIOR_REVIEWS.
//            리뷰가 적을수록 C(전체 평균) 쪽으로 보정돼 리뷰 1~2건 공급사가 만점으로 1위가 되는
//            왜곡을 막는다. 산식은 화면에 공개한다(표시·광고법 대비).
//   좋아요 : 관심등록(♥) 수 (어느 회원인지는 집계에 없음)
//   별점   : 4차원 종합 평균 (동점이면 리뷰 수 많은 순)
//   리뷰   : 게시 리뷰 수
//   MD추천 : 운영자 선정(partner_featured_public, 큐레이션 순서 그대로 — 점수·랭킹이 아님)
import type { SupabaseClient } from '@supabase/supabase-js'

export const TOP100_LIMIT = 100
export const BAYES_PRIOR_REVIEWS = 3

export const TOP100_TABS = [
  { key: 'overall', label: '종합' },
  { key: 'likes', label: '좋아요' },
  { key: 'rating', label: '별점' },
  { key: 'reviews', label: '리뷰' },
  { key: 'md', label: 'MD추천' },
] as const
export type Top100TabKey = (typeof TOP100_TABS)[number]['key']

export interface Top100Row {
  rank: number
  partnerId: string
  name: string
  category: string | null
  avgRating: number | null
  reviewCount: number
  bookmarkCount: number
}

interface RatingRow {
  partner_id: string
  review_count: number
  avg_overall: number | string
}

export async function fetchTop100(supabase: SupabaseClient, tab: Top100TabKey): Promise<Top100Row[]> {
  const [{ data: ratingData }, { data: bookmarkData }] = await Promise.all([
    supabase.from('partner_rating_summary').select('partner_id, review_count, avg_overall'),
    supabase.from('partner_bookmark_summary').select('partner_id, bookmark_count'),
  ])
  const ratings = new Map<string, { count: number; avg: number }>()
  let totalReviews = 0
  let weighted = 0
  for (const r of (ratingData ?? []) as RatingRow[]) {
    const avg = Number(r.avg_overall)
    ratings.set(r.partner_id, { count: r.review_count, avg })
    totalReviews += r.review_count
    weighted += r.review_count * avg
  }
  const globalMean = totalReviews > 0 ? weighted / totalReviews : 0
  const bookmarks = new Map((bookmarkData ?? []).map((b: { partner_id: string; bookmark_count: number }) => [b.partner_id, b.bookmark_count]))

  let orderedIds: string[] = []
  if (tab === 'md') {
    const { data } = await supabase.from('partner_featured_public').select('id')
    orderedIds = (data ?? []).map((r: { id: string }) => r.id)
  } else if (tab === 'likes') {
    orderedIds = Array.from(bookmarks.entries())
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
  } else {
    const entries = Array.from(ratings.entries())
    if (tab === 'reviews') entries.sort((a, b) => b[1].count - a[1].count || b[1].avg - a[1].avg)
    else if (tab === 'rating') entries.sort((a, b) => b[1].avg - a[1].avg || b[1].count - a[1].count)
    else {
      const score = (v: number, r: number) => (v / (v + BAYES_PRIOR_REVIEWS)) * r + (BAYES_PRIOR_REVIEWS / (v + BAYES_PRIOR_REVIEWS)) * globalMean
      entries.sort((a, b) => score(b[1].count, b[1].avg) - score(a[1].count, a[1].avg) || b[1].count - a[1].count)
    }
    orderedIds = entries.map(([id]) => id)
  }
  orderedIds = orderedIds.slice(0, TOP100_LIMIT)
  if (orderedIds.length === 0) return []

  const [{ data: partners }, { data: links }] = await Promise.all([
    supabase.from('partner_list_public').select('id, company_name_ko').in('id', orderedIds),
    supabase.from('partner_category_public').select('partner_id, standard_category_id').eq('role', 'primary').in('partner_id', orderedIds),
  ])
  const nameById = new Map((partners ?? []).map((p: { id: string; company_name_ko: string | null }) => [p.id, p.company_name_ko ?? '(회사명 미공개)']))
  const categoryIds = Array.from(new Set((links ?? []).map((l: { standard_category_id: string }) => l.standard_category_id)))
  const categoryNameById = new Map<string, string>()
  if (categoryIds.length > 0) {
    const { data: names } = await supabase.from('standard_category_translation').select('category_id, name').eq('locale', 'ko').in('category_id', categoryIds)
    for (const n of (names ?? []) as { category_id: string; name: string }[]) categoryNameById.set(n.category_id, n.name)
  }
  const categoryByPartner = new Map((links ?? []).map((l: { partner_id: string; standard_category_id: string }) => [l.partner_id, categoryNameById.get(l.standard_category_id) ?? null]))

  const rows: Top100Row[] = []
  for (const id of orderedIds) {
    const name = nameById.get(id)
    if (!name) continue
    const r = ratings.get(id)
    rows.push({ rank: 0, partnerId: id, name, category: categoryByPartner.get(id) ?? null, avgRating: r?.avg ?? null, reviewCount: r?.count ?? 0, bookmarkCount: bookmarks.get(id) ?? 0 })
  }
  return rows.map((r, i) => ({ ...r, rank: i + 1 }))
}
