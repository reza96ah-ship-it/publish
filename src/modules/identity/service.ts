/**
 * Identity domain module — service layer.
 *
 * Business logic for the MFA enrollment lifecycle (Issue #121).
 * No HTTP. No direct Prisma. Uses src/lib/mfa for TOTP/backup-code crypto.
 */

import {
  generateMfaSecret,
  buildOtpAuthUri,
  generateQrCodeDataUrl,
  encryptMfaSecret,
  decryptMfaSecret,
  verifyTotpCode,
  generateBackupCodes,
  serializeBackupCodes,
  parseBackupCodes,
  consumeBackupCode,
} from '@/lib/mfa'
import { IdentityRepository } from './repository'
import {
  ValidationError,
  MfaNotPendingError,
  MfaInvalidCodeError,
  MfaNotEnabledError,
  MfaInvalidDisableCodeError,
} from './errors'
import type { AuthContext, MfaSetupResult, MfaVerifyResult } from './types'

export class IdentityService {
  constructor(
    private readonly repo: IdentityRepository = new IdentityRepository()
  ) {}

  /**
   * Begin MFA enrollment: generate a TOTP secret, persist it encrypted as
   * pending, and return the QR/otpauth data for the authenticator app.
   * The secret is not active until verified.
   */
  async setupMfa(auth: AuthContext): Promise<MfaSetupResult> {
    const secret = generateMfaSecret()
    const otpauthUri = buildOtpAuthUri(auth.email, secret)
    const qrDataUrl = await generateQrCodeDataUrl(otpauthUri)

    await this.repo.setPendingSecret(auth.userId, encryptMfaSecret(secret))

    return { qrDataUrl, otpauthUri, secret }
  }

  /**
   * Verify the TOTP code against the pending secret and activate MFA.
   * Returns the plaintext backup codes — shown ONCE, only hashes are stored.
   */
  async verifyMfa(auth: AuthContext, code: unknown): Promise<MfaVerifyResult> {
    if (!code || typeof code !== 'string') {
      throw new ValidationError()
    }

    const user = await this.repo.findMfaState(auth.userId)
    if (!user?.mfaSecretPending) {
      throw new MfaNotPendingError()
    }

    const secret = decryptMfaSecret(user.mfaSecretPending)
    if (!verifyTotpCode(code, secret)) {
      throw new MfaInvalidCodeError()
    }

    const { plaintext, hashed } = generateBackupCodes()
    await this.repo.activateMfa(
      auth.userId,
      user.mfaSecretPending,
      serializeBackupCodes(hashed)
    )

    return { backupCodes: plaintext }
  }

  /**
   * Disable MFA. Requires the current TOTP code or an unused backup code.
   */
  async disableMfa(auth: AuthContext, code: unknown): Promise<void> {
    if (!code || typeof code !== 'string') {
      throw new ValidationError()
    }

    const user = await this.repo.findMfaState(auth.userId)
    if (!user?.mfaSecret) {
      throw new MfaNotEnabledError()
    }

    const secret = decryptMfaSecret(user.mfaSecret)
    if (!verifyTotpCode(code, secret)) {
      // Fall back to a backup code
      const stored = parseBackupCodes(user.mfaBackupCodes)
      const { valid } = consumeBackupCode(code, stored)
      if (!valid) {
        throw new MfaInvalidDisableCodeError()
      }
      // Disabling clears all MFA fields, so the consumed backup-code list
      // does not need to be persisted separately.
    }

    await this.repo.disableMfa(auth.userId)
  }
}
