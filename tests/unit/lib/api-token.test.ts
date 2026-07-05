import { describe, it, expect } from 'vitest'
import { generateApiToken, hashToken, verifyToken } from '@/lib/api-token'

describe('api-token helpers', () => {
  describe('generateApiToken', () => {
    it('generates a token with the nsh_ prefix', () => {
      const { plaintext } = generateApiToken()
      expect(plaintext).toMatch(/^nsh_[A-Za-z0-9_-]+$/)
      expect(plaintext.length).toBeGreaterThan(30)
    })

    it('generates a SHA-256 hash (64 hex chars)', () => {
      const { hash } = generateApiToken()
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('generates a prefix for UI display', () => {
      const { prefix } = generateApiToken()
      expect(prefix).toMatch(/^nsh_/)
      expect(prefix.length).toBe(12) // nsh_ + 8 chars
    })

    it('generates unique tokens each call', () => {
      const a = generateApiToken()
      const b = generateApiToken()
      expect(a.plaintext).not.toBe(b.plaintext)
      expect(a.hash).not.toBe(b.hash)
    })
  })

  describe('hashToken', () => {
    it('produces a deterministic SHA-256 hash', () => {
      const token = 'nsh_test123'
      expect(hashToken(token)).toBe(hashToken(token))
    })

    it('produces a 64-char hex string', () => {
      expect(hashToken('test')).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  describe('verifyToken', () => {
    it('returns true for a matching plaintext + hash', () => {
      const { plaintext, hash } = generateApiToken()
      expect(verifyToken(plaintext, hash)).toBe(true)
    })

    it('returns false for a non-matching plaintext', () => {
      const { hash } = generateApiToken()
      expect(verifyToken('nsh_wrong', hash)).toBe(false)
    })

    it('returns false for a tampered hash', () => {
      const { plaintext } = generateApiToken()
      expect(verifyToken(plaintext, '0'.repeat(64))).toBe(false)
    })
  })
})
