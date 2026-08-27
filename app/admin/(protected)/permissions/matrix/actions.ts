'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import type { ActionResult } from '@/lib/supabase/adminAuthActions'

export type PermissionFlag = 'can_read' | 'can_create' | 'can_update' | 'can_delete' | 'can_export'

// Design Ref: supabase/migrations/20260825160000 public.set_role_menu_permission — upsert
// + audit insert atomic in one SECURITY DEFINER function (same pattern as
// update_lead_status/update_lead_assignee, and for the same reason: a raw table upsert
// from here would have no way to also write an audit_log row without a second,
// unauthenticated-from-here call to a private-schema function).
export async function setMenuPermissionAction(
  roleId: string,
  menuId: string,
  flag: PermissionFlag,
  value: boolean,
): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error } = await supabase.rpc('set_role_menu_permission', {
    p_role_id: roleId,
    p_menu_id: menuId,
    p_flag: flag,
    p_value: value,
  })

  if (error) return { success: false, error: error.message, errorCode: 'UPDATE_FAILED' }

  revalidatePath('/admin/permissions/matrix')
  return { success: true }
}
