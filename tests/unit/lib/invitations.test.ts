import { describe, it, expect } from 'vitest'
import {
  generateInvitationToken,
  hashToken,
  verifyToken,
  normalizeEmail,
  isExpired,
  isInvitationValid,
  EXPIRY_HOURS,
} from '../../../src/lib/invitations'

/**
 * Issue #143: Invitation lifecycle tests.
 *
 * Tests the token generation, hashing, verification, and validity logic.
 * Route-level tests would require mocking the auth guards + DB — those are
 * covered by the integration test pyramid in #153.
 */

describe('Issue #143 — Invitation token security', () => {
  describe('generateInvitationToken', () => {
    it('generates a plaintext token (base64url, 43+ chars = 256 bits)', () => {
      const { plaintext } = generateInvitationToken()
      expect(plaintext).toHaveLength(43) // 32 bytes → base64url without padding
      expect(plaintext).toMatch(/^[A-Za-z0-9_-]+$/) // base64url charset
    })

    it('generates a SHA-256 hash (64 hex chars)', () => {
      const { hash } = generateInvitationToken()
      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[a-f0-9]+$/)
    })

    it('generates different tokens on each call (cryptographic randomness)', () => {
      const t1 = generateInvitationToken()
      const t2 = generateInvitationToken()
      expect(t1.plaintext).not.toBe(t2.plaintext)
      expect(t1.hash).not.toBe(t2.hash)
    })

    it('sets expiry to 7 days from now', () => {
      const { expiresAt } = generateInvitationToken()
      const sevenDays = 7 * 24 * 60 * 60 * 1000
      const diff = expiresAt.getTime() - Date.now()
      // Allow 5s tolerance for test execution time
      expect(diff).toBeGreaterThan(sevenDays - 5000)
      expect(diff).toBeLessThan(sevenDays + 5000)
    })

    it('hash is NOT the plaintext (never store plaintext)', () => {
      const { plaintext, hash } = generateInvitationToken()
      expect(hash).not.toBe(plaintext)
    })
  })

  describe('hashToken', () => {
    it('produces the same hash for the same input (deterministic)', () => {
      const token = 'test-token-123'
      expect(hashToken(token)).toBe(hashToken(token))
    })

    it('produces different hashes for different inputs', () => {
      expect(hashToken('token-a')).not.toBe(hashToken('token-b'))
    })
  })

  describe('verifyToken', () => {
    it('returns true when plaintext matches the stored hash', () => {
      const { plaintext, hash } = generateInvitationToken()
      expect(verifyToken(plaintext, hash)).toBe(true)
    })

    it('returns false when plaintext does NOT match the hash', () => {
      const { hash } = generateInvitationToken()
      expect(verifyToken('wrong-token', hash)).toBe(false)
    })

    it('returns false for empty plaintext', () => {
      const { hash } = generateInvitationToken()
      expect(verifyToken('', hash)).toBe(false)
    })

    it('returns false for empty hash', () => {
      const { plaintext } = generateInvitationToken()
      expect(verifyToken(plaintext, '')).toBe(false)
    })

    it('is constant-time safe (does not throw on length mismatch)', () => {
      const { plaintext, hash } = generateInvitationToken()
      // Should not throw — just return false
      expect(() => verifyToken(plaintext.substring(0, 5), hash)).not.toThrow()
    })
  })

  describe('normalizeEmail', () => {
    it('lowercases the email', () => {
      expect(normalizeEmail('User@Example.COM')).toBe('user@example.com')
    })

    it('trims whitespace', () => {
      expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com')
    })

    it('handles mixed case + whitespace', () => {
      expect(normalizeEmail('  John.Doe@Gmail.COM  ')).toBe('john.doe@gmail.com')
    })
  })

  describe('isExpired', () => {
    it('returns false for a future date', () => {
      const future = new Date(Date.now() + 60000)
      expect(isExpired(future)).toBe(false)
    })

    it('returns true for a past date', () => {
      const past = new Date(Date.now() - 60000)
      expect(isExpired(past)).toBe(true)
    })

    it('returns true for the exact current time (or 1ms in the past)', () => {
      // Use 1ms ago to avoid race condition where Date.now() advances between
      // creating the Date and calling isExpired
      const now = new Date(Date.now() - 1)
      expect(isExpired(now)).toBe(true)
    })
  })

  describe('isInvitationValid', () => {
    it('returns true for a pending, non-expired invitation', () => {
      expect(
        isInvitationValid({
          expiresAt: new Date(Date.now() + 60000),
          acceptedAt: null,
          revokedAt: null,
        })
      ).toBe(true)
    })

    it('returns false for an accepted invitation', () => {
      expect(
        isInvitationValid({
          expiresAt: new Date(Date.now() + 60000),
          acceptedAt: new Date(),
          revokedAt: null,
        })
      ).toBe(false)
    })

    it('returns false for a revoked invitation', () => {
      expect(
        isInvitationValid({
          expiresAt: new Date(Date.now() + 60000),
          acceptedAt: null,
          revokedAt: new Date(),
        })
      ).toBe(false)
    })

    it('returns false for an expired invitation', () => {
      expect(
        isInvitationValid({
          expiresAt: new Date(Date.now() - 60000),
          acceptedAt: null,
          revokedAt: null,
        })
      ).toBe(false)
    })

    it('returns false for an expired + accepted invitation', () => {
      expect(
        isInvitationValid({
          expiresAt: new Date(Date.now() - 60000),
          acceptedAt: new Date(),
          revokedAt: null,
        })
      ).toBe(false)
    })
  })

  describe('expiry policy', () => {
    it('EXPIRY_HOURS is 168 (7 days)', () => {
      expect(EXPIRY_HOURS).toBe(168)
    })
  })
})
