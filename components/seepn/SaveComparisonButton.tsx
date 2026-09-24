'use client'

// 비교 화면의 "이 비교 저장" — 사용자가 직접 누를 때만 저장한다(자동 이력 아님). 서버(RPC
// buyer_save_comparison)가 조합 크기·공개 상태·중복·계정당 20개 한도를 검증한다.
import Link from 'next/link'
import { useState } from 'react'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'

export function SaveComparisonButton({ partnerIds }: { partnerIds: string[] }) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'already'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setState('saving')
    setError(null)
    const { data, error: rpcError } = await getBuyerBrowserClient().rpc('buyer_save_comparison', { p_partner_ids: partnerIds })
    if (rpcError) {
      setState('idle')
      const msg = rpcError.message
      setError(
        msg.includes('limit_reached')
          ? '저장은 최대 20개까지 가능합니다. 마이페이지에서 기존 비교를 삭제한 뒤 다시 시도해주세요.'
          : msg.includes('invalid_partner_count')
            ? '2~5곳을 비교할 때 저장할 수 있습니다.'
            : msg.includes('partner_not_available')
              ? '현재 공개되지 않은 공급사가 포함되어 저장할 수 없습니다.'
              : '저장하지 못했습니다. 잠시 후 다시 시도해주세요.',
      )
      return
    }
    const already = Array.isArray(data) ? Boolean(data[0]?.already_saved) : false
    setState(already ? 'already' : 'saved')
  }

  const done = state === 'saved' || state === 'already'
  return (
    <div className="text-right">
      <button
        type="button"
        onClick={save}
        disabled={state === 'saving' || done}
        className="rounded-input border border-primary-600 px-4 py-2 text-body-sm font-semibold text-primary-600 hover:bg-primary-50 disabled:opacity-60"
      >
        {state === 'saving' ? '저장 중...' : done ? '저장됨' : '이 비교 저장'}
      </button>
      {!done && (
        <p className="mt-1 max-w-xs text-label-caption text-neutral-400">
          비교한 공급사 목록과 저장 일시가 마이페이지에 저장됩니다. 직접 삭제하거나 탈퇴하면 즉시 삭제되며, 공급사에는 공개되지 않습니다.
        </p>
      )}
      {done && (
        <p role="status" className="mt-1 text-label-caption text-neutral-500">
          {state === 'already' ? '이미 저장된 비교입니다. ' : ''}
          <Link href="/seepn/my/compared" className="text-primary-600 hover:underline">
            마이페이지에서 보기 →
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-label-caption text-error">
          {error}
        </p>
      )}
    </div>
  )
}
