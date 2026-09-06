'use client'

// Design Ref: human-matching.screen-spec.md §6.2 / ui-spec §4 — (b) 담은 후보 목록.
// Judge editor is a table sub-row accordion (colSpan), not a per-cell expansion — ui-spec
// §4.3 explains why (8-chip tag list + 500-char textarea would blow out row height and
// leave huge gaps in sibling cells if crammed into one w-auto column).
import { Fragment, useMemo, useState } from 'react'
import { Avatar } from '@/components/admin/Avatar'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { SegmentedControl } from '@/components/admin/SegmentedControl'
import { adminInputClass, adminButtonPrimaryClass, adminButtonSecondaryClass } from '@/components/admin/styles'
import { VERIFICATION_STATE_LABELS, VERIFICATION_STATE_TONE } from '@/lib/admin/partnerLabels'
import { JUDGE_STATUS_LABELS, JUDGE_STATUS_VALUES, TAGS_BY_JUDGE_STATUS, type JudgeStatus } from '@/lib/admin/matchTags'
import { revealPartnerContactAction } from '@/app/admin/(protected)/partners/[id]/actions'
import type { MatchRow } from './types'
import { judgeMatchAction, removeCandidateAction } from './actions'

const MEMO_MAX_LENGTH = 500

export function CandidateListTable({
  requirementId,
  matches,
  adminNameById,
  canReadPartners,
  canAccessPii,
  canUpdate,
  onChanged,
}: {
  requirementId: string
  matches: MatchRow[]
  adminNameById: Map<string, string>
  canReadPartners: boolean
  canAccessPii: boolean
  canUpdate: boolean
  onChanged: () => void
}) {
  const [sortMode, setSortMode] = useState<'recent' | 'shortlisted-first'>('recent')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null)
  const [pendingSavingId, setPendingSavingId] = useState<string | null>(null)

  const sorted = useMemo(() => {
    const list = [...matches]
    if (sortMode === 'shortlisted-first') {
      const rank: Record<JudgeStatus, number> = { shortlisted: 0, pending: 1, excluded: 2 }
      list.sort((a, b) => rank[a.judge_status] - rank[b.judge_status] || (a.added_at < b.added_at ? 1 : -1))
    } else {
      list.sort((a, b) => (a.added_at < b.added_at ? 1 : -1))
    }
    return list
  }, [matches, sortMode])

  async function handleRemove(matchId: string) {
    setRemovingId(matchId)
    const result = await removeCandidateAction(requirementId, matchId)
    setRemovingId(null)
    setRemoveConfirmId(null)
    if (result.success) onChanged()
  }

  // "보류(pending)"로 바꾸는 것은 태그/메모가 필요 없으므로(match_judge RPC — screen-spec
  // §6.2/§8.2) 세그먼트 버튼에서 바로 저장한다. 추천/제외는 태그+메모가 함께 필수라서
  // 아코디언을 펼치기만 하고, 실제 저장은 JudgeEditor의 [저장] 버튼에서만 일어난다
  // (screen-spec §9 엣지케이스7: 낙관적 UI 업데이트 없음).
  async function handleSegmentChange(matchId: string, next: JudgeStatus) {
    if (next === 'pending') {
      setPendingSavingId(matchId)
      const result = await judgeMatchAction(requirementId, matchId, 'pending', [], null)
      setPendingSavingId(null)
      if (result.success) onChanged()
      return
    }
    setExpandedId(matchId)
  }

  if (matches.length === 0) {
    return (
      <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
        <h2 className="admin-heading-3 text-neutral-900">담은 후보 목록</h2>
        <p className="mt-2 admin-body-sm text-neutral-400">아직 담은 후보가 없습니다. 위 검색 패널에서 후보를 담아보세요.</p>
      </section>
    )
  }

  return (
    <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
      <div className="flex items-center justify-between">
        <h2 className="admin-heading-3 text-neutral-900">담은 후보 목록</h2>
        <div className="flex items-center gap-3 admin-body-sm">
          <button type="button" onClick={() => setSortMode('recent')} className={sortMode === 'recent' ? 'font-medium text-primary-600' : 'text-neutral-500 hover:underline'}>
            등록순
          </button>
          <button
            type="button"
            onClick={() => setSortMode('shortlisted-first')}
            className={sortMode === 'shortlisted-first' ? 'font-medium text-primary-600' : 'text-neutral-500 hover:underline'}
          >
            추천 먼저
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-64" />
            <col className="w-28" />
            <col className="w-52" />
            <col />
            <col className="w-64" />
            <col className="w-24" />
          </colgroup>
          <thead>
            <tr className="border-b border-neutral-200 text-left">
              <th className="whitespace-nowrap px-4 py-2 admin-body-sm font-medium text-neutral-500">회사명</th>
              <th className="whitespace-nowrap px-4 py-2 admin-body-sm font-medium text-neutral-500">검증상태</th>
              <th className="whitespace-nowrap px-4 py-2 admin-body-sm font-medium text-neutral-500">판정</th>
              <th className="whitespace-nowrap px-4 py-2 admin-body-sm font-medium text-neutral-500">태그/메모</th>
              <th className="whitespace-nowrap px-4 py-2 admin-body-sm font-medium text-neutral-500">연락처</th>
              <th className="whitespace-nowrap px-4 py-2 admin-body-sm font-medium text-neutral-500">관리</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => {
              const partner = m.partner
              const isPreVerified = partner ? ['draft', 'submitted', 'under_review'].includes(partner.verification_state) : false
              const isExpanded = expandedId === m.id
              const tagSummary = m.judge_status === 'shortlisted' ? m.selection_tags : m.judge_status === 'excluded' ? m.exclusion_tags : []

              return (
                <Fragment key={m.id}>
                  <tr className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="px-4 py-3 admin-body" title={`담은 사람: ${adminNameById.get(m.added_by_admin_id) ?? '(알수없음)'} · ${new Date(m.added_at).toLocaleString('ko-KR')}`}>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={partner?.company_name_ko || '(파트너)'} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-neutral-900">
                            {canReadPartners ? partner?.company_name_ko || '(회사명 미입력)' : '(조회 권한 없음)'}
                            {isPreVerified && (
                              <span className="ml-1 text-accent-600" title="검증 전 파트너">
                                ⚠
                              </span>
                            )}
                          </span>
                          <span className="block truncate admin-body-sm text-neutral-400">{partner?.company_name_en ?? ''}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {partner ? (
                        <StatusBadge tone={VERIFICATION_STATE_TONE[partner.verification_state]} label={VERIFICATION_STATE_LABELS[partner.verification_state]} />
                      ) : (
                        <span className="admin-body-sm text-neutral-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <SegmentedControl
                        value={m.judge_status}
                        disabled={!canUpdate || pendingSavingId === m.id}
                        onChange={(next) => handleSegmentChange(m.id, next)}
                        options={JUDGE_STATUS_VALUES.map((s) => ({
                          value: s,
                          label: JUDGE_STATUS_LABELS[s],
                          activeClassName:
                            s === 'shortlisted' ? 'bg-success-100 text-success font-medium' : s === 'excluded' ? 'bg-error-100 text-error font-medium' : 'bg-neutral-100 text-neutral-700',
                        }))}
                      />
                    </td>
                    <td className="px-4 py-3 admin-body-sm text-neutral-600">
                      {tagSummary.length === 0 ? (
                        <span className="text-neutral-400">-</span>
                      ) : (
                        <span>
                          {tagSummary.slice(0, 2).join(', ')}
                          {tagSummary.length > 2 && ` +${tagSummary.length - 2}`}
                        </span>
                      )}
                      <button type="button" onClick={() => setExpandedId(isExpanded ? null : m.id)} className="ml-2 text-primary-600 hover:underline" aria-label="태그/메모 편집">
                        ✎
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {canReadPartners && partner ? (
                        <PartnerContactCell
                          partnerId={partner.id}
                          maskedName={partner.contact_name_masked}
                          maskedEmail={partner.contact_email_masked}
                          canAccessPii={canAccessPii}
                        />
                      ) : (
                        <span className="admin-body-sm text-neutral-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canUpdate &&
                        (removeConfirmId === m.id ? (
                          <span className="admin-body-sm">
                            <button type="button" disabled={removingId === m.id} onClick={() => handleRemove(m.id)} className="text-error hover:underline">
                              확인
                            </button>{' '}
                            <button type="button" onClick={() => setRemoveConfirmId(null)} className="text-neutral-500 hover:underline">
                              취소
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => (m.is_confirmed_top3 ? setRemoveConfirmId(m.id) : handleRemove(m.id))}
                            className="admin-body-sm text-error hover:underline"
                          >
                            제거
                          </button>
                        ))}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-neutral-50">
                      <td colSpan={6} className="px-4 py-4">
                        <JudgeEditor
                          requirementId={requirementId}
                          match={m}
                          canUpdate={canUpdate}
                          onSaved={() => {
                            setExpandedId(null)
                            onChanged()
                          }}
                          onCancel={() => setExpandedId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function PartnerContactCell({
  partnerId,
  maskedName,
  maskedEmail,
  canAccessPii,
}: {
  partnerId: string
  maskedName: string | null
  maskedEmail: string | null
  canAccessPii: boolean
}) {
  const [revealed, setRevealed] = useState<{ contact_name: string; contact_email: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReveal() {
    setLoading(true)
    setError(null)
    const result = await revealPartnerContactAction(partnerId)
    setLoading(false)
    if (!result.success || !result.data) {
      setError('열람 권한이 없거나 실패했습니다.')
      return
    }
    setRevealed({ contact_name: result.data.contact_name, contact_email: result.data.contact_email })
  }

  if (revealed) {
    return (
      <span className="admin-body-sm text-neutral-700">
        {revealed.contact_name} · {revealed.contact_email}
      </span>
    )
  }

  // privacy review §4.3 DoD — canAccessPii=false인 세션은 RevealContact.tsx(개요 탭)와
  // 동일하게 버튼 자체를 없애고 고정 안내 문구로 대체한다(서버 4중 검사가 최종 방어선이긴
  //하나, "버튼은 보이는데 눌러도 조용히 실패"는 그 자체로 DoD 위반 — qa-reviewer 2026-09-06).
  if (!canAccessPii) {
    return (
      <span className="admin-body-sm text-neutral-500">
        {maskedName ?? '(미입력)'} {maskedEmail ?? ''} (viewer 역할은 원문 열람 불가)
      </span>
    )
  }

  return (
    <span className="flex flex-wrap items-center gap-1 admin-body-sm text-neutral-500">
      {maskedName ?? '(미입력)'} {maskedEmail ?? ''}
      <button type="button" onClick={handleReveal} disabled={loading} className="text-primary-600 hover:underline">
        {loading ? '확인 중...' : '원문 보기'}
      </button>
      {error && <span className="admin-label-sm text-error">{error}</span>}
    </span>
  )
}

function JudgeEditor({
  requirementId,
  match,
  canUpdate,
  onSaved,
  onCancel,
}: {
  requirementId: string
  match: MatchRow
  canUpdate: boolean
  onSaved: () => void
  onCancel: () => void
}) {
  const [judgeStatus, setJudgeStatus] = useState<JudgeStatus>(match.judge_status === 'pending' ? 'shortlisted' : match.judge_status)
  const [tags, setTags] = useState<string[]>(match.judge_status === 'shortlisted' ? match.selection_tags : match.judge_status === 'excluded' ? match.exclusion_tags : [])
  const [memo, setMemo] = useState(match.judge_status === 'shortlisted' ? match.selection_memo ?? '' : match.judge_status === 'excluded' ? match.exclusion_memo ?? '' : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = true // any open edit is "unsaved" until explicitly saved (ui-spec §4.3)
  const tagList = TAGS_BY_JUDGE_STATUS[judgeStatus === 'excluded' ? 'excluded' : 'shortlisted']
  const borderClass = judgeStatus === 'excluded' ? 'border-l-4 border-l-error' : 'border-l-4 border-l-success'

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  function switchStatus(next: JudgeStatus) {
    setJudgeStatus(next)
    setTags([])
    setMemo('')
  }

  const canSave = tags.length > 0 && memo.trim().length > 0 && memo.length <= MEMO_MAX_LENGTH

  async function handleSave() {
    setSaving(true)
    setError(null)
    const result = await judgeMatchAction(requirementId, match.id, judgeStatus, tags, memo)
    setSaving(false)
    if (!result.success) {
      setError('저장에 실패했습니다. 다시 시도해주세요.')
      return
    }
    onSaved()
  }

  async function handlePending() {
    setSaving(true)
    setError(null)
    const result = await judgeMatchAction(requirementId, match.id, 'pending', [], null)
    setSaving(false)
    if (!result.success) {
      setError('저장에 실패했습니다. 다시 시도해주세요.')
      return
    }
    onSaved()
  }

  return (
    <div className={`pl-3 ${borderClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => switchStatus('shortlisted')}
            className={`admin-body-sm ${judgeStatus === 'shortlisted' ? 'font-medium text-success' : 'text-neutral-500 hover:underline'}`}
          >
            추천으로 판정
          </button>
          <span className="text-neutral-300">|</span>
          <button
            type="button"
            onClick={() => switchStatus('excluded')}
            className={`admin-body-sm ${judgeStatus === 'excluded' ? 'font-medium text-error' : 'text-neutral-500 hover:underline'}`}
          >
            제외로 판정
          </button>
          <span className="text-neutral-300">|</span>
          <button type="button" onClick={handlePending} disabled={saving} className="admin-body-sm text-neutral-500 hover:underline">
            보류로 되돌리기
          </button>
        </div>
        {dirty && <span className="rounded-sm bg-accent-100 px-2 py-0.5 admin-label-sm text-accent-700">미저장</span>}
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        {tagList.map((tag) => (
          <label key={tag} className="flex items-center gap-1.5 admin-body-sm text-neutral-700">
            <input type="checkbox" checked={tags.includes(tag)} onChange={() => toggleTag(tag)} />
            {tag}
          </label>
        ))}
      </div>

      <div className="mt-3">
        <textarea
          className={`${adminInputClass} w-full`}
          rows={3}
          maxLength={MEMO_MAX_LENGTH}
          placeholder="판정 사유 메모 (필수)"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
        <div className="mt-1 text-right admin-label-sm text-neutral-400">
          {memo.length}/{MEMO_MAX_LENGTH}
        </div>
      </div>

      {!canSave && (memo.length > 0 || tags.length > 0) && <p className="admin-body-sm text-error">태그를 최소 1개 선택하고 메모를 입력하세요.</p>}
      {error && <p className="admin-body-sm text-error">{error}</p>}

      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={adminButtonSecondaryClass}>
          취소
        </button>
        <button type="button" onClick={handleSave} disabled={!canUpdate || !canSave || saving} className={adminButtonPrimaryClass}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}
