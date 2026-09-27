import { afterEach, describe, expect, it, vi } from 'vitest'
import { ZernioInstagramAdapter } from '../../../mini-services/publish-worker/adapters/zernio-instagram'
import type { AdapterJob } from '../../../mini-services/publish-worker/adapters/types'

const accountId = '66b2e19d8c3f5a7e9d0b1c2d'
const adapter = new ZernioInstagramAdapter()

function job(): AdapterJob {
  return {
    id: 'job-1',
    retryCount: 0,
    idempotencyKey: 'stable-publication-operation',
    account: { id: 'platform-1', type: 'instagram', status: 'active', circuitState: 'closed', username: 'shop', providerAccountId: accountId },
    content: { id: 'content-1', title: 'Test', body: 'Hello', hashtags: '#shop', thumbnailUrl: null, mediaItems: [{ type: 'photo', url: 'https://example.com/photo.jpg' }] },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('Zernio Instagram publishing adapter', () => {
  it('uses the stable operation key and only accepts a confirmed Instagram publication', async () => {
    vi.stubEnv('ZERNIO_API_KEY', 'sk_test')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      post: { _id: '66a1f0c2a4b9d3e8f1a2b3c4', status: 'published', platforms: [{ platform: 'instagram', status: 'published', platformPostId: '1800000000' }] },
    }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(adapter.publish(job())).resolves.toMatchObject({ status: 'success', externalId: '1800000000' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://zernio.com/api/v1/posts')
    expect(init.headers['Idempotency-Key']).toBe('stable-publication-operation')
    expect(init.headers.Authorization).toBe('Bearer sk_test')
    expect(JSON.parse(init.body)).toEqual({
      content: 'Hello\n\n#shop',
      mediaItems: [{ type: 'image', url: 'https://example.com/photo.jpg' }],
      platforms: [{ platform: 'instagram', accountId }],
      publishNow: true,
    })
  })

  it('does not call the provider without a valid account, key, and media', async () => {
    vi.stubEnv('ZERNIO_API_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(adapter.publish(job())).resolves.toMatchObject({ status: 'failed', retryable: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('treats timeout as unknown to prevent duplicate posts', async () => {
    vi.stubEnv('ZERNIO_API_KEY', 'sk_test')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network timeout')))
    await expect(adapter.publish(job())).resolves.toMatchObject({ status: 'failed', outcomeUnknown: true, retryable: false })
  })

  it('does not mark a merely created Zernio post as published', async () => {
    vi.stubEnv('ZERNIO_API_KEY', 'sk_test')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      post: { _id: '66a1f0c2a4b9d3e8f1a2b3c4', status: 'publishing', platforms: [{ status: 'pending' }] },
    }), { status: 202 })))
    await expect(adapter.publish(job())).resolves.toMatchObject({ status: 'failed', outcomeUnknown: true })
  })
})
