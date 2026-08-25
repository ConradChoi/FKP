// Design Ref: fkp-v0.2-privacy-review-phase3-rbac.md §6, E3-R1 (Auth login, invite-only —
// Supabase Auth public sign-up stays OFF; the "가입 요청" tab here is a separate, reviewed
// queue, not a sign-up form — see docs/01-plan/... access-request migration comment).
// Admin UI is Korean-only (E3-R13 Won't), so no lib/i18n wiring here.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signInAction } from '@/lib/supabase/adminAuthActions'
import { submitAccessRequestAction } from './accessRequestActions'
import { inputClass, primaryButtonClass, secondaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: '이메일과 비밀번호를 입력해주세요.',
  ACCOUNT_LOCKED: '로그인 시도가 너무 많아 15분간 잠겼습니다. 잠시 후 다시 시도해주세요.',
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 올바르지 않습니다.',
  CONFIG_ERROR: '서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.',
}

export default function AdminLoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'login' | 'request'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [reqName, setReqName] = useState('')
  const [reqEmail, setReqEmail] = useState('')
  const [reqReason, setReqReason] = useState('')
  const [reqHoneypot, setReqHoneypot] = useState('')
  const [reqStatus, setReqStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [reqError, setReqError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError(null)
    setLoading(true)
    const result = await signInAction(email, password)
    setLoading(false)
    if (!result.success) {
      setLoginError(LOGIN_ERROR_MESSAGES[result.errorCode ?? ''] ?? '로그인에 실패했습니다.')
      return
    }
    router.push('/admin')
    router.refresh()
  }

  async function handleAccessRequest(e: React.FormEvent) {
    e.preventDefault()
    setReqError(null)
    if (!reqName.trim() || !reqEmail.trim() || !reqReason.trim()) {
      setReqError('이름, 이메일, 요청 사유를 모두 입력해주세요.')
      return
    }
    setReqStatus('submitting')
    const result = await submitAccessRequestAction({
      name: reqName,
      email: reqEmail,
      reason: reqReason,
      honeypot: reqHoneypot,
    })
    if (!result.success) {
      setReqStatus('error')
      setReqError(
        result.errorCode === 'REQUEST_ALREADY_PENDING'
          ? '이미 처리 대기 중인 요청이 있습니다. 최고관리자의 검토를 기다려주세요.'
          : '요청 접수에 실패했습니다. 잠시 후 다시 시도해주세요.',
      )
      return
    }
    setReqStatus('success')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md rounded-card bg-neutral-0 p-8 shadow-lg">
        <h1 className="text-h3 text-primary-900">Find Korean Partners Admin</h1>

        <div className="mt-6 flex gap-2 border-b border-neutral-200">
          <button
            type="button"
            onClick={() => setTab('login')}
            className={`px-4 py-2 text-body-sm font-medium ${tab === 'login' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-neutral-500'}`}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => setTab('request')}
            className={`px-4 py-2 text-body-sm font-medium ${tab === 'request' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-neutral-500'}`}
          >
            가입 요청
          </button>
        </div>

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-body-sm text-neutral-700">이메일</label>
              <input
                type="email"
                required
                autoComplete="username"
                className={`${inputClass} w-full`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-body-sm text-neutral-700">비밀번호</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                className={`${inputClass} w-full`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {loginError && <p className={errorTextClass}>{loginError}</p>}
            <button type="submit" disabled={loading} className={`${primaryButtonClass} w-full`}>
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        ) : reqStatus === 'success' ? (
          <div className="mt-6 rounded-input border border-primary-200 bg-primary-50 p-4 text-body-sm text-primary-800">
            요청이 접수되었습니다. 최고관리자 승인 후 초대 이메일이 발송됩니다.
          </div>
        ) : (
          <form onSubmit={handleAccessRequest} className="mt-6 flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-body-sm text-neutral-700">이름</label>
              <input
                type="text"
                required
                className={`${inputClass} w-full`}
                value={reqName}
                onChange={(e) => setReqName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-body-sm text-neutral-700">이메일</label>
              <input
                type="email"
                required
                className={`${inputClass} w-full`}
                value={reqEmail}
                onChange={(e) => setReqEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-body-sm text-neutral-700">요청 사유</label>
              <textarea
                required
                rows={3}
                className={`${inputClass} w-full`}
                value={reqReason}
                onChange={(e) => setReqReason(e.target.value)}
                placeholder="예: 신규 운영자로 리드 처리를 담당합니다."
              />
            </div>
            <input
              type="text"
              name="website_url"
              value={reqHoneypot}
              onChange={(e) => setReqHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute left-[-9999px] h-0 w-0 opacity-0"
            />
            {reqError && <p className={errorTextClass}>{reqError}</p>}
            <button type="submit" disabled={reqStatus === 'submitting'} className={`${secondaryButtonClass} w-full`}>
              {reqStatus === 'submitting' ? '접수 중...' : '가입 요청 보내기'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
