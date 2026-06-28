import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LinkedInAdapter } from '../../../mini-services/publish-worker/adapters/linkedin'
import type { AdapterJob, AdapterContent, AdapterAccount } from '../../../mini-services/publish-worker/adapters/types'

function makeAccount(overrides: Partial<AdapterAccount> = {}): AdapterAccount {
  return {
    id: 'plat-1',
    type: 'linkedin',
    username: 'test-user',
    status: 'active',
    circuitState: 'closed',
    token: 'linkedin-oauth-token',
    targetId: 'urn:li:person:12345',
    ...overrides,
  }
}

function makeContent(overrides: Partial<AdapterContent> = {}): AdapterContent {
  return {
    id: 'content-1',
    title: 'Test Post',
    body: 'Hello LinkedIn',
    hashtags: '#test',
    thumbnailUrl: null,
    ...overrides,
  }
}

function makeJob(overrides: Partial<AdapterJob> = {}): AdapterJob {
  return {
    id: 'job-1',
    idempotencyKey: 'idem-1',
    retryCount: 0,
    content: makeContent(),
    account: makeAccount(),
    ...overrides,
  }
}

describe('Issue #114 (CRITICAL) — LinkedIn adapter fix', () => {
  let adapter: LinkedInAdapter
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    adapter = new LinkedInAdapter()
    fetchMock = vi.fn()
    global.fetch = fetchMock as any
  })

  describe('endpoint: uses /rest/posts (not deprecated /v2/posts)', () => {
    it('POSTs to https://api.linkedin.com/rest/posts', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, {
          status: 201,
          headers: { 'x-restli-id': 'urn:li:share:6844785523593134080' },
        })
      )
      await adapter.publish(makeJob())

      const url = fetchMock.mock.calls[0][0]
      expect(url).toBe('https://api.linkedin.com/rest/posts')
      expect(url).not.toContain('/v2/posts')
    })
  })

  describe('required headers', () => {
    it('sends LinkedIn-Version header (YYYYMM format)', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, {
          status: 201,
          headers: { 'x-restli-id': 'urn:li:share:123' },
        })
      )
      await adapter.publish(makeJob())

      const headers = fetchMock.mock.calls[0][1].headers
      expect(headers['LinkedIn-Version']).toMatch(/^\d{6}$/) // YYYYMM
      expect(headers['LinkedIn-Version']).toBe('202505')
    })

    it('sends X-Restli-Protocol-Version: 2.0.0', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, {
          status: 201,
          headers: { 'x-restli-id': 'urn:li:share:123' },
        })
      )
      await adapter.publish(makeJob())

      const headers = fetchMock.mock.calls[0][1].headers
      expect(headers['X-Restli-Protocol-Version']).toBe('2.0.0')
    })

    it('sends Authorization: Bearer <token>', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, {
          status: 201,
          headers: { 'x-restli-id': 'urn:li:share:123' },
        })
      )
      await adapter.publish(makeJob({ account: makeAccount({ token: 'my-token-abc' }) }))

      const headers = fetchMock.mock.calls[0][1].headers
      expect(headers['Authorization']).toBe('Bearer my-token-abc')
    })
  })

  describe('201 response handling: extracts post ID from x-restli-id header (NOT body)', () => {
    it('returns the x-restli-id header value as externalId on 201', async () => {
      const postUrn = 'urn:li:share:6844785523593134080'
      fetchMock.mockResolvedValueOnce(
        new Response(null, {
          status: 201,
          headers: { 'x-restli-id': postUrn },
        })
      )

      const result = await adapter.publish(makeJob())

      expect(result.status).toBe('success')
      expect(result.externalId).toBe(postUrn)
      expect(result.retryable).toBe(false)
    })

    it('does NOT throw on empty 201 body (previous bug: res.json() crashed)', async () => {
      // 201 Created responses from LinkedIn have an EMPTY body.
      // The old code called `await res.json()` which threw "Unexpected end of JSON input".
      fetchMock.mockResolvedValueOnce(
        new Response(null, {
          status: 201,
          headers: { 'x-restli-id': 'urn:li:share:999' },
        })
      )

      const result = await adapter.publish(makeJob())
      expect(result.status).toBe('success')
      expect(result.externalId).toBe('urn:li:share:999')
    })

    it('falls back gracefully if x-restli-id header is missing', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 201 }))

      const result = await adapter.publish(makeJob())
      expect(result.status).toBe('success')
      expect(result.externalId).toBe('') // empty, not a crash
    })
  })

  describe('post body schema: visibility PUBLIC + distribution.feedDistribution MAIN_FEED', () => {
    it('sends visibility: "PUBLIC" (not the old object form)', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, {
          status: 201,
          headers: { 'x-restli-id': 'urn:li:share:1' },
        })
      )
      await adapter.publish(makeJob())

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.visibility).toBe('PUBLIC')
      // Must NOT be the old object form
      expect(typeof body.visibility).toBe('string')
    })

    it('sends distribution.feedDistribution: "MAIN_FEED"', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, {
          status: 201,
          headers: { 'x-restli-id': 'urn:li:share:1' },
        })
      )
      await adapter.publish(makeJob())

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.distribution).toBeDefined()
      expect(body.distribution.feedDistribution).toBe('MAIN_FEED')
    })

    it('sends lifecycleState: "PUBLISHED" + isReshareDisabledByAuthor: false', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, {
          status: 201,
          headers: { 'x-restli-id': 'urn:li:share:1' },
        })
      )
      await adapter.publish(makeJob())

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.lifecycleState).toBe('PUBLISHED')
      expect(body.isReshareDisabledByAuthor).toBe(false)
    })

    it('sends the author URN', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, {
          status: 201,
          headers: { 'x-restli-id': 'urn:li:share:1' },
        })
      )
      await adapter.publish(
        makeJob({ account: makeAccount({ targetId: 'urn:li:organization:5515715' }) })
      )

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.author).toBe('urn:li:organization:5515715')
    })
  })

  describe('normalizeLinkedInError — typed error categories', () => {
    it('401 → errorCategory: "auth" (never retried)', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 401, code: 'UNAUTHORIZED', message: 'token expired' }), {
          status: 401,
        })
      )

      const result = await adapter.publish(makeJob())

      expect(result.status).toBe('action') // not 'failed' — auth is permanent
      expect(result.retryable).toBe(false)
      expect(result.errorCategory).toBe('auth')
    })

    it('403 → errorCategory: "auth" (insufficient permissions)', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 403, message: 'forbidden' }), { status: 403 })
      )

      const result = await adapter.publish(makeJob())
      expect(result.errorCategory).toBe('auth')
      expect(result.retryable).toBe(false)
    })

    it('429 → errorCategory: "rate_limit" (retryable)', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 429, message: 'too many requests' }), { status: 429 })
      )

      const result = await adapter.publish(makeJob())
      expect(result.errorCategory).toBe('rate_limit')
      expect(result.retryable).toBe(true)
      expect(result.status).toBe('failed') // retryable → 'failed' so worker retries
    })

    it('500 → errorCategory: "network" (retryable server error)', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 500, message: 'internal error' }), { status: 500 })
      )

      const result = await adapter.publish(makeJob())
      expect(result.errorCategory).toBe('network')
      expect(result.retryable).toBe(true)
    })

    it('404 → errorCategory: "not_found" (permanent)', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 404, message: 'not found' }), { status: 404 })
      )

      const result = await adapter.publish(makeJob())
      expect(result.errorCategory).toBe('not_found')
      expect(result.retryable).toBe(false)
    })
  })

  describe('missing token / author → auth error, never retried', () => {
    it('missing token returns action with errorCategory: auth', async () => {
      const result = await adapter.publish(
        makeJob({ account: makeAccount({ token: undefined }) })
      )
      expect(result.status).toBe('action')
      expect(result.errorCategory).toBe('auth')
      expect(result.retryable).toBe(false)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('missing authorUrn returns action (not retried)', async () => {
      const result = await adapter.publish(
        makeJob({ account: makeAccount({ targetId: undefined }) })
      )
      expect(result.status).toBe('action')
      expect(result.retryable).toBe(false)
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
