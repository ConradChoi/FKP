'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import type { ActionResult } from '@/lib/supabase/adminAuthActions'
import { isValidSlug, toContentKey, type ArticleContentType } from '@/lib/content/contentTypes'
import { translateBatch } from '@/lib/server/googleTranslate'
import {
  type AiFillResult,
  translateErrorToAiFillFailure,
  validateSourceFields,
  validateTargetLocale,
} from '@/lib/server/aiFill'
import { detectImageMimeType, extensionForDocumentMimeType } from '@/lib/forms/fileSignature'
import { stripImageMetadata } from '@/lib/content/stripImageMetadata'

// Design Ref: 대표 피드백(2026-08-27) — 메뉴관리에서 게시판관리(board_management) 그룹 아래
// 블로그/사례/FAQ 메뉴를 직접 구성했으므로, 그동안 /admin/content 탭 안에 있던 기능을 각자의
// 메뉴 경로로 옮긴다. 실제 데이터 접근 권한은 여전히 content_management RLS/RPC가 게이트하고
// (테이블 정책이 하드코딩한 권한 코드라 메뉴 이동과 무관), 이 admin 경로들은 순수하게
// 내비게이션 구조만 바꾼다.
// notice-board.screen-spec.md §3.1 — Admin path for the notice board is /admin/board/notice
// (app/admin/(protected)/board/blog/ -> notice/ directory move, screen-spec §8 file map /
// G-5, done in this round alongside the physical blog->notice conversion, PRD §7.3 A-2).
const ADMIN_PATH: Record<ArticleContentType, string> = {
  case_study: '/admin/board/example',
  notice: '/admin/board/notice',
}
const FAQ_ADMIN_PATH = '/admin/board/faq'
const ALL_BOARD_PATHS = [ADMIN_PATH.case_study, ADMIN_PATH.notice, FAQ_ADMIN_PATH]

// notice-board-v1.0.prd.md §7.5 G-3 — notices MUST be created with source_locale='ko' and an
// explicit target_audience (no defaults, PRD §7.2/privacy review NB-B5). createArticleAction
// below always creates with the RPC's en/null defaults, which is correct for blog/case_study
// but would silently violate both of those rules for a notice. ArticleContentType includes
// 'notice' (contentTypes.ts, D-N2 — it shares the title/excerpt/body_markdown shape), so
// CreateArticleInput.contentType is typed broadly enough to accept it; this runtime guard is
// the actual enforcement (kept as a plain string union rather than
// Exclude<ArticleContentType, 'notice'> so existing callers like NewArticleForm.tsx, whose
// `contentType` prop is typed as the full ArticleContentType, don't need a matching type
// change to keep compiling).
const NOTICE_CONTENT_TYPE = 'notice' as const

// create_content_item + upsert_content_translation(en, draft) 2단계 호출 — 슬러그는 생성 후
// 불변(lib/content/contentTypes 참고), 부분 실패 허용 정책은 createCategoryAction과 동일.
export interface CreateArticleInput {
  contentType: ArticleContentType
  slug: string
  sortOrder: number
  title: string
  excerpt: string
  bodyMarkdown: string
}

export async function createArticleAction(input: CreateArticleInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  // See NOTICE_CONTENT_TYPE comment above — this function always creates with
  // source_locale='en' (RPC default) and no target_audience, which is wrong for a notice
  // (G-3: notices must be source_locale='ko' + an explicit target_audience). Use
  // createNoticeAction instead. The DB's chk_content_item_notice_requires_audience CHECK
  // would also reject a content_type='notice' row with a null target_audience, but failing
  // here gives a clearer error than a raw constraint-violation message.
  if (input.contentType === NOTICE_CONTENT_TYPE) {
    return { success: false, error: 'use_create_notice_action', errorCode: 'VALIDATION_ERROR' }
  }

  if (!isValidSlug(input.slug)) {
    return { success: false, error: 'invalid_slug', errorCode: 'VALIDATION_ERROR' }
  }

  const contentKey = toContentKey(input.contentType, input.slug)

  const { data: itemId, error: createError } = await supabase.rpc('create_content_item', {
    p_content_type: input.contentType,
    p_content_key: contentKey,
    p_sort_order: input.sortOrder,
  })
  if (createError) return { success: false, error: createError.message, errorCode: 'CREATE_FAILED' }

  const { error: translationError } = await supabase.rpc('upsert_content_translation', {
    p_content_item_id: itemId,
    p_locale: 'en',
    p_body: { title: input.title, excerpt: input.excerpt, body_markdown: input.bodyMarkdown },
    p_status: 'draft',
  })
  if (translationError) return { success: false, error: translationError.message, errorCode: 'CREATE_FAILED' }

  revalidatePath(ADMIN_PATH[input.contentType])
  return { success: true }
}

// =============================================================================
// 공지사항(notice) 생성 — notice-board-v1.0.prd.md §3.1/§7.5 G-3, screen-spec §3.3.
// =============================================================================
//
// createArticleAction (blog/case_study) 위 함수를 그대로 확장하지 않고 별도 함수로 둔 이유:
// (1) content_type이 상수로 고정('notice')돼 CreateArticleInput.contentType 파라미터 자체가
//     불필요하고, (2) source_locale이 'ko'로 고정(en이 아님, G-3)돼 createArticleAction의
//     암묵적 en 가정과 다르며, (3) target_audience가 신규 필수 파라미터라 시그니처가 이미
//     달라진다. 세 가지가 겹치면 "기존 함수에 옵셔널 파라미터 여러 개를 얹는" 것보다 "의도가
//     분명한 새 함수"가 더 안전하다는 판단(§7.5 G-3의 "오버로드 함정"과 같은 종류의 리스크를
//     TypeScript 레이어에서도 반복하지 않기 위함).
const NOTICE_TARGET_AUDIENCES = ['partner', 'seepn_user'] as const
export type NoticeTargetAudience = (typeof NOTICE_TARGET_AUDIENCES)[number]

export interface CreateNoticeInput {
  // screen-spec §3.3 — select의 첫 옵션이 빈 값("선택하세요")이라 클라이언트가 무엇을 보내든
  // 여기서 다시 검증한다(N-R2 "기본값 없이 명시 선택"의 서버측 강제, privacy review NB-B5
  // "서버 액션에서 재검증"과 동일한 원칙). 빈 문자열/오타 값은 VALIDATION_ERROR로 거부한다 —
  // DB의 chk_content_item_target_audience_values도 같은 것을 막지만, 여기서 먼저 걸러 더 나은
  // 에러 코드를 돌려준다.
  targetAudience: NoticeTargetAudience
  slug: string
  sortOrder: number
  title: string
  excerpt: string
  bodyMarkdown: string
}

export async function createNoticeAction(input: CreateNoticeInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  if (!NOTICE_TARGET_AUDIENCES.includes(input.targetAudience)) {
    return { success: false, error: 'invalid_target_audience', errorCode: 'VALIDATION_ERROR' }
  }

  if (!isValidSlug(input.slug)) {
    return { success: false, error: 'invalid_slug', errorCode: 'VALIDATION_ERROR' }
  }

  const contentKey = toContentKey(NOTICE_CONTENT_TYPE, input.slug)

  // PRD §3.1 "모든 공지의 원문 로케일은 ko다" — p_source_locale을 명시적으로 'ko'로 넘긴다
  // (넘기지 않으면 RPC 기본값 'en'이 적용돼 source_synced_at 계산과 번역상태 배지가 영구히
  // 어긋난다, G-3). p_target_audience도 기본값이 없으므로 항상 명시한다(§7.2 "기본값을 두지
  // 않는 것을 권고" — 조용한 오발행 방지).
  const { data: itemId, error: createError } = await supabase.rpc('create_content_item', {
    p_content_type: NOTICE_CONTENT_TYPE,
    p_content_key: contentKey,
    p_sort_order: input.sortOrder,
    p_source_locale: 'ko',
    p_target_audience: input.targetAudience,
  })
  if (createError) return { success: false, error: createError.message, errorCode: 'CREATE_FAILED' }

  const { error: translationError } = await supabase.rpc('upsert_content_translation', {
    p_content_item_id: itemId,
    p_locale: 'ko',
    p_body: { title: input.title, excerpt: input.excerpt, body_markdown: input.bodyMarkdown },
    p_status: 'draft',
  })
  if (translationError) return { success: false, error: translationError.message, errorCode: 'CREATE_FAILED' }

  revalidatePath(ADMIN_PATH.notice)
  return { success: true }
}

export interface UpdateArticleItemInput {
  contentItemId: string
  sortOrder: number
  isActive: boolean
  // notice-board-v1.0.prd.md §3.4 D-N3 / screen-spec §3.5 / privacy review NB-B5 — notice-only
  // (content_type='notice'; blog/case_study/faq callers omit this field entirely, see
  // ArticleRow.tsx/FaqRow.tsx call sites, unchanged). When present, updateArticleItemAction
  // re-validates the D-N3 lock condition itself (below) before writing it — never trust that
  // the value the client sent already respects the lock, see the M-1 comment below for why.
  targetAudience?: NoticeTargetAudience
}

export async function updateArticleItemAction(input: UpdateArticleItemInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  // =====================================================================
  // M-1 — D-N3 대상 변경 잠금, 서버 재검증 (qa-reviewer가 이번 PR에 반드시 포함하도록 조건을
  // 건 항목).
  //
  // 왜 여기서 다시 확인해야 하는가: content_item에는 이미 `grant insert, update, delete ...
  // to authenticated`가 있고(20260827100000_phase5_content_management_schema.sql:286),
  // content_item_admin_update RLS 정책은 content_management/update 권한만 확인할 뿐
  // target_audience 값 자체나 "번역이 이미 있는지"는 전혀 보지 않는다(privacy review §3.2/
  // NB-B3 — 이 테이블의 RLS는 읽기/쓰기 권한 경계일 뿐 D-N3 같은 비즈니스 규칙을 아는 계층이
  // 아니다). 즉 대상 select가 잠금 상태일 때 "추가" 버튼을 비활성화하는 화면 쪽 방어(screen-
  // spec §3.5)는 UX일 뿐이고, 이 서버 액션이 클라이언트가 보낸 targetAudience 값을 그대로
  // 믿고 저장하면 잠금 자체가 존재하지 않는 것과 같아진다.
  //
  // 실제 잠금 재확인·쓰기는 update_notice_target_audience RPC(SECURITY DEFINER,
  // 20260909100000_notice_target_audience_lock.sql) 안에서 매 호출마다 새로 수행한다 —
  // 여기서 직접 content_translation을 SELECT해 판단하지 않는 이유: 그 SELECT는
  // content_translation_admin_select RLS(content_management '읽기' 권한 필요)를 타는데,
  // '읽기'와 '수정'은 이 프로젝트 RBAC에서 독립적으로 부여 가능한 별개 권한 비트라 '수정'
  // 권한만 있고 '읽기' 권한이 없는 관리자가 호출하면 조회 결과가 조용히 0건이 되어 잠금이
  // 없는 것처럼 오판할 수 있다(fail-open). SECURITY DEFINER 함수는 이 프로젝트의 다른 모든
  // content_item/content_translation 쓰기(create_content_item 등)와 동일하게 함수 소유자
  // 권한으로 실행되어 그 필터링 문제 자체가 생기지 않는다.
  if (input.targetAudience !== undefined) {
    if (!NOTICE_TARGET_AUDIENCES.includes(input.targetAudience)) {
      return { success: false, error: 'invalid_target_audience', errorCode: 'VALIDATION_ERROR' }
    }

    // qa-reviewer (2026-09-09, non-blocking, deploy-approved with this to fix before next
    // round): a locked notice's edit form always includes its (unchanged) targetAudience in
    // the payload even when the admin only meant to change sortOrder/isActive — a plain
    // <select> whose value happens to match the current one, submitted alongside other field
    // changes, is exactly the "hidden field carried along" pattern that trips this up. Without
    // this no-op guard, that submission would call update_notice_target_audience below, get
    // TARGET_AUDIENCE_LOCKED (correctly, per D-N3 — there ARE non-ko translations), and fail
    // the whole action before update_content_item ever runs — even though the caller never
    // asked to change the audience at all. Re-fetching the current value here and skipping the
    // RPC when it's unchanged fixes that false failure without weakening the lock itself: a
    // request that DOES ask for a different value still always goes through
    // update_notice_target_audience and is still re-checked there on every call (below), so an
    // actual audience-change attempt on a locked notice still fails with
    // TARGET_AUDIENCE_LOCKED exactly as before.
    //
    // This SELECT can, in principle, undercount due to the same read/update permission-bit gap
    // described above (content_item_admin_select needs content_management 'read') — but the
    // failure mode there is just "treats it as changed and calls the RPC anyway", which is
    // exactly this guard's absence, i.e. always safe, never a way to bypass the lock.
    const { data: currentItem, error: currentItemError } = await supabase
      .from('content_item')
      .select('target_audience')
      .eq('id', input.contentItemId)
      .maybeSingle()
    if (currentItemError) {
      return { success: false, error: currentItemError.message, errorCode: 'UPDATE_FAILED' }
    }

    if (currentItem?.target_audience !== input.targetAudience) {
      const { error: audienceError } = await supabase.rpc('update_notice_target_audience', {
        p_id: input.contentItemId,
        p_target_audience: input.targetAudience,
      })
      if (audienceError) {
        // D-N3: "ko 외 번역 행이 하나라도 존재하면 대상 변경을 거부." screen-spec §3.5's locked
        // state (자물쇠 아이콘) is what should have prevented the client from ever sending this,
        // but this is what actually enforces it — reachable via a stale page, a modified
        // client, or a direct call to this action.
        if (audienceError.message.includes('target_audience_locked')) {
          return { success: false, error: 'target_audience_locked', errorCode: 'TARGET_AUDIENCE_LOCKED' }
        }
        return { success: false, error: audienceError.message, errorCode: 'UPDATE_FAILED' }
      }
    }
  }

  const { error } = await supabase.rpc('update_content_item', {
    p_id: input.contentItemId,
    p_sort_order: input.sortOrder,
    p_is_active: input.isActive,
  })
  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  // 이 함수는 블로그/사례/FAQ/공지 공용이라 어떤 게시판 소속인지 모른다 — 넷 다 revalidate(저비용).
  for (const path of ALL_BOARD_PATHS) revalidatePath(path)
  return { success: true }
}

export async function deleteContentItemAction(contentItemId: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('delete_content_item', { p_id: contentItemId })
  if (error) return { success: false, error: error.message, errorCode: 'DELETE_FAILED' }

  for (const path of ALL_BOARD_PATHS) revalidatePath(path)
  return { success: true }
}

export interface UpsertArticleTranslationInput {
  contentItemId: string
  locale: 'en' | 'ja' | 'ko' | 'zh'
  title: string
  excerpt: string
  bodyMarkdown: string
  status: 'draft' | 'translated' | 'published'
}

export async function upsertArticleTranslationAction(input: UpsertArticleTranslationInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('upsert_content_translation', {
    p_content_item_id: input.contentItemId,
    p_locale: input.locale,
    p_body: { title: input.title, excerpt: input.excerpt, body_markdown: input.bodyMarkdown },
    p_status: input.status,
  })
  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  for (const path of ALL_BOARD_PATHS) revalidatePath(path)
  return { success: true }
}

// =============================================================================
// AI 초벌 채우기 (screen-spec §3.5 게시판 블로그, §6 서버 액션 계약, Gap G-2 서버 측 방어)
// =============================================================================

export interface AiFillArticleTranslationInput {
  contentItemId: string
  targetLocale: 'en' | 'ja' | 'ko' | 'zh'
}

export interface AiFillArticleTranslationBody {
  title: string
  excerpt: string
  bodyMarkdown: string
}

// screen-spec §3.5 — "서버 측 방어(필수, UI만 믿지 않음)": ArticleRow가 case_study일 때 버튼을
// 렌더링하지 않는 것은 frontend-developer 몫(Gap G-2, 이번 작업 범위 아님)이고, 이 서버 액션은
// 그 UI 분기와 무관하게 항상 content_item.content_type을 재조회해 case_study면 즉시 거부한다
// (E-15). 이 체크는 원문 재조회(§6.2 step 2)에 필요한 바로 그 content_item 조회에 곁다리로
// 얹혀 있으므로, 별도 쿼리를 추가하지 않고도 "Google Translate 호출 전에 즉시 반환"을 만족한다.
export async function aiFillArticleTranslationAction(
  input: AiFillArticleTranslationInput,
): Promise<AiFillResult<AiFillArticleTranslationBody>> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, errorCode: 'CONFIG_ERROR' }

  // (1) 인증/권한 재검증 — upsertArticleTranslationAction과 동일하게 content_management/update
  // (board 화면들도 실제 데이터 접근 권한은 content_management RLS/RPC가 게이트한다, 파일 상단
  // 주석 참고).
  const { data: allowed } = await supabase.rpc('has_menu_permission_check', {
    p_menu_code: 'content_management',
    p_action: 'update',
  })
  if (!allowed) return { success: false, errorCode: 'ACCESS_DENIED' }

  const { data: item, error: itemError } = await supabase
    .from('content_item')
    .select('content_type, source_locale')
    .eq('id', input.contentItemId)
    .maybeSingle()
  if (itemError || !item) {
    return { success: false, errorCode: 'SAVE_FAILED', message: itemError?.message ?? 'content_item_not_found' }
  }

  // (4) case_study 서버 방어 — UI 비노출과 무관하게 항상 유효한 방어선(§3.5, E-15).
  //
  // qa-reviewer (2026-09-08, M-3, non-blocking) — content_type 방어를 targetLocale 검증보다
  // 먼저 둔다. content_type이 이미 차단 대상이면 targetLocale 값과 무관하게 어차피 거부되므로
  // 실질 위험은 없지만(어느 쪽이든 번역은 막힌다), targetLocale===sourceLocale로 호출된
  // case_study/notice가 더 구체적인 CASE_STUDY_NOT_ALLOWED/NOTICE_NOT_ALLOWED 대신 애매한
  // INVALID_TARGET_LOCALE을 반환하던 엣지케이스를 없앤다 — "이 콘텐츠 타입 자체가 허용되지
  // 않는다"가 "로케일 조합이 잘못됐다"보다 먼저 판별돼야 원인이 더 정확히 드러난다.
  if (item.content_type === 'case_study') {
    return { success: false, errorCode: 'CASE_STUDY_NOT_ALLOWED' }
  }

  // (4b) notice 서버 방어 — notice-board-v1.0.prd.md §7.5 G-6 / screen-spec §3.6·§6 N-E3.
  // 블로그 화면 전환으로 이 액션이 그대로 notice에도 붙게 됐으나, `partner` 공지는 ko 단일이라
  // 번역 대상 자체가 없고(노출되면 버그), `seepn_user` 공지는 en/ja 번역 대상이 실재하지만
  // AI 초벌 적용은 W-N6 후속 과제로 이번 범위 밖이다. UI 비노출(ArticleRow의 showAiFill 조건,
  // frontend-developer 몫)과 별개로 서버 액션 직접 호출도 항상 거부해야 진짜 방어선이 된다
  // (case_study와 동일 패턴). CASE_STUDY_NOT_ALLOWED를 재사용하지 않고 별도 코드를 쓰는 이유는
  // lib/server/aiFill.ts의 NOTICE_NOT_ALLOWED 주석 참고 — case_study는 영구 배제, notice는
  // "아직" 배제라 나중에 구분해야 한다.
  if (item.content_type === 'notice') {
    return { success: false, errorCode: 'NOTICE_NOT_ALLOWED' }
  }

  // qa-reviewer (blocking, 2026-09-08) — server-side re-check that targetLocale isn't the
  // source locale itself (see lib/server/aiFill.ts's comment on INVALID_TARGET_LOCALE).
  const targetLocaleError = validateTargetLocale(input.targetLocale, item.source_locale)
  if (targetLocaleError) return targetLocaleError

  // (2) 원문 재조회.
  const { data: sourceRow, error: sourceError } = await supabase
    .from('content_translation')
    .select('body')
    .eq('content_item_id', input.contentItemId)
    .eq('locale', item.source_locale)
    .maybeSingle()
  if (sourceError) return { success: false, errorCode: 'SAVE_FAILED', message: sourceError.message }

  const sourceBody = (sourceRow?.body ?? {}) as { title?: string; excerpt?: string; body_markdown?: string }
  const sourceTitle = typeof sourceBody.title === 'string' ? sourceBody.title : ''
  const sourceExcerpt = typeof sourceBody.excerpt === 'string' ? sourceBody.excerpt : ''
  const sourceBodyMarkdown = typeof sourceBody.body_markdown === 'string' ? sourceBody.body_markdown : ''

  // (3) trim 후 빈 값 EMPTY_SOURCE / 필드별 20,000자 초과 SOURCE_TOO_LONG — bodyMarkdown이 세
  // 필드 중 가장 길어 초과 가능성이 가장 높은 필드(screen-spec §3.5).
  const validationError = validateSourceFields([
    { field: 'title', value: sourceTitle },
    { field: 'excerpt', value: sourceExcerpt },
    { field: 'bodyMarkdown', value: sourceBodyMarkdown },
  ])
  if (validationError) return validationError

  // (5) 3개 필드를 translateBatch 1회 호출로 함께 번역(§6.2 step 5 — "1클릭 = 서버 액션 1회
  // 호출"의 구현 디테일로서 여러 필드를 배열로 담는 것은 원칙 위반 아님).
  const batchResult = await translateBatch({
    texts: [sourceTitle, sourceExcerpt, sourceBodyMarkdown],
    sourceLocale: item.source_locale,
    targetLocale: input.targetLocale,
  })
  if (!batchResult.ok) return translateErrorToAiFillFailure(batchResult)

  const [translatedTitle, translatedExcerpt, translatedBodyMarkdown] = batchResult.translations

  // (6) 성공 시 upsert RPC를 p_status='draft', p_translation_source='ai'로 호출.
  const { error: upsertError } = await supabase.rpc('upsert_content_translation', {
    p_content_item_id: input.contentItemId,
    p_locale: input.targetLocale,
    p_body: { title: translatedTitle, excerpt: translatedExcerpt, body_markdown: translatedBodyMarkdown },
    p_status: 'draft',
    p_translation_source: 'ai',
  })
  if (upsertError) return { success: false, errorCode: 'SAVE_FAILED', message: upsertError.message }

  for (const path of ALL_BOARD_PATHS) revalidatePath(path)

  // (7) 번역 결과 반환 — router.refresh()에 의존하지 않고 클라이언트가 이 값으로 로컬 state를
  // 직접 갱신해야 함(§6.4, frontend-developer 몫).
  return {
    success: true,
    body: { title: translatedTitle, excerpt: translatedExcerpt, bodyMarkdown: translatedBodyMarkdown },
    status: 'draft',
    translationSource: 'ai',
  }
}

export interface CreateFaqInput {
  slug: string
  sortOrder: number
  question: string
  answer: string
}

export async function createFaqAction(input: CreateFaqInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  if (!isValidSlug(input.slug)) {
    return { success: false, error: 'invalid_slug', errorCode: 'VALIDATION_ERROR' }
  }

  const contentKey = toContentKey('faq', input.slug)

  const { data: itemId, error: createError } = await supabase.rpc('create_content_item', {
    p_content_type: 'faq',
    p_content_key: contentKey,
    p_sort_order: input.sortOrder,
  })
  if (createError) return { success: false, error: createError.message, errorCode: 'CREATE_FAILED' }

  const { error: translationError } = await supabase.rpc('upsert_content_translation', {
    p_content_item_id: itemId,
    p_locale: 'en',
    p_body: { question: input.question, answer: input.answer },
    p_status: 'draft',
  })
  if (translationError) return { success: false, error: translationError.message, errorCode: 'CREATE_FAILED' }

  revalidatePath(FAQ_ADMIN_PATH)
  return { success: true }
}

export interface UpsertFaqTranslationInput {
  contentItemId: string
  locale: 'en' | 'ja' | 'ko' | 'zh'
  question: string
  answer: string
  status: 'draft' | 'translated' | 'published'
}

export async function upsertFaqTranslationAction(input: UpsertFaqTranslationInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('upsert_content_translation', {
    p_content_item_id: input.contentItemId,
    p_locale: input.locale,
    p_body: { question: input.question, answer: input.answer },
    p_status: input.status,
  })
  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  revalidatePath(FAQ_ADMIN_PATH)
  return { success: true }
}

// =============================================================================
// AI 초벌 채우기 (screen-spec §3.4 게시판 FAQ, §6 서버 액션 계약)
// =============================================================================

export interface AiFillFaqTranslationInput {
  contentItemId: string
  targetLocale: 'en' | 'ja' | 'ko' | 'zh'
}

export interface AiFillFaqTranslationBody {
  question: string
  answer: string
}

// question + answer는 카드 버튼 1개가 함께 번역하는 다중 필드 — translateBatch 1회 호출로
// [question, answer]를 함께 보낸다(§6.2 step 5).
export async function aiFillFaqTranslationAction(
  input: AiFillFaqTranslationInput,
): Promise<AiFillResult<AiFillFaqTranslationBody>> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, errorCode: 'CONFIG_ERROR' }

  // (1) 인증/권한 재검증 — upsertFaqTranslationAction과 동일하게 content_management/update.
  const { data: allowed } = await supabase.rpc('has_menu_permission_check', {
    p_menu_code: 'content_management',
    p_action: 'update',
  })
  if (!allowed) return { success: false, errorCode: 'ACCESS_DENIED' }

  // (2) 원문 재조회.
  const { data: item, error: itemError } = await supabase
    .from('content_item')
    .select('source_locale')
    .eq('id', input.contentItemId)
    .maybeSingle()
  if (itemError || !item) {
    return { success: false, errorCode: 'SAVE_FAILED', message: itemError?.message ?? 'content_item_not_found' }
  }

  // qa-reviewer (blocking, 2026-09-08) — server-side re-check that targetLocale isn't the
  // source locale itself (see lib/server/aiFill.ts's comment on INVALID_TARGET_LOCALE).
  const targetLocaleError = validateTargetLocale(input.targetLocale, item.source_locale)
  if (targetLocaleError) return targetLocaleError

  const { data: sourceRow, error: sourceError } = await supabase
    .from('content_translation')
    .select('body')
    .eq('content_item_id', input.contentItemId)
    .eq('locale', item.source_locale)
    .maybeSingle()
  if (sourceError) return { success: false, errorCode: 'SAVE_FAILED', message: sourceError.message }

  const sourceBody = (sourceRow?.body ?? {}) as { question?: string; answer?: string }
  const sourceQuestion = typeof sourceBody.question === 'string' ? sourceBody.question : ''
  const sourceAnswer = typeof sourceBody.answer === 'string' ? sourceBody.answer : ''

  // (3) trim 후 빈 값 EMPTY_SOURCE / 필드별 20,000자 초과 SOURCE_TOO_LONG.
  const validationError = validateSourceFields([
    { field: 'question', value: sourceQuestion },
    { field: 'answer', value: sourceAnswer },
  ])
  if (validationError) return validationError

  // (5) Google Cloud Translation API 호출.
  const batchResult = await translateBatch({
    texts: [sourceQuestion, sourceAnswer],
    sourceLocale: item.source_locale,
    targetLocale: input.targetLocale,
  })
  if (!batchResult.ok) return translateErrorToAiFillFailure(batchResult)

  const [translatedQuestion, translatedAnswer] = batchResult.translations

  // (6) 성공 시 upsert RPC를 p_status='draft', p_translation_source='ai'로 호출.
  const { error: upsertError } = await supabase.rpc('upsert_content_translation', {
    p_content_item_id: input.contentItemId,
    p_locale: input.targetLocale,
    p_body: { question: translatedQuestion, answer: translatedAnswer },
    p_status: 'draft',
    p_translation_source: 'ai',
  })
  if (upsertError) return { success: false, errorCode: 'SAVE_FAILED', message: upsertError.message }

  for (const path of ALL_BOARD_PATHS) revalidatePath(path)

  // (7) 번역 결과 반환 — router.refresh()에 의존하지 않고 클라이언트가 이 값으로 로컬 state를
  // 직접 갱신해야 함(§6.4, frontend-developer 몫).
  return {
    success: true,
    body: { question: translatedQuestion, answer: translatedAnswer },
    status: 'draft',
    translationSource: 'ai',
  }
}

// =============================================================================
// 공지 본문 이미지 업로드/삭제 (WS-3, notice-board-v1.0.prd.md §7.6/N-R16/C-3,
// notice-board-privacy-review.md §2 전체 — NB-B1/B2/B4/B10, §2.6 NB-B9)
// =============================================================================
//
// Design notes (read before changing anything below):
//
// - Bucket: content-image (public=true, 20260909110000_notice_image_bucket.sql). That
//   migration's storage.objects RLS grants INSERT/DELETE DIRECTLY to an authenticated admin
//   session holding content_management create/delete — unlike partner-doc (whose RLS grants
//   admin SELECT only, forcing uploadPartnerDocumentAction in
//   ../partners/[id]/actions.ts to fall back to getSupabaseAdminClient()/service_role for the
//   write), this bucket's policies are shaped so the admin's OWN JWT
//   (getSupabaseAuthServerClient()) can write directly. Privacy review NB-B4 requires exactly
//   this: "관리자 본인 JWT로 Storage에 쓰게 해서 storage.objects RLS가 실제 통제선이 되게
//   한다." Do NOT switch this to getSupabaseAdminClient() — that would make the RLS policies
//   in the migration decorative and move the entire authorization decision into application
//   code, which is precisely what NB-B4 warns against.
// - No SELECT policy exists on the bucket (NB-B1) and none should ever be added here either —
//   getPublicUrl() below works without one because the bucket itself is public=true. See the
//   migration file's header comment for the full reasoning (a SELECT policy would open the
//   LIST endpoint, not "allow reads").
// - contentItemId is a REQUIRED parameter, not derived or optional: the storage path
//   convention (content-image/{content_item_id}/{uuid}.{ext}, privacy review §2.3) assumes the
//   notice row already exists. createNoticeAction always creates that row (with a draft 'ko'
//   translation) before any editing UI for its body can open, so by the time an admin is
//   editing a notice's body with the rich-text editor, its contentItemId is always available —
//   frontend-developer: do not call this action before the notice has been created via
//   createNoticeAction.
// - EXIF/metadata stripping (NB-B10, blocking — not optional) happens AFTER magic-byte
//   detection and BEFORE the Storage write, so the bytes that actually reach the public bucket
//   never carry the original capture metadata. See lib/content/stripImageMetadata.ts's own
//   comment for the byte-level approach and the Orientation-tag trade-off it accepts.
// - webp is intentionally unsupported (detectImageMimeType only matches jpeg/png) — see that
//   function's comment in lib/forms/fileSignature.ts for why.

const NOTICE_IMAGE_BUCKET = 'content-image'
const MAX_NOTICE_IMAGE_BYTES = 2 * 1024 * 1024 // 2MB — matches the bucket's file_size_limit
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface UploadNoticeImageResult {
  success: boolean
  url?: string
  path?: string
  error?: string
  errorCode?:
    | 'CONFIG_ERROR'
    | 'ACCESS_DENIED'
    | 'VALIDATION_ERROR'
    | 'FILE_TOO_LARGE'
    | 'UNSUPPORTED_FORMAT'
    | 'METADATA_STRIP_FAILED'
    | 'UPLOAD_FAILED'
}

export async function uploadNoticeImageAction(contentItemId: string, file: File): Promise<UploadNoticeImageResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  if (!UUID_RE.test(contentItemId)) {
    return { success: false, error: 'invalid_content_item_id', errorCode: 'VALIDATION_ERROR' }
  }
  if (!(file instanceof File)) {
    return { success: false, error: 'invalid_input', errorCode: 'VALIDATION_ERROR' }
  }

  // NB-R2 (non-blocking recommendation, cheap to satisfy): reject by client-reported size
  // before reading the full body into memory. This is a first-pass check only — file.size is
  // caller-reported metadata, not a guarantee — the actual enforced limit is the byte-length
  // check right after arrayBuffer() below, plus the bucket's own file_size_limit
  // (defense-in-depth, migration comment §1).
  if (file.size <= 0 || file.size > MAX_NOTICE_IMAGE_BYTES) {
    return { success: false, error: 'file_too_large', errorCode: 'FILE_TOO_LARGE' }
  }

  // (1) 권한 재검증 — content_management create. "이 버튼이 admin 화면에만 보인다"는 사실은
  // 통제가 아니다(updateArticleItemAction의 M-1 주석과 동일 원칙 — 이 액션은 독립된 공개
  // 엔드포인트이므로 UI가 무엇을 렌더링하든 매번 다시 검증한다).
  const { data: allowed } = await supabase.rpc('has_menu_permission_check', {
    p_menu_code: 'content_management',
    p_action: 'create',
  })
  if (!allowed) return { success: false, error: 'access_denied', errorCode: 'ACCESS_DENIED' }

  const bytes = Buffer.from(await file.arrayBuffer())
  if (bytes.length > MAX_NOTICE_IMAGE_BYTES) {
    return { success: false, error: 'file_too_large', errorCode: 'FILE_TOO_LARGE' }
  }

  // (2) 매직바이트 검증 — 선언된 file.type/원본 확장자는 신뢰하지 않는다(NB-B2). jpeg/png만
  // 허용(webp 미지원 — detectImageMimeType 주석 참고).
  const detectedMimeType = detectImageMimeType(bytes)
  if (!detectedMimeType) {
    return { success: false, error: 'unsupported_format', errorCode: 'UNSUPPORTED_FORMAT' }
  }

  // (3) EXIF 등 메타데이터 스트립 — 필수(NB-B10). 새 런타임 의존성 없이 바이트 레벨로 JPEG
  // APP1/APP13 세그먼트, PNG eXIf/tEXt/iTXt/zTXt 청크를 제거한다. Orientation 트레이드오프는
  // stripImageMetadata.ts 주석 참고.
  //
  // qa-reviewer (2026-09-09, blocking) — fail-closed, not fail-safe: stripImageMetadata returns
  // null when the marker/chunk walk hits ANY structure it doesn't fully parse (malformed length,
  // truncated file, missing IEND, etc.), instead of the file's first version, which passed the
  // unparsed remainder through untouched in that situation. That was the wrong trade-off for this
  // feature specifically: an unparsed remainder is exactly where an un-stripped APP1/eXIf segment
  // could still be sitting, and unlike a broken image, a leftover GPS tag is invisible everywhere
  // in this app (no EXIF viewer anywhere) — nobody would ever notice it happened. Reject the
  // upload outright rather than risk publishing it (stripImageMetadata.ts file header has the
  // full reasoning). Ordinary phone-camera JPEGs / screenshot PNGs parse cleanly and are
  // unaffected; only unusual/malformed files hit this branch.
  const strippedBytes = stripImageMetadata(bytes, detectedMimeType)
  if (!strippedBytes) {
    return { success: false, error: 'metadata_strip_failed', errorCode: 'METADATA_STRIP_FAILED' }
  }

  // (4) 서버 생성 UUID 파일명 — 원본 파일명은 절대 사용하지 않는다(NB-B2). 확장자는 탐지된
  // MIME에서 파생(extensionForDocumentMimeType은 'image/jpeg'|'image/png'를 포함하는 상위
  // 유니온을 받으므로 그대로 재사용 가능).
  const objectPath = `${contentItemId}/${randomUUID()}.${extensionForDocumentMimeType(detectedMimeType)}`

  // (5) 관리자 본인 세션(JWT)으로 업로드 — service_role 아님(파일 상단 주석, NB-B4).
  // Storage에 저장하는 contentType은 탐지된 MIME으로 명시 설정한다 — 클라이언트가 보낸
  // Content-Type을 그대로 저장하면 허용 목록을 통과한 파일이 의도와 다른 Content-Type으로
  // 서빙될 수 있다(privacy review §2.4 "추가 확인 사항").
  const { error: uploadError } = await supabase.storage
    .from(NOTICE_IMAGE_BUCKET)
    .upload(objectPath, strippedBytes, { contentType: detectedMimeType })
  if (uploadError) return { success: false, error: uploadError.message, errorCode: 'UPLOAD_FAILED' }

  const { data: publicUrlData } = supabase.storage.from(NOTICE_IMAGE_BUCKET).getPublicUrl(objectPath)

  return { success: true, url: publicUrlData.publicUrl, path: objectPath }
}

export interface DeleteNoticeImageResult {
  success: boolean
  error?: string
  errorCode?: 'CONFIG_ERROR' | 'ACCESS_DENIED' | 'VALIDATION_ERROR' | 'DELETE_FAILED'
}

// privacy review §2.6 NB-B9 — "본문에서 링크만 지우면 됨"은 반려된 설계. 이 액션이 그
// "최소한의 수동 삭제 경로"다. path는 uploadNoticeImageAction이 반환한 값을 그대로 넘겨받는
// 것을 전제로 한다(프론트엔드가 임의 문자열을 입력받아 넘기는 UI를 만들지 않는다) — 그래도
// 서버는 아래에서 명백한 경로 조작 패턴만 방어적으로 걸러낸다. content_management delete
// 권한을 재검증하며, 이는 create와 다른 권한 비트이므로 별도로 확인해야 한다(이 프로젝트
// RBAC은 create/read/update/delete를 독립적으로 부여할 수 있다).
export async function deleteNoticeImageAction(path: string): Promise<DeleteNoticeImageResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  if (!path || path.includes('..') || path.startsWith('/')) {
    return { success: false, error: 'invalid_path', errorCode: 'VALIDATION_ERROR' }
  }

  const { data: allowed } = await supabase.rpc('has_menu_permission_check', {
    p_menu_code: 'content_management',
    p_action: 'delete',
  })
  if (!allowed) return { success: false, error: 'access_denied', errorCode: 'ACCESS_DENIED' }

  const { error } = await supabase.storage.from(NOTICE_IMAGE_BUCKET).remove([path])
  if (error) return { success: false, error: error.message, errorCode: 'DELETE_FAILED' }

  return { success: true }
}
