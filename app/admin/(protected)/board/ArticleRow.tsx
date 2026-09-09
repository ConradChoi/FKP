'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateArticleItemAction,
  deleteContentItemAction,
  upsertArticleTranslationAction,
  aiFillArticleTranslationAction,
  type NoticeTargetAudience,
} from './actions'
import { computeTranslationBadge, computeSourceBadge, TONE_CLASS, type TranslationRow } from '@/lib/admin/translationStatus'
import { adminInputClass } from '@/components/admin/styles'
import { AiFillButton } from '@/components/admin/AiFillButton'
import {
  getAiFillDisabledReason,
  getAiFillConfirmMessage,
  getAiFillErrorMessage,
  AI_REVIEW_SAVE_CONFIRM_MESSAGE,
  AI_DRAFT_PUBLISH_GUARD_CAPTION,
  AI_DRAFT_PUBLISH_SAVE_REJECTED_MESSAGE,
  AI_FILL_STALE_SOURCE_CAPTION,
} from '@/lib/admin/aiFillClient'

// notice-board-v1.0.prd.md (v3.0 Final) §7.5 G-2 / screen-spec §2 — mirrors
// content_translation.locale's DB CHECK (en/ja/ko/zh). Kept local to this admin component
// (not imported from lib/content/getPublishedNotices.ts, which defines its own copy scoped to
// the partner-facing read path) so this purely-presentational union doesn't create a
// compile-time dependency from an admin component onto a public-read file.
export type ContentLocale = 'ko' | 'en' | 'ja' | 'zh'

export interface ArticleTranslationRow extends TranslationRow {
  title: string
  excerpt: string
  bodyMarkdown: string
}

export interface ArticleRecord {
  contentItemId: string
  slug: string
  sortOrder: number
  isActive: boolean
  translations: Record<string, ArticleTranslationRow | null>
  // notice-board-v1.0.prd.md §7.2 — null for case_study/faq (column is notice-only). 'partner' |
  // 'seepn_user' for every notice row (DB CHECK guarantees NOT NULL there).
  targetAudience: NoticeTargetAudience | null
}

export interface ArticleLocaleConfig {
  key: ContentLocale
  label: string
  isSource: boolean
}

// screen-spec §7.5 G-2′ — case_study's locale config, unchanged from the pre-generalization
// hardcoded `LOCALES` constant. Used as ArticleRow's default `locales` prop so
// app/admin/(protected)/board/example/page.tsx (case_study's only caller) doesn't need to change
// at all — the exact regression-avoidance the PRD/screen-spec call for (G-5, N-E5).
export const DEFAULT_ARTICLE_LOCALES: ArticleLocaleConfig[] = [
  { key: 'en', label: 'English (원본)', isSource: true },
  { key: 'ja', label: '日本語', isSource: false },
]

const STATUS_OPTIONS: { value: 'draft' | 'translated' | 'published'; label: string }[] = [
  { value: 'draft', label: '초안' },
  { value: 'translated', label: '작성완료' },
  { value: 'published', label: '게시됨' },
]

// screen-spec §3.5 대상 필드 매핑 (copy.md §4.1)
const FIELD_LABELS: Record<string, string> = { title: '제목이', excerpt: '요약이', bodyMarkdown: '본문이' }

// notice-board-v1.0.prd.md §9 NS-1 / screen-spec §3.9 — must stay bound to the body field
// wrapper (not to a future rich editor component) so it survives WS-3's editor swap unchanged
// (privacy review NB-B8).
const NS1_CAPTION =
  '공지 내용은 로그인 여부와 무관하게 인터넷에서 누구나 볼 수 있는 공개 데이터입니다. 특정 파트너의 상호명·담당자·연락처·심사 결과 등 개별 식별정보를 적지 마세요.'

// privacy review notice-board-privacy-review.md §1.2 NB-B7 — one-time confirm at the
// draft/translated -> published transition, separate from (and not a substitute for) the
// always-on NS-1 caption above.
const NOTICE_PUBLISH_CONFIRM_MESSAGE =
  '게시하면 이 공지의 제목·요약·본문은 로그인 없이 인터넷 누구나 조회할 수 있습니다. 특정 파트너의 상호·담당자·연락처·심사 결과나 개인정보가 담긴 내용이 들어있지 않은지 확인하셨습니까?'

const SEEPN_USER_NO_CONSUMER_SCREEN_WARNING =
  '이 대상은 아직 볼 수 있는 화면이 없습니다 — seepn.me 준비 중. 지금 게시해도 아무도 보지 못합니다.'

const TARGET_AUDIENCE_LABELS: Record<NoticeTargetAudience, string> = {
  partner: '파트너',
  seepn_user: 'SEEPN 사용자',
}

function Badge({ label, tone }: { label: string; tone: keyof typeof TONE_CLASS }) {
  return <span className={`rounded-full px-2 py-1 admin-label-sm ${TONE_CLASS[tone]}`}>{label}</span>
}

function ArticleTranslationEditor({
  contentItemId,
  locale,
  label,
  isSource,
  row,
  sourceUpdatedAt,
  sourceTitle,
  sourceExcerpt,
  sourceBodyMarkdown,
  showAiFill,
  isNotice,
}: {
  contentItemId: string
  locale: ContentLocale
  label: string
  isSource: boolean
  row: ArticleTranslationRow | null
  sourceUpdatedAt: string | null
  sourceTitle: string
  sourceExcerpt: string
  sourceBodyMarkdown: string
  // Gap G-2 (screen-spec §3.5) — case_study never renders the AI-fill button/tree at all (not
  // just disabled). notice-board-v1.0.prd.md §7.5 G-6 extends the same "never render" treatment
  // to notice (partner notices have no translation target at all; seepn_user AI-fill is a
  // deliberately out-of-scope follow-up, W-N6). Computed by the caller from `contentType` so
  // this editor doesn't need to know about content types itself.
  showAiFill: boolean
  // notice-board-v1.0.prd.md §9 NS-1 / privacy review NB-B7/NB-B8 — gates the always-on NS-1
  // caption below the body field and the one-time publish confirm. false for blog/case_study/faq.
  isNotice: boolean
}) {
  const router = useRouter()
  const [title, setTitle] = useState(row?.title ?? '')
  const [excerpt, setExcerpt] = useState(row?.excerpt ?? '')
  const [bodyMarkdown, setBodyMarkdown] = useState(row?.bodyMarkdown ?? '')
  const [status, setStatus] = useState<'draft' | 'translated' | 'published'>(
    (row?.status as 'draft' | 'translated' | 'published') ?? 'draft',
  )
  // privacy review NB-B7 — tracks the last value actually persisted, so the publish confirm only
  // fires on the draft/translated -> published transition, not on every subsequent save of an
  // already-published notice.
  const [lastSavedStatus, setLastSavedStatus] = useState<'draft' | 'translated' | 'published'>(
    (row?.status as 'draft' | 'translated' | 'published') ?? 'draft',
  )
  // Gap G-3 / §6.4 — local state so the AI-fill response can update this already-mounted card
  // directly, instead of relying on router.refresh().
  const [translationSource, setTranslationSource] = useState<'human' | 'ai' | 'ai_reviewed'>(
    row?.translation_source ?? 'human',
  )
  const [hasTranslation, setHasTranslation] = useState(row !== null)
  const [sourceSyncedAt, setSourceSyncedAt] = useState<string | null>(row?.source_synced_at ?? null)
  const [saving, setSaving] = useState(false)
  const [aiFilling, setAiFilling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const localRow: TranslationRow | null = hasTranslation
    ? { status, source_synced_at: sourceSyncedAt, updated_at: row?.updated_at ?? sourceUpdatedAt ?? '', translation_source: translationSource }
    : null
  const badge = computeTranslationBadge({ isSource, row: localRow, sourceUpdatedAt })
  const sourceBadge = computeSourceBadge(localRow)

  async function save() {
    if (translationSource === 'ai' && !window.confirm(AI_REVIEW_SAVE_CONFIRM_MESSAGE)) return
    if (isNotice && status === 'published' && lastSavedStatus !== 'published') {
      if (!window.confirm(NOTICE_PUBLISH_CONFIRM_MESSAGE)) return
    }

    setSaving(true)
    setError(null)
    const result = await upsertArticleTranslationAction({ contentItemId, locale, title, excerpt, bodyMarkdown, status })
    setSaving(false)
    if (!result.success) {
      setError(translationSource === 'ai' && status === 'published' ? AI_DRAFT_PUBLISH_SAVE_REJECTED_MESSAGE : '저장 실패')
      return
    }
    if (translationSource === 'ai') setTranslationSource('ai_reviewed')
    setHasTranslation(true)
    setSourceSyncedAt(sourceUpdatedAt)
    setLastSavedStatus(status)
    router.refresh()
  }

  async function aiFill() {
    const confirmMessage = getAiFillConfirmMessage({ hasTranslation, status, translationSource, localeLabel: label })
    if (confirmMessage !== null && !window.confirm(confirmMessage)) return

    setAiFilling(true)
    setError(null)
    const result = await aiFillArticleTranslationAction({ contentItemId, targetLocale: locale })
    setAiFilling(false)
    if (!result.success) {
      setError(getAiFillErrorMessage(result, FIELD_LABELS))
      return
    }
    setTitle(result.body.title)
    setExcerpt(result.body.excerpt)
    setBodyMarkdown(result.body.bodyMarkdown)
    setStatus(result.status)
    setTranslationSource(result.translationSource)
    setHasTranslation(true)
    setSourceSyncedAt(sourceUpdatedAt)
    router.refresh()
  }

  const aiFillDisabledReason = getAiFillDisabledReason([
    { label: '제목이', value: sourceTitle },
    { label: '요약이', value: sourceExcerpt },
    { label: '본문이', value: sourceBodyMarkdown },
  ])

  return (
    <div className="rounded-card border border-neutral-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="admin-body-sm font-medium text-neutral-900">{label}</p>
        <div className="flex flex-wrap items-center gap-2">
          {!isSource && showAiFill && (
            <AiFillButton loading={aiFilling} disabledReason={aiFillDisabledReason} disabled={saving} onClick={aiFill} />
          )}
          <Badge label={badge.label} tone={badge.tone} />
          {sourceBadge && <Badge label={sourceBadge.label} tone={sourceBadge.tone} />}
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <input
          className={adminInputClass}
          placeholder="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={aiFilling}
        />
        <textarea
          className={`${adminInputClass} min-h-[56px]`}
          placeholder="요약 (150자 내외 권장)"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          disabled={aiFilling}
        />
        {/* notice-board-privacy-review.md §1.3 NB-B8 — NS-1 caption is bound to this body-field
            wrapper, not to a rich-editor component, so it keeps rendering unchanged once WS-3
            replaces the textarea below with a real editor. */}
        <div>
          <textarea
            className={`${adminInputClass} min-h-[200px] w-full font-mono admin-body-sm`}
            placeholder="본문 (마크다운: #/## 제목, **굵게**, - 목록, 1. 번호목록, |표|, [링크](url))"
            value={bodyMarkdown}
            onChange={(e) => setBodyMarkdown(e.target.value)}
            disabled={aiFilling}
          />
          {isNotice && <p className="mt-1 admin-label-sm text-accent-700">⚠ {NS1_CAPTION}</p>}
        </div>
        <select
          className={adminInputClass}
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          disabled={aiFilling}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              disabled={opt.value === 'published' && translationSource === 'ai'}
              title={opt.value === 'published' && translationSource === 'ai' ? AI_DRAFT_PUBLISH_GUARD_CAPTION : undefined}
            >
              {opt.label}
            </option>
          ))}
        </select>
        {translationSource === 'ai' && <p className="admin-label-sm text-neutral-500">{AI_DRAFT_PUBLISH_GUARD_CAPTION}</p>}
      </div>
      {error && <p className={`mt-2 admin-label-sm text-error`}>{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={saving || aiFilling || !title}
        className="mt-3 rounded-input bg-primary-600 px-4 py-2 admin-label-sm text-neutral-0 hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
      >
        저장
      </button>
      {!isSource && showAiFill && <p className="mt-2 admin-label-sm text-neutral-400">{AI_FILL_STALE_SOURCE_CAPTION}</p>}
    </div>
  )
}

export function ArticleRow({
  article,
  urlSegment,
  contentType,
  locales = DEFAULT_ARTICLE_LOCALES,
}: {
  article: ArticleRecord
  // Optional — case_study passes its public URL segment (used for the `/{urlSegment}/{slug}`
  // label below); notice has no public FKP route at all (D-N0-1) so it's omitted and the label
  // falls back to the raw content_key (screen-spec §3.4 — showing a fake `/notice/{slug}` URL
  // would mislead an admin into thinking a public page exists).
  urlSegment?: string
  // Gap G-2 (screen-spec §3.5) — neither blog/page.tsx nor example/page.tsx used to pass this;
  // both callers now pass a literal 'case_study' | 'notice' since each page only ever renders one
  // content type. Server-side defense (aiFillArticleTranslationAction re-checking
  // content_item.content_type) stays the real boundary regardless of this prop.
  contentType: 'case_study' | 'notice'
  // screen-spec §7.5 G-2′ — caller-supplied locale columns, replacing the old hardcoded `LOCALES`
  // constant. Defaults to case_study's original en/ja config so example/page.tsx (case_study's
  // only caller) doesn't have to change at all. Notice callers compute this per-row from
  // `article.targetAudience` (partner -> ko only, seepn_user -> ko/en/ja, PRD N-R12/G-2′).
  locales?: ArticleLocaleConfig[]
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [sortOrder, setSortOrder] = useState(article.sortOrder)
  const [isActive, setIsActive] = useState(article.isActive)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isNotice = contentType === 'notice'
  const sourceLocale = locales.find((l) => l.isSource)?.key ?? locales[0]?.key ?? 'en'
  const dirty = sortOrder !== article.sortOrder || isActive !== article.isActive
  const sourceUpdatedAt = article.translations[sourceLocale]?.updated_at ?? null
  const sourceTitle = article.translations[sourceLocale]?.title ?? ''
  const sourceExcerpt = article.translations[sourceLocale]?.excerpt ?? ''
  const sourceBodyMarkdown = article.translations[sourceLocale]?.bodyMarkdown ?? ''
  // notice-board-v1.0.prd.md §7.5 G-6 — the AI-fill button must never render for notice,
  // regardless of target_audience (partner has no translation target at all; seepn_user AI-fill
  // is deliberately out of scope, W-N6). The server action (aiFillArticleTranslationAction)
  // rejects both content_type==='case_study' and ==='notice' independently — this is UI-only.
  const showAiFill = contentType !== 'case_study' && contentType !== 'notice'

  // D-N3 (PRD §3.4) / screen-spec §3.5 — locked once any non-ko translation row exists. Always
  // false for case_study (irrelevant there; contentType !== 'notice' short-circuits it).
  const locked = isNotice && Object.entries(article.translations).some(([loc, row]) => loc !== 'ko' && row !== null)
  const [audienceValue, setAudienceValue] = useState<NoticeTargetAudience | null>(article.targetAudience)
  const [audienceSaving, setAudienceSaving] = useState(false)
  const [audienceError, setAudienceError] = useState<string | null>(null)

  const gridColsClass =
    locales.length === 1 ? 'grid-cols-1' : locales.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'sm:grid-cols-2'

  async function saveSummary() {
    setSaving(true)
    setError(null)
    const result = await updateArticleItemAction({ contentItemId: article.contentItemId, sortOrder, isActive })
    setSaving(false)
    if (!result.success) {
      setError('저장 실패')
      return
    }
    router.refresh()
  }

  // screen-spec §3.5 — confirm-then-write, using the article's last-committed sortOrder/isActive
  // (not whatever is currently typed into the still-unsaved sortOrder/active fields above) so
  // this standalone audience change never silently piggybacks an unrelated pending edit.
  async function changeTargetAudience(next: NoticeTargetAudience) {
    const wideningLocales = article.targetAudience === 'partner' && next === 'seepn_user'
    const message = wideningLocales
      ? '대상을 바꾸면 로케일 구성이 바뀝니다. 번역 입력 화면이 추가로 나타납니다. 계속할까요?'
      : '대상을 바꾸면 로케일 구성이 바뀝니다. 계속할까요?'
    if (!window.confirm(message)) return

    setAudienceSaving(true)
    setAudienceError(null)
    const result = await updateArticleItemAction({
      contentItemId: article.contentItemId,
      sortOrder: article.sortOrder,
      isActive: article.isActive,
      targetAudience: next,
    })
    setAudienceSaving(false)
    if (!result.success) {
      setAudienceError(
        result.errorCode === 'TARGET_AUDIENCE_LOCKED'
          ? '번역이 입력된 뒤에는 대상을 변경할 수 없습니다. 삭제 후 새로 작성하세요.'
          : '대상 변경 실패',
      )
      return
    }
    setAudienceValue(next)
    router.refresh()
  }

  async function remove() {
    if (
      !window.confirm(
        '삭제하면 모든 언어 번역이 함께 삭제되고 되돌릴 수 없습니다. 외부 링크/검색엔진 색인이 끊기지 않도록 삭제 대신 비활성화를 사용하는 것을 권장합니다. 그래도 삭제할까요?',
      )
    )
      return
    const result = await deleteContentItemAction(article.contentItemId)
    if (!result.success) {
      window.alert('삭제 실패')
      return
    }
    router.refresh()
  }

  // screen-spec §3.4 — notice has no public FKP route (D-N0-1), so it shows the raw content_key
  // (`notice.{slug}`) instead of a fake `/{urlSegment}/{slug}` public-URL-looking label.
  const rowLabel = isNotice ? `notice.${article.slug}` : `/${urlSegment}/${article.slug}`

  return (
    <div className="rounded-card border border-neutral-200 bg-neutral-0">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="admin-body-sm text-primary-600 hover:underline">
          {expanded ? '접기' : '편집'}
        </button>
        <span className="font-mono admin-label-sm text-neutral-500">{rowLabel}</span>
        {isNotice && (
          <div className="flex items-center gap-1">
            {locked ? (
              <span
                className="rounded-full bg-neutral-100 px-2 py-1 admin-label-sm text-neutral-500"
                title="번역이 입력된 뒤에는 대상을 변경할 수 없습니다. 대상을 바꾸려면 삭제 후 새로 작성하세요."
              >
                🔒 {TARGET_AUDIENCE_LABELS[audienceValue ?? 'partner']}
              </span>
            ) : (
              <select
                className={`${adminInputClass} py-1`}
                value={audienceValue ?? ''}
                disabled={audienceSaving}
                onChange={(e) => changeTargetAudience(e.target.value as NoticeTargetAudience)}
              >
                <option value="partner">파트너용(ko 단일)</option>
                <option value="seepn_user">SEEPN 사용자용(ko/en/ja)</option>
              </select>
            )}
            {audienceValue === 'seepn_user' && (
              <span
                className="cursor-help text-accent-600"
                title={SEEPN_USER_NO_CONSUMER_SCREEN_WARNING}
                aria-label="소비 화면 없음 경고"
              >
                ⚠
              </span>
            )}
          </div>
        )}
        <input
          type="number"
          className={`${adminInputClass} w-16 py-1 text-center`}
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
        />
        <label className="flex items-center gap-1 admin-body-sm text-neutral-600">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          활성
        </label>
        <div className="flex gap-2">
          {locales.map(({ key, isSource }) => {
            const badge = computeTranslationBadge({ isSource, row: article.translations[key] ?? null, sourceUpdatedAt })
            return <Badge key={key} label={`${key.toUpperCase()} ${badge.label}`} tone={badge.tone} />
          })}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {dirty && (
            <button type="button" onClick={saveSummary} disabled={saving} className="admin-body-sm text-primary-600 hover:underline">
              저장
            </button>
          )}
          <button type="button" onClick={remove} className="admin-body-sm text-error hover:underline">
            삭제
          </button>
        </div>
      </div>
      {audienceError && <p className="px-4 pb-2 admin-label-sm text-error">{audienceError}</p>}
      {error && <p className={`px-4 pb-2 admin-label-sm text-error`}>{error}</p>}
      {expanded && (
        <div className={`grid gap-3 border-t border-neutral-100 p-4 ${gridColsClass}`}>
          {locales.map(({ key, label, isSource }) => (
            <ArticleTranslationEditor
              key={key}
              contentItemId={article.contentItemId}
              locale={key}
              label={label}
              isSource={isSource}
              row={article.translations[key] ?? null}
              sourceUpdatedAt={sourceUpdatedAt}
              sourceTitle={sourceTitle}
              sourceExcerpt={sourceExcerpt}
              sourceBodyMarkdown={sourceBodyMarkdown}
              showAiFill={showAiFill}
              isNotice={isNotice}
            />
          ))}
        </div>
      )}
    </div>
  )
}
