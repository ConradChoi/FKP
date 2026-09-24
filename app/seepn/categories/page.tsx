// Design Ref: Figma "Seepn 2.0 — UI Design" User App frame "U-CQ-Full — Desktop (1440)" (node
// 101:2) + "U-CQ-L3 Modal" (node 101:308) — the 전체 카테고리 screen the home's "전체 카테고리
// 보기 →" link points to. L1 sidebar (selected via ?l1=<id>, first L1 by default) -> that L1's L2
// cards -> up to 5 L3 rows per card, overflow via CategoryL3Modal. Data is the same public
// category tree /seepn/partners' filter uses; every link lands on that list with ?category=<id>.
import Link from 'next/link'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'
import { fetchPublicCategoryTree } from '@/lib/seepn/categoryTree'
import { CategoryL3ModalTrigger } from '@/components/seepn/CategoryL3Modal'
import { SeepnMainHeader } from '@/components/seepn/SeepnMainChrome'
import { SeepnFooter } from '@/components/seepn/SeepnFooter'

const L3_PREVIEW_LIMIT = 5

export const revalidate = 300

export default async function SeepnCategoriesPage({ searchParams }: { searchParams: Promise<{ l1?: string }> }) {
  const { l1: l1Param } = await searchParams
  const supabase = getSupabaseServerClient()
  // Same 3-root tree (상품/서비스/상품+서비스) the home page flattens — L1 lives one level down.
  const l1Nodes = supabase ? (await fetchPublicCategoryTree(supabase)).flatMap((root) => root.children) : []
  const active = l1Nodes.find((n) => n.id === l1Param) ?? l1Nodes[0]

  return (
    <div className="flex min-h-screen flex-col bg-[#f9fafb]">
      <SeepnMainHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
        <nav aria-label="breadcrumb" className="text-label-caption text-neutral-500">
          <Link href="/seepn/home" className="text-primary-600 hover:underline">
            홈
          </Link>
          <span className="mx-1.5 text-neutral-400">›</span>
          <span>전체 카테고리</span>
        </nav>
        <h1 className="mt-3 text-[24px] font-semibold text-neutral-900">전체 카테고리</h1>

        {!active ? (
          <p className="mt-8 text-body text-neutral-500">카테고리를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
            <aside className="self-start border border-neutral-200 bg-white">
              <p className="px-3 pb-2 pt-4 text-[11px] font-semibold text-neutral-400">카테고리</p>
              <ul className="grid grid-cols-2 sm:grid-cols-3 lg:block">
                {l1Nodes.map((node) => {
                  const isActive = node.id === active.id
                  return (
                    <li key={node.id} className="border-t border-neutral-200">
                      <Link
                        href={`/seepn/categories?l1=${node.id}`}
                        aria-current={isActive ? 'page' : undefined}
                        className={`block px-3 py-2.5 text-body-sm ${
                          isActive ? 'border-l-[3px] border-primary-600 bg-primary-50 font-semibold text-primary-600' : 'border-l-[3px] border-transparent text-neutral-700 hover:bg-neutral-50'
                        }`}
                      >
                        {node.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </aside>

            <section>
              <div className="flex items-center gap-2">
                <h2 className="text-body font-semibold text-neutral-900">{active.name}</h2>
                <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-600">{active.children.length}</span>
              </div>

              {active.children.length === 0 ? (
                <p className="mt-6 text-body-sm text-neutral-500">
                  하위 카테고리가 없습니다.{' '}
                  <Link href={`/seepn/partners?category=${active.id}`} className="text-primary-600 hover:underline">
                    이 카테고리의 공급사 보기 →
                  </Link>
                </p>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {active.children.map((l2) => {
                    const preview = l2.children.slice(0, L3_PREVIEW_LIMIT)
                    const overflow = l2.children.length - preview.length
                    return (
                      <div key={l2.id} className="min-h-[240px] rounded-input border border-neutral-200 bg-white">
                        <Link
                          href={`/seepn/partners?category=${l2.id}`}
                          className="block border-b border-neutral-200 px-3 py-3 text-body-sm font-semibold text-neutral-800 hover:text-primary-600"
                        >
                          {l2.name}
                        </Link>
                        <ul className="px-3 py-2">
                          {preview.map((l3) => (
                            <li key={l3.id}>
                              <Link href={`/seepn/partners?category=${l3.id}`} className="block truncate py-0.5 text-label-caption text-neutral-600 hover:text-primary-600">
                                · {l3.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                        {overflow > 0 && (
                          <div className="px-3 pb-3">
                            <CategoryL3ModalTrigger
                              title={l2.name}
                              label={`외 ${overflow}개 →`}
                              items={l2.children.map((l3) => ({ id: l3.id, name: l3.name, count: l3.rollupCount }))}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
      <SeepnFooter />
    </div>
  )
}
