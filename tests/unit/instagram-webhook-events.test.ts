import { describe, expect, it } from 'vitest'
import { buildProviderWebhookEventKey } from '../../src/modules/inbox/instagram-webhook'

describe('Instagram webhook event persistence helpers', () => {
  it('builds stable provider-scoped event keys from raw payloads', () => {
    const rawBody = JSON.stringify({ object: 'instagram', entry: [{ id: 'ig-1' }] })

    expect(buildProviderWebhookEventKey('instagram', rawBody)).toBe(
      buildProviderWebhookEventKey('instagram', rawBody)
    )
    expect(buildProviderWebhookEventKey('instagram', rawBody)).not.toBe(
      buildProviderWebhookEventKey('facebook', rawBody)
    )
    expect(buildProviderWebhookEventKey('instagram', rawBody)).not.toBe(
      buildProviderWebhookEventKey('instagram', `${rawBody} `)
    )
  })
})
