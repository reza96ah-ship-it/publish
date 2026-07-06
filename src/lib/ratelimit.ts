/**
 * Redis-backed fixed-window rate limiter.
 *
 * Each window is keyed as `rl:{prefix}:{identifier}:{windowIndex}`.
 * The INCR is atomic; EXPIRE is set on the first increment so the key
 * auto-removes when the window passes.
 *
 * Degrades gracefully: if Redis is unavailable the request is allowed
 * through rather than blocking legitimate traffic.
 */

import { getRedisClient } from '@/lib/redis'

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number // Unix ms when the current window resets
}

async function checkLimit(
  prefix: string,
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowIndex = Math.floor(now / (windowSeconds * 1000))
  const key = `rl:${prefix}:${identifier}:${windowIndex}`
  const resetAt = (windowIndex + 1) * windowSeconds * 1000

  try {
    const redis = getRedisClient()
    const pipeline = redis.pipeline()
    pipeline.incr(key)
    pipeline.expire(key, windowSeconds + 1)
    const results = await pipeline.exec()
    const count = (results?.[0]?.[1] as number) ?? 0
    return {
      success: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    }
  } catch {
    // Fail open — Redis unavailable should not block traffic
    return { success: true, remaining: limit, resetAt }
  }
}

// Generic helper (kept for backwards compatibility)
export async function rateLimit(
  identifier: string,
  opts: { limit: number; window: number } = { limit: 20, window: 60 }
): Promise<RateLimitResult> {
  return checkLimit('generic', identifier, opts.limit, opts.window)
}

// Pre-configured limiters
// 15 AI generation requests per minute per IP
export const aiRateLimit = (ip: string) =>
  checkLimit('ai', ip, 15, 60)

// 5 auth/MFA attempts per 5 minutes per user
export const authRateLimit = (userId: string) =>
  checkLimit('auth', userId, 5, 300)

// 10 platform connect/validate attempts per minute per workspace+platform
export const platformRateLimit = (workspaceId: string, platformId: string) =>
  checkLimit('platform', `${workspaceId}:${platformId}`, 10, 60)

// 60 general API requests per minute per workspace
export const apiRateLimit = (identifier: string) =>
  checkLimit('api', identifier, 60, 60)

// Issue #255: 120 public-API requests per minute per API token.
// Keyed by token id (not by hash) so a revoked+rotated token gets a fresh
// budget. Generous enough for typical Zapier/n8n polling integrations but
// still caps runaway loops. Fail-open — Redis outage must not block traffic.
export const publicApiRateLimit = (tokenId: string) =>
  checkLimit('public-api', tokenId, 120, 60)
