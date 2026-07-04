/**
 * Per-platform-type token-bucket rate limiter. (Issue #147 E)
 *
 * BullMQ's `Worker` limiter (used in index.ts) is global to the whole
 * `publish-jobs` queue — one `{max, duration}` shared by every provider.
 * The installed bullmq version (5.79.2) does not expose per-group rate
 * limiting on `Worker` (that requires Pro/Enterprise job-scheduler groups),
 * so as a pragmatic alternative this adds an additional in-process
 * token-bucket per PlatformType, checked right before the adapter's
 * `publish()` call. If a platform's bucket is empty the job is deferred
 * (moved to delayed) rather than calling the provider — same "defer, don't
 * retry-count" treatment as the existing circuit breaker.
 *
 * This is intentionally process-local (not Redis-backed): with a single
 * worker process (CONCURRENCY env var) this is sufficient to stay under
 * each provider's documented per-second/per-minute limits without spinning
 * up separate BullMQ queues per platform. If the worker is ever scaled to
 * multiple processes, this would need to move to a Redis-backed limiter.
 */

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

export class PlatformRateLimiter {
  private buckets = new Map<PlatformType, Bucket>()

  private get(platform: PlatformType): Bucket {
    let b = this.buckets.get(platform)
    if (!b) {
      const cfg = configFor(platform)
      b = { tokens: cfg.capacity, lastRefillAt: Date.now() }
      this.buckets.set(platform, b)
    }
    return b
  }

  private refill(platform: PlatformType, bucket: Bucket): void {
    const cfg = configFor(platform)
    const now = Date.now()
    const elapsed = now - bucket.lastRefillAt
    if (elapsed <= 0) return
    bucket.tokens = Math.min(cfg.capacity, bucket.tokens + elapsed * cfg.refillPerMs)
    bucket.lastRefillAt = now
  }

  /** Returns true and consumes one token if available; false if the bucket is empty. */
  tryAcquire(platform: PlatformType): boolean {
    const bucket = this.get(platform)
    this.refill(platform, bucket)
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      return true
    }
    return false
  }
}

export const platformRateLimiter = new PlatformRateLimiter()
