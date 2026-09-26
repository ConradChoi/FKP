// 글쓰기. 닉네임이 없으면 먼저 닉네임 설정을 받는다(작성자는 닉네임으로만 공개된다).
import Link from 'next/link'
import { redirectToLoginIfNoBuyerSession } from '@/lib/seepn/loginGate'
import { requireBuyerSession } from '@/lib/seepn/session'
import { CommunityPostForm } from '@/components/seepn/CommunityPostForm'
import { NicknameForm } from '@/components/seepn/NicknameForm'
import { SeepnMainHeader } from '@/components/seepn/SeepnMainChrome'
import { SeepnFooter } from '@/components/seepn/SeepnFooter'

export const dynamic = 'force-dynamic'

export default async function SeepnCommunityNewPage() {
  await redirectToLoginIfNoBuyerSession('/seepn/community/new')
  const session = await requireBuyerSession()
  const { data: account } = await session.supabase.from('buyer_account').select('nickname').maybeSingle<{ nickname: string | null }>()
  const nickname = account?.nickname ?? null

  return (
    <div className="flex min-h-screen flex-col bg-[#f9fafb]">
      <SeepnMainHeader active="community" />
      <main className="mx-auto w-full max-w-[800px] flex-1 px-6 py-10">
        <p className="text-label-caption text-neutral-500">
          <Link href="/seepn/community" className="hover:underline">자유토론방</Link> &gt; 글쓰기
        </p>
        <h1 className="mt-2 text-[22px] font-bold text-neutral-900">글쓰기</h1>
        <div className="mt-6">
          {nickname ? (
            <>
              <p className="mb-3 text-body-sm text-neutral-500">
                작성자로 <strong className="text-neutral-800">{nickname}</strong> 닉네임이 표시됩니다.{' '}
                <Link href="/seepn/my/profile" className="text-primary-600 hover:underline">닉네임 변경</Link>
              </p>
              <CommunityPostForm />
            </>
          ) : (
            <>
              <p className="mb-3 text-body-sm text-neutral-600">글과 댓글을 쓰려면 먼저 커뮤니티 닉네임을 설정해주세요.</p>
              <NicknameForm initial={null} />
            </>
          )}
        </div>
      </main>
      <SeepnFooter />
    </div>
  )
}
