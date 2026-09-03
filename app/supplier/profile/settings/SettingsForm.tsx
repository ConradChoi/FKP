'use client'

// Design Ref: screen-spec §4.6/§4.7 (SUP-13/SUP-14) as corrected by
// docs/03-security/partner-supplier-app-backend-implementation-notes.md §1 (UI-B3 call order —
// "반드시 ① 먼저" for both ON and OFF) + docs/03-security/partner-supplier-app-ui-privacy-review.md
// §1.2 (UI-B2 — get_own_partner_consents, 3-state toggle removed per UI-R12) + §1.3/§1.4
// (UI-B3 disabled conditions + disclosure block) + §7.2 (UI-B9 — reauth before password change).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupplierBrowserClient } from '@/lib/supabase/supplierBrowserClient'
import { inputClass, destructiveButtonClass, errorTextClass } from '@/components/RequestForm/styles'
import { PARTNER_MARKETING_CONSENT_VERSION, PARTNER_PRIVACY_CONSENT_VERSION } from '@/lib/legal/partnerConsentVersions'
import { PUBLIC_LISTING_EXPOSED_FIELDS, PUBLIC_LISTING_HIDDEN_FIELDS } from '@/lib/supplier/publicListingDisclosure'
import { ToggleSwitch } from '@/components/supplier/ToggleSwitch'
import { ConfirmActionModal } from '@/components/supplier/ConfirmActionModal'
import type { ConsentsByType } from '@/lib/supplier/types'

const MIN_PASSWORD_LENGTH = 12

export function SettingsForm({
  partnerId,
  verificationState,
  publicListingState,
  businessEntityType,
  hasBizCertDocument,
  consents,
}: {
  partnerId: string
  verificationState: string
  publicListingState: 'off' | 'on' | 'suspended'
  businessEntityType: 'corporation' | 'sole_proprietor' | null
  hasBizCertDocument: boolean
  consents: ConsentsByType
}) {
  const router = useRouter()

  // --- Public listing ---
  const [listingOn, setListingOn] = useState(publicListingState === 'on')
  const [listingSaving, setListingSaving] = useState(false)
  const [listingMessage, setListingMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const listingDisabled =
    listingSaving || publicListingState === 'suspended' || verificationState !== 'verified' || !hasBizCertDocument

  async function handleListingToggle(next: boolean) {
    setListingSaving(true)
    setListingMessage(null)
    const supabase = getSupplierBrowserClient()

    if (next) {
      const { error: consentError } = await supabase.rpc('partner_grant_consent', {
        p_consent_type: 'public_listing',
        p_granted: true,
        p_document_version: PARTNER_PRIVACY_CONSENT_VERSION,
        p_consent_locale: 'ko',
      })
      if (consentError) {
        setListingSaving(false)
        setListingMessage({ tone: 'error', text: '동의 저장에 실패했습니다. 다시 시도해주세요.' })
        return
      }
      const { error: listingError } = await supabase.rpc('partner_set_public_listing', {
        p_partner_id: partnerId,
        p_on: true,
      })
      setListingSaving(false)
      if (listingError) {
        setListingOn(false)
        if (listingError.message?.includes('not_verified')) {
          setListingMessage({
            tone: 'info',
            text: '동의가 저장되었습니다. 검증이 완료되면 자동으로 노출되지 않으니, 검증 완료 후 이 토글을 다시 켜주세요.',
          })
        } else if (listingError.message?.includes('business_registration_cert_missing')) {
          setListingMessage({ tone: 'info', text: '사업자등록증을 먼저 첨부해주세요.' })
        } else {
          setListingMessage({ tone: 'error', text: '공개 설정에 실패했습니다. 다시 시도해주세요.' })
        }
        return
      }
      setListingOn(true)
      return
    }

    // OFF: partner_set_public_listing FIRST (backend notes §1 corrected order).
    const { error: offError } = await supabase.rpc('partner_set_public_listing', {
      p_partner_id: partnerId,
      p_on: false,
    })
    if (offError) {
      setListingSaving(false)
      setListingMessage({ tone: 'error', text: '공개 중단에 실패했습니다. 다시 시도해주세요.' })
      return
    }
    setListingOn(false)
    const { error: revokeError } = await supabase.rpc('partner_grant_consent', {
      p_consent_type: 'public_listing',
      p_granted: false,
    })
    setListingSaving(false)
    if (revokeError) {
      setListingMessage({ tone: 'error', text: '공개는 중단되었지만 동의 철회 기록에 실패했습니다. 다시 시도해주세요.' })
    }
  }

  // --- Marketing consent (UI-B2: plain 2-value toggle, current value known via
  // get_own_partner_consents) ---
  const [marketingOn, setMarketingOn] = useState(consents.marketing?.granted ?? false)
  const [marketingSaving, setMarketingSaving] = useState(false)
  const [marketingCollectedAt] = useState(consents.marketing?.collected_at ?? null)
  const [marketingError, setMarketingError] = useState<string | null>(null)

  async function handleMarketingToggle(next: boolean) {
    setMarketingSaving(true)
    setMarketingError(null)
    const supabase = getSupplierBrowserClient()
    const { error } = await supabase.rpc('partner_grant_consent', {
      p_consent_type: 'marketing',
      p_granted: next,
      p_document_version: PARTNER_MARKETING_CONSENT_VERSION,
      p_consent_locale: 'ko',
    })
    setMarketingSaving(false)
    if (error) {
      setMarketingError('저장에 실패했습니다. 다시 시도해주세요.')
      return
    }
    setMarketingOn(next)
  }

  // --- Password change (UI-B9: reauth with current password first) ---
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [pwState, setPwState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [pwError, setPwError] = useState<string | null>(null)

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwError(null)
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPwError(`새 비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`)
      return
    }
    if (newPassword !== newPasswordConfirm) {
      setPwError('새 비밀번호가 일치하지 않습니다.')
      return
    }
    setPwState('saving')
    const supabase = getSupplierBrowserClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.email) {
      setPwState('error')
      setPwError('세션 정보를 확인할 수 없습니다. 다시 로그인해주세요.')
      return
    }
    // UI-B9 ①: reauth with current password before allowing the change.
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
    if (reauthError) {
      setPwState('error')
      setPwError('현재 비밀번호가 올바르지 않습니다.')
      return
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      setPwState('error')
      setPwError(
        updateError.message.toLowerCase().includes('leaked') || updateError.message.toLowerCase().includes('breach')
          ? '이 비밀번호는 이미 유출된 적이 있어 사용할 수 없습니다.'
          : '비밀번호 변경에 실패했습니다.',
      )
      return
    }
    setPwState('saved')
    setCurrentPassword('')
    setNewPassword('')
    setNewPasswordConfirm('')
  }

  // --- Withdraw (SUP-14) ---
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)

  async function handleWithdraw() {
    setWithdrawing(true)
    setWithdrawError(null)
    try {
      const res = await fetch('/api/partner/withdraw', { method: 'POST' })
      const data = (await res.json()) as { success?: boolean }
      if (!res.ok || !data.success) throw new Error('withdraw_failed')
      const supabase = getSupplierBrowserClient()
      await supabase.auth.signOut().catch(() => {})
      router.push('/supplier/login')
      router.refresh()
    } catch {
      setWithdrawing(false)
      setWithdrawError('탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. 공개 노출 */}
      <section className="border-b border-neutral-200 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-body-sm font-medium text-neutral-900">SEEPN에 프로필 공개</p>
          </div>
          <ToggleSwitch checked={listingOn} disabled={listingDisabled} onChange={handleListingToggle} label="SEEPN에 프로필 공개" />
        </div>

        {publicListingState === 'suspended' ? (
          <p className="mt-1 text-label-caption text-neutral-500">운영자에 의해 공개가 중단되었습니다. 사유는 고객센터로 문의해주세요.</p>
        ) : verificationState !== 'verified' ? (
          <p className="mt-1 text-label-caption text-neutral-500">검증이 완료되면 공개 노출을 설정할 수 있습니다.</p>
        ) : !hasBizCertDocument ? (
          <p className="mt-1 text-label-caption text-neutral-500">사업자등록증을 첨부하면 공개 노출을 설정할 수 있습니다.</p>
        ) : listingOn ? (
          <p className="mt-1 text-label-caption text-success">현재 공개 중입니다</p>
        ) : null}

        {listingMessage && (
          <p className={`mt-2 rounded-input px-3 py-2 text-body-sm ${listingMessage.tone === 'error' ? 'text-error' : 'bg-primary-50 text-primary-700'}`}>
            {listingMessage.text}
          </p>
        )}

        {/* UI-B3 §1.4 disclosure block */}
        <div className="mt-3 rounded-input bg-neutral-50 p-3 text-label-caption text-neutral-500">
          <p>공개되는 정보: {PUBLIC_LISTING_EXPOSED_FIELDS}</p>
          <p className="mt-1">공개되지 않는 정보: {PUBLIC_LISTING_HIDDEN_FIELDS}</p>
          <p className="mt-1">공개 대상: SEEPN 웹사이트를 방문하는 누구나(로그인 불필요)</p>
          <p className="mt-1">목적: 해외 바이어가 귀사를 찾을 수 있도록 하기 위함</p>
          <p className="mt-1">기간: 이 설정을 끄거나 탈퇴하실 때까지</p>
          <p className="mt-1">동의하지 않으셔도 파트너 등록과 운영자 매칭 이용에는 아무런 제한이 없습니다. 언제든 이 토글을 꺼서 공개를 중단하고 동의를 철회할 수 있습니다.</p>
          {businessEntityType === 'sole_proprietor' && (
            <p className="mt-1 text-accent-700">
              개인사업자는 상호·소재지가 대표자 개인을 식별할 수 있는 정보에 해당할 수 있습니다. 공개 여부를 신중히 결정해주세요.
            </p>
          )}
        </div>
      </section>

      {/* 2. 마케팅 수신 동의 */}
      <section className="border-b border-neutral-200 pb-6">
        <div className="flex items-center justify-between">
          <p className="text-body-sm font-medium text-neutral-900">마케팅 정보 수신 동의</p>
          <ToggleSwitch checked={marketingOn} disabled={marketingSaving} onChange={handleMarketingToggle} label="마케팅 정보 수신 동의" />
        </div>
        {marketingCollectedAt && (
          <p className="mt-1 text-label-caption text-neutral-400">동의일: {new Date(marketingCollectedAt).toISOString().slice(0, 10)}</p>
        )}
        {marketingError && <p className={`mt-1 ${errorTextClass}`}>{marketingError}</p>}
      </section>

      {/* 3. 비밀번호 변경 */}
      <section className="border-b border-neutral-200 pb-6">
        <p className="text-body-sm font-medium text-neutral-900">비밀번호 변경</p>
        <form onSubmit={handlePasswordChange} className="mt-3 flex flex-col gap-3 sm:max-w-sm">
          <div>
            <label className="mb-1 block text-body-sm text-neutral-700">현재 비밀번호</label>
            <input
              type="password"
              autoComplete="current-password"
              className={`${inputClass} w-full`}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-body-sm text-neutral-700">새 비밀번호</label>
            <input
              type="password"
              autoComplete="new-password"
              className={`${inputClass} w-full`}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <p className="mt-1 text-label-caption text-neutral-400">최소 {MIN_PASSWORD_LENGTH}자 이상 입력해주세요.</p>
          </div>
          <div>
            <label className="mb-1 block text-body-sm text-neutral-700">새 비밀번호 확인</label>
            <input
              type="password"
              autoComplete="new-password"
              className={`${inputClass} w-full`}
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              required
            />
          </div>
          {pwError && <p className={errorTextClass}>{pwError}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={pwState === 'saving'} className="rounded-input border border-neutral-300 px-6 py-3 text-label-button text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50">
              {pwState === 'saving' ? '변경 중...' : '비밀번호 변경'}
            </button>
            {pwState === 'saved' && <span className="text-label-caption text-success">변경되었습니다</span>}
          </div>
        </form>
      </section>

      {/* 4. 탈퇴 */}
      <section>
        <p className="text-body-sm font-medium text-neutral-900">계정 탈퇴</p>
        <button type="button" onClick={() => setWithdrawModalOpen(true)} className={`${destructiveButtonClass} mt-3`}>
          탈퇴하기
        </button>
      </section>

      <ConfirmActionModal
        open={withdrawModalOpen}
        title="정말 탈퇴하시겠습니까?"
        confirmLabel="탈퇴하기"
        confirmButtonClassName={destructiveButtonClass}
        loading={withdrawing}
        loadingLabel="처리 중..."
        error={withdrawError}
        onConfirm={handleWithdraw}
        onCancel={() => setWithdrawModalOpen(false)}
      >
        {/* Design Ref: privacy review §5.3 확정 모달 문구 — the "첨부하신 증빙 문서가
            삭제됩니다" line is DELIBERATELY OMITTED per backend-implementation-notes.md §4:
            "파기 워커가 실제로 배포되어 동작을 확인한 뒤에만 화면에 추가할 것" (ceo-decisions.md
            §4 조건 2) — that worker's Amplify/GitHub Actions secrets have not been confirmed
            configured in this task, so it is treated as "not yet deployed". Add that line back
            once deployment is verified. */}
        <ul className="flex flex-col gap-1.5 text-body-sm text-neutral-700">
          <li>· 로그인 계정(이메일·비밀번호)이 즉시 삭제되며 복구할 수 없습니다.</li>
          <li>· SEEPN 공개 노출이 즉시 중단됩니다.</li>
          <li>· 담당자 연락처가 즉시 삭제됩니다.</li>
          {businessEntityType === 'sole_proprietor' && <li>· 회사 정보(상호·사업자등록번호·소재지)가 삭제됩니다.</li>}
          {businessEntityType === 'corporation' && <li>· 회사 단위 정보와 매칭 이력은 통계 목적으로 남을 수 있습니다.</li>}
          <li>· 동의 기록(동의 시각·항목·버전)은 법령상 입증을 위해 별도로 보관되며, 접속 기록은 관련 법령에 따라 최대 2년간 보관됩니다.</li>
          <li>· 탈퇴 후 같은 이메일로 다시 가입하실 수 있습니다.</li>
        </ul>
      </ConfirmActionModal>
    </div>
  )
}
