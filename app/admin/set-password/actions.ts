'use server'

import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import type { ActionResult } from '@/lib/supabase/adminAuthActions'

export async function completeInviteAction(tokenHash: string, newPassword: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }

  const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'invite' })
  if (verifyError) {
    return { success: false, error: verifyError.message, errorCode: 'INVALID_INVITE' }
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
  if (updateError) {
    return { success: false, error: updateError.message, errorCode: 'PASSWORD_UPDATE_FAILED' }
  }

  await supabase.rpc('log_auth_event', { p_action: 'auth.password_changed' })

  return { success: true }
}
