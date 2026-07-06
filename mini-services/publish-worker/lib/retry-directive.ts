/**
 * RetryDirective — normalized adapter outcome. (Issue #147 A)
 *
 * Every adapter returns a `PublishResult` (status / retryable / errorCategory).
 * Previously the worker only special-cased `errorCategory === 'auth'` as
 * permanent and threw a generic retryable Error for everything else — so a
 * `retryable: false` result with no category (or `status: 'action'`) still
 * fell into the retry branch and got retried by BullMQ needlessly.
 *
 * `normalizePublishResult()` is now the single place that maps a raw
 * adapter result onto exactly one `RetryDirective.kind`. The worker switches
 * on that kind (exhaustively — see index.ts) instead of re-deriving the
 * decision from raw fields.
 */

import type { ErrorCategory, PublishResult } from '../adapters/types'

export type RetryDirective =
  | { kind: 'success'; providerPostId: string; receipt?: unknown }
  | { kind: 'retry'; category: ErrorCategory; retryAt?: Date; safeMessage: string }
  | { kind: 'action_required'; category: ErrorCategory; safeMessage: string }
  | { kind: 'permanent_failure'; category: ErrorCategory; safeMessage: string }
  | { kind: 'outcome_unknown'; category: ErrorCategory; safeMessage: string }

const DEFAULT_SAFE_MESSAGE = 'خطای نامشخص'

/**
 * Map an adapter's raw `PublishResult` onto a `RetryDirective`.
 *
 * Priority order:
 *  1. `status === 'success'`                                    → success
 *  2. `outcomeUnknown === true` (e.g. a request timeout —        → outcome_unknown
 *     see lib/fetch-with-timeout.ts; we don't know if the
 *     provider received the request, so we must not blindly retry)
 *  3. `retryable === false` AND `status === 'action'`            → action_required
 *  4. `retryable === true`                                       → retry
 *  5. fallback (`retryable === false`, any other status)         → permanent_failure
 *
 * `errorCategory` absent on the adapter result is treated as `'unknown'`,
 * never as a free pass to retry.
 */
export function normalizePublishResult(result: PublishResult): RetryDirective {
  const category: ErrorCategory = result.errorCategory ?? 'unknown'
  const safeMessage = result.error ?? DEFAULT_SAFE_MESSAGE

  if (result.status === 'success') {
    return {
      kind: 'success',
      providerPostId: result.externalId ?? '',
      receipt: result.rawResponse,
    }
  }

  if (result.outcomeUnknown) {
    return { kind: 'outcome_unknown', category, safeMessage }
  }

  if (!result.retryable && result.status === 'action') {
    return { kind: 'action_required', category, safeMessage }
  }

  if (result.retryable) {
    const retryAt =
      typeof result.retryAfterMs === 'number' && result.retryAfterMs > 0
        ? new Date(Date.now() + result.retryAfterMs)
        : undefined
    return { kind: 'retry', category, safeMessage, ...(retryAt ? { retryAt } : {}) }
  }

  // retryable === false and status is 'failed' (or any non-'action' status) → permanent
  return { kind: 'permanent_failure', category, safeMessage }
}

/**
 * Exhaustive helper for `switch (directive.kind) { ... default: assertNever(directive) }`.
 * Forces a compile error if a new RetryDirective kind is added without
 * handling it everywhere it's switched on.
 */
export function assertNeverRetryDirective(directive: never): never {
  throw new Error(`Unhandled RetryDirective.kind: ${JSON.stringify(directive)}`)
}
