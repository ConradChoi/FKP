'use server'

// SEEPN 커뮤니티 운영 서버 액션 (2026-09-26). 권한(admin + AAL2 + content_management)과 숨김 이력
// (community_moderation_log)은 RPC가 처리한다.
import { revalidatePath } from 'next/cache'
import { getSupabaseAuthServerClient } from '@/lib/supabase/serverAuthClient'
import type { ActionResult } from '@/lib/supabase/adminAuthActions'

export type CommunityTargetType = 'post' | 'comment'

export interface AdminCommunityComment {
  id: string
  parent_id: string | null
  body: string
  nickname: string | null
  status: 'published' | 'hidden'
  created_at: string
}

export async function setCommunityHiddenAction(targetType: CommunityTargetType, targetId: string, hidden: boolean, reason: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }
  const { error } = await supabase.rpc('admin_set_community_hidden', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_hidden: hidden,
    p_reason: reason.trim() || null,
  })
  if (error) return { success: false, error: error.message, errorCode: 'COMMUNITY_MODERATION_FAILED' }
  revalidatePath('/admin/community')
  return { success: true }
}

export async function resolveCommunityReportsAction(targetType: CommunityTargetType, targetId: string): Promise<ActionResult> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, error: 'service_unavailable', errorCode: 'CONFIG_ERROR' }
  const { error } = await supabase.rpc('admin_resolve_community_reports', { p_target_type: targetType, p_target_id: targetId })
  if (error) return { success: false, error: error.message, errorCode: 'COMMUNITY_MODERATION_FAILED' }
  revalidatePath('/admin/community')
  return { success: true }
}

export async function listCommunityCommentsAction(postId: string): Promise<{ success: boolean; comments: AdminCommunityComment[] }> {
  const supabase = await getSupabaseAuthServerClient()
  if (!supabase) return { success: false, comments: [] }
  const { data, error } = await supabase.rpc('admin_list_community_comments', { p_post_id: postId })
  if (error) return { success: false, comments: [] }
  return { success: true, comments: (data ?? []) as AdminCommunityComment[] }
}
