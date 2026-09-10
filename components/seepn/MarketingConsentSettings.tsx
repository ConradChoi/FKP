'use client'

// Design Ref: docs/02-design/features/seepn-buyer-marketing-consent-settings.screen-spec.md
// §3 (화면 정의서), §4 (비관적 갱신 + saving 중 disabled), §5 (엣지케이스: access_denied는
// 세션만료/탈퇴 계정 구분 없이 동일 문구 + 로그인 유도, 네트워크 예외는 별도 문구), §7 (문구안).
// Mirrors app/supplier/profile/settings/SettingsForm.tsx's handleMarketingToggle structure
// (same pessimistic-update / saving-disabled / try-catch-around-network shape), scaled down to
// this screen's single toggle and the buyer-domain RPC (`buyer_grant_consent`).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getBuyerBrowserClient } from '@/lib/supabase/buyerBrowserClient'
import { errorTextClass } from '@/components/RequestForm/styles'
import { SEEPN_BUYER_MARKETING_CONSENT_VERSION } from '@/lib/legal/buyerConsentVersions'
import { ToggleSwitch } from '@/components/supplier/ToggleSwitch'
import type { BuyerConsentsByType } from '@/lib/seepn/types'

interface ConsentState {
  granted: boolean
  collectedAt: string | null
  hasHistory: boolean
}

function parseConsents(consents: BuyerConsentsByType | null): ConsentState | null {
  if (!consents) return null
  const record = consents.marketing
  if (!record) return { granted: false, collectedAt: null, hasHistory: false }
  return { granted: record.granted, collectedAt: record.collected_at, hasHistory: true }
}

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

// access_denied is thrown for both "인증 안 됨"과 "탈퇴 계정" — screen-spec §5 explicitly says
// the frontend does not need to (and cannot) tell these apart, so both map to the same copy.
function isAccessDenied(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '42501' || Boolean(error.message?.includes('access_denied'))
}

export function MarketingConsentSettings({
  initialConsents,
  initialLoadFailed,
}: {
  initialConsents: BuyerConsentsByType | null
  initialLoadFailed: boolean
}) {
  const [loadFailed, setLoadFailed] = useState(initialLoadFailed)
  const [consentState, setConsentState] = useState<ConsentState | null>(() => parseConsents(initialConsents))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string; showLoginLink?: boolean } | null>(null)

  // Re-sync when the server component re-runs (e.g. after the user clicks "다시 불러오기",
  // which calls router.refresh()) — the client component instance is reused, so its state
  // wouldn't otherwise pick up the fresh server-fetched props.
  useEffect(() => {
    setLoadFailed(initialLoadFailed)
    setConsentState(parseConsents(initialConsents))
  }, [initialLoadFailed, initialConsents])

  async function handleRetryLoad() {
    setSaving(false)
    setMessage(null)
    window.location.reload()
  }

  async function handleToggle(next: boolean) {
    setSaving(true)
    setMessage(null)

    let result: { error: { code?: string; message?: string } | null }
    try {
      const supabase = getBuyerBrowserClient()
      result = await supabase.rpc('buyer_grant_consent', {
        p_consent_type: 'marketing',
        p_granted: next,
        p_document_version: SEEPN_BUYER_MARKETING_CONSENT_VERSION,
        p_consent_locale: 'ko',
      })
    } catch {
      setSaving(false)
      setMessage({ tone: 'error', text: '네트워크 오류로 저장하지 못했습니다. 다시 시도해주세요.' })
      return
    }

    if (result.error) {
      setSaving(false)
      if (isAccessDenied(result.error)) {
        setMessage({
          tone: 'error',
          text: '로그인이 만료되었거나 계정 상태가 변경되었습니다. 다시 로그인한 뒤 시도해주세요.',
          showLoginLink: true,
        })
      } else {
        setMessage({ tone: 'error', text: '저장에 실패했습니다. 다시 시도해주세요.' })
      }
      return
    }

    // Success — re-fetch so the collected_at caption reflects the server's actual timestamp
    // rather than an optimistic client-side `new Date()` guess (screen-spec §4).
    const supabase = getBuyerBrowserClient()
    const { data: refreshed, error: refetchError } = await supabase.rpc('get_own_buyer_consents')
    setSaving(false)
    setConsentState(refetchError ? { granted: next, collectedAt: null, hasHistory: true } : parseConsents((refreshed ?? {}) as BuyerConsentsByType))
    setMessage({ tone: 'success', text: '저장되었습니다' })
  }

  if (loadFailed) {
    return (
      <section className="border-b border-neutral-200 pb-6">
        <div className="rounded-input bg-error-100 px-3 py-2 text-body-sm text-error">
          동의 상태를 불러오지 못했습니다. 새로고침해 주세요.
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-body-sm font-medium text-neutral-900">마케팅 정보 수신 동의</p>
          <ToggleSwitch checked={false} disabled onChange={() => {}} label="마케팅 정보 수신 동의" />
        </div>

        <button
          type="button"
          onClick={handleRetryLoad}
          className="mt-3 text-body-sm text-primary-600 hover:underline"
        >
          다시 불러오기
        </button>
      </section>
    )
  }

  const granted = consentState?.granted ?? false

  return (
    <section className="border-b border-neutral-200 pb-6">
      <div className="flex items-center justify-between">
        <p className="text-body-sm font-medium text-neutral-900">마케팅 정보 수신 동의</p>
        <div className="flex items-center gap-2">
          {saving && <span className="text-label-caption text-neutral-400">저장 중...</span>}
          <ToggleSwitch checked={granted} disabled={saving} onChange={handleToggle} label="마케팅 정보 수신 동의" />
        </div>
      </div>

      <p className="mt-2 text-label-caption text-neutral-500">
        SEEPN의 새로운 소식, 이벤트, 혜택 정보를 이메일 등으로 받아보실 수 있습니다. 언제든 여기서 껐다 켤 수 있습니다.
      </p>

      {consentState?.hasHistory && consentState.collectedAt ? (
        <p className="mt-1 text-label-caption text-neutral-400">
          {consentState.granted ? '동의일' : '철회일'}: {formatDate(consentState.collectedAt)}
        </p>
      ) : consentState?.hasHistory ? (
        <p className="mt-1 text-label-caption text-neutral-400">저장되었습니다. 날짜는 새로고침 후 표시됩니다.</p>
      ) : (
        <p className="mt-1 text-label-caption text-neutral-400">아직 동의/철회 이력이 없습니다.</p>
      )}

      {message && (
        <div className={`mt-2 ${message.tone === 'error' ? errorTextClass : 'text-label-caption text-success'}`}>
          <p>{message.text}</p>
          {message.showLoginLink && (
            <Link href="/seepn/login" className="mt-1 inline-block text-body-sm text-primary-600 hover:underline">
              로그인 페이지로 이동
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
