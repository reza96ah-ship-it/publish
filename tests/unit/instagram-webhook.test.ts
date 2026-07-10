import { describe, expect, it } from 'vitest'
import {
  INSTAGRAM_APP_SECRET_ENV,
  INSTAGRAM_WEBHOOK_VERIFY_TOKEN_ENV,
  signInstagramWebhookBody,
  summarizeInstagramWebhookPayload,
  verifyInstagramWebhookChallenge,
  verifyInstagramWebhookSignature,
} from '../../src/modules/inbox/instagram-webhook'

describe('Instagram webhook verification', () => {
  it('accepts valid Meta subscribe challenges', () => {
    const params = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'verify-token',
      'hub.challenge': 'challenge-123',
    })

    expect(
      verifyInstagramWebhookChallenge(params, {
        [INSTAGRAM_WEBHOOK_VERIFY_TOKEN_ENV]: 'verify-token',
      })
    ).toEqual({ ok: true, challenge: 'challenge-123' })
  })

  it('rejects invalid challenge tokens', () => {
    const params = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong-token',
      'hub.challenge': 'challenge-123',
    })

    expect(
      verifyInstagramWebhookChallenge(params, {
        [INSTAGRAM_WEBHOOK_VERIFY_TOKEN_ENV]: 'verify-token',
      })
    ).toMatchObject({ ok: false, status: 403 })
  })

  it('verifies x-hub-signature-256 over the raw JSON body', () => {
    const rawBody = JSON.stringify({ object: 'instagram', entry: [{ id: 'entry-1' }] })
    const signature = signInstagramWebhookBody(rawBody, 'app-secret')

    expect(
      verifyInstagramWebhookSignature(rawBody, signature, {
        [INSTAGRAM_APP_SECRET_ENV]: 'app-secret',
      })
    ).toEqual({ ok: true })
    expect(
      verifyInstagramWebhookSignature(`${rawBody} `, signature, {
        [INSTAGRAM_APP_SECRET_ENV]: 'app-secret',
      })
    ).toMatchObject({ ok: false, status: 401 })
  })

  it('summarizes payload shape without trusting event contents yet', () => {
    expect(
      summarizeInstagramWebhookPayload({
        object: 'instagram',
        entry: [{ id: '1' }, { id: '2' }],
      })
    ).toEqual({ object: 'instagram', entryCount: 2, providerAccountId: '1' })
  })
})
