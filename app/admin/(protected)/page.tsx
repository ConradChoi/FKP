// Design Ref: fkp-v0.2-platform-foundation.prd.md §3 (OQ-12: "새 지표를 만들지 않는다" — 이
// 대시보드는 §3의 북극성/보조 지표와 E3-R3가 명시한 항목(기간별 접수/상태별·카테고리별·
// locale별 분포/미처리 건수)만 그대로 노출한다). 북극성 지표의 SSOT는 GA4가 아니라 이
// Supabase 조회 결과 자체다(§3.1).
//
// 집계는 RLS로 이미 lead_management read 범위로 좁혀진 행을 서버에서 그대로 가져와 JS로
// 계산한다(현재 리드 규모가 작아 충분 — 건수가 많아지면 전용 집계 함수/뷰로 옮길 것).
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_ORDER, label } from '@/lib/admin/labels'
import { DistributionBar } from './DistributionBar'

const LOCALE_LABELS: Record<string, string> = { en: '영어(en)', ja: '일본어(ja)' }

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export default async function AdminHomePage() {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) redirect('/admin/login')

  const { data: context } = await supabase.rpc('get_my_admin_context')
  if (!context?.is_active_admin) redirect('/admin/login')

  const { data: rows, error } = await supabase
    .from('requests')
    .select('status, category, locale, created_at')
    .order('created_at', { ascending: false })
    .limit(5000)

  const leads = rows ?? []
  const now = new Date()
  const today = startOfDay(now)
  const monthStart = startOfMonth(now)

  const total = leads.length
  const todayCount = leads.filter((r) => new Date(r.created_at) >= today).length
  const monthCount = leads.filter((r) => new Date(r.created_at) >= monthStart).length
  const unprocessed = leads.filter((r) => r.status === 'new' || r.status === 'reviewing').length

  function countBy(key: 'status' | 'category' | 'locale') {
    const counts = new Map<string, number>()
    for (const r of leads) {
      const v = (r as Record<string, string>)[key] ?? '-'
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    return counts
  }
  const byStatus = countBy('status')
  const byCategory = countBy('category')
  const byLocale = countBy('locale')

  return (
    <div className="mx-auto max-w-[960px]">
      <h1 className="text-h3 text-primary-900">대시보드</h1>
      {error && <p className="mt-4 text-body-sm text-error">지표를 불러오지 못했습니다: {error.message}</p>}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="전체 리드" value={total} />
        <StatCard label="미처리 (신규+검토중)" value={unprocessed} accent={unprocessed > 0} />
        <StatCard label="이번 달 접수" value={monthCount} />
        <StatCard label="오늘 접수" value={todayCount} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="rounded-card border border-neutral-200 bg-neutral-0 p-6">
          <h2 className="text-h4 text-neutral-900">상태별 분포</h2>
          <div className="mt-4 flex flex-col gap-2">
            {STATUS_ORDER.map((s) => (
              <DistributionBar key={s} label={STATUS_LABELS[s]} count={byStatus.get(s) ?? 0} total={total} />
            ))}
          </div>
        </section>

        <section className="rounded-card border border-neutral-200 bg-neutral-0 p-6">
          <h2 className="text-h4 text-neutral-900">카테고리별 분포</h2>
          <div className="mt-4 flex flex-col gap-2">
            {[...byCategory.entries()].map(([cat, count]) => (
              <DistributionBar key={cat} label={label(CATEGORY_LABELS, cat)} count={count} total={total} />
            ))}
          </div>
        </section>

        <section className="rounded-card border border-neutral-200 bg-neutral-0 p-6 sm:col-span-2">
          <h2 className="text-h4 text-neutral-900">언어(locale)별 분포</h2>
          <div className="mt-4 flex flex-col gap-2">
            {[...byLocale.entries()].map(([loc, count]) => (
              <DistributionBar key={loc} label={LOCALE_LABELS[loc] ?? loc} count={count} total={total} />
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/admin/leads"
          className="rounded-card border border-neutral-200 bg-neutral-0 p-6 transition-colors hover:border-primary-300"
        >
          <h2 className="text-h4 text-neutral-900">요청관리</h2>
          <p className="mt-2 text-body-sm text-neutral-600">리드 목록을 조회하고 상태/담당자를 관리합니다.</p>
        </Link>
        {context.is_super_admin && (
          <Link
            href="/admin/access-requests"
            className="rounded-card border border-neutral-200 bg-neutral-0 p-6 transition-colors hover:border-primary-300"
          >
            <h2 className="text-h4 text-neutral-900">가입 요청 검토</h2>
            <p className="mt-2 text-body-sm text-neutral-600">신규 운영자 가입 요청을 승인/거부합니다.</p>
          </Link>
        )}
      </div>
    </div>
  )
}

function StatCard({ label: statLabel, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-card border border-neutral-200 bg-neutral-0 p-4">
      <p className="text-label-caption text-neutral-500">{statLabel}</p>
      <p className={`mt-1 text-h3 ${accent ? 'text-error' : 'text-neutral-900'}`}>{value}</p>
    </div>
  )
}
