'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createMenuAction } from './actions'
import { inputClass, primaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'

interface ParentOption {
  id: string
  display_name: string
}

export function NewMenuForm({ parentOptions }: { parentOptions: ParentOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [parentId, setParentId] = useState('')
  const [path, setPath] = useState('')
  const [menuType, setMenuType] = useState<'page' | 'group'>('page')
  const [sortOrder, setSortOrder] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const result = await createMenuAction({
      code,
      displayName,
      parentId: parentId || null,
      path: menuType === 'group' ? null : path,
      menuType,
      sortOrder,
    })
    setSaving(false)
    if (!result.success) {
      setError(result.errorCode === 'VALIDATION_ERROR' ? '코드는 영문 소문자/숫자/밑줄만 가능합니다.' : '생성 실패 (코드 중복 등)')
      return
    }
    setCode('')
    setDisplayName('')
    setPath('')
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={primaryButtonClass}>
        + 새 메뉴 추가
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card border border-neutral-200 bg-neutral-0 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <input
          className={inputClass}
          placeholder="코드 (예: reports)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <input
          className={inputClass}
          placeholder="표시명"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
        <select className={inputClass} value={menuType} onChange={(e) => setMenuType(e.target.value as 'page' | 'group')}>
          <option value="page">페이지</option>
          <option value="group">그룹</option>
        </select>
        <select className={inputClass} value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">(최상위)</option>
          {parentOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
        {menuType === 'page' && (
          <input className={inputClass} placeholder="경로 (예: /admin/reports)" value={path} onChange={(e) => setPath(e.target.value)} />
        )}
        <input
          type="number"
          className={inputClass}
          placeholder="정렬순서"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
        />
      </div>
      {error && <p className={`mt-2 ${errorTextClass}`}>{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={saving} className={primaryButtonClass}>
          추가
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-body-sm text-neutral-500 hover:underline">
          취소
        </button>
      </div>
    </form>
  )
}
