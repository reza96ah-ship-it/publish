/**
 * Per-platform-type token-bucket rate limiter. (Issue #147 E)
 *
 * BullMQ's `Worker` limiter (used in index.ts) is global to the whole
 * `publish-jobs` queue — one `{max, duration}` shared by every provider.
 * The installed bullmq version (5.79.2) does not expose per-group rate
 * limiting on `Worker` (that requires Pro/Enterprise job-scheduler groups),
 * so as a pragmatic alternative this adds an additional token-bucket per
 * PlatformType, checked right before the adapter's `publish()` call. If a
 * platform's bucket is empty the job is deferred (moved to delayed) rather
 * than calling the provider — same "defer, don't retry-count" treatment as
 * the existing circuit breaker.
 *
 * Issue #147 (horizontal scaling): the bucket now lives in Redis so N
 * worker replicas share one bucket per PlatformType. The refill + check +
 * decrement is a single atomic Lua script — concurrent workers can't
 * overdraw the bucket.
 *
 * If Redis is unavailable (or REDIS_URL is unset), falls back to the
 * pre-Redis in-memory token bucket. Degraded mode: N replicas → N× the
 * effective rate limit. A warning is logged on first fallback; further
 * warnings are rate-limited.
 *
 * Public API is async (was sync). Callers in index.ts await every call.
 */

import { getRedisClient } from './redis-client'
import type { PlatformType } from '../adapters/types'

interface Bucket {
  tokens: number
  lastRefillAt: number
}

interface BucketConfig {
  capacity: number
  refillPerMs: number // tokens added per millisecond
}

// Conservative limits derived from each provider's documented rate limits
// (see adapter file headers). Kept well under the documented ceiling to
// leave headroom for other workspaces sharing this worker process.
const PLATFORM_LIMITS: Record<PlatformType, { max: number; perMs: number }> = {
  telegram: { max: 25, perMs: 1000 }, // docs: 30 msg/sec global
  bale: { max: 25, perMs: 1000 }, // Telegram-Bot-API compatible
  rubika: { max: 10, perMs: 1000 },
  eitaa: { max: 10, perMs: 1000 },
  instagram: { max: 1, perMs: 18_000 }, // docs: 200 calls/hour ≈ 1 per 18s
  linkedin: { max: 1, perMs: 1000 }, // ~90 posts/day per member; stay slow
}

function configFor(platform: PlatformType): BucketConfig {
  const limit = PLATFORM_LIMITS[platform] ?? { max: 5, perMs: 1000 }
  return { capacity: limit.max, refillPerMs: limit.max / limit.perMs }
}

// ── Lua script ─────────────────────────────────────────────────
//
// Key: token_bucket:{platform}  (Redis hash)
//   tokens       — current token count (decimal string)
//   lastRefillAt — ms timestamp (decimal string)
//
// Single atomic op: read tokens + lastRefillAt, refill based on elapsed,
// check if >= 1, decrement if so, write back. Returns 1 (allowed) or 0
// (denied). Two concurrent workers can't both see "1 token left" and
// both succeed — the script runs to completion before the other starts.

const TOKEN_BUCKET_SCRIPT = `
-- KEYS[1] = token_bucket key
-- ARGV[1] = capacity (number)
-- ARGV[2] = refill_per_ms (number)
-- ARGV[3] = now (ms)
-- returns: 1 if a token was acquired, 0 otherwise
local data = redis.call('HMGET', KEYS[1], 'tokens', 'lastRefillAt')
local tokensStr = data[1]
local lastStr = data[2]
local capacity = tonumber(ARGV[1])
local refillPerMs = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local tokens, lastRefillAt
if not tokensStr or tokensStr == false then
  -- Fresh bucket: start full.
  tokens = capacity
  lastRefillAt = now
else
  tokens = tonumber(tokensStr) or 0
  lastRefillAt = tonumber(lastStr) or now
end

-- Refill based on elapsed time since lastRefillAt.
local elapsed = now - lastRefillAt
if elapsed > 0 then
  tokens = tokens + elapsed * refillPerMs
  if tokens > capacity then tokens = capacity end
  lastRefillAt = now
end

local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end

-- tostring on a float in Lua 5.1 may produce scientific notation for very
-- small/large numbers; for our value ranges (0..25, ms-scaled) it stays in
-- decimal form. Use string.format to be safe and bound precision.
redis.call('HMSET', KEYS[1],
  'tokens', string.format('%.6f', tokens),
  'lastRefillAt', string.format('%d', lastRefillAt))
-- Expire after 24h so abandoned platforms don't leak.
redis.call('EXPIRE', KEYS[1], 86400)
return allowed
`

type RedisClient = NonNullable<Awaited<ReturnType<typeof getRedisClient>>>
let tokenBucketSha: string | null = null

async function runTokenBucket(
  redis: RedisClient,
  key: string,
  capacity: number,
  refillPerMs: number,
  now: number
): Promise<number> {
  if (tokenBucketSha) {
    try {
      const r = await redis.evalsha(tokenBucketSha, 1, key, capacity, refillPerMs, now)
      return typeof r === 'number' ? r : Number(r)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.includes('NOSCRIPT')) throw err
      tokenBucketSha = null
    }
  }
  const r = await redis.eval(TOKEN_BUCKET_SCRIPT, 1, key, capacity, refillPerMs, now)
  if (!tokenBucketSha) {
    try {
      tokenBucketSha = (await redis.script('LOAD', TOKEN_BUCKET_SCRIPT)) as string
    } catch {
      // Non-fatal — next call will just EVAL again.
    }
  }
  return typeof r === 'number' ? r : Number(r)
}

export class PlatformRateLimiter {
  /** In-memory fallback (used only when Redis is unavailable). */
  private buckets = new Map<PlatformType, Bucket>()
  private fallbackWarned = false

  private key(platform: PlatformType): string {
    return `token_bucket:${platform}`
  }

  private getMem(platform: PlatformType): Bucket {
    let b = this.buckets.get(platform)
    if (!b) {
      const cfg = configFor(platform)
      b = { tokens: cfg.capacity, lastRefillAt: Date.now() }
      this.buckets.set(platform, b)
    }
    return b
  }

  private refillMem(platform: PlatformType, bucket: Bucket): void {
    const cfg = configFor(platform)
    const now = Date.now()
    const elapsed = now - bucket.lastRefillAt
    if (elapsed <= 0) return
    bucket.tokens = Math.min(cfg.capacity, bucket.tokens + elapsed * cfg.refillPerMs)
    bucket.lastRefillAt = now
  }

  private warnFallbackOnce(err: unknown): void {
    if (this.fallbackWarned) return
    this.fallbackWarned = true
    console.warn(
      '[rate-limiter] Redis op failed, using in-memory fallback (will retry Redis on next op):',
      err instanceof Error ? err.message : err
    )
    const t = setTimeout(() => {
      this.fallbackWarned = false
    }, 60_000)
    if (typeof (t as any).unref === 'function') (t as any).unref()
  }

  /**
   * Returns true and consumes one token if available; false if the bucket
   * is empty. Now async — callers must await.
   */
  async tryAcquire(platform: PlatformType): Promise<boolean> {
    const cfg = configFor(platform)
    const redis = await getRedisClient()
    if (redis) {
      try {
        const allowed = await runTokenBucket(
          redis,
          this.key(platform),
          cfg.capacity,
          cfg.refillPerMs,
          Date.now()
        )
        return allowed === 1
      } catch (err) {
        this.warnFallbackOnce(err)
        // fall through to in-memory
      }
    }
    const bucket = this.getMem(platform)
    this.refillMem(platform, bucket)
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      return true
    }
    return false
  }
}

export const platformRateLimiter = new PlatformRateLimiter()
