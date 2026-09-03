'use client'

// Design Ref: screen-spec §4.5 (SUP-12) — rpc('get_own_partner_contact') / rpc
// ('set_own_partner_contact'). privacy review UI-R11: this tab is deliberately EXCLUDED from
// any future sessionStorage dirty-backup (OQ-S8) — not implemented here at all, so there is
// nothing to exclude yet, but the exclusion is noted so a future implementer doesn't add one.
import { useEffect, useState } from 'react'
import { getSupplierBrowserClient } from '@/lib/supabase/supplierBrowserClient'
import { inputClass, primaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'
import type { PartnerContactRecord } from '@/lib/supplier/types'
import { useDirtyGuard } from '@/components/supplier/DirtyGuard'

export function ContactForm() {
  const { setDirty } = useDirtyGuard()
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [representativeName, setRepresentativeName] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle')
  const [fieldError, setFieldError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = getSupplierBrowserClient()
      const { data } = await supabase.rpc('get_own_partner_contact')
      const contact = data as PartnerContactRecord | null
      if (contact) {
        setName(contact.contact_name)
        setTitle(contact.contact_title ?? '')
        setEmail(contact.contact_email)
        setPhone(contact.contact_phone ?? '')
        setRepresentativeName(contact.representative_name ?? '')
      }
      setLoading(false)
    }
    void load()
  }, [])

  useEffect(() => {
    setDirty(saveState === 'dirty')
  }, [saveState, setDirty])

  function markDirty() {
    setSaveState('dirty')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)
    if (!name.trim()) {
      setFieldError('담당자 이름을 입력해주세요.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldError('올바른 이메일 형식을 입력해주세요.')
      return
    }
    setSaveState('saving')
    const supabase = getSupplierBrowserClient()
    const { error } = await supabase.rpc('set_own_partner_contact', {
      p_contact_name: name.trim(),
      p_contact_title: title.trim() || null,
      p_contact_email: email.trim(),
      p_contact_phone: phone.trim() || null,
      p_representative_name: representativeName.trim() || null,
    })
    if (error) {
      setSaveState('error')
      return
    }
    setSaveState('saved')
    setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 3000)
  }

  if (loading) {
    return <p className="text-body-sm text-neutral-500">불러오는 중...</p>
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4 rounded-card border border-neutral-200 bg-neutral-0 p-5">
      <p className="text-label-caption text-neutral-400">
        이 정보는 목록에 마스킹되어 표시되며, 원문은 검증 담당 운영자만 감사기록을 남기고 열람합니다.
      </p>

      <div>
        <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">담당자 이름</label>
        <input
          className={`${inputClass} w-full`}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            markDirty()
          }}
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">직함</label>
        <input
          className={`${inputClass} w-full`}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            markDirty()
          }}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">이메일</label>
        <input
          type="email"
          className={`${inputClass} w-full`}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            markDirty()
          }}
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">전화</label>
        <input
          className={`${inputClass} w-full`}
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value)
            markDirty()
          }}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-body-sm font-medium text-neutral-700">대표자명(개인사업자인 경우)</label>
        <input
          className={`${inputClass} w-full`}
          value={representativeName}
          onChange={(e) => {
            setRepresentativeName(e.target.value)
            markDirty()
          }}
        />
      </div>

      {fieldError && <p className={errorTextClass}>{fieldError}</p>}

      <div>
        <p className="text-label-caption text-neutral-400">자동저장되지 않습니다. 탭을 벗어나기 전에 저장해주세요.</p>
        <div className="mt-2 flex items-center gap-3" aria-live="polite">
          <button type="submit" disabled={saveState === 'saving'} className={primaryButtonClass}>
            {saveState === 'error' ? '다시 시도' : saveState === 'saving' ? '저장 중...' : '저장'}
          </button>
          {saveState === 'dirty' && <span className="text-label-caption text-accent-700">저장되지 않은 변경사항이 있습니다</span>}
          {saveState === 'saved' && <span className="text-label-caption text-success">방금 저장되었습니다</span>}
          {saveState === 'error' && <span className={errorTextClass}>저장 실패 — 다시 시도해주세요</span>}
        </div>
      </div>
    </form>
  )
}
