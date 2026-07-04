import { describe, it, expect } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  isArgon2Hash,
  isLegacyScryptHash,
  _legacyHashPasswordForTesting,
} from '../../../src/lib/password'

describe('Issue #118 — Argon2id password hashing + scrypt migration', () => {
  describe('hashPassword produces Argon2id hashes', () => {
    it('hashes a password with $argon2id prefix', async () => {
      const hash = await hashPassword('myPassword123')
      expect(hash).toMatch(/^\$argon2id\$/)
    })

    it('includes OWASP-recommended parameters (m=65536, t=3, p=4)', async () => {
      const hash = await hashPassword('test')
      // PHC format: $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>
      expect(hash).toContain('m=65536')
      expect(hash).toContain('t=3')
      expect(hash).toContain('p=4')
    })

    it('different calls produce different hashes (random salt)', async () => {
      const h1 = await hashPassword('same')
      const h2 = await hashPassword('same')
      expect(h1).not.toBe(h2)
    })
  })

  describe('verifyPassword — Argon2id', () => {
    it('verifies a correct password', async () => {
      const hash = await hashPassword('correctPass')
      const result = await verifyPassword('correctPass', hash)
      expect(result.valid).toBe(true)
      expect(result.rehash).toBeUndefined()
    })

    it('rejects an incorrect password', async () => {
      const hash = await hashPassword('correctPass')
      const result = await verifyPassword('wrongPass', hash)
      expect(result.valid).toBe(false)
    })

    it('does not return rehash for Argon2id hashes', async () => {
      const hash = await hashPassword('test')
      const result = await verifyPassword('test', hash)
      expect(result.rehash).toBeUndefined()
    })
  })

  describe('verifyPassword — legacy scrypt migration', () => {
    it('verifies a legacy scrypt hash', async () => {
      const legacyHash = _legacyHashPasswordForTesting('oldPassword')
      expect(isLegacyScryptHash(legacyHash)).toBe(true)

      const result = await verifyPassword('oldPassword', legacyHash)
      expect(result.valid).toBe(true)
    })

    it('returns rehash signal for legacy scrypt hashes (gradual migration)', async () => {
      const legacyHash = _legacyHashPasswordForTesting('migrateMe')
      const result = await verifyPassword('migrateMe', legacyHash)

      expect(result.valid).toBe(true)
      expect(result.rehash).toBeDefined()
      expect(result.rehash).toMatch(/^\$argon2id\$/) // upgraded to Argon2id
    })

    it('rejected legacy hash does not return rehash', async () => {
      const legacyHash = _legacyHashPasswordForTesting('correct')
      const result = await verifyPassword('wrong', legacyHash)
      expect(result.valid).toBe(false)
      expect(result.rehash).toBeUndefined()
    })

    it('rehash produces a verifiable Argon2id hash', async () => {
      const legacyHash = _legacyHashPasswordForTesting('upgradeTest')
      const result = await verifyPassword('upgradeTest', legacyHash)
      const rehashed = result.rehash!

      // The rehashed value should verify as a valid Argon2id hash
      const reverify = await verifyPassword('upgradeTest', rehashed)
      expect(reverify.valid).toBe(true)
      expect(reverify.rehash).toBeUndefined() // already Argon2id, no further rehash
    })
  })

  describe('hash format detection', () => {
    it('isArgon2Hash detects $argon2 prefix', () => {
      expect(isArgon2Hash('$argon2id$v=19$m=65536,t=3,p=4$abc$def')).toBe(true)
      expect(isArgon2Hash('$argon2i$v=19$abc$def')).toBe(true)
      expect(isArgon2Hash('scrypt:16384:8:1:abc:def')).toBe(false)
      expect(isArgon2Hash('plaintext')).toBe(false)
    })

    it('isLegacyScryptHash detects scrypt: prefix', () => {
      expect(isLegacyScryptHash('scrypt:16384:8:1:abc:def')).toBe(true)
      expect(isLegacyScryptHash('$argon2id$v=19$abc$def')).toBe(false)
      expect(isLegacyScryptHash('plaintext')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('empty stored hash returns invalid', async () => {
      const result = await verifyPassword('test', '')
      expect(result.valid).toBe(false)
    })

    it('unknown hash format returns invalid', async () => {
      const result = await verifyPassword('test', 'unknown:format:hash')
      expect(result.valid).toBe(false)
    })

    it('handles empty password', async () => {
      const hash = await hashPassword('')
      const result = await verifyPassword('', hash)
      expect(result.valid).toBe(true)
    })
  })
})
