// Design Ref: privacy review §4.3 item 3 (consent_ip /24 masking) + S-5
// (failed_submissions masking rules — email `a***@example.com`, free text = length only).
//
// These helpers run BEFORE any data leaves the Next.js server route: raw PII must
// never be passed to a Supabase RPC call or written to server logs.

/**
 * Masks an email address for storage in failed_submissions / logs.
 * 'jane.doe@example.com' -> 'j***@example.com'
 * Falls back to a generic mask if the input isn't email-shaped.
 */
export function maskEmail(email: string): string {
  const trimmed = email.trim()
  const atIndex = trimmed.indexOf('@')
  if (atIndex <= 0) return '***'
  const local = trimmed.slice(0, atIndex)
  const domain = trimmed.slice(atIndex + 1)
  return `${local.slice(0, 1)}***@${domain || '***'}`
}

/**
 * Masks an IPv4 address to its /24 network (last octet -> 0), matching the
 * `consent_ip` / `request_ip` retention decision in the privacy review
 * ("/24 마스킹 저장, 6개월 보관"). IPv6 and unparseable input are dropped
 * entirely (return null) rather than stored raw or half-masked.
 */
export function maskIp(ip: string | null | undefined): string | null {
  if (!ip) return null
  const trimmed = ip.trim()
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(trimmed)
  if (!ipv4Match) return null // IPv6 / unknown format: do not store
  const [, a, b, c] = ipv4Match
  const octets = [a, b, c].map((n) => Number(n))
  if (octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null
  return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`
}

/**
 * Best-effort extraction of the client IP from a Next.js Request, preferring
 * standard proxy headers (Amplify/CloudFront sets x-forwarded-for).
 */
export function extractClientIp(headers: Headers): string | null {
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return null
}
