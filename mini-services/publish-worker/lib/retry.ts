/**
 * Exponential backoff with jitter — per the architecture spec:
 * base 1s, factor 2, cap 5 min, jitter ±20%.
 */

export interface RetryPolicy {
  baseMs: number
  factor: number
  capMs: number
  jitterRatio: number // 0.2 = ±20%
  maxAttempts: number
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  baseMs: 1000,
  factor: 2,
  capMs: 5 * 60 * 1000,
  jitterRatio: 0.2,
  maxAttempts: 5,
}

export const CHANNEL_RETRY_POLICIES: Record<string, RetryPolicy> = {
  instagram: { ...DEFAULT_RETRY_POLICY, maxAttempts: 5 },
  rubika: { ...DEFAULT_RETRY_POLICY, maxAttempts: 5 },
  telegram: { ...DEFAULT_RETRY_POLICY, maxAttempts: 5 },
  linkedin: { ...DEFAULT_RETRY_POLICY, maxAttempts: 4 },
  eitaa: { ...DEFAULT_RETRY_POLICY, maxAttempts: 5 },
}

export function computeBackoff(
  attempt: number,
  policy: RetryPolicy,
  retryAfterMs?: number
): number {
  // P6.3: honor platform-provided retryAfter (e.g. Telegram's retry_after)
  if (typeof retryAfterMs === 'number' && retryAfterMs > 0) {
    const capped = Math.min(retryAfterMs, policy.capMs)
    const jitter = capped * policy.jitterRatio * (Math.random() * 2 - 1)
    return Math.max(0, Math.round(capped + jitter))
  }
  const raw = policy.baseMs * Math.pow(policy.factor, attempt)
  const capped = Math.min(raw, policy.capMs)
  const jitter = capped * policy.jitterRatio * (Math.random() * 2 - 1)
  return Math.max(0, Math.round(capped + jitter))
}

export function shouldRetry(attempt: number, retryable: boolean, policy: RetryPolicy): boolean {
  return retryable && attempt < policy.maxAttempts
}

/** Sleep helper that respects the computed backoff. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
