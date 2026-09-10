'use client'

// Design Ref: app/supplier/signup/page.tsx (SUP-02/03, mirrored per screen-spec §3.2/§3.3
// BY-02/03 — "SUP-02와 동일 구조", "SUP-03과 동일 구조") + PRD D-14③ (ko 단일 로케일) +
// lib/legal/buyerConsentVersions.ts's SEEPN_BUYER_SIGNUP_ENABLED gate (currently false — the ko
// legal docs do not exist yet). Differences from the partner flow, called out inline:
//   - No phone/company/title fields (screen-spec §3.3, privacy review §5.1 BP-5 최소수집).
//   - POST /api/seepn/signup instead of /api/partner/signup.
//   - SEEPN_BUYER_SIGNUP_ENABLED banner: this screen renders fully (DoD requires the screen to
//     exist) but the submit button is disabled and a "준비 중" notice is shown while the flag is
//     false, matching the task instruction "가입 화면 자체는 만들어도 되고, 이 라우트가 503을
//     반환하면 그에 맞는 에러 처리를 하면 됩니다" — this is the defense-in-depth half of that;
//     the reactive half (handling an actual 503 response) is in handleSubmit below.
import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthShell } from '@/components/seepn/AuthShell'
import { inputClass, primaryButtonClass, secondaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'
import {
  SEEPN_BUYER_SIGNUP_ENABLED,
  SEEPN_BUYER_PRIVACY_CONSENT_VERSION,
  SEEPN_BUYER_TERMS_CONSENT_VERSION,
} from '@/lib/legal/buyerConsentVersions'

const MIN_PASSWORD_LENGTH = 12

function StepProgress({ step }: { step: 1 | 2 }) {
  const stepLabel = step === 1 ? '1/2단계 · 약관 동의' : '2/2단계 · 계정 정보 입력'
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1.5">
        <span className="h-1 w-8 rounded-full bg-primary-600" />
        <span className={`h-1 w-8 rounded-full ${step === 2 ? 'bg-primary-600' : 'bg-neutral-200'}`} />
      </div>
      <span className="text-label-caption text-neutral-500">{stepLabel}</span>
    </div>
  )
}

function SignupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect')
  const [step, setStep] = useState<1 | 2>(1)

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
      setFieldError('이름 또는 회사명을 1~100자로 입력해주세요.')
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
      const res = await fetch('/api/seepn/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: trimmedName,
          email: email.trim(),
          password,
          honeypot,
          consents: [
            { consent_type: 'terms', granted: true, document_version: SEEPN_BUYER_TERMS_CONSENT_VERSION, consent_locale: 'ko' },
            { consent_type: 'privacy', granted: true, document_version: SEEPN_BUYER_PRIVACY_CONSENT_VERSION, consent_locale: 'ko' },
            ...(agreeMarketing ? [{ consent_type: 'marketing' as const, granted: true, consent_locale: 'ko' }] : []),
          ],
        }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) {
        if (res.status === 503 && data.error === 'legal_documents_not_ready') {
          setSubmitError('현재 SEEPN 회원가입은 준비 중입니다. 잠시 후 다시 시도해주세요.')
        } else if (data.error === 'invalid_password') {
          setSubmitError('이 비밀번호는 이미 유출된 적이 있어 사용할 수 없습니다.')
        } else if (res.status === 429) {
          setSubmitError('잠시 후 다시 시도해주세요.')
        } else {
          setSubmitError('가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
        }
        return
      }
      const params = new URLSearchParams({ email: email.trim() })
      if (redirectTo) params.set('redirect', redirectTo)
      router.push(`/seepn/signup/complete?${params.toString()}`)
    } catch {
      setSubmitError('가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  const notReadyBanner = !SEEPN_BUYER_SIGNUP_ENABLED && (
    <p className="rounded-input bg-accent-50 px-3 py-2 text-label-caption text-accent-700">
      현재 SEEPN 회원가입은 준비 중입니다.
    </p>
  )

  if (step === 1) {
    return (
      <AuthShell title="SEEPN 가입" progress={<StepProgress step={1} />}>
        <div className="flex flex-col gap-4">
          {notReadyBanner}
          <label className="flex items-center gap-2 border-b border-neutral-200 pb-3 text-body-sm font-medium text-neutral-900">
            <input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} className="h-4 w-4" />
            전체 동의
          </label>
          <p className="-mt-2 text-label-caption text-neutral-400">선택 항목(마케팅 정보 수신)도 함께 동의됩니다.</p>

          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-body-sm text-neutral-800">
              <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="h-4 w-4" />
              <span>[필수] SEEPN 이용약관 동의</span>
              <Link href="/seepn/legal/terms" target="_blank" className="ml-auto text-label-caption text-primary-600 hover:underline">
                전문 보기
              </Link>
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-body-sm text-neutral-800">
              <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} className="h-4 w-4" />
              <span>[필수] 개인정보 수집·이용 동의</span>
              <Link href="/seepn/legal/privacy" target="_blank" className="ml-auto text-label-caption text-primary-600 hover:underline">
                전문 보기
              </Link>
            </label>
            <p className="pl-6 text-label-caption text-neutral-400">
              수집 항목: 이메일, 비밀번호, 표시명 · 목적: 회원관리 및 파트너 정보 열람·관심등록·문의 제공 · 보유기간: 탈퇴
              시까지. 동의를 거부하실 수 있으나, 거부 시 SEEPN 가입 및 서비스 이용이 제한됩니다.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-body-sm text-neutral-800">
              <input type="checkbox" checked={agreeMarketing} onChange={(e) => setAgreeMarketing(e.target.checked)} className="h-4 w-4" />
              <span>[선택] 마케팅 정보 수신 동의</span>
            </label>
            <p className="pl-6 text-label-caption text-neutral-400">
              이메일로 SEEPN의 소식을 보내드립니다. 동의하지 않으셔도 서비스 이용에 제한이 없습니다. 가입 후
              계정 메뉴 &gt; 설정 화면에서 언제든지 철회하실 수 있습니다.
            </p>
          </div>

          <p className="text-label-caption text-neutral-400">만 14세 미만은 가입할 수 없습니다.</p>

          {!allRequiredAgreed && <p className={errorTextClass}>이용약관과 개인정보 수집·이용에 동의해주세요.</p>}

          <div className="flex items-center justify-between pt-2">
            <Link href="/seepn/login" className="text-body-sm text-neutral-500 hover:underline">
              취소
            </Link>
            <button type="button" disabled={!allRequiredAgreed} onClick={() => setStep(2)} className={primaryButtonClass}>
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
        {notReadyBanner}
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
          <p className="mt-1 text-label-caption text-neutral-400">이름 또는 회사명 중 편한 것을 입력해주세요. 실명이 아니어도 됩니다.</p>
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
          <p className="mt-1 text-label-caption text-neutral-400">운영자 문의 회신도 이 이메일로 드립니다.</p>
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

        {/* Honeypot */}
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
          <button
            type="submit"
            disabled={submitting || !SEEPN_BUYER_SIGNUP_ENABLED}
            className={`${primaryButtonClass} flex-1`}
          >
            {submitting ? '가입 처리 중...' : '가입하기'}
          </button>
        </div>
      </form>
    </AuthShell>
  )
}

export default function SeepnSignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupContent />
    </Suspense>
  )
}
