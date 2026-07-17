import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest'
import { PlatformRateLimiter } from '../../../mini-services/publish-worker/lib/rate-limiter'

// P1-10: tryAcquire is now async (Redis-backed under horizontal scaling,
// with an in-memory fallback). Force in-memory mode by unsetting REDIS_URL
// so these unit tests are deterministic regardless of CI environment.
beforeAll(() => {
  delete process.env.REDIS_URL
  delete process.env.REDIS_QUEUE_URL
})

describe('Issue #147 E — PlatformRateLimiter (per-platform token bucket)', () => {
  let limiter: PlatformRateLimiter

  beforeEach(() => {
    vi.useFakeTimers()
    limiter = new PlatformRateLimiter()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows acquiring up to the bucket capacity immediately', async () => {
    // telegram bucket capacity is 25 (see PLATFORM_LIMITS)
    let allowed = 0
    for (let i = 0; i < 25; i++) {
      if (await limiter.tryAcquire('telegram')) allowed++
    }
    expect(allowed).toBe(25)
  })

  it('rejects once the bucket is exhausted', async () => {
    for (let i = 0; i < 25; i++) await limiter.tryAcquire('telegram')
    expect(await limiter.tryAcquire('telegram')).toBe(false)
  })

  it('tracks separate buckets per platform — exhausting telegram does not affect linkedin', async () => {
    for (let i = 0; i < 25; i++) await limiter.tryAcquire('telegram')
    expect(await limiter.tryAcquire('telegram')).toBe(false)
    expect(await limiter.tryAcquire('linkedin')).toBe(true)
  })

  it('instagram (200 calls/hour ≈ 1 per 18s) only allows 1 immediate call', async () => {
    expect(await limiter.tryAcquire('instagram')).toBe(true)
    expect(await limiter.tryAcquire('instagram')).toBe(false)
  })

  it('refills over time (bucket gains tokens back)', async () => {
    for (let i = 0; i < 25; i++) await limiter.tryAcquire('telegram')
    expect(await limiter.tryAcquire('telegram')).toBe(false)
    // telegram refills at 25 tokens/sec → advancing 80ms yields ~2 tokens
    vi.advanceTimersByTime(80)
    expect(await limiter.tryAcquire('telegram')).toBe(true)
  })
})
