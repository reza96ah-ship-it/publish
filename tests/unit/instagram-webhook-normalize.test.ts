import { describe, expect, it } from 'vitest'
import { extractInstagramInboxEvents } from '../../src/modules/inbox/instagram-webhook-normalize'

describe('Instagram webhook inbox normalization', () => {
  it('extracts comment changes into inbox events', () => {
    const events = extractInstagramInboxEvents({
      object: 'instagram',
      entry: [
        {
          id: 'ig-account-1',
          time: 1_788_888_888,
          changes: [
            {
              field: 'comments',
              value: {
                id: 'comment-1',
                text: 'Price?',
                from: { id: 'user-1', username: 'buyer' },
                timestamp: '2026-07-10T10:00:00.000Z',
              },
            },
          ],
        },
      ],
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      providerAccountId: 'ig-account-1',
      providerThreadId: 'comment:comment-1',
      providerMessageId: 'comment-1',
      providerUserId: 'user-1',
      senderName: 'buyer',
      body: 'Price?',
      messageType: 'comment',
    })
  })

  it('extracts messaging events into DM thread events and skips echoes', () => {
    const events = extractInstagramInboxEvents({
      entry: [
        {
          id: 'ig-account-1',
          messaging: [
            {
              sender: { id: 'user-1' },
              timestamp: 1_788_888_888_000,
              message: { mid: 'mid-1', text: 'Hello' },
            },
            {
              sender: { id: 'ig-account-1' },
              timestamp: 1_788_888_889_000,
              message: { mid: 'mid-echo', text: 'Echo', is_echo: true },
            },
          ],
        },
      ],
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      providerAccountId: 'ig-account-1',
      providerThreadId: 'dm:user-1',
      providerMessageId: 'mid-1',
      messageType: 'dm',
      body: 'Hello',
    })
  })
})
