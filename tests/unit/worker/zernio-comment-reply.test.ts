import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendZernioPrivateCommentReply, sendZernioPublicCommentReply } from '../../../mini-services/publish-worker/lib/zernio-comment-reply'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('Zernio comment reply adapter', () => {
  it('sends one plain-text private reply without an unsafe automatic retry', async () => {
    vi.stubEnv('ZERNIO_API_KEY', 'sk_test')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'sent', messageId: 'message-1', platform: 'instagram' })))
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendZernioPrivateCommentReply('account-1', 'post-1', 'comment-1', 'Hello'))
      .resolves.toEqual({ messageId: 'message-1', recipientId: null })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://zernio.com/api/v1/inbox/comments/post-1/comment-1/private-reply')
    expect(JSON.parse(init.body)).toEqual({ accountId: 'account-1', message: 'Hello' })
    expect(init.headers.Authorization).toBe('Bearer sk_test')
  })

  it('makes public comment retries idempotent', async () => {
    vi.stubEnv('ZERNIO_API_KEY', 'sk_test')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { commentId: 'reply-1' } })))
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendZernioPublicCommentReply('account-1', 'post-1', 'comment-1', 'Thanks', 'rule:comment'))
      .resolves.toEqual({ id: 'reply-1' })
    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBe('rule:comment')
  })
})
