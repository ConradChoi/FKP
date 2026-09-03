// Design Ref: E1-R10 (Should) — rate limiting without adding a Turnstile-class
// dependency. This is a best-effort, in-memory, per-instance limiter: it resets on
// cold start and does not share state across concurrent Amplify SSR instances.
// It stops naive scripted abuse from a single instance/IP; it is NOT a substitute
// for Turnstile/hCaptcha if abuse becomes a real problem — flagged as a follow-up
// in the task summary, not implemented here (new external dependency decision).
//
// UI-B10 (partner-supplier-app-ui-privacy-review.md §6.1, 2026-09-04): reused
// (not re-implemented) for POST /api/partner/check-brn's account-scoped "1일
// 10회" limit via isRateLimitedWindow below — same documented per-instance/
// cold-start limitation applies there too. Accepted at v1.0 scale per
// ceo-decisions.md §2(b)-2 ("이건 열거를 막는 결정론적 보장이 아니라 억지 장치다"):
// a determined attacker with multiple accounts across multiple cold starts can
// still exceed 10/day/account in the worst case, but this stops casual/naive
// scripted enumeration, which is the actual threat model at 30-50 partners.

const MAX_TRACKED_KEYS = 5000 // safety valve against unbounded memory growth

const hits = new Map<string, number[]>()

function recordAndCheck(key: string, windowMs: number, maxRequestsPerWindow: number): boolean {
  const now = Date.now()
  const windowStart = now - windowMs

  const existing = hits.get(key) ?? []
  const recent = existing.filter((timestamp) => timestamp > windowStart)
  recent.push(now)
  hits.set(key, recent)

  if (hits.size > MAX_TRACKED_KEYS) {
    hits.clear()
  }

  return recent.length > maxRequestsPerWindow
}

export function isRateLimited(key: string): boolean {
  return recordAndCheck(key, 10 * 60 * 1000, 5)
}

// General-purpose variant with a caller-supplied window/threshold, sharing the
// same in-memory store (and its documented limitations) as isRateLimited above.
// Namespace `key` per caller (e.g. `brn:${accountId}`) to avoid cross-feature
// collisions in the shared Map.
export function isRateLimitedWindow(key: string, windowMs: number, maxRequestsPerWindow: number): boolean {
  return recordAndCheck(key, windowMs, maxRequestsPerWindow)
}
