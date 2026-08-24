// Design Ref: E1-R10 (Should) — rate limiting without adding a Turnstile-class
// dependency. This is a best-effort, in-memory, per-instance limiter: it resets on
// cold start and does not share state across concurrent Amplify SSR instances.
// It stops naive scripted abuse from a single instance/IP; it is NOT a substitute
// for Turnstile/hCaptcha if abuse becomes a real problem — flagged as a follow-up
// in the task summary, not implemented here (new external dependency decision).

const WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 5
const MAX_TRACKED_KEYS = 5000 // safety valve against unbounded memory growth

const hits = new Map<string, number[]>()

export function isRateLimited(key: string): boolean {
  const now = Date.now()
  const windowStart = now - WINDOW_MS

  const existing = hits.get(key) ?? []
  const recent = existing.filter((timestamp) => timestamp > windowStart)
  recent.push(now)
  hits.set(key, recent)

  if (hits.size > MAX_TRACKED_KEYS) {
    hits.clear()
  }

  return recent.length > MAX_REQUESTS_PER_WINDOW
}
