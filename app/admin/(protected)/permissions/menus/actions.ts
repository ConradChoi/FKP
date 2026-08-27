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

  const { error } = await supabase.rpc('create_menu', {
    p_code: input.code,
    p_display_name: input.displayName,
    p_parent_id: input.parentId,
    p_path: input.path || null,
    p_menu_type: input.menuType,
    p_sort_order: input.sortOrder,
  })
  if (error) return { success: false, error: error.message, errorCode: 'CREATE_FAILED' }

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

  const { error } = await supabase.rpc('update_menu', {
    p_id: input.id,
    p_display_name: input.displayName,
    p_path: input.path || null,
    p_sort_order: input.sortOrder,
    p_is_active: input.isActive,
  })
  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  revalidatePath('/admin/permissions/menus')
  return { success: true }
}

export async function deleteMenuAction(id: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('delete_menu', { p_id: id })
  if (error) return { success: false, error: error.message, errorCode: 'DELETE_FAILED' }

  revalidatePath('/admin/permissions/menus')
  return { success: true }
}
