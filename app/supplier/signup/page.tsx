'use client'

// Design Ref: docs/02-design/features/partner-supplier-app.screen-spec.md §3.2/§3.3 (SUP-02/
// SUP-03, single route/two client-side steps, screen-spec §3.4 request contract) +
// docs/02-design/features/partner-supplier-app.ui-spec.md §3.2 (step-progress bar) +
// docs/03-security/partner-supplier-app-ui-privacy-review.md §2.2 (UI-B7 — the 10 numbered
// requirements below map 1:1 to that section's table; each block is commented with its item
// number so a reviewer can check them off directly against the doc).
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthShell } from '@/components/supplier/AuthShell'
import { inputClass, primaryButtonClass, secondaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'
import { PARTNER_PRIVACY_CONSENT_VERSION, PARTNER_TERMS_CONSENT_VERSION } from '@/lib/legal/partnerConsentVersions'

const MIN_PASSWORD_LENGTH = 12

function StepProgress({ step }: { step: 1 | 2 }) {
  const label = step === 1 ? '1/2단계 · 약관 동의' : '2/2단계 · 계정 정보 입력'
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1.5">
        <span className="h-1 w-8 rounded-full bg-primary-600" />
        <span className={`h-1 w-8 rounded-full ${step === 2 ? 'bg-primary-600' : 'bg-neutral-200'}`} />
      </div>
      <span className="text-label-caption text-neutral-500">{label}</span>
    </div>
  )
}

export default function SupplierSignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)

  // --- Step 1: consent state ---
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeMarketing, setAgreeMarketing] = useState(false)
  const allRequiredAgreed = agreeTerms && agreePrivacy
  const allChecked = agreeTerms && agreePrivacy && agreeMarketing

  function toggleAll(next: boolean) {
    setAgreeTerms(next)
    setAgreePrivacy(next)
    setAgreeMarketing(next)
  }

  // --- Step 2: account fields ---
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)
    setSubmitError(null)

    const trimmedName = displayName.trim()
    if (trimmedName.length < 1 || trimmedName.length > 100) {
      setFieldError('회사명 또는 별칭을 1~100자로 입력해주세요.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldError('올바른 이메일 형식을 입력해주세요.')
      return
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFieldError(`비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`)
      return
    }
    if (password !== passwordConfirm) {
      setFieldError('비밀번호가 일치하지 않습니다.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/partner/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: trimmedName,
          email: email.trim(),
          password,
          honeypot,
          consents: [
            { consent_type: 'terms', granted: true, document_version: PARTNER_TERMS_CONSENT_VERSION, consent_locale: 'ko' },
            { consent_type: 'privacy', granted: true, document_version: PARTNER_PRIVACY_CONSENT_VERSION, consent_locale: 'ko' },
            ...(agreeMarketing ? [{ consent_type: 'marketing', granted: true, consent_locale: 'ko' }] : []),
          ],
        }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) {
        if (data.error === 'invalid_password') {
          setSubmitError('이 비밀번호는 이미 유출된 적이 있어 사용할 수 없습니다.')
        } else if (res.status === 429) {
          setSubmitError('잠시 후 다시 시도해주세요.')
        } else {
          setSubmitError('가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
        }
        return
      }
      router.push(`/supplier/signup/complete?email=${encodeURIComponent(email.trim())}`)
    } catch {
      setSubmitError('가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 1) {
    return (
      <AuthShell title="파트너 등록" progress={<StepProgress step={1} />}>
        <div className="flex flex-col gap-4">
          {/* UI-B7 item 2: 전체동의는 개별 항목과 같은 크기/굵기, 배경강조 없음 */}
          <label className="flex items-center gap-2 border-b border-neutral-200 pb-3 text-body-sm font-medium text-neutral-900">
            <input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} className="h-4 w-4" />
            전체 동의
          </label>
          {/* UI-B7 item 3 */}
          <p className="-mt-2 text-label-caption text-neutral-400">선택 항목(마케팅 정보 수신)도 함께 동의됩니다.</p>

          {/* UI-B7 item 1/5/6: [필수] 텍스트 표기 + 전문 링크(새 탭) + 고지사항 요약 + 거부 시 불이익 */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-body-sm text-neutral-800">
              <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="h-4 w-4" />
              <span>[필수] 파트너 이용약관 동의</span>
              <Link href="/supplier/legal/terms" target="_blank" className="ml-auto text-label-caption text-primary-600 hover:underline">
                전문 보기
              </Link>
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-body-sm text-neutral-800">
              <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} className="h-4 w-4" />
              <span>[필수] 개인정보 수집·이용 동의</span>
              <Link href="/supplier/legal/privacy" target="_blank" className="ml-auto text-label-caption text-primary-600 hover:underline">
                전문 보기
              </Link>
            </label>
            <p className="pl-6 text-label-caption text-neutral-400">
              수집 항목: 이메일, 비밀번호, 표시명, 회사 정보, 담당자 연락처 등 · 목적: 파트너 등록 및 매칭 서비스 제공 ·
              보유기간: 탈퇴 시까지. 동의를 거부하실 수 있으나, 거부 시 파트너 등록 및 서비스 이용이 제한됩니다.
            </p>
          </div>

          {/* UI-B7 item 4/7: 기본값 미체크, 전송수단/목적/불이익없음 명시 */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-body-sm text-neutral-800">
              <input type="checkbox" checked={agreeMarketing} onChange={(e) => setAgreeMarketing(e.target.checked)} className="h-4 w-4" />
              <span>[선택] 마케팅 정보 수신 동의</span>
            </label>
            <p className="pl-6 text-label-caption text-neutral-400">
              이메일로 SEEPN의 소식·매칭 안내를 보내드립니다. 동의하지 않으셔도 서비스 이용에 제한이 없습니다.
            </p>
          </div>

          <p className="text-label-caption text-neutral-400">만 14세 미만은 가입할 수 없습니다.</p>

          {/* UI-B7 item 9: 미체크 시 비활성화 + 사유 문구, 모달로 재차 조르지 않음 */}
          {!allRequiredAgreed && (
            <p className={errorTextClass}>이용약관과 개인정보 수집·이용에 동의해주세요.</p>
          )}

          {/* UI-B7 item 8: 거부 경로(로그인으로 돌아가기)를 숨기지 않음 */}
          <div className="flex items-center justify-between pt-2">
            <Link href="/supplier/login" className="text-body-sm text-neutral-500 hover:underline">
              취소
            </Link>
            <button
              type="button"
              disabled={!allRequiredAgreed}
              onClick={() => setStep(2)}
              className={primaryButtonClass}
            >
              다음
            </button>
          </div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="계정 정보 입력" progress={<StepProgress step={2} />}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="display_name" className="mb-1 block text-body-sm text-neutral-700">
            표시명
          </label>
          <input
            id="display_name"
            className={`${inputClass} w-full`}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={100}
            required
          />
          <p className="mt-1 text-label-caption text-neutral-400">
            회사명 또는 별칭 — 담당자 실명이 아닙니다. 다른 곳에 표시되지 않습니다.
          </p>
        </div>

        <div>
          <label htmlFor="signup_email" className="mb-1 block text-body-sm text-neutral-700">
            이메일
          </label>
          <input
            id="signup_email"
            type="email"
            autoComplete="username"
            className={`${inputClass} w-full`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="signup_password" className="mb-1 block text-body-sm text-neutral-700">
            비밀번호
          </label>
          <input
            id="signup_password"
            type="password"
            autoComplete="new-password"
            className={`${inputClass} w-full`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="mt-1 text-label-caption text-neutral-400">최소 {MIN_PASSWORD_LENGTH}자 이상 입력해주세요.</p>
        </div>

        <div>
          <label htmlFor="signup_password_confirm" className="mb-1 block text-body-sm text-neutral-700">
            비밀번호 확인
          </label>
          <input
            id="signup_password_confirm"
            type="password"
            autoComplete="new-password"
            className={`${inputClass} w-full`}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
          />
        </div>

        {/* Honeypot — admin login page's website_url pattern, screen-spec §3.3 */}
        <input
          type="text"
          name="website_url"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
        />

        {fieldError && <p className={errorTextClass}>{fieldError}</p>}
        {submitError && <p className={errorTextClass}>{submitError}</p>}

        <div className="flex items-center gap-3 pt-2">
          <button type="button" onClick={() => setStep(1)} className={secondaryButtonClass}>
            이전
          </button>
          <button type="submit" disabled={submitting} className={`${primaryButtonClass} flex-1`}>
            {submitting ? '가입 처리 중...' : '가입하기'}
          </button>
        </div>
      </form>
    </AuthShell>
  )
}
