/**
 * Identity domain module — types.
 *
 * Covers MFA enrollment lifecycle (Issue #121): setup → verify → disable.
 */

/** Authenticated caller — routes resolve the session and pass this in. */
export interface AuthContext {
  userId: string
  email: string
}

/** Result of MFA setup — QR + URI for the authenticator app. */
export interface MfaSetupResult {
  qrDataUrl: string
  otpauthUri: string
  /** Text fallback in case QR scan fails. Shown once. */
  secret: string
}

/** Result of MFA verification — backup codes are shown ONCE. */
export interface MfaVerifyResult {
  backupCodes: string[]
}

/** MFA-related persisted state for a user. */
export interface MfaUserState {
  mfaSecret: string | null
  mfaSecretPending: string | null
  mfaBackupCodes: string | null
}
