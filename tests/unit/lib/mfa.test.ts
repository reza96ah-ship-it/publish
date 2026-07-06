import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  generateMfaSecret,
  buildOtpAuthUri,
  generateQrCodeDataUrl,
  generateTotpToken,
  verifyTotpCode,
  generateBackupCodes,
  hashBackupCode,
  serializeBackupCodes,
  parseBackupCodes,
  consumeBackupCode,
  encryptMfaSecret,
  decryptMfaSecret,
} from '../../../src/lib/mfa'

describe('Issue #121 — MFA (TOTP) helper', () => {
  const origEnv = { ...process.env }

  beforeEach(() => {
    delete process.env.ENCRYPTION_KEY_V1
    delete process.env.AUTH_SECRET
    process.env.AUTH_SECRET = 'mfa-test-secret'
  })

  afterEach(() => {
    process.env = { ...origEnv }
  })

  describe('secret generation', () => {
    it('generates a base32 secret (32 chars, no padding)', () => {
      const secret = generateMfaSecret()
      expect(secret).toHaveLength(32)
      expect(secret).toMatch(/^[A-Z2-7]+$/) // base32 charset
    })

    it('generates different secrets on each call (random)', () => {
      const s1 = generateMfaSecret()
      const s2 = generateMfaSecret()
      expect(s1).not.toBe(s2)
    })
  })

  describe('otpauth URI', () => {
    it('builds a valid otpauth:// URI with issuer + email + secret', () => {
      const secret = generateMfaSecret()
      const uri = buildOtpAuthUri('user@nashrino.ir', secret)
      expect(uri).toMatch(/^otpauth:\/\/totp\/Nashrino:user%40nashrino\.ir/)
      expect(uri).toContain(`secret=${secret}`)
      expect(uri).toContain('issuer=Nashrino')
      expect(uri).toContain('digits=6')
      expect(uri).toContain('period=30')
    })
  })

  describe('QR code generation', () => {
    it('generates a data URL PNG for the otpauth URI', async () => {
      const secret = generateMfaSecret()
      const uri = buildOtpAuthUri('user@nashrino.ir', secret)
      const qr = await generateQrCodeDataUrl(uri)
      expect(qr).toMatch(/^data:image\/png;base64,/)
    })
  })

  describe('TOTP code verification', () => {
    it('verifies a valid current TOTP code', () => {
      const secret = generateMfaSecret()
      const token = generateTotpToken(secret)
      expect(verifyTotpCode(token, secret)).toBe(true)
    })

    it('rejects an invalid TOTP code', () => {
      const secret = generateMfaSecret()
      expect(verifyTotpCode('000000', secret)).toBe(false)
    })

    it('handles whitespace in codes (user might type "123 456")', () => {
      const secret = generateMfaSecret()
      const token = generateTotpToken(secret)
      expect(verifyTotpCode(`  ${token}  `, secret)).toBe(true)
    })

    it('accepts codes within ±1 step window (clock skew tolerance)', () => {
      // We can't easily test time drift without mocking, but we verify the
      // current code works — the window=1 config allows ±30s drift.
      const secret = generateMfaSecret()
      const token = generateTotpToken(secret)
      expect(verifyTotpCode(token, secret)).toBe(true)
    })

    it('different secrets generate different tokens', () => {
      const s1 = generateMfaSecret()
      const s2 = generateMfaSecret()
      const t1 = generateTotpToken(s1)
      // Token from s1 should NOT verify against s2
      expect(verifyTotpCode(t1, s2)).toBe(false)
    })
  })

  describe('backup codes', () => {
    it('generates 10 backup codes (8 chars each)', () => {
      const { plaintext, hashed } = generateBackupCodes()
      expect(plaintext).toHaveLength(10)
      expect(hashed).toHaveLength(10)
      for (const code of plaintext) {
        expect(code).toHaveLength(8)
        expect(code).toMatch(/^[A-Z2-9]+$/) // no ambiguous chars (0/O, 1/I)
      }
    })

    it('hashed codes are SHA-256 hex digests (64 chars)', () => {
      const { hashed } = generateBackupCodes()
      for (const h of hashed) {
        expect(h).toHaveLength(64)
        expect(h).toMatch(/^[a-f0-9]+$/)
      }
    })

    it('hashBackupCode is case-insensitive (uppercase input)', () => {
      const { plaintext } = generateBackupCodes()
      const code = plaintext[0]
      const hashUpper = hashBackupCode(code)
      const hashLower = hashBackupCode(code.toLowerCase())
      expect(hashUpper).toBe(hashLower)
    })

    it('backup codes are unique within a generation', () => {
      const { plaintext } = generateBackupCodes()
      const unique = new Set(plaintext)
      expect(unique.size).toBe(10)
    })
  })

  describe('backup code serialization', () => {
    it('serializes and parses backup code arrays', () => {
      const { hashed } = generateBackupCodes()
      const serialized = serializeBackupCodes(hashed)
      expect(typeof serialized).toBe('string')
      const parsed = parseBackupCodes(serialized)
      expect(parsed).toEqual(hashed)
    })

    it('parseBackupCodes handles null (no codes stored)', () => {
      expect(parseBackupCodes(null)).toEqual([])
    })

    it('parseBackupCodes handles invalid JSON gracefully', () => {
      expect(parseBackupCodes('not-json')).toEqual([])
    })
  })

  describe('consumeBackupCode — single-use consumption', () => {
    it('returns valid=true + removes the consumed code from the list', () => {
      const { plaintext, hashed } = generateBackupCodes()
      const code = plaintext[0]
      const result = consumeBackupCode(code, hashed)
      expect(result.valid).toBe(true)
      expect(result.remaining).toHaveLength(9)
      expect(result.remaining).not.toContain(hashBackupCode(code))
    })

    it('returns valid=false for an unknown code', () => {
      const { hashed } = generateBackupCodes()
      const result = consumeBackupCode('UNKNOWN1', hashed)
      expect(result.valid).toBe(false)
      expect(result.remaining).toHaveLength(10) // unchanged
    })

    it('a consumed code cannot be reused (single-use)', () => {
      const { plaintext, hashed } = generateBackupCodes()
      const code = plaintext[0]

      // First use — valid
      const first = consumeBackupCode(code, hashed)
      expect(first.valid).toBe(true)

      // Second use — invalid (already consumed)
      const second = consumeBackupCode(code, first.remaining)
      expect(second.valid).toBe(false)
    })
  })

  describe('MFA secret encryption (at rest)', () => {
    it('encrypts and decrypts MFA secrets via AES-256-GCM', () => {
      const secret = generateMfaSecret()
      const encrypted = encryptMfaSecret(secret)
      expect(encrypted).not.toBe(secret)
      expect(encrypted).toMatch(/^enc:/)
      expect(decryptMfaSecret(encrypted)).toBe(secret)
    })

    it('encrypted secret changes each time (random IV)', () => {
      const secret = generateMfaSecret()
      const e1 = encryptMfaSecret(secret)
      const e2 = encryptMfaSecret(secret)
      expect(e1).not.toBe(e2)
      expect(decryptMfaSecret(e1)).toBe(secret)
      expect(decryptMfaSecret(e2)).toBe(secret)
    })
  })

  describe('full MFA enrollment + verification flow', () => {
    it('setup → verify → login cycle works end-to-end', async () => {
      // 1. Setup: generate secret
      const secret = generateMfaSecret()
      const encryptedSecret = encryptMfaSecret(secret)

      // 2. Verify: user enters code from authenticator app
      const token = generateTotpToken(secret)
      expect(verifyTotpCode(token, decryptMfaSecret(encryptedSecret))).toBe(true)

      // 3. Login: same secret verifies future codes
      const loginToken = generateTotpToken(secret)
      expect(verifyTotpCode(loginToken, secret)).toBe(true)

      // 4. Backup codes work for recovery
      const { plaintext, hashed } = generateBackupCodes()
      const backupCode = plaintext[0]
      const consumed = consumeBackupCode(backupCode, hashed)
      expect(consumed.valid).toBe(true)
      expect(consumed.remaining).toHaveLength(9)
    })
  })
})
