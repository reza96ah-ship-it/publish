import { describe, it, expect, vi, beforeEach } from 'vitest'

// Issue #115: Telegram caption limit (1024 for media, 4096 for text) + HTML escaping.
// We test the adapter's publish() behavior by mocking global.fetch.
// The escapeTelegramHtml function is private — we test it indirectly via publish().

// Mock the adapter module path to avoid importing the worker's db dependency.
// We import the TelegramAdapter class directly; it only depends on types + provider-capabilities.
import { TelegramAdapter } from '../../../mini-services/publish-worker/adapters/telegram'
import type { AdapterJob, AdapterContent, AdapterAccount } from '../../../mini-services/publish-worker/adapters/types'

function makeAccount(overrides: Partial<AdapterAccount> = {}): AdapterAccount {
  return {
    id: 'plat-1',
    type: 'telegram',
    username: '@testchannel',
    status: 'active',
    circuitState: 'closed',
    token: '123456:ABC-DEF',
    targetId: '@testchannel',
    ...overrides,
  }
}

function makeContent(overrides: Partial<AdapterContent> = {}): AdapterContent {
  return {
    id: 'content-1',
    title: 'عنوان تستی',
    body: 'متن پیام',
    hashtags: '#تست',
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

describe('Issue #115 — Telegram adapter: caption limit + HTML escaping', () => {
  let adapter: TelegramAdapter
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    adapter = new TelegramAdapter()
    fetchMock = vi.fn()
    global.fetch = fetchMock as any
  })

  describe('caption limit enforcement (1024 for media, 4096 for text)', () => {
    it('rejects media caption > 1024 chars with a clear Persian error', async () => {
      // Set title/hashtags to null so body length == caption length
      const longCaption = 'x'.repeat(1025)
      const job = makeJob({
        content: makeContent({
          title: null as any,
          body: longCaption,
          hashtags: null,
          mediaItems: [{ type: 'photo', url: 'https://example.com/img.jpg' }],
        }),
      })

      const result = await adapter.publish(job)

      expect(result.status).toBe('action')
      expect(result.retryable).toBe(false)
      expect(result.error).toContain('1024')
      expect(result.error).toContain('1025')
      // Must NOT have called fetch — validation happens before the API call
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('rejects text-only message > 4096 chars', async () => {
      const longText = 'x'.repeat(4097)
      const job = makeJob({
        content: makeContent({
          title: null as any,
          body: longText,
          hashtags: null,
          mediaItems: [],
        }),
      })

      const result = await adapter.publish(job)

      expect(result.status).toBe('action')
      expect(result.error).toContain('4096')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('accepts media caption exactly 1024 chars', async () => {
      const caption = 'x'.repeat(1024)
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { message_id: 42 } }),
      })
      const job = makeJob({
        content: makeContent({
          title: null as any,
          body: caption,
          hashtags: null,
          mediaItems: [{ type: 'photo', url: 'https://example.com/img.jpg' }],
        }),
      })

      const result = await adapter.publish(job)
      expect(result.status).toBe('success')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('uses 4096 limit for text-only (no media)', async () => {
      const text = 'x'.repeat(4096) // exactly at the limit
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { message_id: 42 } }),
      })
      const job = makeJob({
        content: makeContent({
          title: null as any,
          body: text,
          hashtags: null,
          mediaItems: [],
        }),
      })

      const result = await adapter.publish(job)
      expect(result.status).toBe('success')
    })
  })

  describe('HTML escaping (parse_mode=HTML injection prevention)', () => {
    it('escapes <b> tags so they render as text, not bold', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { message_id: 42 } }),
      })
      const job = makeJob({
        content: makeContent({
          title: null as any,
          body: 'Hello <b>world</b> & <i>friends</i>',
          hashtags: null,
          mediaItems: [],
        }),
      })

      await adapter.publish(job)

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(callBody.text).toBe('Hello &lt;b&gt;world&lt;/b&gt; &amp; &lt;i&gt;friends&lt;/i&gt;')
      expect(callBody.parse_mode).toBe('HTML')
    })

    it('escapes angle brackets in media captions too', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { message_id: 42 } }),
      })
      const job = makeJob({
        content: makeContent({
          title: null as any,
          body: 'Price: <100> USD & more',
          hashtags: null,
          mediaItems: [{ type: 'photo', url: 'https://example.com/img.jpg' }],
        }),
      })

      await adapter.publish(job)

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(callBody.caption).toBe('Price: &lt;100&gt; USD &amp; more')
    })

    it('escapes ampersands (& → &amp;) to avoid malformed entities', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { message_id: 42 } }),
      })
      const job = makeJob({
        content: makeContent({
          title: null as any,
          body: 'Tom & Jerry <cartoon>',
          hashtags: null,
          mediaItems: [],
        }),
      })

      await adapter.publish(job)

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(callBody.text).toBe('Tom &amp; Jerry &lt;cartoon&gt;')
    })

    it('raw <b> in user content is escaped — does NOT render as bold', async () => {
      // The core issue #115: content with <b> tags must NOT be rendered as bold.
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { message_id: 42 } }),
      })
      const job = makeJob({
        content: makeContent({
          title: null as any,
          body: 'Not bold <b>but escaped</b>',
          hashtags: null,
          mediaItems: [],
        }),
      })

      await adapter.publish(job)

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
      // The escaped form must contain &lt;b&gt; — proving it won't render as bold
      expect(callBody.text).toContain('&lt;b&gt;')
      expect(callBody.text).not.toMatch(/<b>[^<]/) // no raw <b> followed by text
    })
  })

  describe('validateReadiness uses registry limits (1024 for media, 4096 for text)', () => {
    it('flags caption_too_long when media present and body > 1024', async () => {
      const result = await adapter.validateReadiness(
        makeContent({
          body: 'x'.repeat(1025),
          mediaItems: [{ type: 'photo', url: 'https://example.com/img.jpg' }],
        }),
        makeAccount()
      )
      expect(result.ready).toBe(false)
      expect(result.issues.some((i) => i.code === 'caption_too_long')).toBe(true)
      // The message should reference the 1024 limit, not 4096
      const capIssue = result.issues.find((i) => i.code === 'caption_too_long')!
      expect(capIssue.message).toContain('1024')
    })

    it('does not flag when text-only body is 2000 chars (under 4096 text limit)', async () => {
      const result = await adapter.validateReadiness(
        makeContent({ body: 'x'.repeat(2000), mediaItems: [] }),
        makeAccount()
      )
      expect(result.issues.some((i) => i.code === 'caption_too_long')).toBe(false)
    })
  })
})
