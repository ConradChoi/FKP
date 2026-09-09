'use client'

// Design Ref: docs/02-design/features/notice-board.ui-spec.md §1~2 (에디터 툴바/이미지 업로드 UI) +
// notice-board-v1.0.prd.md N-R13~N-R16/C-2/C-3 + docs/03-security/notice-board-privacy-review.md
// §1.4 (NS-5 copy) — the WS-3 rich(-ish) body editor for the notice board only.
//
// Implementation choice: plain <textarea> + toolbar buttons that insert markdown syntax, NOT a
// contentEditable WYSIWYG surface. ui-spec §0.3/§1.3 specifies a single contentEditable area that
// renders formatting live. The task brief for this round explicitly relaxes that: "정교한
// WYSIWYG까지는 필요 없다 — textarea + 툴바 버튼 방식이면 목표를 충분히 달성한다." Reasons this is the
// right trade-off here, not just the easy one:
//   1. C-2 (PM, notice-board-v1.0.prd.md §6.4) locks the storage format to markdown specifically
//      because the current renderer's inability to parse arbitrary HTML is today's XSS defense
//      line. A contentEditable surface that round-trips through HTML (even transiently, e.g. via
//      execCommand or a rich-text lib's internal model) reintroduces exactly the sanitizer/XSS
//      surface C-2 says NS-4 would require a security review to open — for a feature this PRD
//      explicitly scoped OUT (§9, "NS-4 조건 미충족").
//   2. A hand-rolled contentEditable model that emits our exact 5-construct markdown subset
//      (heading/bold/list/link/image) without drifting from lib/content/renderMarkdown.tsx's
//      supported grammar is a materially larger, bug-prone surface than toolbar buttons that
//      splice literal `**`/`- `/`[]()`Ⓜ`![]()` into a textarea's value — and a textarea can never
//      "silently drop" syntax it doesn't understand (N-R15/§1.4 requirement), because it never
//      interprets the text as anything but a string.
//   3. N-R15/C-2 both require existing case_study/FAQ markdown (including the `|table|` syntax
//      this editor has no button for) to open and save unchanged — trivially guaranteed by a
//      textarea (it never parses the value at all), whereas a WYSIWYG surface would need an
//      explicit "leave what I don't understand alone" fallback path for every unsupported
//      construct.
// See the parent task brief / PM review thread for the explicit sign-off on this trade-off.
import { useMemo, useRef, useState } from 'react'
import { uploadNoticeImageAction, deleteNoticeImageAction } from '@/app/admin/(protected)/board/actions'
import { adminEditorToolbarButtonClass } from './styles'

// notice-board-privacy-review.md §1.4 — ui-spec §2.2's NS-5 copy plus the one added sentence the
// privacy review requested ("본문에서 지워도 업로드된 파일 자체는 남습니다") so operators don't
// reasonably-but-wrongly assume deleting the markdown text also deletes the uploaded file.
const NS5_CAPTION =
  '업로드한 이미지는 로그인 없이 인터넷 누구나 볼 수 있습니다. 사업자등록증, 개인 연락처 등 개인정보가 담긴 이미지를 올리지 마세요. 본문에서 지워도 업로드된 파일 자체는 남습니다.'

// Actual backend support (app/admin/(protected)/board/actions.ts's detectImageMimeType /
// lib/forms/fileSignature.ts) is jpeg/png ONLY — webp is intentionally not detected server-side
// despite ui-spec §2.1's `accept="image/jpeg,image/png,image/webp"` and §2.3④'s "jpg/png/webp만
// 가능" copy. The backend is the source of truth here (already deployed, out of scope to change),
// so this component's `accept` attribute and error copy say jpg/png only — matching what the
// server will actually accept, not what the (slightly stale) UI spec assumed. Flagged in the
// handoff summary for qa-reviewer/ui-ux-designer awareness.
const IMAGE_ACCEPT = 'image/jpeg,image/png'
const CLIENT_MAX_IMAGE_BYTES = 2 * 1024 * 1024 // soft pre-check only; actions.ts enforces this for real

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; fileName: string }
  | { status: 'error'; kind: 'size' | 'format' | 'other'; message: string; file: File }

// Matches `![alt](https://.../storage/v1/object/public/content-image/{path})` — the exact shape
// uploadNoticeImageAction's getPublicUrl() produces (see that function + isSafeImageUrl in
// lib/content/renderMarkdown.tsx, which this regex deliberately mirrors the intent of). Used only
// to let the editor list/delete images already embedded in the body — it does not gate what can
// be *rendered* (renderMarkdown.tsx already owns that).
const NOTICE_IMAGE_MARKDOWN_RE =
  /!\[[^\]]*\]\((https:\/\/[^)\s]+\/storage\/v1\/object\/public\/content-image\/([^)\s]+))\)/g

interface EmbeddedImage {
  fullMatch: string
  url: string
  path: string
}

function findEmbeddedImages(markdown: string): EmbeddedImage[] {
  const matches: EmbeddedImage[] = []
  const seen = new Set<string>()
  for (const m of markdown.matchAll(NOTICE_IMAGE_MARKDOWN_RE)) {
    const [fullMatch, url, path] = m
    if (seen.has(fullMatch)) continue
    seen.add(fullMatch)
    matches.push({ fullMatch, url, path })
  }
  return matches
}

function getLineBounds(value: string, from: number, to: number): { lineStart: number; lineEnd: number } {
  const lineStart = value.lastIndexOf('\n', Math.max(from - 1, 0)) + 1
  const nextBreak = value.indexOf('\n', Math.max(to - 1, 0))
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  return { lineStart, lineEnd }
}

export interface NoticeBodyEditorProps {
  value: string
  onChange: (next: string) => void
  // null while the notice hasn't been created yet (NewNoticeForm) — image insertion requires an
  // existing content_item id (uploadNoticeImageAction's REQUIRED contentItemId param, see that
  // function's header comment in actions.ts). ArticleRow's edit card always has one.
  contentItemId: string | null
  disabled?: boolean
  id?: string
  placeholder?: string
  // qa-reviewer (round 2, 주요) — deleteNoticeImageAction deletes the Storage object immediately,
  // independently of whether the admin ever presses 저장. For an already-published notice, that
  // means the live public page starts rendering a broken <img> the instant "삭제" is confirmed,
  // regardless of what happens to the unsaved body text afterward — a materially different risk
  // than for a draft (nothing public references the image yet). Callers pass true only when
  // isNotice && status === 'published' (see ArticleRow.tsx); NewNoticeForm's brand-new notice is
  // always draft, so it never needs to pass this.
  isPublished?: boolean
}

export function NoticeBodyEditor({
  value,
  onChange,
  contentItemId,
  disabled = false,
  id,
  placeholder = '본문을 입력하세요',
  isPublished = false,
}: NoticeBodyEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' })
  const [imageActionError, setImageActionError] = useState<string | null>(null)
  // qa-reviewer (round 2, 사소) — Set instead of a single string so deleting image A doesn't
  // re-enable/mislabel image B's button while A's delete is still in flight (was a single
  // `deletingPath: string | null`, which could only ever track one in-progress delete at a time).
  const [deletingPaths, setDeletingPaths] = useState<Set<string>>(new Set())

  const embeddedImages = useMemo(() => findEmbeddedImages(value), [value])

  // Re-focuses the textarea and restores a caret/selection position after a programmatic edit.
  // Needed because `value` is controlled from the parent — setSelectionRange has to run after the
  // DOM has actually re-rendered with the new value, which a plain synchronous call right after
  // onChange() cannot guarantee. A macrotask (setTimeout 0) reliably runs after React's commit.
  function restoreSelection(start: number, end: number) {
    window.setTimeout(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(start, end)
    }, 0)
  }

  function getSelection(): { start: number; end: number } {
    const el = textareaRef.current
    if (!el) return { start: value.length, end: value.length }
    return { start: el.selectionStart ?? value.length, end: el.selectionEnd ?? value.length }
  }

  function applyBold() {
    const { start, end } = getSelection()
    const hasSelection = start !== end
    const selected = hasSelection ? value.slice(start, end) : '굵게'
    const next = `${value.slice(0, start)}**${selected}**${value.slice(end)}`
    onChange(next)
    restoreSelection(start + 2, start + 2 + selected.length)
  }

  function applyBlockPrefix(prefix: '' | '#' | '##') {
    const { start, end } = getSelection()
    const { lineStart, lineEnd } = getLineBounds(value, start, end)
    const line = value.slice(lineStart, lineEnd)
    const stripped = line.replace(/^#{1,2}\s+/, '')
    const newLine = prefix ? `${prefix} ${stripped}` : stripped
    const next = value.slice(0, lineStart) + newLine + value.slice(lineEnd)
    onChange(next)
    const delta = newLine.length - line.length
    restoreSelection(end + delta, end + delta)
  }

  // qa-reviewer (round 2, blocking) — strip whatever list marker a line already has (bullet OR
  // numbered) before deciding what to do with it. Without this, toggling from "- item" to a
  // numbered list produced "1. - item" (both markers stacked) instead of "1. item": the old
  // `alreadyListed` check only tested whether every line already started with the marker being
  // clicked, so switching *between* the two marker types never took the strip-existing-marker
  // branch at all.
  const NUMBERED_MARKER_RE = /^\d+\.\s/

  function stripListMarker(line: string): string {
    if (line.startsWith('- ')) return line.slice(2)
    const m = NUMBERED_MARKER_RE.exec(line)
    if (m) return line.slice(m[0].length)
    return line
  }

  // "Does this line already carry a marker of the SAME TYPE the user just clicked" — checked by
  // marker *type* (bullet vs any-digit-numbered), not by exact string match. A literal
  // `l.startsWith('1. ')` check would fail to recognize "2. item"/"3. item" as already-numbered
  // (real numbered lists don't repeat "1." on every line), which would make clicking "1.목록"
  // again on an existing 1/2/3-numbered list re-prefix instead of toggling it off.
  function lineHasMarkerType(line: string, marker: '- ' | '1. '): boolean {
    return marker === '- ' ? line.startsWith('- ') : NUMBERED_MARKER_RE.test(line)
  }

  function applyListPrefix(marker: '- ' | '1. ') {
    const { start, end } = getSelection()
    const { lineStart, lineEnd } = getLineBounds(value, start, end)
    const block = value.slice(lineStart, lineEnd)
    const lines = block.split('\n')
    const nonEmptyLines = lines.filter((l) => l.trim() !== '')
    // Toggle OFF only when every non-empty line already uses this marker TYPE (clicking the same
    // list-type button again removes it). Switching from the OTHER marker type always goes
    // through the strip-then-prefix branch below, never the toggle-off branch.
    const alreadyThisMarker = nonEmptyLines.length > 0 && nonEmptyLines.every((l) => lineHasMarkerType(l, marker))
    const newLines = lines.map((l) => {
      if (l.trim() === '') return l
      const stripped = stripListMarker(l)
      return alreadyThisMarker ? stripped : `${marker}${stripped}`
    })
    const newBlock = newLines.join('\n')
    const next = value.slice(0, lineStart) + newBlock + value.slice(lineEnd)
    onChange(next)
    const delta = newBlock.length - block.length
    restoreSelection(lineStart, lineEnd + delta)
  }

  function applyLink() {
    const { start, end } = getSelection()
    const hasSelection = start !== end
    const label = hasSelection ? value.slice(start, end) : window.prompt('링크 텍스트를 입력하세요', '') ?? ''
    if (!label) return
    const url = window.prompt('링크 URL을 입력하세요 (https:// 로 시작)', 'https://')
    if (!url) return
    const markdown = `[${label}](${url})`
    const next = `${value.slice(0, start)}${markdown}${value.slice(end)}`
    onChange(next)
    const newPos = start + markdown.length
    restoreSelection(newPos, newPos)
  }

  function insertImageMarkdown(url: string) {
    const el = textareaRef.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const before = value.slice(0, start)
    const after = value.slice(end)
    const needsLeadingBreak = before.length > 0 && !before.endsWith('\n')
    const insertText = `${needsLeadingBreak ? '\n' : ''}![](${url})\n`
    const next = `${before}${insertText}${after}`
    onChange(next)
    const newPos = before.length + insertText.length
    restoreSelection(newPos, newPos)
  }

  function errorKindAndMessage(errorCode: string | undefined): { kind: 'size' | 'format' | 'other'; message: string } {
    if (errorCode === 'FILE_TOO_LARGE') {
      return { kind: 'size', message: '파일 용량이 너무 큽니다(최대 2MB).' }
    }
    if (errorCode === 'UNSUPPORTED_FORMAT') {
      return { kind: 'format', message: '지원하지 않는 이미지 형식입니다(jpg/png만 가능).' }
    }
    // ui-spec §2.3의 ⑤(네트워크/서버 오류)와 동일 시각 처리로 수렴 — CONFIG_ERROR/ACCESS_DENIED/
    // VALIDATION_ERROR/METADATA_STRIP_FAILED/UPLOAD_FAILED 및 네트워크 예외 전부 포함.
    return { kind: 'other', message: '업로드에 실패했습니다. 다시 시도해주세요.' }
  }

  async function doUpload(file: File) {
    if (!contentItemId) return
    setUploadState({ status: 'uploading', fileName: file.name })
    try {
      const result = await uploadNoticeImageAction(contentItemId, file)
      if (!result.success || !result.url) {
        setUploadState({ ...errorKindAndMessage(result.errorCode), status: 'error', file })
        return
      }
      insertImageMarkdown(result.url)
      setUploadState({ status: 'idle' })
    } catch {
      setUploadState({ status: 'error', kind: 'other', message: '업로드에 실패했습니다. 다시 시도해주세요.', file })
    }
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 파일을 다시 선택할 수 있도록 초기화
    if (!file) return
    // ui-spec §2.4 — 클라이언트 사전 확인(서버 검증을 대체하지 않음, 사용자 실수를 줄이는 보조 장치).
    if (file.size > CLIENT_MAX_IMAGE_BYTES) {
      setUploadState({ status: 'error', kind: 'size', message: '파일 용량이 너무 큽니다(최대 2MB).', file })
      return
    }
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      setUploadState({ status: 'error', kind: 'format', message: '지원하지 않는 이미지 형식입니다(jpg/png만 가능).', file })
      return
    }
    void doUpload(file)
  }

  async function handleDeleteImage(image: EmbeddedImage) {
    // qa-reviewer (round 2, 주요) — the base confirm text only warns that the Storage file is
    // gone forever; it doesn't say that an already-published notice's live page is affected
    // immediately, independent of whether 저장 is ever pressed afterward. Append that only when
    // it's actually true (published notice) rather than scaring drafts/case_study/faq callers
    // with an irrelevant warning.
    const confirmMessage = isPublished
      ? '이 이미지를 삭제할까요? 스토리지에서 완전히 제거되며 되돌릴 수 없습니다. 이미 게시된 공지라면 저장 여부와 무관하게 지금 즉시 화면에서 이미지가 사라집니다.'
      : '이 이미지를 삭제할까요? 스토리지에서 완전히 제거되며 되돌릴 수 없습니다.'
    if (!window.confirm(confirmMessage)) return
    setImageActionError(null)
    setDeletingPaths((prev) => new Set(prev).add(image.path))
    const result = await deleteNoticeImageAction(image.path)
    setDeletingPaths((prev) => {
      const next = new Set(prev)
      next.delete(image.path)
      return next
    })
    if (!result.success) {
      setImageActionError('이미지 삭제에 실패했습니다. 다시 시도해주세요.')
      return
    }
    const next = value.replace(image.fullMatch, '').replace(/\n{3,}/g, '\n\n')
    onChange(next)
  }

  const imageButtonDisabled = disabled || !contentItemId || uploadState.status === 'uploading'
  const imageButtonTitle = !contentItemId ? '이미지는 공지를 먼저 저장한 후 추가할 수 있습니다.' : '이미지 삽입'

  return (
    <div className="rounded-input border border-neutral-300 bg-neutral-0 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500">
      {/* ui-spec §1.1/§1.2 — 4 groups: 문단서식 / 인라인서식(굵게만, 이탤릭 제외 §0.2) / 목록 / 삽입 */}
      <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-neutral-50 px-2 py-1.5">
        <select
          aria-label="문단 서식"
          title="문단 서식"
          className="h-8 rounded-sm border-0 bg-transparent px-2 admin-body-sm text-neutral-600 hover:bg-neutral-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:text-neutral-300"
          value=""
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value
            if (v === 'h1') applyBlockPrefix('#')
            else if (v === 'h2') applyBlockPrefix('##')
            else if (v === 'body') applyBlockPrefix('')
          }}
        >
          <option value="" disabled hidden>
            본문 ▾
          </option>
          <option value="body">본문</option>
          <option value="h1">제목1</option>
          <option value="h2">제목2</option>
        </select>

        <span className="mx-1 h-5 w-px bg-neutral-200" aria-hidden="true" />

        <button
          type="button"
          aria-label="굵게"
          title="굵게"
          disabled={disabled}
          onClick={applyBold}
          className={adminEditorToolbarButtonClass}
        >
          <span className="font-bold">B</span>
        </button>

        <span className="mx-1 h-5 w-px bg-neutral-200" aria-hidden="true" />

        <button
          type="button"
          aria-label="글머리 목록"
          title="글머리 목록"
          disabled={disabled}
          onClick={() => applyListPrefix('- ')}
          className={adminEditorToolbarButtonClass}
        >
          • 목록
        </button>
        <button
          type="button"
          aria-label="번호 목록"
          title="번호 목록"
          disabled={disabled}
          onClick={() => applyListPrefix('1. ')}
          className={adminEditorToolbarButtonClass}
        >
          1. 목록
        </button>

        <span className="mx-1 h-5 w-px bg-neutral-200" aria-hidden="true" />

        <button
          type="button"
          aria-label="링크 삽입"
          title="링크 삽입"
          disabled={disabled}
          onClick={applyLink}
          className={adminEditorToolbarButtonClass}
        >
          🔗 링크
        </button>
        <button
          type="button"
          aria-label="이미지 삽입"
          title={imageButtonTitle}
          disabled={imageButtonDisabled}
          onClick={() => fileInputRef.current?.click()}
          className={adminEditorToolbarButtonClass}
        >
          🖼 이미지
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={handleFileSelected}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {/* 새 공지 작성 화면(contentItemId=null)에서는 왜 이미지 버튼이 비활성화됐는지 상시 안내 —
          hover(title)만으로는 발견성이 낮다는 것이 §3.4 잠금 캡션과 같은 원칙(항상 보여야 하는
          정보는 hover에 의존하지 않는다). */}
      {!contentItemId && (
        <p className="border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 admin-label-sm text-neutral-500">
          이미지는 공지를 먼저 저장한 후 추가할 수 있습니다.
        </p>
      )}

      <textarea
        id={id}
        ref={textareaRef}
        className="min-h-[200px] w-full rounded-b-input border-0 p-3 font-mono admin-body-sm text-neutral-900 focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />

      {/* ui-spec §2.3 — 업로드 상태 표시. contentEditable이 아니라 textarea라 "삽입 위치"에 인라인
          박스를 그릴 수 없으므로, 툴바/편집영역 바로 아래에 상태 카드로 표시한다(§0.3 WYSIWYG 원칙을
          textarea 제약 안에서 최대한 따른 형태 — 상세는 파일 상단 주석 참고). */}
      {uploadState.status === 'uploading' && (
        <div className="flex h-[60px] items-center justify-center gap-2 border-t border-neutral-200 bg-neutral-50 admin-body-sm text-neutral-500">
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-600"
          />
          업로드 중… {uploadState.fileName}
        </div>
      )}
      {uploadState.status === 'error' && (
        <div className="flex items-center justify-between gap-3 border-t border-error/30 bg-error-100 px-3 py-2 admin-body-sm text-error">
          <span>{uploadState.message}</span>
          <span className="flex shrink-0 items-center gap-3">
            {uploadState.kind === 'other' && (
              <button type="button" className="text-error underline" onClick={() => void doUpload(uploadState.file)}>
                다시 시도
              </button>
            )}
            <button
              type="button"
              className="text-error hover:underline"
              aria-label="오류 닫기"
              onClick={() => setUploadState({ status: 'idle' })}
            >
              ✕
            </button>
          </span>
        </div>
      )}

      {/* NS-5 — 이미지 버킷 공개 경고. 항상 노출, 박스 없는 캡션(ui-spec §2.2). */}
      <p className="border-t border-neutral-100 px-3 py-2 admin-label-sm text-accent-700">
        <span className="text-accent-600" aria-hidden="true">
          ⚠{' '}
        </span>
        {NS5_CAPTION}
      </p>

      {/* 삽입된 이미지 관리 — 본문에서 마크다운만 지우면 스토리지 파일이 남으므로(W-N11/NB-B9),
          "삭제" 버튼을 별도로 둬 deleteNoticeImageAction까지 함께 호출한다. */}
      {embeddedImages.length > 0 && (
        <div className="border-t border-neutral-100 px-3 py-2">
          <p className="admin-label-sm text-neutral-500">삽입된 이미지 ({embeddedImages.length})</p>
          <ul className="mt-1 space-y-1">
            {embeddedImages.map((image) => (
              <li key={image.path} className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- Storage 공개 URL 썸네일 */}
                <img src={image.url} alt="" className="h-8 w-8 rounded-sm border border-neutral-200 object-cover" />
                <span className="flex-1 truncate admin-label-sm text-neutral-500">{image.path}</span>
                <button
                  type="button"
                  className="admin-label-sm text-error hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={deletingPaths.has(image.path)}
                  aria-label="이미지 삭제"
                  onClick={() => void handleDeleteImage(image)}
                >
                  {deletingPaths.has(image.path) ? '삭제 중…' : '삭제'}
                </button>
              </li>
            ))}
          </ul>
          {imageActionError && <p className="mt-1 admin-label-sm text-error">{imageActionError}</p>}
        </div>
      )}
    </div>
  )
}
