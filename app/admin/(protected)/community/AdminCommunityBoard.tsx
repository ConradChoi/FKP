'use client'

// 커뮤니티 운영: 신고 접수 목록(처리 대기)과 게시글 목록. 숨김 처리하면 회원에게 노출되지 않고 그
// 대상의 열린 신고는 자동 해결된다. 작성자는 닉네임으로만 보인다(계정 식별자는 화면에 없다).
import { useState } from 'react'
import { adminInputClass } from '@/components/admin/styles'
import { listCommunityCommentsAction, resolveCommunityReportsAction, setCommunityHiddenAction, type AdminCommunityComment, type CommunityTargetType } from './actions'

export interface AdminCommunityReport {
  report_id: string
  target_type: CommunityTargetType
  target_id: string
  reason: string
  detail: string | null
  reported_at: string
  target_status: 'published' | 'hidden' | null
  target_nickname: string | null
  target_excerpt: string | null
  report_count: number
}

export interface AdminCommunityPost {
  id: string
  category: string
  title: string
  body: string
  nickname: string | null
  status: 'published' | 'hidden'
  created_at: string
  comment_count: number
}

const REASON_LABELS: Record<string, string> = { spam: '스팸·광고', abuse: '욕설·비방·명예훼손', privacy: '개인정보 노출', illegal: '불법·위법', other: '기타' }

function HideControls({ targetType, targetId, status, onDone }: { targetType: CommunityTargetType; targetId: string; status: 'published' | 'hidden' | null; onDone: () => void }) {
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(hidden: boolean) {
    setBusy(true)
    setError(null)
    const result = await setCommunityHiddenAction(targetType, targetId, hidden, hidden ? reason : '')
    setBusy(false)
    if (!result.success) {
      setError('처리하지 못했습니다. 권한을 확인해주세요.')
      return
    }
    setAsking(false)
    setReason('')
    onDone()
  }

  if (status === 'hidden') {
    return (
      <span className="inline-flex items-center gap-2">
        <button type="button" disabled={busy} onClick={() => run(false)} className="admin-body-sm text-primary-600 hover:underline">숨김 해제</button>
        {error && <span className="admin-label-sm text-error">{error}</span>}
      </span>
    )
  }
  return asking ? (
    <span className="inline-flex flex-wrap items-center gap-2">
      <input className={`${adminInputClass} w-64`} placeholder="숨김 사유 (선택)" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
      <button type="button" disabled={busy} onClick={() => run(true)} className="admin-body-sm text-error hover:underline">{busy ? '처리 중...' : '숨김 확인'}</button>
      <button type="button" onClick={() => setAsking(false)} className="admin-body-sm text-neutral-500 hover:underline">취소</button>
      {error && <span className="admin-label-sm text-error">{error}</span>}
    </span>
  ) : (
    <button type="button" onClick={() => setAsking(true)} className="admin-body-sm text-error hover:underline">숨기기</button>
  )
}

function PostRow({ post, onChanged }: { post: AdminCommunityPost; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<AdminCommunityComment[] | null>(null)

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && comments === null) setComments((await listCommunityCommentsAction(post.id)).comments)
  }

  return (
    <li className="rounded-card border border-neutral-200 bg-neutral-0 p-4">
      <button type="button" onClick={toggle} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="block truncate admin-body-sm font-medium text-neutral-900">[{post.category}] {post.title}</span>
          <span className="admin-label-sm font-normal text-neutral-400">{post.nickname ?? '(탈퇴)'} · {new Date(post.created_at).toLocaleDateString('ko-KR')} · 댓글 {post.comment_count}</span>
        </span>
        <span className={`shrink-0 rounded-sm px-2 py-0.5 admin-label-sm ${post.status === 'hidden' ? 'bg-neutral-200 text-neutral-600' : 'bg-secondary-50 text-secondary-700'}`}>{post.status === 'hidden' ? '숨김' : '게시 중'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t border-neutral-100 pt-3">
          <p className="whitespace-pre-wrap admin-body-sm text-neutral-800">{post.body}</p>
          <HideControls targetType="post" targetId={post.id} status={post.status} onDone={onChanged} />
          <div className="space-y-2 border-t border-neutral-100 pt-3">
            <p className="admin-label-sm text-neutral-500">댓글</p>
            {comments === null ? <p className="admin-body-sm text-neutral-400">불러오는 중...</p> : comments.length === 0 ? <p className="admin-body-sm text-neutral-400">댓글이 없습니다.</p> : (
              comments.map((c) => (
                <div key={c.id} className={`rounded-input border p-3 ${c.parent_id ? 'ml-6' : ''} ${c.status === 'hidden' ? 'border-neutral-200 bg-neutral-50' : 'border-neutral-200'}`}>
                  <p className="admin-label-sm text-neutral-500">{c.nickname ?? '(탈퇴)'} · {new Date(c.created_at).toLocaleString('ko-KR')} {c.status === 'hidden' && '· 숨김'}</p>
                  <p className="mt-1 whitespace-pre-wrap admin-body-sm text-neutral-800">{c.body}</p>
                  <div className="mt-1">
                    <HideControls targetType="comment" targetId={c.id} status={c.status} onDone={async () => setComments((await listCommunityCommentsAction(post.id)).comments)} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </li>
  )
}

export function AdminCommunityBoard({ reports, posts }: { reports: AdminCommunityReport[]; posts: AdminCommunityPost[] }) {
  const [tab, setTab] = useState<'reports' | 'posts'>('reports')
  const [resolving, setResolving] = useState<string | null>(null)
  const refresh = () => window.location.reload()

  async function resolve(r: AdminCommunityReport) {
    setResolving(r.report_id)
    await resolveCommunityReportsAction(r.target_type, r.target_id)
    setResolving(null)
    refresh()
  }

  return (
    <div>
      <div className="flex gap-1 border-b border-neutral-200">
        {([['reports', `신고 (${reports.length})`], ['posts', '게시글']] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`border-b-2 px-4 py-2 admin-body-sm font-medium ${tab === key ? 'border-primary-600 text-primary-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'reports' ? (
        <ul className="mt-4 space-y-3">
          {reports.map((r) => (
            <li key={r.report_id} className="rounded-card border border-neutral-200 bg-neutral-0 p-4">
              <p className="admin-label-sm text-neutral-500">
                {r.target_type === 'post' ? '게시글' : '댓글'} · {r.target_nickname ?? '(탈퇴)'} · 신고 {r.report_count}건 · {REASON_LABELS[r.reason] ?? r.reason} · {new Date(r.reported_at).toLocaleString('ko-KR')}
              </p>
              <p className="mt-2 whitespace-pre-wrap admin-body-sm text-neutral-800">{r.target_excerpt ?? '(삭제된 대상)'}</p>
              {r.detail && <p className="mt-1 admin-label-sm text-neutral-500">신고 내용: {r.detail}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <HideControls targetType={r.target_type} targetId={r.target_id} status={r.target_status} onDone={refresh} />
                <button type="button" disabled={resolving === r.report_id} onClick={() => resolve(r)} className="admin-body-sm text-neutral-600 hover:underline">문제 없음(신고 종결)</button>
              </div>
            </li>
          ))}
          {reports.length === 0 && <p className="admin-body-sm text-neutral-400">처리할 신고가 없습니다.</p>}
        </ul>
      ) : (
        <ul className="mt-4 space-y-3">
          {posts.map((p) => (
            <PostRow key={p.id} post={p} onChanged={refresh} />
          ))}
          {posts.length === 0 && <p className="admin-body-sm text-neutral-400">게시글이 없습니다.</p>}
        </ul>
      )}
    </div>
  )
}
