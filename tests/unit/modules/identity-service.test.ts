import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IdentityService } from '../../../src/modules/identity/service'
import { IdentityRepository } from '../../../src/modules/identity/repository'
import {
  ValidationError,
  MfaNotPendingError,
  MfaInvalidCodeError,
  MfaNotEnabledError,
  MfaInvalidDisableCodeError,
} from '../../../src/modules/identity/errors'
import {
  encryptMfaSecret,
  generateMfaSecret,
  generateTotpToken,
  hashBackupCode,
  serializeBackupCodes,
} from '../../../src/lib/mfa'
import type { AuthContext, MfaUserState } from '../../../src/modules/identity/types'

/**
 * Issue #156: Identity module — service-layer unit tests, no DB.
 *
 * The service depends on the repository interface, so we mock it and use the
 * real lib/mfa crypto (TOTP + backup-code hashing) to exercise real logic.
 */

const auth: AuthContext = { userId: 'user-1', email: 'user@example.com' }

function makeMockRepo(state: MfaUserState | null): IdentityRepository {
  return {
    findMfaState: vi.fn(async () => state),
    setPendingSecret: vi.fn(async () => {}),
    activateMfa: vi.fn(async () => {}),
    disableMfa: vi.fn(async () => {}),
  } as unknown as IdentityRepository
}

describe('Issue #156 — IdentityService (service-layer unit tests, no DB)', () => {
  const origEnv = { ...process.env }

  beforeEach(() => {
    process.env.AUTH_SECRET = 'identity-test-secret'
  })

  afterEach(() => {
    process.env = { ...origEnv }
  })

  describe('setupMfa', () => {
    it('persists an encrypted pending secret and returns QR + otpauth URI', async () => {
      const repo = makeMockRepo(null)
      const service = new IdentityService(repo)

      const result = await service.setupMfa(auth)

      expect(result.secret).toMatch(/^[A-Z2-7]+$/) // base32
      expect(result.otpauthUri).toContain('otpauth://totp/')
      expect(result.otpauthUri).toContain(encodeURIComponent(auth.email))
      expect(result.qrDataUrl).toMatch(/^data:image\//)

      expect(repo.setPendingSecret).toHaveBeenCalledTimes(1)
      const [userId, stored] = vi.mocked(repo.setPendingSecret).mock.calls[0]!
      expect(userId).toBe(auth.userId)
      // Stored value must be encrypted, never the plaintext base32 secret
      expect(stored).not.toBe(result.secret)
    })
  })

  describe('verifyMfa', () => {
    it('rejects a missing or non-string code', async () => {
      const service = new IdentityService(makeMockRepo(null))
      await expect(service.verifyMfa(auth, undefined)).rejects.toThrow(ValidationError)
      await expect(service.verifyMfa(auth, 123)).rejects.toThrow(ValidationError)
    })

    it('rejects when no pending secret exists', async () => {
      const repo = makeMockRepo({ mfaSecret: null, mfaSecretPending: null, mfaBackupCodes: null })
      const service = new IdentityService(repo)
      await expect(service.verifyMfa(auth, '123456')).rejects.toThrow(MfaNotPendingError)
    })

    it('rejects an invalid TOTP code', async () => {
      const secret = generateMfaSecret()
      const repo = makeMockRepo({
        mfaSecret: null,
        mfaSecretPending: encryptMfaSecret(secret),
        mfaBackupCodes: null,
      })
      const service = new IdentityService(repo)
      await expect(service.verifyMfa(auth, '000000')).rejects.toThrow(MfaInvalidCodeError)
      expect(repo.activateMfa).not.toHaveBeenCalled()
    })

    it('activates MFA with a valid code and returns backup codes once', async () => {
      const secret = generateMfaSecret()
      const encrypted = encryptMfaSecret(secret)
      const repo = makeMockRepo({
        mfaSecret: null,
        mfaSecretPending: encrypted,
        mfaBackupCodes: null,
      })
      const service = new IdentityService(repo)

      const { backupCodes } = await service.verifyMfa(auth, generateTotpToken(secret))

      expect(backupCodes).toHaveLength(10)
      expect(repo.activateMfa).toHaveBeenCalledTimes(1)
      const [userId, storedSecret, storedCodes] = vi.mocked(repo.activateMfa).mock.calls[0]!
      expect(userId).toBe(auth.userId)
      expect(storedSecret).toBe(encrypted) // pending secret promoted as-is
      // Only hashes are persisted — never the plaintext backup codes
      for (const code of backupCodes) {
        expect(storedCodes).not.toContain(code)
        expect(storedCodes).toContain(hashBackupCode(code))
      }
    })
  })

  describe('disableMfa', () => {
    it('rejects a missing code', async () => {
      const service = new IdentityService(makeMockRepo(null))
      await expect(service.disableMfa(auth, null)).rejects.toThrow(ValidationError)
    })

    it('rejects when MFA is not enabled', async () => {
      const repo = makeMockRepo({ mfaSecret: null, mfaSecretPending: null, mfaBackupCodes: null })
      const service = new IdentityService(repo)
      await expect(service.disableMfa(auth, '123456')).rejects.toThrow(MfaNotEnabledError)
    })

    it('disables MFA with a valid TOTP code', async () => {
      const secret = generateMfaSecret()
      const repo = makeMockRepo({
        mfaSecret: encryptMfaSecret(secret),
        mfaSecretPending: null,
        mfaBackupCodes: null,
      })
      const service = new IdentityService(repo)

      await service.disableMfa(auth, generateTotpToken(secret))
      expect(repo.disableMfa).toHaveBeenCalledWith(auth.userId)
    })

    it('disables MFA with a valid backup code when TOTP fails', async () => {
      const secret = generateMfaSecret()
      const backupCode = 'ABCD-1234'
      const repo = makeMockRepo({
        mfaSecret: encryptMfaSecret(secret),
        mfaSecretPending: null,
        mfaBackupCodes: serializeBackupCodes([hashBackupCode(backupCode)]),
      })
      const service = new IdentityService(repo)

      await service.disableMfa(auth, backupCode)
      expect(repo.disableMfa).toHaveBeenCalledWith(auth.userId)
    })

    it('rejects when neither TOTP nor backup code is valid', async () => {
      const secret = generateMfaSecret()
      const repo = makeMockRepo({
        mfaSecret: encryptMfaSecret(secret),
        mfaSecretPending: null,
        mfaBackupCodes: serializeBackupCodes([hashBackupCode('REAL-CODE')]),
      })
      const service = new IdentityService(repo)

      await expect(service.disableMfa(auth, 'WRONG-CODE')).rejects.toThrow(
        MfaInvalidDisableCodeError
      )
      expect(repo.disableMfa).not.toHaveBeenCalled()
    })
  })
})
