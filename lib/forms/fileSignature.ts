// Design Ref: docs/03-security/partner-supplier-app-ui-privacy-review.md §4.1
// (UI-B4) step 3 — "매직바이트 검증 — %PDF / JPEG(FFD8FF) / PNG(89504E47) 화이트리스트.
// 확장자·선언 MIME은 참고값으로만 쓴다". A client-declared File.type / filename
// extension is attacker-controlled and MUST NOT be trusted for this decision —
// this module inspects the actual leading bytes of the uploaded content instead.
// Used exclusively by app/api/partner/documents/route.ts (server-side, after the
// bytes have already been read into a Buffer — never runs in the browser).

export type AllowedDocumentMimeType = 'application/pdf' | 'image/jpeg' | 'image/png'

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46] // "%PDF"
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function matchesSignature(bytes: Buffer, signature: number[]): boolean {
  if (bytes.length < signature.length) return false
  return signature.every((byte, index) => bytes[index] === byte)
}

/**
 * Returns the real MIME type detected from the file's magic bytes, or null if
 * the content does not match any allow-listed type (PDF/JPEG/PNG). The
 * caller's declared Content-Type/extension play no role in this result.
 */
export function detectDocumentMimeType(bytes: Buffer): AllowedDocumentMimeType | null {
  if (matchesSignature(bytes, PDF_SIGNATURE)) return 'application/pdf'
  if (matchesSignature(bytes, JPEG_SIGNATURE)) return 'image/jpeg'
  if (matchesSignature(bytes, PNG_SIGNATURE)) return 'image/png'
  return null
}

export function extensionForDocumentMimeType(mimeType: AllowedDocumentMimeType): string {
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType === 'image/jpeg') return 'jpg'
  return 'png'
}
