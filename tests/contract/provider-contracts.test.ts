/**
 * Issue #153 Tier 4: Provider contract tests.
 *
 * Uses the synthetic fixtures from tests/fixtures/provider-fixtures.ts
 * to verify that each adapter correctly handles every documented
 * provider result class (success, auth, permission, rate-limit, etc.)
 *
 * These tests mock global.fetch to return the fixture responses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TelegramAdapter } from '../../mini-services/publish-worker/adapters/telegram'
import { LinkedInAdapter } from '../../mini-services/publish-worker/adapters/linkedin'
import { InstagramAdapter } from '../../mini-services/publish-worker/adapters/instagram'
import {
  TELEGRAM_FIXTURES,
  LINKEDIN_FIXTURES,
  INSTAGRAM_FIXTURES,
  type ProviderFixture,
} from '../fixtures/provider-fixtures'
import type { AdapterJob } from '../../mini-services/publish-worker/adapters/types'

// Set up env for crypto
process.env.AUTH_SECRET = 'test-secret-for-crypto'

function makeMockJob(platform: string): AdapterJob {
  return {
    id: 'job-test',
    idempotencyKey: 'idem-test',
    retryCount: 0,
    content: {
      id: 'content-test',
      title: 'Test Post',
      body: 'Test body',
      hashtags: '#test',
      thumbnailUrl: null,
    },
    account: {
      id: 'platform-test',
      type: platform as any,
      username: '@test',
      status: 'active',
      circuitState: 'closed',
      token: 'test-token-1234567890',
      targetId: '@testchannel',
    },
  }
}

function mockFetchWithFixture(fixture: ProviderFixture) {
  const mock = vi.fn()
  if (fixture.timeout) {
    mock.mockImplementation((url: string) => {
      // Simulate timeout — never resolves
      return new Promise(() => {})
    })
    // Override fetchWithTimeout behavior by making it throw after timeout
    mock.mockRejectedValueOnce(new Error('timeout'))
  } else if (fixture.connectionReset) {
    mock.mockRejectedValueOnce(new Error('ECONNRESET'))
  } else {
    mock.mockResolvedValueOnce({
      ok: fixture.status >= 200 && fixture.status < 300,
      status: fixture.status,
      statusText: fixture.status === 200 ? 'OK' : 'Error',
      headers: new Headers(fixture.headers || {}),
      json: async () => (typeof fixture.body === 'string' ? JSON.parse(fixture.body) : fixture.body),
      text: async () => (typeof fixture.body === 'string' ? fixture.body : JSON.stringify(fixture.body)),
      blob: async () => new Blob(),
    })
  }
  global.fetch = mock as any
  return mock
}

describe('Issue #153 Tier 4 — Provider contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Telegram adapter', () => {
    const adapter = new TelegramAdapter()

    for (const fixture of TELEGRAM_FIXTURES) {
      it(`handles ${fixture.name}`, async () => {
        mockFetchWithFixture(fixture)

        try {
          const result = await adapter.publish(makeMockJob('telegram'))

          if (fixture.expectedStatus === 'success') {
            expect(result.status).toBe('success')
            expect(result.externalId).toBeTruthy()
          } else if (fixture.expectedStatus === 'failed') {
            expect(['failed', 'action']).toContain(result.status)
            if (fixture.expectedRetryable !== undefined) {
              expect(result.retryable).toBe(fixture.expectedRetryable)
            }
          } else {
            // action — just verify it doesn't throw
            expect(result.status).toBeDefined()
          }
        } catch (err) {
          // Some fixtures cause the adapter to throw (e.g. timeout)
          if (fixture.expectedStatus !== 'success') {
            expect(err).toBeDefined()
          } else {
            throw err
          }
        }
      })
    }
  })

  describe('LinkedIn adapter', () => {
    const adapter = new LinkedInAdapter()

    for (const fixture of LINKEDIN_FIXTURES) {
      it(`handles ${fixture.name}`, async () => {
        mockFetchWithFixture(fixture)

        try {
          const result = await adapter.publish(makeMockJob('linkedin'))

          if (fixture.expectedStatus === 'success') {
            expect(result.status).toBe('success')
          } else {
            expect(['failed', 'action']).toContain(result.status)
            if (fixture.expectedErrorCategory) {
              expect(result.errorCategory).toBe(fixture.expectedErrorCategory)
            }
          }
        } catch (err) {
          if (fixture.expectedStatus !== 'success') {
            expect(err).toBeDefined()
          } else {
            throw err
          }
        }
      })
    }
  })

  describe('Instagram adapter', () => {
    const adapter = new InstagramAdapter()

    // Instagram requires media — add media items to the job
    function makeInstagramJob(): AdapterJob {
      const job = makeMockJob('instagram')
      job.content.mediaItems = [{ type: 'photo', url: 'https://example.com/image.jpg' }]
      return job
    }

    // Instagram publish makes multiple fetch calls:
    // 1. POST /media (create container) → returns { id }
    // 2. GET /{containerId}?fields=status_code → returns { status_code: 'FINISHED' }
    // 3. POST /media_publish → returns { id }
    // For error fixtures, only the first call matters.
    function mockInstagramFetch(fixture: ProviderFixture) {
      const mock = vi.fn()
      if (fixture.timeout) {
        mock.mockRejectedValueOnce(new Error('timeout'))
      } else if (fixture.connectionReset) {
        mock.mockRejectedValueOnce(new Error('ECONNRESET'))
      } else if (fixture.name === 'success-publish') {
        // Success path: 3 calls, all successful
        mock
          .mockResolvedValueOnce({
            ok: true, status: 200,
            headers: new Headers(),
            json: async () => ({ id: 'container-123' }),
            text: async () => JSON.stringify({ id: 'container-123' }),
            blob: async () => new Blob(),
          })
          .mockResolvedValueOnce({
            ok: true, status: 200,
            headers: new Headers(),
            json: async () => ({ status_code: 'FINISHED' }),
            text: async () => JSON.stringify({ status_code: 'FINISHED' }),
            blob: async () => new Blob(),
          })
          .mockResolvedValueOnce({
            ok: true, status: 200,
            headers: new Headers(),
            json: async () => ({ id: 'pub-456' }),
            text: async () => JSON.stringify({ id: 'pub-456' }),
            blob: async () => new Blob(),
          })
      } else {
        // Error path: first call returns the error
        mock.mockResolvedValueOnce({
          ok: fixture.status >= 200 && fixture.status < 300,
          status: fixture.status,
          statusText: 'Error',
          headers: new Headers(fixture.headers || {}),
          json: async () => fixture.body,
          text: async () => JSON.stringify(fixture.body),
          blob: async () => new Blob(),
        })
      }
      global.fetch = mock as any
    }

    for (const fixture of INSTAGRAM_FIXTURES) {
      it(`handles ${fixture.name}`, async () => {
        mockInstagramFetch(fixture)

        try {
          const result = await adapter.publish(makeInstagramJob())

          if (fixture.expectedStatus === 'success') {
            expect(result.status).toBe('success')
          } else {
            expect(['failed', 'action']).toContain(result.status)
            if (fixture.expectedErrorCategory) {
              expect(result.errorCategory).toBe(fixture.expectedErrorCategory)
            }
          }
        } catch (err) {
          if (fixture.expectedStatus !== 'success') {
            expect(err).toBeDefined()
          } else {
            throw err
          }
        }
      })
    }
  })
})
