import { RATE_LIMIT_MS } from '../config'

const lastSent = new Map<number, number>()

export function checkRateLimit(userId: number): { allowed: boolean; retryAfterMs: number } {
  const last = lastSent.get(userId)
  const now = Date.now()
  if (last !== undefined && now - last < RATE_LIMIT_MS) {
    return { allowed: false, retryAfterMs: RATE_LIMIT_MS - (now - last) }
  }
  lastSent.set(userId, now)
  return { allowed: true, retryAfterMs: 0 }
}

export function resetRateLimit(): void {
  lastSent.clear()
}
