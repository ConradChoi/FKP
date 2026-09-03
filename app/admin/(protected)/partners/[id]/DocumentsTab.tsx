'use client'

// Design Ref: screen-spec §2.5.5 — 문서 탭. 열람은 반드시 2단계(log_partner_document_reveal
// 선행 -> 성공해야만 signed URL 요청)를 화면에 그대로 반영해야 한다(실수하기 쉬운 지점으로
// 문서 자체가 지목).
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminInputClass, adminButtonPrimaryClass } from '@/components/admin/styles'
import { DOC_TYPE_LABELS } from '@/lib/admin/partnerLabels'
import { uploadPartnerDocumentAction, revealPartnerDocumentAction, deletePartnerDocumentAction } from './actions'
import type { PartnerDocumentRecord } from './page'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function DocumentRow({
  partnerId,
  doc,
  canAccessPii,
  canUpdate,
}: {
  partnerId: string
  doc: PartnerDocumentRecord
  canAccessPii: boolean
  canUpdate: boolean
}) {
  const router = useRouter()
  const [revealState, setRevealState] = useState<'idle' | 'checking' | 'ready' | 'error'>('idle')
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleReveal() {
    setRevealState('checking')
    setError(null)
    const result = await revealPartnerDocumentAction(doc.id)
    if (!result.success || !result.data) {
      setRevealState('error')
      setError('열람 권한이 없거나 실패했습니다.')
      return
    }
    setSignedUrl(result.data.url)
    setRevealState('ready')
    window.open(result.data.url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => {
      setRevealState('idle')
      setSignedUrl(null)
    }, 120_000)
  }

  async function handleDelete() {
    if (!window.confirm(`"${doc.original_filename}" 문서를 삭제할까요?`)) return
    setDeleting(true)
    const result = await deletePartnerDocumentAction(doc.id, doc.storage_path, partnerId)
    setDeleting(false)
    if (!result.success) {
      setError('삭제 실패')
      return
    }
    router.refresh()
  }

  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <td className="px-3 py-2 admin-body-sm">
        <span className="rounded-sm bg-neutral-100 px-1.5 py-0.5 admin-label-sm text-neutral-600">{DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}</span>
      </td>
      <td className="px-3 py-2 admin-body-sm text-neutral-700">{doc.original_filename}</td>
      <td className="px-3 py-2 admin-body-sm text-neutral-500">{doc.uploaded_by_kind === 'admin' ? '운영자' : '파트너'}</td>
      <td className="px-3 py-2 admin-body-sm text-neutral-500">{new Date(doc.created_at).toLocaleDateString('ko-KR')}</td>
      <td className="px-3 py-2 admin-body-sm text-neutral-500">{doc.purge_after ? `자동삭제 예정: ${new Date(doc.purge_after).toLocaleDateString('ko-KR')}` : '-'}</td>
      <td className="px-3 py-2 admin-body-sm text-neutral-500">{formatBytes(doc.file_size_bytes)}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          {canAccessPii ? (
            <button type="button" onClick={handleReveal} disabled={revealState === 'checking'} className="admin-body-sm text-primary-600 hover:underline">
              {revealState === 'checking' ? '확인 중...' : revealState === 'ready' ? '다운로드 준비 완료' : '열람'}
            </button>
          ) : (
            <span className="admin-body-sm text-neutral-400">열람 권한 없음</span>
          )}
          {canUpdate && (
            <button type="button" onClick={handleDelete} disabled={deleting} className="admin-body-sm text-error hover:underline">
              삭제
            </button>
          )}
        </div>
        {signedUrl && revealState === 'ready' && (
          <p className="mt-1 admin-label-sm text-neutral-400">링크는 120초 후 만료됩니다. 재열람 시 다시 눌러주세요.</p>
        )}
        {error && <p className="mt-1 admin-label-sm text-error">{error}</p>}
      </td>
    </tr>
  )
}

export function DocumentsTab({
  partnerId,
  documents,
  canAccessPii,
  canUpdate,
  canCreateDocument,
}: {
  partnerId: string
  documents: PartnerDocumentRecord[]
  canAccessPii: boolean
  canUpdate: boolean
  canCreateDocument: boolean
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [docType, setDocType] = useState('business_registration_cert')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      setError('pdf/jpg/png 파일만 업로드할 수 있습니다.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('파일 크기는 10MB 이하여야 합니다.')
      return
    }
    setUploading(true)
    setError(null)
    const formData = new FormData()
    formData.set('partnerId', partnerId)
    formData.set('docType', docType)
    formData.set('file', file)
    const result = await uploadPartnerDocumentAction(formData)
    setUploading(false)
    if (!result.success) {
      setError('업로드 실패')
      return
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <p className="rounded-input bg-accent-100 px-3 py-2 admin-body-sm text-accent-700">
        사업자등록증 등 서류에 주민등록번호가 포함되어 있지 않은지 확인하세요. 확인되면 반려 처리됩니다.
      </p>

      {canCreateDocument ? (
        <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-2 rounded-card border border-neutral-200 bg-neutral-0 p-4">
          <select className={adminInputClass} value={docType} onChange={(e) => setDocType(e.target.value)}>
            {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="admin-body-sm" />
          <button type="submit" disabled={uploading} className={adminButtonPrimaryClass}>
            {uploading ? '업로드 중...' : '업로드'}
          </button>
        </form>
      ) : (
        <p className="admin-body-sm text-neutral-400">생성 권한이 없어 업로드할 수 없습니다.</p>
      )}
      {error && <p className="admin-body-sm text-error">{error}</p>}

      <div className="overflow-x-auto rounded-card border border-neutral-200 bg-neutral-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200 text-left">
              <th className="px-3 py-2 admin-body-sm font-medium text-neutral-500">유형</th>
              <th className="px-3 py-2 admin-body-sm font-medium text-neutral-500">파일명</th>
              <th className="px-3 py-2 admin-body-sm font-medium text-neutral-500">업로더</th>
              <th className="px-3 py-2 admin-body-sm font-medium text-neutral-500">업로드일</th>
              <th className="px-3 py-2 admin-body-sm font-medium text-neutral-500">보관기한</th>
              <th className="px-3 py-2 admin-body-sm font-medium text-neutral-500">크기</th>
              <th className="px-3 py-2 admin-body-sm font-medium text-neutral-500">관리</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <DocumentRow key={doc.id} partnerId={partnerId} doc={doc} canAccessPii={canAccessPii} canUpdate={canUpdate} />
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center admin-body-sm text-neutral-400">
                  등록된 문서가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
