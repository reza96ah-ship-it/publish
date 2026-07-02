/**
 * Identity domain module — repository layer.
 *
 * Data access only — no business logic. Wraps Prisma calls so the service
 * layer can be unit-tested with a mock repository.
 *
 * TOTP/backup-code crypto lives in src/lib/mfa (infrastructure), not here —
 * the repository only persists encrypted secrets and hashes.
 */

import { db } from '@/lib/db'
import type { MfaUserState } from './types'

export class IdentityRepository {
  /** Read the user's MFA state (encrypted secrets + backup code hashes). */
  async findMfaState(userId: string): Promise<MfaUserState | null> {
    return db.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaSecretPending: true, mfaBackupCodes: true },
    })
  }

  /** Store a freshly generated (encrypted) secret as pending enrollment. */
  async setPendingSecret(userId: string, encryptedSecret: string): Promise<void> {
    await db.user.update({
      where: { id: userId },
      data: { mfaSecretPending: encryptedSecret },
    })
  }

  /** Activate MFA: promote the pending secret and store backup code hashes. */
  async activateMfa(
    userId: string,
    encryptedSecret: string,
    serializedBackupCodes: string
  ): Promise<void> {
    await db.user.update({
      where: { id: userId },
      data: {
        mfaSecret: encryptedSecret,
        mfaSecretPending: null,
        mfaBackupCodes: serializedBackupCodes,
        mfaEnabledAt: new Date(),
      },
    })
  }

  /** Disable MFA: clear all MFA fields. */
  async disableMfa(userId: string): Promise<void> {
    await db.user.update({
      where: { id: userId },
      data: {
        mfaSecret: null,
        mfaSecretPending: null,
        mfaBackupCodes: null,
        mfaEnabledAt: null,
      },
    })
  }
}
