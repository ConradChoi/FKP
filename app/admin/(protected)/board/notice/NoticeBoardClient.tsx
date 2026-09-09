'use client'

// Design Ref: notice-board.screen-spec.md §3.2 (target-audience filter) + §3.7 (N-R6 3-way
// exposure, this file owns exposure ①②; ArticleRow.tsx owns ③ the per-row icon) + ui-spec §3.2/
// §3.3. Client component because the audience filter is "client-side only, no server refetch"
// (screen-spec §3.2 — the whole notice board's row count is small enough that pagination itself
// is out of scope, §6.3 trigger).
import { useState } from 'react'
import { SegmentedControl } from '@/components/admin/SegmentedControl'
import { ArticleRow, type ArticleRecord, type ArticleLocaleConfig } from '../ArticleRow'
import { NewNoticeForm } from './NewNoticeForm'

const SEEPN_USER_NO_CONSUMER_SCREEN_WARNING =
  '이 대상은 아직 볼 수 있는 화면이 없습니다 — seepn.me 준비 중. 지금 게시해도 아무도 보지 못합니다.'

// notice-board-v1.0.prd.md §3.1/§7.2 (N-R12/G-2′) — partner is ko-only, seepn_user is ko/en/ja.
// Computed per-row below from each article's own targetAudience, not passed once for the whole
// list, because partner and seepn_user notices are interleaved in the same list (screen-spec
// §3.2 — "하나의 목록 안에 함께 나타나고").
const PARTNER_LOCALES: ArticleLocaleConfig[] = [{ key: 'ko', label: '한국어 (원본)', isSource: true }]
const SEEPN_USER_LOCALES: ArticleLocaleConfig[] = [
  { key: 'ko', label: '한국어 (원본)', isSource: true },
  { key: 'en', label: 'English', isSource: false },
  { key: 'ja', label: '日本語', isSource: false },
]

type AudienceFilter = 'all' | 'partner' | 'seepn_user'

export function NoticeBoardClient({ records, nextSortOrder }: { records: ArticleRecord[]; nextSortOrder: number }) {
  const [filter, setFilter] = useState<AudienceFilter>('all')
  const filtered = filter === 'all' ? records : records.filter((r) => r.targetAudience === filter)

  return (
    <div className="mt-6 space-y-4">
      <SegmentedControl<AudienceFilter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: '전체', activeClassName: 'bg-primary-600 text-neutral-0' },
          { value: 'partner', label: '파트너', activeClassName: 'bg-primary-600 text-neutral-0' },
          { value: 'seepn_user', label: 'SEEPN 사용자', activeClassName: 'bg-primary-600 text-neutral-0' },
        ]}
      />
      {/* screen-spec §3.7 노출 ② — filter-triggered banner, distinct from ArticleRow's always-on
          per-row ⚠ icon (③) which stays visible regardless of this filter. */}
      {filter === 'seepn_user' && (
        <div className="flex items-start gap-2 rounded-input border border-accent-200 bg-accent-100 px-4 py-3">
          <span className="text-accent-600" aria-hidden="true">
            ⚠
          </span>
          <p className="admin-body-sm text-accent-700">{SEEPN_USER_NO_CONSUMER_SCREEN_WARNING}</p>
        </div>
      )}

      <NewNoticeForm nextSortOrder={nextSortOrder} />

      <div className="space-y-3">
        {filtered.map((record) => (
          <ArticleRow
            key={record.contentItemId}
            article={record}
            contentType="notice"
            locales={record.targetAudience === 'seepn_user' ? SEEPN_USER_LOCALES : PARTNER_LOCALES}
          />
        ))}
      </div>
    </div>
  )
}
