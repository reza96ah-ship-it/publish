import { describe, it, expect } from 'vitest'
import {
  normalizePublishResult,
  type RetryDirective,
} from '../../../mini-services/publish-worker/lib/retry-directive'
import type { PublishResult } from '../../../mini-services/publish-worker/adapters/types'

function result(overrides: Partial<PublishResult>): PublishResult {
  return {
    externalId: null,
    rawResponse: {},
    status: 'failed',
    error: null,
    retryable: false,
    ...overrides,
  }
}

describe('Issue #147 A — normalizePublishResult (RetryDirective)', () => {
  it('success → kind: success, carries providerPostId + receipt', () => {
    const r = result({ status: 'success', externalId: 'msg-123', rawResponse: { ok: true } })
    const directive = normalizePublishResult(r)
    expect(directive.kind).toBe('success')
    if (directive.kind === 'success') {
      expect(directive.providerPostId).toBe('msg-123')
      expect(directive.receipt).toEqual({ ok: true })
    }
  })

  it('outcomeUnknown=true → kind: outcome_unknown, regardless of retryable/status', () => {
    const r = result({
      status: 'failed',
      retryable: true, // would otherwise be 'retry' — outcomeUnknown must win
      outcomeUnknown: true,
      errorCategory: 'network',
      error: 'timeout',
    })
    const directive = normalizePublishResult(r)
    expect(directive.kind).toBe('outcome_unknown')
    if (directive.kind === 'outcome_unknown') {
      expect(directive.category).toBe('network')
      expect(directive.safeMessage).toBe('timeout')
    }
  })

  it('retryable=false + status=action → kind: action_required', () => {
    const r = result({ status: 'action', retryable: false, errorCategory: 'auth', error: 'no token' })
    const directive = normalizePublishResult(r)
    expect(directive.kind).toBe('action_required')
    if (directive.kind === 'action_required') {
      expect(directive.category).toBe('auth')
    }
  })

  it('retryable=false + status=action + NO errorCategory → still action_required (absent category = unknown, not a free pass to retry)', () => {
    const r = result({ status: 'action', retryable: false, error: 'caption too long' })
    const directive = normalizePublishResult(r)
    expect(directive.kind).toBe('action_required')
    if (directive.kind === 'action_required') {
      expect(directive.category).toBe('unknown')
    }
  })

  it('retryable=true → kind: retry', () => {
    const r = result({ status: 'failed', retryable: true, errorCategory: 'rate_limit' })
    const directive = normalizePublishResult(r)
    expect(directive.kind).toBe('retry')
    if (directive.kind === 'retry') {
      expect(directive.category).toBe('rate_limit')
      expect(directive.retryAt).toBeUndefined()
    }
  })

  it('retryable=true + retryAfterMs → kind: retry with computed retryAt', () => {
    const before = Date.now()
    const r = result({ status: 'failed', retryable: true, errorCategory: 'rate_limit', retryAfterMs: 30_000 })
    const directive = normalizePublishResult(r)
    expect(directive.kind).toBe('retry')
    if (directive.kind === 'retry') {
      expect(directive.retryAt).toBeInstanceOf(Date)
      expect(directive.retryAt!.getTime()).toBeGreaterThanOrEqual(before + 30_000)
      expect(directive.retryAt!.getTime()).toBeLessThan(before + 31_000)
    }
  })

  it('retryable=false + status=failed → kind: permanent_failure', () => {
    const r = result({ status: 'failed', retryable: false, errorCategory: 'not_found' })
    const directive = normalizePublishResult(r)
    expect(directive.kind).toBe('permanent_failure')
    if (directive.kind === 'permanent_failure') {
      expect(directive.category).toBe('not_found')
    }
  })

  it('retryable=false, status neither success/action/failed → falls back to permanent_failure', () => {
    // Defensive case: PublishOutcome only has success|failed|action today, but
    // the normalizer must not silently retry an unrecognized non-retryable result.
    const r = result({ status: 'failed' as any, retryable: false })
    const directive = normalizePublishResult(r)
    expect(directive.kind).toBe('permanent_failure')
  })

  it('missing errorCategory never defaults to "auth" (no silent free pass)', () => {
    const r = result({ status: 'action', retryable: false })
    const directive = normalizePublishResult(r)
    expect(directive.kind).toBe('action_required')
    if (directive.kind === 'action_required') {
      expect(directive.category).not.toBe('auth')
      expect(directive.category).toBe('unknown')
    }
  })

  it('exhaustive kind coverage — every RetryDirective.kind is reachable', () => {
    const kinds: RetryDirective['kind'][] = [
      normalizePublishResult(result({ status: 'success', externalId: 'x' })).kind,
      normalizePublishResult(result({ status: 'failed', retryable: true })).kind,
      normalizePublishResult(result({ status: 'action', retryable: false })).kind,
      normalizePublishResult(result({ status: 'failed', retryable: false })).kind,
      normalizePublishResult(result({ status: 'failed', retryable: true, outcomeUnknown: true })).kind,
    ]
    expect(new Set(kinds)).toEqual(
      new Set(['success', 'retry', 'action_required', 'permanent_failure', 'outcome_unknown'])
    )
  })
})
