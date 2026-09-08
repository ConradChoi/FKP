'use server'

// Design Ref: supabase/migrations/20260829150000_standard_category_schema.sql — this table has
// NO RPCs (unlike public.menu's create_menu/update_menu/move_menu/delete_menu). Every action
// below is a direct column-grant CRUD call (`supabase.from('standard_category')...`), per the
// migration's own design intent. RLS (standard_category_admin_*) is the real enforcement;
// these actions only translate results/errors for the UI.
import { revalidatePath } from 'next/cache'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import type { ActionResult } from '@/lib/supabase/adminAuthActions'
import type { CategoryLocale, TranslationStatus } from './page'
import { translateOne } from '@/lib/server/googleTranslate'
import {
  type AiFillResult,
  translateErrorToAiFillFailure,
  validateSourceFields,
  validateTargetLocale,
} from '@/lib/server/aiFill'

async function getAdminUserId(supabase: Awaited<ReturnType<typeof getSupabaseAuthServerClient>>): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.rpc('get_my_admin_context')
  return (data?.admin_user_id as string | undefined) ?? null
}

export interface CreateCategoryInput {
  parentId: string | null
  nameKo: string
  sortOrder: number
}

// Design Ref: screen-spec §3.4 — source is always 'seepn_custom' here (this form is exactly
// the "표준에 없는 것을 추가" path), code is left null (나라장터 코드가 없는 신설 노드),
// exposed_to_fkp defaults false (explicit opt-in only, D-11). The category INSERT and the ko
// translation INSERT are two separate calls (no RPC wraps them atomically) — if the second
// fails, the first has already committed a nameless node. We surface the new id even on that
// partial failure so the caller can point the operator back at it to finish naming it, per the
// spec's documented recovery path.
export async function createCategoryAction(input: CreateCategoryInput): Promise<ActionResult<{ id: string }>> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const name = input.nameKo.trim()
  if (!name) return { success: false, error: 'name_required', errorCode: 'VALIDATION_ERROR' }

  const { data: created, error: createError } = await supabase
    .from('standard_category')
    .insert({
      parent_id: input.parentId,
      source: 'seepn_custom',
      code: null,
      sort_order: input.sortOrder,
      exposed_to_fkp: false,
    })
    .select('id')
    .single()

  if (createError || !created) {
    return { success: false, error: createError?.message ?? 'create_failed', errorCode: 'CREATE_FAILED' }
  }

  const adminUserId = await getAdminUserId(supabase)
  const { error: translationError } = await supabase.from('standard_category_translation').insert({
    category_id: created.id,
    locale: 'ko',
    name,
    status: 'draft',
    source_synced_at: new Date().toISOString(),
    updated_by: adminUserId,
  })

  if (translationError) {
    return {
      success: false,
      error: translationError.message,
      errorCode: 'TRANSLATION_FAILED',
      data: { id: created.id },
    }
  }

  revalidatePath('/admin/categories')
  return { success: true, data: { id: created.id } }
}

export interface UpdateCategoryStatusInput {
  id: string
  isActive: boolean
  exposedToFkp: boolean
  // Design Ref: screen-spec §3.6 E9 — populated by the caller (CategoryDetailPanel) only after
  // the operator confirms cascading a deactivation down a subtree. Applied as a second, separate
  // UPDATE (not atomic with the first — no RPC/transaction available here either); a partial
  // failure leaves some descendants active, which the tree rendering surfaces as an inconsistent
  // "parent inactive, child active" state rather than hiding it (spec's explicit recommendation).
  cascadeDeactivateIds?: string[]
}

export async function updateCategoryStatusAction(input: UpdateCategoryStatusInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase
    .from('standard_category')
    .update({ is_active: input.isActive, exposed_to_fkp: input.exposedToFkp })
    .eq('id', input.id)
  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  if (input.cascadeDeactivateIds && input.cascadeDeactivateIds.length > 0) {
    const { error: cascadeError } = await supabase
      .from('standard_category')
      .update({ is_active: false })
      .in('id', input.cascadeDeactivateIds)
    if (cascadeError) return { success: false, error: cascadeError.message, errorCode: 'CASCADE_FAILED' }
  }

  revalidatePath('/admin/categories')
  return { success: true }
}

// Design Ref: screen-spec §3.2 — "형제 두 행의 sort_order를 swap하는 일반 UPDATE 2건"
// (no move_menu-equivalent RPC exists; standard_category.sort_order has no unique constraint).
// Not atomic across the two UPDATE calls — accepted risk per the spec (two admins reordering the
// exact same sibling group within milliseconds is judged low-probability).
export async function moveCategoryAction(id: string, direction: 'up' | 'down'): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { data: current, error: currentError } = await supabase
    .from('standard_category')
    .select('id, parent_id, sort_order')
    .eq('id', id)
    .single()
  if (currentError || !current) {
    return { success: false, error: currentError?.message ?? 'not_found', errorCode: 'UPDATE_FAILED' }
  }

  let siblingQuery = supabase.from('standard_category').select('id, sort_order').order('sort_order')
  siblingQuery = current.parent_id ? siblingQuery.eq('parent_id', current.parent_id) : siblingQuery.is('parent_id', null)
  const { data: siblings, error: siblingsError } = await siblingQuery
  if (siblingsError || !siblings) {
    return { success: false, error: siblingsError?.message ?? 'siblings_lookup_failed', errorCode: 'UPDATE_FAILED' }
  }

  const index = siblings.findIndex((s) => s.id === id)
  const swapIndex = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || swapIndex < 0 || swapIndex >= siblings.length) {
    return { success: false, error: 'already_at_edge', errorCode: 'UPDATE_FAILED' }
  }
  const target = siblings[swapIndex]

  const { error: firstError } = await supabase.from('standard_category').update({ sort_order: target.sort_order }).eq('id', id)
  if (firstError) return { success: false, error: firstError.message, errorCode: 'UPDATE_FAILED' }

  const { error: secondError } = await supabase
    .from('standard_category')
    .update({ sort_order: siblings[index].sort_order })
    .eq('id', target.id)
  if (secondError) return { success: false, error: secondError.message, errorCode: 'UPDATE_FAILED' }

  revalidatePath('/admin/categories')
  return { success: true }
}

export interface UpsertStandardCategoryTranslationInput {
  categoryId: string
  locale: CategoryLocale
  name: string
  status: TranslationStatus
  // Gap G-1 closure (screen-spec §3.3/§7, 20260908100000_standard_category_translation_ai_guard.sql)
  // — optional so every existing call site (the normal Admin UI save button) keeps compiling and
  // behaving unmodified: omitted means the RPC auto-promotes ai -> ai_reviewed on save (§2.2),
  // exactly like upsert_content_translation/upsert_category_translation already do. Only the new
  // aiFillStandardCategoryTranslationAction (this file, below) passes 'ai' explicitly.
  translationSource?: 'human' | 'ai' | 'ai_reviewed'
}

// Design Ref: screen-spec §3.3 Gap G-1 — this used to be a direct `.upsert()` (see git history)
// that hand-replicated source_synced_at bookkeeping and had NEITHER an upsert RPC NOR a
// (translation_source='ai' AND status='published') guard, unlike content_translation /
// content_category_translation. 20260908100000_standard_category_translation_ai_guard.sql adds
// public.upsert_standard_category_translation (same permission check / bookkeeping / audit log /
// ai->ai_reviewed auto-promotion pattern as the other two RPCs) — this action now calls it instead
// of writing the table directly. NOTE: this migration has not been run yet (repo workflow — 대표가
// 콘솔에서 직접 실행); until it is, this action will fail with "could not find function" errors.
export async function upsertStandardCategoryTranslationAction(
  input: UpsertStandardCategoryTranslationInput,
): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const name = input.name.trim()
  if (!name) return { success: false, error: 'name_required', errorCode: 'VALIDATION_ERROR' }

  const { error } = await supabase.rpc('upsert_standard_category_translation', {
    p_category_id: input.categoryId,
    p_locale: input.locale,
    p_name: name,
    p_status: input.status,
    p_translation_source: input.translationSource ?? null,
  })
  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  revalidatePath('/admin/categories')
  return { success: true }
}

// =============================================================================
// AI 초벌 채우기 (screen-spec §3.3 표준 카테고리, §6 서버 액션 계약, Gap G-1)
// =============================================================================

const STANDARD_CATEGORY_SOURCE_LOCALE: CategoryLocale = 'ko'

export interface AiFillStandardCategoryTranslationInput {
  categoryId: string
  targetLocale: Exclude<CategoryLocale, 'ko'>
}

export interface AiFillStandardCategoryTranslationBody {
  name: string
}

// screen-spec §3.3 — "화면이 요구하는 동작은 다른 3개 화면과 동일해야 한다": status='draft' +
// translation_source='ai' 즉시 저장, ai+published 조합 거부, 저장 시 ai->ai_reviewed 자동 승격.
// 이 액션은 그 3가지를 20260908100000_standard_category_translation_ai_guard.sql이 신설한
// upsert_standard_category_translation RPC 호출 하나로 만족시킨다. 이 마이그레이션이 아직
// 실행되지 않았다면(대표가 콘솔에서 직접 실행하는 이 프로젝트의 기존 워크플로) 이 액션은
// RPC를 찾지 못해 SAVE_FAILED로 실패한다 — 이는 예상된 동작이다.
export async function aiFillStandardCategoryTranslationAction(
  input: AiFillStandardCategoryTranslationInput,
): Promise<AiFillResult<AiFillStandardCategoryTranslationBody>> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, errorCode: 'CONFIG_ERROR' }

  // (1) 인증/권한 재검증 — upsert_standard_category_translation RPC와 동일하게
  // 'standard_category_management'/'update' (NOT 'content_management' — 이 테이블의 실제 RLS
  // 권한 경계, 20260829150000 §1/§2).
  const { data: allowed } = await supabase.rpc('has_menu_permission_check', {
    p_menu_code: 'standard_category_management',
    p_action: 'update',
  })
  if (!allowed) return { success: false, errorCode: 'ACCESS_DENIED' }

  // qa-reviewer (blocking, 2026-09-08) — the TS type Exclude<CategoryLocale, 'ko'> on
  // targetLocale does NOT exist at runtime (compiles away), so it is not a real defense against
  // a caller invoking this Server Action directly with targetLocale: 'ko'. Explicit runtime
  // check against the actual source locale constant, matching the other 4 actions.
  const targetLocaleError = validateTargetLocale(input.targetLocale, STANDARD_CATEGORY_SOURCE_LOCALE)
  if (targetLocaleError) return targetLocaleError

  // (2) 원문 재조회 — 표준 카테고리의 소스 로케일은 'ko'(나라장터 표준, screen-spec §3.3).
  const { data: sourceRow, error: sourceError } = await supabase
    .from('standard_category_translation')
    .select('name')
    .eq('category_id', input.categoryId)
    .eq('locale', STANDARD_CATEGORY_SOURCE_LOCALE)
    .maybeSingle()
  if (sourceError) return { success: false, errorCode: 'SAVE_FAILED', message: sourceError.message }

  const sourceName = sourceRow?.name ?? ''

  // (3) trim 후 빈 값 EMPTY_SOURCE / 20,000자 초과 SOURCE_TOO_LONG.
  const validationError = validateSourceFields([{ field: 'name', value: sourceName }])
  if (validationError) return validationError

  // (5) Google Cloud Translation API 호출.
  const translated = await translateOne({
    text: sourceName,
    sourceLocale: STANDARD_CATEGORY_SOURCE_LOCALE,
    targetLocale: input.targetLocale,
  })
  if (!translated.ok) return translateErrorToAiFillFailure(translated)

  // (6) 성공 시 upsert RPC를 p_status='draft', p_translation_source='ai'로 호출.
  const { error: upsertError } = await supabase.rpc('upsert_standard_category_translation', {
    p_category_id: input.categoryId,
    p_locale: input.targetLocale,
    p_name: translated.translation,
    p_status: 'draft',
    p_translation_source: 'ai',
  })
  if (upsertError) return { success: false, errorCode: 'SAVE_FAILED', message: upsertError.message }

  revalidatePath('/admin/categories')

  // (7) 번역 결과 반환 — router.refresh()에 의존하지 않고 클라이언트가 이 값으로 로컬 state를
  // 직접 갱신해야 함(§6.4, frontend-developer 몫).
  return { success: true, body: { name: translated.translation }, status: 'draft', translationSource: 'ai' }
}

// Design Ref: screen-spec §3.5 — the UI pre-checks partner/child reference counts and disables
// the delete button before this is ever called, so this path is the "우회해도 서버가 최종
// 방어" fallback: private.protect_standard_category_referenced (20260829150000 §4) raises
// 'standard_category_referenced: ...' with errcode P0001 when referenced.
export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.from('standard_category').delete().eq('id', id)
  if (error) {
    const isReferenced = error.code === 'P0001' || error.message.includes('standard_category_referenced')
    return { success: false, error: error.message, errorCode: isReferenced ? 'REFERENCED' : 'DELETE_FAILED' }
  }

  revalidatePath('/admin/categories')
  return { success: true }
}
