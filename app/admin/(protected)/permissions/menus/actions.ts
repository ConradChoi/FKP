'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import type { ActionResult } from '@/lib/supabase/adminAuthActions'

export interface CreateMenuInput {
  code: string
  displayName: string
  parentId: string | null
  path: string | null
  menuType: 'group' | 'page'
  sortOrder: number
}

export async function createMenuAction(input: CreateMenuInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  if (!/^[a-z][a-z0-9_]{1,49}$/.test(input.code)) {
    return { success: false, error: 'invalid_code', errorCode: 'VALIDATION_ERROR' }
  }

  const { error } = await supabase.from('menu').insert({
    code: input.code,
    display_name: input.displayName,
    parent_id: input.parentId,
    path: input.path || null,
    menu_type: input.menuType,
    sort_order: input.sortOrder,
  })
  if (error) return { success: false, error: error.message, errorCode: 'CREATE_FAILED' }

  await supabase.rpc('log_audit', { p_action: 'menu.create', p_target_table: 'menu', p_target_id: input.code })
  revalidatePath('/admin/permissions/menus')
  return { success: true }
}

export interface UpdateMenuInput {
  id: string
  displayName: string
  path: string | null
  sortOrder: number
  isActive: boolean
}

export async function updateMenuAction(input: UpdateMenuInput): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase
    .from('menu')
    .update({
      display_name: input.displayName,
      path: input.path || null,
      sort_order: input.sortOrder,
      is_active: input.isActive,
    })
    .eq('id', input.id)
  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  await supabase.rpc('log_audit', { p_action: 'menu.update', p_target_table: 'menu', p_target_id: input.id })
  revalidatePath('/admin/permissions/menus')
  return { success: true }
}

export async function deleteMenuAction(id: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.from('menu').delete().eq('id', id)
  if (error) return { success: false, error: error.message, errorCode: 'DELETE_FAILED' }

  await supabase.rpc('log_audit', { p_action: 'menu.delete', p_target_table: 'menu', p_target_id: id })
  revalidatePath('/admin/permissions/menus')
  return { success: true }
}
