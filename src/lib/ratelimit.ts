/**
 * Rate limiting — in-memory sliding window (no Redis needed for SQLite demo).
 *
 * Usage:
 *   import { rateLimit } from "@/lib/ratelimit";
 *   const { success, remaining } = await rateLimit(identifier, { limit: 10, window: 60 });
 *   if (!success) return NextResponse.json({ error: "تعداد درخواست‌ها زیاد است" }, { status: 429 });
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 60s
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 60_000)

export async function rateLimit(
  identifier: string,
  opts: { limit: number; window: number } = { limit: 20, window: 60 }
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  const now = Date.now()
  const key = identifier
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    // First request or window expired
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + opts.window * 1000,
    }
    store.set(key, newEntry)
    return { success: true, remaining: opts.limit - 1, resetAt: newEntry.resetAt }
  }

  if (entry.count >= opts.limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { success: true, remaining: opts.limit - entry.count, resetAt: entry.resetAt }
}

// Pre-configured limiters
export const aiRateLimit = (identifier: string) =>
  rateLimit(`ai:${identifier}`, { limit: 15, window: 60 }) // 15 AI requests per minute

export const authRateLimit = (identifier: string) =>
  rateLimit(`auth:${identifier}`, { limit: 5, window: 300 }) // 5 login attempts per 5 minutes

export const apiRateLimit = (identifier: string) =>
  rateLimit(`api:${identifier}`, { limit: 60, window: 60 }) // 60 API requests per minute
