import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TelegramAdapter } from '../../../mini-services/publish-worker/adapters/telegram'
import { BaleAdapter } from '../../../mini-services/publish-worker/adapters/bale'
import { RubikaAdapter } from '../../../mini-services/publish-worker/adapters/rubika'
import { InstagramAdapter } from '../../../mini-services/publish-worker/adapters/instagram'
import { normalizePublishResult } from '../../../mini-services/publish-worker/lib/retry-directive'
import type {
  AdapterAccount,
  AdapterContent,
  AdapterJob,
} from '../../../mini-services/publish-worker/adapters/types'

function makeJob(account: AdapterAccount, contentOverrides: Partial<AdapterContent> = {}): AdapterJob {
  return {
    id: 'job-1',
    idempotencyKey: 'idem-1',
    retryCount: 0,
    content: {
      id: 'content-1',
      title: 'Title',
      body: 'Body',
      hashtags: null,
      thumbnailUrl: null,
      ...contentOverrides,
    },
    account,
  }
}

/**
 * Issue #147 A: prior to this fix, telegram/bale/rubika/eitaa never
 * populated PublishResult.errorCategory, so their permission/validation
 * errors fell into the worker's generic retry branch even when
 * retryable=false. This table-driven test verifies each adapter now
 * classifies its provider error codes the same way LinkedIn already did,
 * and that the resulting RetryDirective is correct end-to-end through the
 * normalizer.
 */
describe('Issue #147 A — adapter error classification → RetryDirective', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    global.fetch = fetchMock as any
  })

  function botResponse(status: number, description: string, errorCode: number) {
    return { json: async () => ({ ok: false, error_code: errorCode, description }) }
  }

  describe('Telegram', () => {
    const account: AdapterAccount = {
      id: 'p1',
      type: 'telegram',
      username: '@c',
      status: 'active',
      circuitState: 'closed',
      token: 't',
      targetId: '@c',
    }

    it('401 → auth, action_required (never retried)', async () => {
      fetchMock.mockResolvedValueOnce(botResponse(401, 'Unauthorized', 401))
      const result = await new TelegramAdapter().publish(makeJob(account))
      expect(result.errorCategory).toBe('auth')
      expect(result.retryable).toBe(false)
      expect(normalizePublishResult(result).kind).toBe('action_required')
    })

    it('429 → rate_limit, retry', async () => {
      fetchMock.mockResolvedValueOnce(botResponse(429, 'Too Many Requests', 429))
      const result = await new TelegramAdapter().publish(makeJob(account))
      expect(result.errorCategory).toBe('rate_limit')
      expect(result.retryable).toBe(true)
      expect(normalizePublishResult(result).kind).toBe('retry')
    })

    it('500 → network, retry', async () => {
      fetchMock.mockResolvedValueOnce(botResponse(500, 'Internal error', 500))
      const result = await new TelegramAdapter().publish(makeJob(account))
      expect(result.errorCategory).toBe('network')
      expect(result.retryable).toBe(true)
      expect(normalizePublishResult(result).kind).toBe('retry')
    })

    it('400 (validation) → unknown category, action_required (never retried)', async () => {
      // Telegram's adapter returns status:'action' for non-retryable errors
      // (signals "needs a user fix", e.g. an invalid chat_id) — the
      // normalizer maps retryable=false + status='action' to action_required,
      // not permanent_failure. Either way it must never be retried.
      fetchMock.mockResolvedValueOnce(botResponse(400, 'Bad Request: chat not found', 400))
      const result = await new TelegramAdapter().publish(makeJob(account))
      expect(result.errorCategory).toBe('unknown')
      expect(result.retryable).toBe(false)
      expect(normalizePublishResult(result).kind).toBe('action_required')
    })
  })

  describe('Bale', () => {
    const account: AdapterAccount = {
      id: 'p1',
      type: 'bale',
      username: '@c',
      status: 'active',
      circuitState: 'closed',
      token: 't',
      targetId: '@c',
    }

    it('403 → auth, action_required', async () => {
      fetchMock.mockResolvedValueOnce(botResponse(403, 'Forbidden', 403))
      const result = await new BaleAdapter().publish(makeJob(account))
      expect(result.errorCategory).toBe('auth')
      expect(normalizePublishResult(result).kind).toBe('action_required')
    })

    it('429 → rate_limit, retry', async () => {
      fetchMock.mockResolvedValueOnce(botResponse(429, 'rate limited', 429))
      const result = await new BaleAdapter().publish(makeJob(account))
      expect(result.errorCategory).toBe('rate_limit')
      expect(normalizePublishResult(result).kind).toBe('retry')
    })
  })

  describe('Rubika (and Eitaa via inheritance)', () => {
    const account: AdapterAccount = {
      id: 'p1',
      type: 'rubika',
      username: 'c',
      status: 'active',
      circuitState: 'closed',
      token: 't',
      targetId: 'c',
    }

    it('provider error with code 401 → auth, action_required', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ status: 'ERROR', code: 401, message: 'unauthorized' }),
      })
      const result = await new RubikaAdapter().publish(makeJob(account))
      expect(result.errorCategory).toBe('auth')
      expect(normalizePublishResult(result).kind).toBe('action_required')
    })

    it('network exception (fetch rejects) → network category, retry', async () => {
      fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'))
      const result = await new RubikaAdapter().publish(makeJob(account))
      expect(result.errorCategory).toBe('network')
      expect(result.retryable).toBe(true)
      expect(normalizePublishResult(result).kind).toBe('retry')
    })
  })

  describe('Instagram', () => {
    const account: AdapterAccount = {
      id: 'p1',
      type: 'instagram',
      username: 'u',
      status: 'active',
      circuitState: 'closed',
      token: 't',
      targetId: 'ig-1',
    }

    it('error code 190 (invalid/expired token) → auth, action_required', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ id: 'container-1' }),
      })
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ error: { message: 'token expired', code: 190 } }),
      })
      const result = await new InstagramAdapter().publish(
        makeJob(account, { mediaItems: [{ type: 'photo', url: 'https://x.com/i.jpg' }] })
      )
      expect(result.errorCategory).toBe('auth')
      expect(normalizePublishResult(result).kind).toBe('action_required')
    })

    it('error code 32 (rate limit) → rate_limit, retry', async () => {
      fetchMock.mockResolvedValueOnce({ json: async () => ({ id: 'container-1' }) })
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ error: { message: 'rate limit', code: 32 } }),
      })
      const result = await new InstagramAdapter().publish(
        makeJob(account, { mediaItems: [{ type: 'photo', url: 'https://x.com/i.jpg' }] })
      )
      expect(result.errorCategory).toBe('rate_limit')
      expect(normalizePublishResult(result).kind).toBe('retry')
    })
  })
})
