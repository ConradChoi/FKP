// Design Ref: notice-board-v1.0.prd.md §7.6 (N-R16) + notice-board-privacy-review.md §2.5
// (NB-B10, blocking) — "EXIF 등 메타데이터 제거는 선택이 아니라 필수". GPS coordinates, capture
// timestamps and device info embedded in a phone photo are invisible in every preview/review
// surface the admin editor has (no thumbnail EXIF panel exists anywhere in this app) — the only
// way to guarantee they don't reach the PUBLIC content-image bucket (§2 — public=true, anon
// readable the moment it's uploaded) is to strip them server-side before the bytes are written.
//
// Chosen approach: byte-level segment/chunk stripping, NOT re-encoding via `sharp` or similar.
// Per the privacy review's own recommendation (§2.5): a native-dependency image library adds
// real weight to the Amplify Lambda bundle this project deploys to, and this project's existing
// convention (5-D §5.2, still honored per notice-board-v1.0.prd.md §6.4's closing note) is to
// avoid new runtime dependencies when a targeted alternative exists. Both formats we accept
// (JPEG/PNG, see lib/forms/fileSignature.ts's detectImageMimeType — webp is NOT supported, same
// file's comment) have metadata living in clearly-delimited, skippable containers (JPEG APPn
// marker segments / PNG ancillary chunks), so a plain Buffer walk removes them without touching
// pixel data at all.
//
// FAIL-CLOSED, NOT FAIL-SAFE (qa-reviewer, 2026-09-09, blocking — reversal of this module's first
// version): both strip functions below return `null` — meaning "refuse to use this file at all" —
// the moment the marker/chunk walk hits ANY structure it doesn't fully recognize (a byte where a
// 0xFF marker prefix was expected but isn't there, a declared segment/chunk length that runs past
// the end of the buffer, a PNG that never reaches a well-formed IEND, etc.). The FIRST version of
// this module instead copied the unparsed remainder through verbatim in exactly those situations,
// reasoning "don't risk corrupting an otherwise-valid image over an edge case". That reasoning
// picked the wrong failure mode for this specific feature: an unparsed remainder is EXACTLY where
// an APP1/APP13 segment or an eXIf/tEXt/iTXt/zTXt chunk could still be sitting, un-stripped, and
// it would sail straight into the public bucket with location data intact — and unlike a visibly
// broken image, nobody would ever notice, because GPS coordinates don't show up in any preview,
// any review screen, or any QA click-through (privacy review §2.5: "이것이 이 섹션에서 가장 중요한
// 항목이다... 통제 불가능성" — the whole reason this control exists is that a leak here is
// silent). Between "some unusual JPEGs/PNGs get rejected with a clear error and the admin re-saves
// them" and "some unusual JPEGs/PNGs silently keep their GPS tag forever on a public URL", the
// former is the only acceptable failure mode for this feature. Ordinary phone-camera JPEGs and
// ordinary PNG screenshots/exports — the entire realistic caller population for a 0~1
// notices/month admin tool — parse cleanly through the paths below and are unaffected.
//
// KNOWN TRADE-OFF (documented per privacy review §2.5 "구현 주의", do not silently rediscover
// this as a bug): stripping JPEG APP1 also removes the Exif Orientation tag. Since this module
// does not re-encode pixels, it cannot compensate by physically rotating the image — a photo
// taken with the phone held sideways will display sideways after this strip. At the project's
// current publishing volume (PRD §8.2: 0~1 notices/month) the accepted mitigation is operational,
// not technical: if a photo comes out rotated, re-save it right-side-up on-device and re-upload
// (privacy review §2.5, "월 0~1건 규모에서는 후자로 충분"). Do not silently add sharp/exifr to
// "fix" this later without re-reading that trade-off note and confirming the bundle-size concern
// no longer applies.

import type { AllowedNoticeImageMimeType } from '@/lib/forms/fileSignature'

const JPEG_SOI = 0xd8
const JPEG_EOI = 0xd9
const JPEG_SOS = 0xda // Start of Scan — everything after this is entropy-coded pixel data, not markers
const JPEG_TEM = 0x01
const JPEG_RST_MIN = 0xd0
const JPEG_RST_MAX = 0xd7
const JPEG_APP1 = 0xe1 // Exif / XMP
const JPEG_APP13 = 0xed // IPTC / Photoshop metadata

/**
 * Walks a JPEG's marker-segment structure and drops APP1 (Exif/XMP) and APP13 (IPTC/Photoshop)
 * segments in full, leaving every other marker (including APP0/JFIF, quantization/Huffman
 * tables, and the actual scan data) byte-for-byte untouched.
 *
 * Returns `null` (fail-closed, see file header) instead of a Buffer the moment the header
 * portion of the file (everything before the first Start-of-Scan marker) doesn't parse exactly
 * as a well-formed JPEG marker sequence — the caller MUST treat `null` as "reject this upload",
 * never as "use the original bytes". Once a valid SOS marker is reached, the remainder of the
 * file (scan data + any further scans/RST markers + the final EOI, verbatim) is copied through
 * without further parsing — that region is defined by the JPEG spec to be either entropy-coded
 * pixel data or restart markers, never another metadata segment, so it's safe to stop parsing
 * there and this is a real success outcome, not a shortcut.
 */
export function stripJpegMetadata(bytes: Buffer): Buffer | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== JPEG_SOI) return null

  const kept: Buffer[] = [bytes.subarray(0, 2)] // SOI
  let offset = 2

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      // Not at a marker boundary where we expected one — this is a structure this module doesn't
      // understand, and the unparsed remainder could contain an unstripped APP1/APP13 segment.
      // Fail closed (see file header) rather than passing it through.
      return null
    }

    // Marker segments may be preceded by fill bytes (0xff padding) per the JPEG spec.
    let markerOffset = offset + 1
    while (markerOffset < bytes.length && bytes[markerOffset] === 0xff) markerOffset++
    if (markerOffset >= bytes.length) return null // ran off the end while still looking for a marker code

    const marker = bytes[markerOffset]
    const markerStart = offset
    const markerHeaderEnd = markerOffset + 1

    // Markers with no payload/length field at all.
    if (marker === JPEG_EOI || marker === JPEG_TEM || (marker >= JPEG_RST_MIN && marker <= JPEG_RST_MAX)) {
      kept.push(bytes.subarray(markerStart, markerHeaderEnd))
      offset = markerHeaderEnd
      continue
    }

    if (marker === JPEG_SOS) {
      // Everything from here on (SOS header + entropy-coded scan data + trailing EOI, and for
      // progressive JPEGs any further SOS/RST sequences) is copied verbatim — we never parse
      // inside scan data, that's where stray 0xFF bytes are expected and NOT marker boundaries
      // (they're byte-stuffed as 0xFF 0x00). This is the normal, successful end of parsing.
      kept.push(bytes.subarray(markerStart))
      return Buffer.concat(kept)
    }

    if (markerHeaderEnd + 2 > bytes.length) return null // truncated before a length field we expected

    const segmentLength = bytes.readUInt16BE(markerHeaderEnd) // includes the 2 length bytes themselves
    const segmentEnd = markerHeaderEnd + segmentLength
    if (segmentEnd > bytes.length) return null // declared segment length overruns the buffer

    if (marker === JPEG_APP1 || marker === JPEG_APP13) {
      // Drop the entire segment (marker bytes + length + payload) — this is the actual strip.
      offset = segmentEnd
      continue
    }

    kept.push(bytes.subarray(markerStart, segmentEnd))
    offset = segmentEnd
  }

  // Reached the end of the buffer without ever encountering SOS (or a well-formed EOI-only file)
  // — not a shape a normal encoder produces. Fail closed rather than guess.
  return null
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const PNG_METADATA_CHUNK_TYPES = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt'])

/**
 * Walks a PNG's chunk structure and drops eXIf/tEXt/iTXt/zTXt ancillary chunks in full, leaving
 * the signature, IHDR/IDAT/PLTE/IEND and every other chunk untouched.
 *
 * Returns `null` (fail-closed, see file header) if the chunk walk doesn't reach a well-formed
 * IEND chunk with nothing left over afterward — a declared chunk length that overruns the
 * buffer, a file that ends before IEND, or unexplained trailing bytes after IEND are all treated
 * as "this module doesn't fully understand this file's structure" and therefore as a reason to
 * reject the upload rather than pass an unparsed (and potentially still metadata-bearing) region
 * through.
 */
export function stripPngMetadata(bytes: Buffer): Buffer | null {
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return null

  const kept: Buffer[] = [bytes.subarray(0, 8)]
  let offset = 8
  let sawIend = false

  while (offset + 8 <= bytes.length) {
    const dataLength = bytes.readUInt32BE(offset) // always >= 0 (unsigned 32-bit read)
    const chunkType = bytes.subarray(offset + 4, offset + 8).toString('ascii')
    const chunkEnd = offset + 12 + dataLength // length(4) + type(4) + data(dataLength) + crc(4)

    if (chunkEnd > bytes.length) return null // declared chunk length overruns the buffer

    if (PNG_METADATA_CHUNK_TYPES.has(chunkType)) {
      offset = chunkEnd
      continue
    }

    kept.push(bytes.subarray(offset, chunkEnd))
    offset = chunkEnd

    if (chunkType === 'IEND') {
      sawIend = true
      break
    }
  }

  // Success requires BOTH a well-formed IEND and nothing left unaccounted for afterward — a
  // chunk walk that ends any other way (ran out of buffer before IEND, or trailing bytes after
  // it) means some part of the file wasn't actually inspected, and that unexamined part could be
  // an un-stripped metadata chunk.
  if (!sawIend || offset !== bytes.length) return null

  return Buffer.concat(kept)
}

export function stripImageMetadata(bytes: Buffer, mimeType: AllowedNoticeImageMimeType): Buffer | null {
  return mimeType === 'image/jpeg' ? stripJpegMetadata(bytes) : stripPngMetadata(bytes)
}
