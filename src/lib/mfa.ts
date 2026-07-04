/**
 * Issue #121: MFA (TOTP) helper — secret generation, QR code, backup codes.
 *
 * Uses otpauth for TOTP (RFC 6238) + qrcode for QR data URLs.
 * Secrets are stored encrypted via src/lib/crypto.ts (AES-256-GCM).
 *
 * Flow:
 *   1. setup: generate secret → encrypt as mfaSecretPending → return QR + otpauth URL
 *   2. verify: user enters 6-digit code → verify against mfaSecretPending →
 *      if valid, move to mfaSecret + generate backup codes
 *   3. login: after password verify, if mfaSecret exists, require TOTP code
 *   4. disable: clear mfaSecret + backup codes (requires current TOTP code)
 */

import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'
import { randomBytes, createHash } from 'crypto'
import { encrypt, decrypt } from './crypto'

const ISSUER = 'Nashrino'

/**
 * Generate a new TOTP secret (base32, 20 bytes → 32 chars).
 */
export function generateMfaSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32
}

/**
 * Build a TOTP instance from a base32 secret.
 * Config: SHA1, 6 digits, 30s period, ±1 step window (clock skew tolerance).
 */
function makeTotp(secret: string, label = 'user'): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  })
}

/**
 * Build the otpauth:// URI for QR code scanners (Google Authenticator, Authy, etc.).
 */
export function buildOtpAuthUri(email: string, secret: string): string {
  return makeTotp(secret, email).toString()
}

/**
 * Generate a QR code as a data URL (base64 PNG) for the otpauth URI.
 */
export async function generateQrCodeDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, {
    width: 256,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  })
}

/**
 * Generate the current 6-digit TOTP token for a secret.
 * (Used in tests; the authenticator app generates this on the user's device.)
 */
export function generateTotpToken(secret: string): string {
  return makeTotp(secret).generate()
}

/**
 * Verify a 6-digit TOTP code against a secret.
 * Allows ±1 step (30s) drift for clock skew.
 * Returns true if valid, false otherwise.
 */
export function verifyTotpCode(token: string, secret: string): boolean {
  try {
    const delta = makeTotp(secret).validate({
      token: token.replace(/\s/g, ''),
      window: 1, // ±1 step = ±30s
    })
    return delta !== null
  } catch {
    return false
  }
}

/**
 * Generate 10 single-use backup codes (8 chars each, alphanumeric).
 * Returns plaintext codes (to show user once) + hashed codes (to store).
 * Hashed with SHA-256 so a DB compromise doesn't reveal usable codes.
 */
export function generateBackupCodes(): { plaintext: string[]; hashed: string[] } {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars (0/O, 1/I)
  const plaintext: string[] = []
  for (let i = 0; i < 10; i++) {
    const bytes = randomBytes(8)
    let code = ''
    for (let j = 0; j < 8; j++) {
      code += chars[bytes[j] % chars.length]
    }
    plaintext.push(code)
  }
  const hashed = plaintext.map(hashBackupCode)
  return { plaintext, hashed }
}

/**
 * Hash a backup code with SHA-256 for storage.
 * Backup codes are single-use — we compare hashes on use, then remove from the list.
 */
export function hashBackupCode(code: string): string {
  return createHash('sha256').update(code.toUpperCase()).digest('hex')
}

/**
 * Encrypt an MFA secret for storage (AES-256-GCM via crypto.ts).
 */
export function encryptMfaSecret(secret: string): string {
  return encrypt(secret)
}

/**
 * Decrypt a stored MFA secret.
 */
export function decryptMfaSecret(encrypted: string): string {
  return decrypt(encrypted)
}

/**
 * Serialize backup code hashes for storage as a JSON string.
 */
export function serializeBackupCodes(hashedCodes: string[]): string {
  return JSON.stringify(hashedCodes)
}

/**
 * Parse stored backup codes from JSON string.
 */
export function parseBackupCodes(stored: string | null): string[] {
  if (!stored) return []
  try {
    return JSON.parse(stored)
  } catch {
    return []
  }
}

/**
 * Consume a backup code: if it matches (by hash), remove it from the list.
 * Returns { valid, remaining } so the caller can update storage.
 */
export function consumeBackupCode(
  inputCode: string,
  storedHashed: string[]
): { valid: boolean; remaining: string[] } {
  const inputHash = hashBackupCode(inputCode)
  const idx = storedHashed.indexOf(inputHash)
  if (idx === -1) {
    return { valid: false, remaining: storedHashed }
  }
  // Remove the consumed code (single-use)
  const remaining = [...storedHashed.slice(0, idx), ...storedHashed.slice(idx + 1)]
  return { valid: true, remaining }
}
