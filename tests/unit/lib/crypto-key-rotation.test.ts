import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  encrypt,
  decrypt,
  isEncrypted,
  ensureEncrypted,
  wasEncryptedWithOldKey,
  reencryptWithActiveKey,
  getActiveKeyId,
  _clearKeyCacheForTesting,
} from '../../../src/lib/crypto'

describe('Issue #120 — AES-256-GCM key rotation support', () => {
  const origEnv = { ...process.env }

  beforeEach(() => {
    // Clear encryption key env vars + key cache between tests
    delete process.env.ENCRYPTION_KEY_V1
    delete process.env.ENCRYPTION_KEY_V2
    delete process.env.ACTIVE_ENCRYPTION_KEY_ID
    delete process.env.AUTH_SECRET
    delete process.env.NEXTAUTH_SECRET
    _clearKeyCacheForTesting()
  })

  afterEach(() => {
    process.env = { ...origEnv }
  })

  describe('backward compatibility — old enc:v1: format still decrypts', () => {
    it('uses AUTH_SECRET as v1 key when no ENCRYPTION_KEY_V* set (legacy mode)', () => {
      process.env.AUTH_SECRET = 'test-auth-secret'
      const encrypted = encrypt('my-token')
      expect(encrypted).toMatch(/^enc:v1:/)
      expect(decrypt(encrypted)).toBe('my-token')
    })

    it('old format enc:v1: values decrypt correctly', () => {
      process.env.AUTH_SECRET = 'legacy-secret-key'
      // Encrypt with v1, then decrypt — round-trip
      const encrypted = encrypt('bot-token-123')
      expect(encrypted.startsWith('enc:v1:')).toBe(true)
      expect(decrypt(encrypted)).toBe('bot-token-123')
    })
  })

  describe('key-id prefix in ciphertext format', () => {
    it('ciphertext format is enc:<keyId>:<iv>:<ciphertext>:<tag>', () => {
      process.env.AUTH_SECRET = 'test-secret'
      const encrypted = encrypt('test')
      const parts = encrypted.split(':')
      expect(parts[0]).toBe('enc')
      expect(parts[1]).toBe('v1') // keyId
      expect(parts).toHaveLength(5)
    })
  })

  describe('multiple keys + ACTIVE_ENCRYPTION_KEY_ID', () => {
    it('encrypts with the active key (v2) when ACTIVE_ENCRYPTION_KEY_ID=v2', () => {
      process.env.ENCRYPTION_KEY_V1 = 'key-one-secret'
      process.env.ENCRYPTION_KEY_V2 = 'key-two-secret'
      process.env.ACTIVE_ENCRYPTION_KEY_ID = 'v2'

      const encrypted = encrypt('rotated-token')
      expect(encrypted.startsWith('enc:v2:')).toBe(true)
      expect(getActiveKeyId()).toBe('v2')
    })

    it('decrypts v1-encrypted value with v1 key (during rotation)', () => {
      process.env.ENCRYPTION_KEY_V1 = 'key-one-secret'
      process.env.ENCRYPTION_KEY_V2 = 'key-two-secret'
      process.env.ACTIVE_ENCRYPTION_KEY_ID = 'v1'

      // Encrypt with v1 (old key)
      const v1Encrypted = encrypt('rotation-data')

      // Switch active key to v2 — old v1 data must still decrypt
      process.env.ACTIVE_ENCRYPTION_KEY_ID = 'v2'
      _clearKeyCacheForTesting()
      expect(decrypt(v1Encrypted)).toBe('rotation-data')
    })

    it('decrypts v2-encrypted value with v2 key', () => {
      process.env.ENCRYPTION_KEY_V1 = 'key-one-secret'
      process.env.ENCRYPTION_KEY_V2 = 'key-two-secret'
      process.env.ACTIVE_ENCRYPTION_KEY_ID = 'v2'

      const encrypted = encrypt('v2-data')
      expect(decrypt(encrypted)).toBe('v2-data')
    })
  })

  describe('wasEncryptedWithOldKey — re-encryption detection', () => {
    it('returns true when value was encrypted with a non-active key', () => {
      process.env.ENCRYPTION_KEY_V1 = 'key-one'
      process.env.ENCRYPTION_KEY_V2 = 'key-two'
      process.env.ACTIVE_ENCRYPTION_KEY_ID = 'v1'

      const oldEncrypted = encrypt('data')

      // Rotate to v2
      process.env.ACTIVE_ENCRYPTION_KEY_ID = 'v2'
      _clearKeyCacheForTesting()
      expect(wasEncryptedWithOldKey(oldEncrypted)).toBe(true)
    })

    it('returns false when value was encrypted with the active key', () => {
      process.env.AUTH_SECRET = 'test-secret'
      const encrypted = encrypt('data')
      expect(wasEncryptedWithOldKey(encrypted)).toBe(false)
    })

    it('returns false for non-encrypted values', () => {
      process.env.AUTH_SECRET = 'test-secret'
      expect(wasEncryptedWithOldKey('plaintext-token')).toBe(false)
    })
  })

  describe('reencryptWithActiveKey — background rotation', () => {
    it('re-encrypts an old-key value with the active key', () => {
      process.env.ENCRYPTION_KEY_V1 = 'key-one'
      process.env.ENCRYPTION_KEY_V2 = 'key-two'
      process.env.ACTIVE_ENCRYPTION_KEY_ID = 'v1'

      const oldValue = encrypt('reencrypt-me')

      // Rotate to v2 and re-encrypt
      process.env.ACTIVE_ENCRYPTION_KEY_ID = 'v2'
      _clearKeyCacheForTesting()
      const reencrypted = reencryptWithActiveKey(oldValue)

      expect(reencrypted.startsWith('enc:v2:')).toBe(true)
      expect(decrypt(reencrypted)).toBe('reencrypt-me')
    })

    it('does not re-encrypt a value already using the active key', () => {
      process.env.AUTH_SECRET = 'test-secret'
      const encrypted = encrypt('already-active')
      const result = reencryptWithActiveKey(encrypted)
      expect(result).toBe(encrypted) // unchanged
    })

    it('encrypts plaintext values (not previously encrypted)', () => {
      process.env.AUTH_SECRET = 'test-secret'
      const result = reencryptWithActiveKey('plaintext-token')
      expect(isEncrypted(result)).toBe(true)
      expect(decrypt(result)).toBe('plaintext-token')
    })
  })

  describe('ensureEncrypted is idempotent', () => {
    it('does not double-encrypt already-encrypted values', () => {
      process.env.AUTH_SECRET = 'test-secret'
      const encrypted = encrypt('token')
      const doubleEncrypted = ensureEncrypted(encrypted)
      expect(doubleEncrypted).toBe(encrypted)
    })
  })

  describe('error handling', () => {
    it('throws when decrypting with a missing key ID', () => {
      process.env.ENCRYPTION_KEY_V1 = 'key-one'
      process.env.ENCRYPTION_KEY_V2 = 'key-two'

      // Encrypt with v2
      process.env.ACTIVE_ENCRYPTION_KEY_ID = 'v2'
      const encrypted = encrypt('data')

      // Remove v2 key + clear cache so keys reload from env (without V2)
      delete process.env.ENCRYPTION_KEY_V2
      _clearKeyCacheForTesting()

      expect(() => decrypt(encrypted)).toThrow(/key.*v2.*not found/i)
    })
  })
})
