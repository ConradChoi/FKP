// 게시중단 요청 안내 (이용약관 제11조의3). 서비스의 리뷰·커뮤니티 게시물로 권리를 침해받았다고
// 주장하는 사람(파트너를 포함)이 게시중단을 요청하는 방법과 처리 절차를 안내한다. 접수 창구는
// 고객센터 이메일이다.
import type { Metadata } from 'next'
import Link from 'next/link'
import { SeepnMainHeader } from '@/components/seepn/SeepnMainChrome'
import { SeepnFooter } from '@/components/seepn/SeepnFooter'

export const metadata: Metadata = { title: 'SEEPN 게시중단 요청 안내' }

const SUBJECT = encodeURIComponent('[게시중단 요청] 게시물 권리침해 신고')

export default function SeepnTakedownPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f9fafb]">
      <SeepnMainHeader />
      <main className="mx-auto w-full max-w-[760px] flex-1 px-6 py-10">
        <h1 className="text-[22px] font-bold text-neutral-900">게시중단 요청 안내</h1>
        <p className="mt-3 text-body-sm text-neutral-600">
          SEEPN의 리뷰·커뮤니티 게시물로 사생활 침해, 명예훼손 등 권리를 침해받았다고 생각하시는 분(공급사를 포함합니다)은 아래 방법으로 게시중단을 요청하실 수 있습니다.
          자세한 내용은 <Link href="/seepn/legal/terms" className="text-primary-600 hover:underline">이용약관 제11조의3</Link>을 확인해 주세요.
        </p>

        <section className="mt-8">
          <h2 className="text-body font-semibold text-neutral-900">접수 방법</h2>
          <p className="mt-2 text-body-sm text-neutral-700">
            <a href={`mailto:info@ylia.io?subject=${SUBJECT}`} className="font-medium text-primary-600 hover:underline">
              info@ylia.io
            </a>
            로 아래 내용을 보내주세요.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-body-sm text-neutral-700">
            <li>요청인의 성명(상호), 연락처, 권리를 가진 자임을 확인할 수 있는 정보</li>
            <li>침해되었다고 주장하는 게시물의 위치(화면 주소 등)</li>
            <li>침해 사실을 소명하는 내용과 자료</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-body font-semibold text-neutral-900">처리 절차</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-body-sm text-neutral-700">
            <li>접수 즉시 해당 게시물을 삭제하거나 임시로 접근할 수 없게 하는 조치(임시조치, 30일 이내)를 하고, 요청인과 작성한 회원에게 알립니다.</li>
            <li>작성한 회원은 임시조치 기간 안에 이의를 제기하며 재게시를 요청할 수 있습니다.</li>
            <li>회사는 양 당사자의 소명과 관계 법령에 따라 삭제 또는 재게시 여부를 판단하여 알려드립니다.</li>
            <li>삭제·임시조치가 이루어진 게시물에는 그 사실을 표시합니다.</li>
          </ol>
        </section>

        <p className="mt-8 rounded-input border border-neutral-200 bg-white p-4 text-label-caption text-neutral-500">
          허위의 사실로 게시중단을 요청하여 타인에게 손해를 입힌 경우 책임을 질 수 있습니다. 개인정보 침해 등 개인정보 처리에 관한 요청은 개인정보 처리방침에 안내된 방법으로 접수하실 수 있습니다.
        </p>
      </main>
      <SeepnFooter />
    </div>
  )
}
