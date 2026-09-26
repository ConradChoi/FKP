// Design Ref: Figma U-10 FAQ (node 347:32). 질문·답변은 admin > 게시판 > SEEPN FAQ에서 게시한 것만
// 보인다(lib/content/getPublishedSeepnContent.ts). 기존 FKP FAQ(해외 바이어용 en/ja)와는 별개.
import { getPublishedSeepnFaqs } from '@/lib/content/getPublishedSeepnContent'
import { FaqList } from '@/components/seepn/FaqList'
import { SeepnMainHeader } from '@/components/seepn/SeepnMainChrome'
import { SeepnFooter } from '@/components/seepn/SeepnFooter'

export const revalidate = 60

export default async function SeepnFaqPage() {
  const items = await getPublishedSeepnFaqs()
  return (
    <div className="flex min-h-screen flex-col bg-[#f9fafb]">
      <SeepnMainHeader active="faq" />
      <main className="mx-auto w-full max-w-[800px] flex-1 px-6 py-10">
        <h1 className="text-[22px] font-bold text-neutral-900">자주 묻는 질문</h1>
        <div className="mt-5">
          <FaqList items={items} />
        </div>
      </main>
      <SeepnFooter />
    </div>
  )
}
