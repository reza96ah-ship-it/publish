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
      attachments: [],
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
      attachments: [],
    })
  })

  it('keeps attachment-only Instagram DMs visible', () => {
    const events = extractInstagramInboxEvents({
      entry: [
        {
          id: 'ig-account-1',
          messaging: [
            {
              sender: { id: 'user-1' },
              timestamp: 1_788_888_888_000,
              message: {
                mid: 'mid-image',
                attachments: [
                  {
                    type: 'image',
                    payload: {
                      id: 'media-1',
                      url: 'https://cdn.example.test/image.jpg',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      providerMessageId: 'mid-image',
      body: 'Instagram image attachment',
      messageType: 'dm',
      attachments: [
        {
          type: 'image',
          title: 'Image',
          url: 'https://cdn.example.test/image.jpg',
          providerId: 'media-1',
        },
      ],
    })
  })

  it('extracts postbacks as actionable DM events', () => {
    const events = extractInstagramInboxEvents({
      entry: [
        {
          id: 'ig-account-1',
          messaging: [
            {
              sender: { id: 'user-1' },
              timestamp: 1_788_888_888_000,
              postback: {
                mid: 'mid-postback',
                title: 'Start order',
                payload: 'ORDER_START',
              },
            },
          ],
        },
      ],
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      providerMessageId: 'mid-postback',
      body: 'Start order',
      messageType: 'dm',
      attachments: [
        {
          type: 'postback',
          title: 'Start order',
          url: null,
          providerId: 'ORDER_START',
        },
      ],
    })
  })

  it('preserves mention media metadata', () => {
    const events = extractInstagramInboxEvents({
      entry: [
        {
          id: 'ig-account-1',
          changes: [
            {
              field: 'mentions',
              value: {
                comment_id: 'mention-1',
                caption: 'Thanks for the shoutout',
                user_id: 'user-1',
                username: 'creator',
                media: {
                  id: 'media-1',
                  media_type: 'reel',
                  permalink: 'https://instagram.example.test/reel/1',
                },
              },
            },
          ],
        },
      ],
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      providerThreadId: 'mention:mention-1',
      providerUserId: 'user-1',
      senderName: 'creator',
      body: 'Thanks for the shoutout',
      messageType: 'mention',
      attachments: [
        {
          type: 'reel',
          title: 'Reel',
          url: 'https://instagram.example.test/reel/1',
          providerId: 'media-1',
        },
      ],
    })
  })
})
