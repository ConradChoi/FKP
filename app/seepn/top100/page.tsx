// Design Ref: Figma U-06 TOP100 (node 293:2) — 탭(종합·좋아요·별점·리뷰·MD추천) + 순위 목록. 산정
// 기준은 lib/seepn/top100.ts에 정의하고, 산식은 화면에 공개한다.
import Link from 'next/link'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { BAYES_PRIOR_REVIEWS, TOP100_LIMIT, TOP100_TABS, fetchTop100, type Top100TabKey } from '@/lib/seepn/top100'
import { SeepnMainHeader } from '@/components/seepn/SeepnMainChrome'
import { SeepnFooter } from '@/components/seepn/SeepnFooter'

export const revalidate = 300

const TAB_NOTES: Record<Top100TabKey, string> = {
  overall: `종합 순위는 리뷰 수를 반영한 보정 평점입니다. 리뷰가 적은 공급사는 전체 평균 쪽으로 보정되어(리뷰 ${BAYES_PRIOR_REVIEWS}건 기준), 소수의 리뷰만으로 상위에 오르지 않습니다.`,
  likes: '관심등록(♥) 수가 많은 순서입니다. 어느 회원이 관심등록했는지는 공개되지 않습니다.',
  rating: '품질·가격·납기·서비스 4차원 평균 별점이 높은 순서입니다(동점이면 리뷰 수가 많은 순).',
  reviews: '등록된 리뷰 수가 많은 순서입니다.',
  md: 'SEEPN 운영자가 선정한 공급사이며, 점수나 순위가 아니라 운영자가 정한 순서입니다.',
}

export default async function SeepnTop100Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams
  const tab: Top100TabKey = (TOP100_TABS.find((t) => t.key === tabParam)?.key ?? 'overall') as Top100TabKey
  const supabase = getSupabaseServerClient()
  const rows = supabase ? await fetchTop100(supabase, tab) : []

  return (
    <div className="flex min-h-screen flex-col bg-[#f9fafb]">
      <SeepnMainHeader active="top100" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <h1 className="text-[22px] font-bold text-neutral-900">TOP {TOP100_LIMIT}</h1>
        <div className="mt-5 flex gap-6 border-b border-neutral-200 text-body-sm">
          {TOP100_TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === 'overall' ? '/seepn/top100' : `/seepn/top100?tab=${t.key}`}
              className={`-mb-px border-b-2 pb-2.5 ${tab === t.key ? 'border-primary-700 font-bold text-primary-700' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <p className="mt-3 text-label-caption text-neutral-500">{TAB_NOTES[tab]}</p>

        {rows.length === 0 ? (
          <p className="mt-6 rounded-input border border-dashed border-neutral-200 bg-white p-10 text-center text-body-sm text-neutral-500">아직 집계할 데이터가 없습니다.</p>
        ) : (
          <ol className="mt-5 divide-y divide-neutral-200 overflow-hidden rounded-input border border-neutral-200 bg-white">
            {rows.map((r) => (
              <li key={r.partnerId}>
                <Link href={`/seepn/partners/${r.partnerId}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-50">
                  <span className={`w-6 text-[18px] font-bold ${r.rank === 1 ? 'text-[#fbbf24]' : 'text-neutral-700'}`}>{r.rank}</span>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-label-caption font-bold text-white">{r.name.slice(0, 1)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm font-bold text-neutral-900">{r.name}</span>
                    {r.category && <span className="mt-1 inline-block rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-medium text-primary-600">{r.category}</span>}
                  </span>
                  <span className="shrink-0 text-[13px] font-medium text-neutral-700">
                    {tab === 'likes' ? (
                      <>♥ {r.bookmarkCount.toLocaleString('ko-KR')}</>
                    ) : tab === 'reviews' ? (
                      <>리뷰 {r.reviewCount.toLocaleString('ko-KR')}건</>
                    ) : tab === 'md' ? (
                      <span className="text-primary-600">운영자 추천</span>
                    ) : r.avgRating !== null ? (
                      <>
                        ★{r.avgRating.toFixed(1)} <span className="font-normal text-neutral-400">({r.reviewCount})</span>
                      </>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </main>
      <SeepnFooter />
    </div>
  )
}
