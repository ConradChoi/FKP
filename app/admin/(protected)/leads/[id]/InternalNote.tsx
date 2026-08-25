'use client'

import { useState } from 'react'
import { updateInternalNoteAction } from './actions'
import { inputClass, primaryButtonClass, errorTextClass } from '@/components/RequestForm/styles'

export function InternalNote({ requestId, initialNote }: { requestId: string; initialNote: string }) {
  const [note, setNote] = useState(initialNote)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    const result = await updateInternalNoteAction(requestId, note)
    setSaving(false)
    if (!result.success) {
      setError('메모 저장에 실패했습니다.')
      return
    }
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="mt-4">
      <textarea
        className={`${inputClass} w-full`}
        rows={4}
        maxLength={5000}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="mt-2 flex items-center gap-3">
        <button type="button" onClick={handleSave} disabled={saving} className={primaryButtonClass}>
          {saving ? '저장 중...' : '메모 저장'}
        </button>
        {saved && <span className="text-body-sm text-primary-600">저장됨</span>}
        {error && <span className={errorTextClass}>{error}</span>}
      </div>
    </div>
  )
}
