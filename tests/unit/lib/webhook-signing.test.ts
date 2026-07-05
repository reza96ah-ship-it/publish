import { describe, it, expect } from 'vitest'
import { signWebhook, verifyWebhookSignature, computeSignature } from '@/lib/webhook-signing'

const SECRET = 'test-webhook-secret-1234'
const PAYLOAD = JSON.stringify({ event: 'publish.success', data: { id: '123' } })

describe('webhook-signing', () => {
  describe('signWebhook', () => {
    it('produces a sha256=<hex> signature', () => {
      const { signature } = signWebhook(SECRET, PAYLOAD)
      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/)
    })

    it('produces a unix timestamp string', () => {
      const { timestamp } = signWebhook(SECRET, PAYLOAD)
      expect(timestamp).toMatch(/^\d+$/)
    })

    it('uses the provided timestamp when given', () => {
      const { timestamp } = signWebhook(SECRET, PAYLOAD, 1700000000)
      expect(timestamp).toBe('1700000000')
    })
  })

  describe('computeSignature', () => {
    it('is deterministic', () => {
      expect(computeSignature(SECRET, '1700000000', PAYLOAD)).toBe(computeSignature(SECRET, '1700000000', PAYLOAD))
    })

    it('differs for different payloads', () => {
      expect(computeSignature(SECRET, '1700000000', 'a')).not.toBe(computeSignature(SECRET, '1700000000', 'b'))
    })

    it('differs for different secrets', () => {
      expect(computeSignature('s1', '1700000000', PAYLOAD)).not.toBe(computeSignature('s2', '1700000000', PAYLOAD))
    })
  })

  describe('verifyWebhookSignature', () => {
    it('returns true for a valid signature', () => {
      const { signature, timestamp } = signWebhook(SECRET, PAYLOAD)
      expect(verifyWebhookSignature(SECRET, signature, timestamp, PAYLOAD)).toBe(true)
    })

    it('returns false for a tampered payload', () => {
      const { signature, timestamp } = signWebhook(SECRET, PAYLOAD)
      expect(verifyWebhookSignature(SECRET, signature, timestamp, 'tampered')).toBe(false)
    })

    it('returns false for a wrong secret', () => {
      const { signature, timestamp } = signWebhook(SECRET, PAYLOAD)
      expect(verifyWebhookSignature('wrong', signature, timestamp, PAYLOAD)).toBe(false)
    })

    it('returns false for an expired timestamp (replay protection)', () => {
      const oldTs = Math.floor(Date.now() / 1000) - 600
      const { signature } = signWebhook(SECRET, PAYLOAD, oldTs)
      expect(verifyWebhookSignature(SECRET, signature, String(oldTs), PAYLOAD)).toBe(false)
    })

    it('accepts timestamps within the 5-minute tolerance', () => {
      const recentTs = Math.floor(Date.now() / 1000) - 60
      const { signature } = signWebhook(SECRET, PAYLOAD, recentTs)
      expect(verifyWebhookSignature(SECRET, signature, String(recentTs), PAYLOAD)).toBe(true)
    })
  })
})
