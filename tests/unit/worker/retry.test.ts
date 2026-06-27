import { describe, it, expect } from 'vitest'
import { computeBackoff, shouldRetry, type RetryPolicy, DEFAULT_RETRY_POLICY } from '../../../mini-services/publish-worker/lib/retry'

describe('Worker — retry logic', () => {
  it('computeBackoff returns increasing values for consecutive attempts', () => {
    const policy: RetryPolicy = { ...DEFAULT_RETRY_POLICY, jitterRatio: 0 } // no jitter for deterministic test
    const b1 = computeBackoff(1, policy)
    const b2 = computeBackoff(2, policy)
    const b3 = computeBackoff(3, policy)
    
    expect(b1).toBe(2000)  // base * factor^1 = 1000 * 2
    expect(b2).toBe(4000)  // base * factor^2 = 1000 * 4
    expect(b3).toBe(8000)  // base * factor^3 = 1000 * 8
  })

  it('computeBackoff caps at policy.capMs', () => {
    const policy: RetryPolicy = { ...DEFAULT_RETRY_POLICY, jitterRatio: 0, capMs: 5000 }
    const b10 = computeBackoff(10, policy)
    expect(b10).toBe(5000)
  })

  it('computeBackoff honors retryAfterMs when provided', () => {
    const policy: RetryPolicy = { ...DEFAULT_RETRY_POLICY, jitterRatio: 0 }
    const backoff = computeBackoff(1, policy, 30_000) // Telegram says wait 30s
    expect(backoff).toBe(30_000)
  })

  it('computeBackoff caps retryAfterMs at policy.capMs', () => {
    const policy: RetryPolicy = { ...DEFAULT_RETRY_POLICY, jitterRatio: 0, capMs: 60_000 }
    const backoff = computeBackoff(1, policy, 120_000) // Telegram says 2min, but cap is 1min
    expect(backoff).toBe(60_000)
  })

  it('computeBackoff applies jitter within ±20%', () => {
    const policy: RetryPolicy = { ...DEFAULT_RETRY_POLICY, jitterRatio: 0.2 }
    const baseValue = 2000 // attempt 1, no retryAfter
    const results = Array.from({ length: 100 }, () => computeBackoff(1, policy))
    
    // All should be within ±20% of 2000
    for (const r of results) {
      expect(r).toBeGreaterThanOrEqual(Math.round(baseValue * 0.8))
      expect(r).toBeLessThanOrEqual(Math.round(baseValue * 1.2))
    }
    
    // Should have some variation (not all the same)
    const unique = new Set(results)
    expect(unique.size).toBeGreaterThan(1)
  })
})

describe('Worker — shouldRetry', () => {
  it('returns true when retryable and under max attempts', () => {
    expect(shouldRetry(1, true, DEFAULT_RETRY_POLICY)).toBe(true)
    expect(shouldRetry(4, true, DEFAULT_RETRY_POLICY)).toBe(true) // maxAttempts=5
  })

  it('returns false when not retryable', () => {
    expect(shouldRetry(1, false, DEFAULT_RETRY_POLICY)).toBe(false)
  })

  it('returns false when max attempts exceeded', () => {
    expect(shouldRetry(5, true, DEFAULT_RETRY_POLICY)).toBe(false) // attempt 5 = max
    expect(shouldRetry(6, true, DEFAULT_RETRY_POLICY)).toBe(false)
  })
})
