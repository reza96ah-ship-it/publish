/**
 * Issue #143: Workspace invitation token library.
 *
 * Security invariants:
 *   - Tokens are 256 bits of cryptographic randomness (32 bytes → base64url)
 *   - Only the SHA-256 hash is stored in the database (never the plaintext)
 *   - Tokens are compared by hash, not by plaintext string
 *   - Plaintext tokens are returned to the caller ONCE and never logged
 *
 * Expiry policy: 7 days (604800 seconds). Documented in AUTHORIZATION_MATRIX.md.
 */

import { randomBytes, createHash, timingSafeEqual } from 'crypto'

const TOKEN_BYTES = 32 // 256 bits
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Generate a new invitation token (plaintext) + its SHA-256 hash.
 * Returns { plaintext, hash, expiresAt }.
 *
 * The plaintext is returned to the caller ONCE so they can send it to the
 * invitee. Only the hash is persisted to the database.
 */
export function generateInvitationToken(): {
  plaintext: string
  hash: string
  expiresAt: Date
} {
  const bytes = randomBytes(TOKEN_BYTES)
  const plaintext = bytes.toString('base64url') // URL-safe, no padding
  const hash = hashToken(plaintext)
  const expiresAt = new Date(Date.now() + EXPIRY_MS)
  return { plaintext, hash, expiresAt }
}

/**
 * Hash a plaintext token using SHA-256.
 * The hash is what gets stored in the database.
 */
export function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

/**
 * Verify a plaintext token against a stored hash in constant time.
 * Prevents timing attacks that could reveal the hash.
 */
export function verifyToken(plaintext: string, storedHash: string): boolean {
  const computedHash = hashToken(plaintext)
  const computedBuf = Buffer.from(computedHash, 'hex')
  const storedBuf = Buffer.from(storedHash, 'hex')
  if (computedBuf.length !== storedBuf.length) return false
  return timingSafeEqual(computedBuf, storedBuf)
}

/**
 * Normalize an email address for consistent storage + comparison.
 * Lowercase + trim. This is the form stored in emailNormalized.
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

/**
 * Check if an invitation has expired.
 */
export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return now.getTime() > expiresAt.getTime()
}

/**
 * Check if an invitation is in a valid (usable) state.
 * Valid = not expired, not revoked, not accepted.
 */
export function isInvitationValid(inv: {
  expiresAt: Date
  acceptedAt: Date | null
  revokedAt: Date | null
  now?: Date
}): boolean {
  if (inv.acceptedAt) return false
  if (inv.revokedAt) return false
  if (isExpired(inv.expiresAt, inv.now ?? new Date())) return false
  return true
}

/**
 * Expiry duration in human-readable form (for documentation/UI).
 */
export const EXPIRY_DESCRIPTION = '۷ روز'
export const EXPIRY_HOURS = 7 * 24
