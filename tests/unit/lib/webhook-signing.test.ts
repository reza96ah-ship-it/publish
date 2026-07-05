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
      const ts = parseInt(timestamp, 10)
      expect(Math.abs(Date.now() / 1000 - ts)).toBeLessThan(5) // within 5 seconds
    })

    it('uses the provided timestamp when given', () => {
      const ts = 1700000000
      const { timestamp } = signWebhook(SECRET, PAYLOAD, ts)
      expect(timestamp).toBe(String(ts))
    })
  })

  describe('computeSignature', () => {
    it('computes HMAC-SHA256 of timestamp.payload', () => {
      const ts = '1700000000'
      const sig = computeSignature(SECRET, ts, PAYLOAD)
      expect(sig).toMatch(/^[a-f0-9]{64}$/)
    })

    it('is deterministic', () => {
      const ts = '1700000000'
      expect(computeSignature(SECRET, ts, PAYLOAD)).toBe(computeSignature(SECRET, ts, PAYLOAD))
    })

    it('differs for different payloads', () => {
      const ts = '1700000000'
      const sig1 = computeSignature(SECRET, ts, 'payload1')
      const sig2 = computeSignature(SECRET, ts, 'payload2')
      expect(sig1).not.toBe(sig2)
    })

    it('differs for different secrets', () => {
      const ts = '1700000000'
      const sig1 = computeSignature('secret1', ts, PAYLOAD)
      const sig2 = computeSignature('secret2', ts, PAYLOAD)
      expect(sig1).not.toBe(sig2)
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
      expect(verifyWebhookSignature('wrong-secret', signature, timestamp, PAYLOAD)).toBe(false)
    })

    it('returns false for a wrong signature format', () => {
      const { timestamp } = signWebhook(SECRET, PAYLOAD)
      expect(verifyWebhookSignature(SECRET, 'sha256=invalid', timestamp, PAYLOAD)).toBe(false)
    })

    it('returns false for an expired timestamp (replay protection)', () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600 // 10 minutes ago
      const { signature } = signWebhook(SECRET, PAYLOAD, oldTimestamp)
      expect(verifyWebhookSignature(SECRET, signature, String(oldTimestamp), PAYLOAD)).toBe(false)
    })

    it('returns false for a future timestamp beyond tolerance', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 600 // 10 minutes in future
      const { signature } = signWebhook(SECRET, PAYLOAD, futureTimestamp)
      expect(verifyWebhookSignature(SECRET, signature, String(futureTimestamp), PAYLOAD)).toBe(false)
    })

    it('accepts timestamps within the 5-minute tolerance', () => {
      const recentTimestamp = Math.floor(Date.now() / 1000) - 60 // 1 minute ago
      const { signature } = signWebhook(SECRET, PAYLOAD, recentTimestamp)
      expect(verifyWebhookSignature(SECRET, signature, String(recentTimestamp), PAYLOAD)).toBe(true)
    })
  })
})
