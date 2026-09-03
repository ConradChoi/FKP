'use client'

// Design Ref: ui-spec §3.9 (업로드 위젯) + docs/03-security/partner-supplier-app-ui-privacy-review.md
// §4.2 (UI-B11 대신 넣을 것 1: 개인사업자에게만 업로드 전 명시적 확인 체크박스) +
// backend-implementation-notes.md §6 (POST /api/partner/documents 계약, partnerId를
// body/formData에 넣지 말 것) + privacy review §0.3(G-S3 삭제 절차, DELETE /api/partner/documents).
import { useRef, useState } from 'react'
import { getSupplierBrowserClient } from '@/lib/supabase/supplierBrowserClient'
import { inputClass, errorTextClass } from '@/components/RequestForm/styles'
import { DOC_TYPE_LABELS } from '@/lib/admin/partnerLabels'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { UploadCloudIcon, WarningTriangleIcon } from '@/components/icons/SupplierIcons'
import type { PartnerDocumentRow } from '@/lib/supplier/types'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

const DOC_TYPES = Object.keys(DOC_TYPE_LABELS) as Array<keyof typeof DOC_TYPE_LABELS>

function DocumentRow({
  doc,
  onDeleted,
  flagged,
}: {
  doc: PartnerDocumentRow
  onDeleted: (id: string) => void
  flagged?: boolean
}) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [viewing, setViewing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleView() {
    setViewing(true)
    setError(null)
    const supabase = getSupplierBrowserClient()
    // screen-spec §4.4 — self-access, no audit RPC needed (G-S4), TTL 300s, forced download.
    const { data, error: signError } = await supabase.storage
      .from('partner-doc')
      .createSignedUrl(doc.storage_path, 300, { download: true })
    setViewing(false)
    if (signError || !data?.signedUrl) {
      setError('열람에 실패했습니다.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/partner/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id, storagePath: doc.storage_path }),
      })
      if (!res.ok) throw new Error('delete_failed')
      onDeleted(doc.id)
    } catch {
      setError('삭제에 실패했습니다.')
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <div className={`flex items-center justify-between py-3 ${flagged ? '-mx-4 border-l-4 border-error bg-error-100/40 px-4' : ''}`}>
      <div className="flex items-center gap-2">
        <StatusBadge tone="neutral" label={DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type} />
        <div>
          <p className="truncate text-body-sm font-medium text-neutral-900">{doc.original_filename}</p>
          <p className="text-label-caption text-neutral-400">
            {formatBytes(doc.file_size_bytes)} · {new Date(doc.created_at).toLocaleDateString('ko-KR')}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {confirming ? (
          <>
            <span className="text-body-sm text-neutral-700">정말 삭제할까요?</span>
            <button type="button" onClick={() => setConfirming(false)} className="text-body-sm text-neutral-500 hover:underline">
              취소
            </button>
            <button type="button" onClick={handleDelete} disabled={deleting} className="text-body-sm text-error hover:underline">
              {deleting ? '삭제 중...' : '삭제'}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={handleView} disabled={viewing} className="text-body-sm text-primary-600 hover:underline">
              {viewing ? '확인 중...' : '보기'}
            </button>
            <button type="button" onClick={() => setConfirming(true)} className="text-body-sm text-error hover:underline">
              삭제
            </button>
          </>
        )}
      </div>
      {error && <p className={`ml-2 ${errorTextClass}`}>{error}</p>}
    </div>
  )
}

export function DocumentsForm({
  partnerId,
  businessEntityType,
  documents: initialDocuments,
  verificationState,
  rejectionReason,
}: {
  partnerId: string
  businessEntityType: string | null
  documents: PartnerDocumentRow[]
  verificationState: string
  rejectionReason: string | null
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [documents, setDocuments] = useState(initialDocuments)
  const [docType, setDocType] = useState<string>('business_registration_cert')
  const [rrnConfirmed, setRrnConfirmed] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasBizCert = documents.some((d) => d.doc_type === 'business_registration_cert')
  const requiresRrnConfirm = businessEntityType === 'sole_proprietor'
  const uploadDisabled = uploading || (requiresRrnConfirm && !rrnConfirmed)

  // privacy review §4.2 대신 넣을 것 3(UI-B11) — 반려 사유에 주민등록번호가 언급된 경우
  // 능동적 재첨부를 유도하는 배너 + 사업자등록증 문서 행 강조. §4.2가 "이것이 진짜
  // blocking"이라고 명시한 항목(반려된 원본이 90일간 그대로 남는 문제에 대한 화면 레벨 완화책).
  const rrnRejected = verificationState === 'rejected' && !!rejectionReason && rejectionReason.includes('주민등록번호')

  async function handleFile(file: File) {
    if (uploadDisabled) return
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      setError('업로드 실패 — 파일 형식/크기를 확인해주세요.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('업로드 실패 — 파일 형식/크기를 확인해주세요.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.set('docType', docType)
      formData.set('file', file)
      const res = await fetch('/api/partner/documents', { method: 'POST', body: formData })
      const data = (await res.json()) as { success?: boolean; id?: string }
      if (!res.ok || !data.success || !data.id) throw new Error('upload_failed')

      // Fetch the actual row back (rather than fabricating one client-side) so storage_path
      // is correct for the "보기"/"삭제" actions that follow immediately after — the server
      // route generated that path, this component never sees it otherwise.
      const supabase = getSupplierBrowserClient()
      const { data: newDoc } = await supabase
        .from('partner_document')
        .select('id, doc_type, storage_path, original_filename, mime_type, file_size_bytes, created_at')
        .eq('id', data.id)
        .maybeSingle<PartnerDocumentRow>()
      if (newDoc) setDocuments((prev) => [newDoc, ...prev])

      setRrnConfirmed(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch {
      setError('업로드 실패 — 파일 형식/크기를 확인해주세요.')
    } finally {
      setUploading(false)
    }
  }

  function handleDeleted(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="flex flex-col gap-4">
      {rrnRejected && (
        <div className="flex items-start gap-2 rounded-input border border-error/30 bg-error-100 px-4 py-3">
          <WarningTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-error" />
          <p className="text-body-sm text-error">
            첨부하신 문서에 주민등록번호가 포함되어 있습니다. 해당 파일을 삭제하고, 주민등록번호를 가린 파일로 다시 첨부해주세요.
          </p>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-input border border-accent-500/30 bg-accent-100 px-4 py-3">
        <WarningTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" />
        <p className="text-body-sm text-accent-700">
          사업자등록증 등에 주민등록번호가 포함되어 있지 않은지 확인해주세요. 포함되어 있으면 반려됩니다.
        </p>
      </div>

      <div className="rounded-card border border-neutral-200 bg-neutral-0 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select className={`${inputClass} w-full sm:w-64`} value={docType} onChange={(e) => setDocType(e.target.value)}>
            {DOC_TYPES.map((v) => (
              <option key={v} value={v}>
                {DOC_TYPE_LABELS[v]}
              </option>
            ))}
          </select>
          {docType === 'business_registration_cert' && !hasBizCert && (
            <span className="inline-block rounded-sm bg-primary-50 px-1.5 py-0.5 text-label-caption text-primary-700">필수</span>
          )}
        </div>

        {requiresRrnConfirm && (
          <label className="mt-3 flex items-center gap-2 text-body-sm text-neutral-700">
            <input type="checkbox" checked={rrnConfirmed} onChange={(e) => setRrnConfirmed(e.target.checked)} />
            첨부 파일에 주민등록번호가 표시되어 있지 않음을 확인했습니다.
          </label>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault()
            if (!uploadDisabled) setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files?.[0]
            if (file) void handleFile(file)
          }}
          onClick={() => !uploadDisabled && fileInputRef.current?.click()}
          className={`mt-3 flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed transition-colors ${
            uploadDisabled ? 'cursor-not-allowed border-neutral-200 bg-neutral-50 opacity-60' : dragOver ? 'border-primary-400 bg-primary-50' : 'border-neutral-300 bg-neutral-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            disabled={uploadDisabled}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
            }}
          />
          {uploading ? (
            <p className="text-body-sm text-neutral-600">업로드 중...</p>
          ) : (
            <>
              <UploadCloudIcon className="h-8 w-8 text-neutral-400" />
              <p className="text-body font-medium text-neutral-700">파일을 드래그하거나 클릭하여 업로드</p>
              <p className="text-body-sm text-neutral-500">PDF, JPG, PNG · 최대 10MB</p>
            </>
          )}
        </div>
        {error && <p className={`mt-2 ${errorTextClass}`}>{error}</p>}
      </div>

      {documents.length > 0 && (
        <div className="divide-y divide-neutral-200 rounded-card border border-neutral-200 bg-neutral-0 px-4">
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              onDeleted={handleDeleted}
              flagged={rrnRejected && doc.doc_type === 'business_registration_cert'}
            />
          ))}
        </div>
      )}
    </div>
  )
}
