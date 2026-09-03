'use client'

// Design Ref: screen-spec §2.5.4(연락처 탭, PR-1/A1-R7). Gap G-1이 20260829180000에서
// admin_set_partner_contact로 해소되었으므로, admin_entry 파트너의 입력폼은 "준비 중" 안내가
// 아니라 실제로 동작하는 폼으로 구현한다(작업지시서 명시 사항).
import { useState } from 'react'
import { adminInputClass, adminButtonPrimaryClass } from '@/components/admin/styles'
import { adminSetPartnerContactAction, revealPartnerContactAction, type RevealedContact } from './actions'

export function ContactTab({
  partnerId,
  intakeSource,
  contactNameMasked,
  contactEmailMasked,
  contactPhoneMasked,
  canAccessPii,
  hasContact,
  rejectedPiiPurged,
  canUpdate,
}: {
  partnerId: string
  intakeSource: string
  contactNameMasked: string | null
  contactEmailMasked: string | null
  contactPhoneMasked: string | null
  canAccessPii: boolean
  hasContact: boolean
  rejectedPiiPurged: boolean
  canUpdate: boolean
}) {
  const [revealed, setRevealed] = useState<RevealedContact | null>(null)
  const [revealing, setRevealing] = useState(false)
  const [revealError, setRevealError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [representativeName, setRepresentativeName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleReveal() {
    setRevealing(true)
    setRevealError(null)
    const result = await revealPartnerContactAction(partnerId)
    setRevealing(false)
    if (!result.success || !result.data) {
      setRevealError('열람 권한이 없거나 실패했습니다.')
      return
    }
    setRevealed(result.data)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    const result = await adminSetPartnerContactAction({
      partnerId,
      contactName: name,
      contactTitle: title,
      contactEmail: email,
      contactPhone: phone,
      representativeName,
    })
    setSaving(false)
    if (!result.success) {
      setSaveError('저장 실패')
      return
    }
    setSaved(true)
    setRevealed(null)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
        <h2 className="admin-heading-3 text-neutral-900">현재 등록된 연락처</h2>
        {!hasContact ? (
          <p className="mt-2 admin-body-sm text-neutral-400">
            {rejectedPiiPurged
              ? '담당자 연락처가 삭제되었습니다 (반려 90일 경과).'
              : intakeSource === 'self_service'
                ? '담당자 연락처가 아직 입력되지 않았습니다. (파트너 본인이 입력하는 항목입니다)'
                : '담당자 연락처가 아직 입력되지 않았습니다.'}
          </p>
        ) : (
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="admin-label-sm text-neutral-500">이름</dt>
              <dd className="admin-body text-neutral-900">{revealed ? revealed.contact_name : contactNameMasked}</dd>
            </div>
            <div>
              <dt className="admin-label-sm text-neutral-500">이메일</dt>
              <dd className="admin-body text-neutral-900">{revealed ? revealed.contact_email : contactEmailMasked}</dd>
            </div>
            <div>
              <dt className="admin-label-sm text-neutral-500">전화</dt>
              <dd className="admin-body text-neutral-900">{revealed ? revealed.contact_phone : contactPhoneMasked}</dd>
            </div>
            {revealed?.contact_title && (
              <div>
                <dt className="admin-label-sm text-neutral-500">직함</dt>
                <dd className="admin-body text-neutral-900">{revealed.contact_title}</dd>
              </div>
            )}
          </dl>
        )}
        {hasContact && !revealed && canAccessPii && (
          <button type="button" onClick={handleReveal} disabled={revealing} className="mt-3 admin-body-sm text-primary-600 hover:underline">
            {revealing ? '확인 중...' : '원문 보기'}
          </button>
        )}
        {hasContact && !canAccessPii && <p className="mt-2 admin-body-sm text-neutral-500">viewer 역할은 원문 열람 불가</p>}
        {revealError && <p className="mt-2 admin-body-sm text-error">{revealError}</p>}
      </section>

      {intakeSource === 'admin_entry' && (
        <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
          <h2 className="admin-heading-3 text-neutral-900">연락처 입력/수정</h2>
          <p className="mt-1 admin-label-sm text-neutral-400">예외입력(admin_entry) 파트너의 연락처를 관리자가 대신 입력합니다.</p>
          {!canUpdate && <p className="mt-1 admin-label-sm text-accent-700">수정 권한이 없어 조회만 가능합니다.</p>}
          <form onSubmit={handleSave} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <fieldset disabled={!canUpdate} className="contents">
            <div>
              <label className="admin-label-sm text-neutral-500">이름 *</label>
              <input className={`${adminInputClass} mt-1 w-full`} value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="admin-label-sm text-neutral-500">직함</label>
              <input className={`${adminInputClass} mt-1 w-full`} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="admin-label-sm text-neutral-500">이메일 *</label>
              <input type="email" className={`${adminInputClass} mt-1 w-full`} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="admin-label-sm text-neutral-500">전화</label>
              <input className={`${adminInputClass} mt-1 w-full`} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="admin-label-sm text-neutral-500">대표자명 (개인사업자인 경우)</label>
              <input
                className={`${adminInputClass} mt-1 w-full`}
                value={representativeName}
                onChange={(e) => setRepresentativeName(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <button type="submit" disabled={saving || !name.trim() || !email.trim()} className={adminButtonPrimaryClass}>
                {saving ? '저장 중...' : '저장'}
              </button>
              {saved && <span className="admin-body-sm text-success">저장되었습니다.</span>}
            </div>
            {saveError && <p className="sm:col-span-2 admin-body-sm text-error">{saveError}</p>}
          </fieldset>
          </form>
        </section>
      )}
    </div>
  )
}
