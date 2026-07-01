import { describe, it, expect, beforeEach } from 'vitest'
import { PlatformRateLimiter } from '../../../mini-services/publish-worker/lib/rate-limiter'

describe('Issue #147 E — PlatformRateLimiter (per-platform token bucket)', () => {
  let limiter: PlatformRateLimiter

  beforeEach(() => {
    limiter = new PlatformRateLimiter()
  })

  it('allows acquiring up to the bucket capacity immediately', () => {
    // telegram bucket capacity is 25 (see PLATFORM_LIMITS)
    let allowed = 0
    for (let i = 0; i < 25; i++) {
      if (limiter.tryAcquire('telegram')) allowed++
    }
    expect(allowed).toBe(25)
  })

  it('rejects once the bucket is exhausted', () => {
    for (let i = 0; i < 25; i++) limiter.tryAcquire('telegram')
    expect(limiter.tryAcquire('telegram')).toBe(false)
  })

  it('tracks separate buckets per platform — exhausting telegram does not affect linkedin', () => {
    for (let i = 0; i < 25; i++) limiter.tryAcquire('telegram')
    expect(limiter.tryAcquire('telegram')).toBe(false)
    expect(limiter.tryAcquire('linkedin')).toBe(true)
  })

  it('instagram (200 calls/hour ≈ 1 per 18s) only allows 1 immediate call', () => {
    expect(limiter.tryAcquire('instagram')).toBe(true)
    expect(limiter.tryAcquire('instagram')).toBe(false)
  })

  it('refills over time (bucket gains tokens back)', async () => {
    for (let i = 0; i < 25; i++) limiter.tryAcquire('telegram')
    expect(limiter.tryAcquire('telegram')).toBe(false)
    // telegram refills at 25 tokens/sec → waiting ~50ms should yield ~1 token
    await new Promise((r) => setTimeout(r, 80))
    expect(limiter.tryAcquire('telegram')).toBe(true)
  })
})
