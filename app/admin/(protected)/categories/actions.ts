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
}

// Design Ref: 20260827100000's upsert_category_translation RPC (content_category_translation
// pattern) stamps source_synced_at = now() when saving the source locale, else = the source
// row's current updated_at (so computeTranslationBadge, lib/admin/translationStatus.ts, can
// tell a translation is stale vs current). standard_category has NO such RPC, so this action
// replicates that bookkeeping by hand. Unlike content_category (source locale 'en'),
// standard_category's source locale is 'ko' — 나라장터 표준이 한글 원본이므로(screen-spec §3.3).
export async function upsertStandardCategoryTranslationAction(
  input: UpsertStandardCategoryTranslationInput,
): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const name = input.name.trim()
  if (!name) return { success: false, error: 'name_required', errorCode: 'VALIDATION_ERROR' }

  let sourceSyncedAt = new Date().toISOString()
  if (input.locale !== 'ko') {
    const { data: sourceRow } = await supabase
      .from('standard_category_translation')
      .select('updated_at')
      .eq('category_id', input.categoryId)
      .eq('locale', 'ko')
      .maybeSingle()
    sourceSyncedAt = sourceRow?.updated_at ?? sourceSyncedAt
  }

  const adminUserId = await getAdminUserId(supabase)
  const { error } = await supabase.from('standard_category_translation').upsert(
    {
      category_id: input.categoryId,
      locale: input.locale,
      name,
      status: input.status,
      source_synced_at: sourceSyncedAt,
      updated_by: adminUserId,
    },
    { onConflict: 'category_id,locale' },
  )
  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  revalidatePath('/admin/categories')
  return { success: true }
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
