/**
 * Password hashing — Argon2id (Issue #118) with legacy scrypt migration.
 *
 * Previous implementation used synchronous scrypt (N=2^14, r=8, p=1) which:
 *   1. Fell below OWASP minimum (N=2^17 or p=5)
 *   2. Blocked the Node.js event loop during login (scryptSync)
 *
 * New implementation uses argon2id (async) with OWASP-recommended parameters:
 *   - memoryCost: 65536 KiB (64 MB) — GPU-resistant
 *   - timeCost: 3 iterations
 *   - parallelism: 4 lanes
 *
 * Migration: legacy scrypt hashes (prefix "scrypt:") still verify correctly.
 * On successful verification of a legacy hash, verifyPassword() returns a
 * `rehash` signal so the auth route can upgrade the stored hash to Argon2id
 * on the next login (gradual migration, no forced password reset).
 *
 * Detection: argon2 hashes start with "$argon2id$" (or "$argon2i$"/"$argon2d$").
 * Legacy hashes start with "scrypt:".
 */

import argon2 from 'argon2'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

// OWASP-recommended Argon2id parameters (Issue #118 spec)
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
} as const

// Legacy scrypt parameters (kept for verifying old hashes during migration)
const LEGACY_SCRYPT_N = 16384
const LEGACY_SCRYPT_R = 8
const LEGACY_SCRYPT_P = 1
const LEGACY_KEY_LEN = 64

/**
 * Hash a password using Argon2id.
 * Returns a PHC-formatted string: "$argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>"
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS)
}

/**
 * Result of password verification.
 * - `valid: true` means the password matched.
 * - `rehash?: string` is set when the stored hash is a legacy scrypt hash that
 *   was valid — the caller should update the stored hash to this Argon2id value
 *   for gradual migration (Issue #118 acceptance criterion).
 */
export interface VerifyResult {
  valid: boolean
  /** Present when a legacy scrypt hash was verified and should be upgraded. */
  rehash?: string
}

/**
 * Verify a password against a stored hash.
 *
 * Supports both:
 *   - Argon2id hashes (prefix "$argon2") — async, non-blocking
 *   - Legacy scrypt hashes (prefix "scrypt:") — sync, kept for migration
 *
 * Returns { valid, rehash } so the auth route can upgrade legacy hashes.
 */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<VerifyResult> {
  if (!stored) return { valid: false }

  // Argon2 hash (new format)
  if (isArgon2Hash(stored)) {
    const valid = await argon2.verify(stored, password)
    return { valid }
  }

  // Legacy scrypt hash (old format) — verify + signal rehash
  if (isLegacyScryptHash(stored)) {
    const valid = verifyLegacyScrypt(password, stored)
    if (!valid) return { valid: false }
    // Upgrade to Argon2id — caller persists this
    const rehash = await hashPassword(password)
    return { valid: true, rehash }
  }

  // Unknown format
  return { valid: false }
}

/**
 * Detect Argon2 hashes (PHC format starts with $argon2).
 */
export function isArgon2Hash(hash: string): boolean {
  return hash.startsWith('$argon2')
}

/**
 * Detect legacy scrypt hashes (our custom format starts with "scrypt:").
 */
export function isLegacyScryptHash(hash: string): boolean {
  return hash.startsWith('scrypt:')
}

/**
 * Verify a legacy scrypt hash (sync — kept only for migration).
 * Format: "scrypt:N:r:p:saltHex:hashHex"
 */
function verifyLegacyScrypt(password: string, stored: string): boolean {
  const parts = stored.split(':')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const N = parseInt(parts[1], 10)
  const r = parseInt(parts[2], 10)
  const p = parseInt(parts[3], 10)
  const salt = Buffer.from(parts[4], 'hex')
  const storedHash = Buffer.from(parts[5], 'hex')

  const hash = scryptSync(password, salt, storedHash.length, { N, r, p })

  // Constant-time comparison to prevent timing attacks
  if (hash.length !== storedHash.length) return false
  return timingSafeEqual(hash, storedHash)
}

/**
 * Synchronous legacy hash generator — ONLY for tests/seed scripts that need
 * to create a legacy hash to test migration. Never use in production code.
 */
export function _legacyHashPasswordForTesting(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, LEGACY_KEY_LEN, {
    N: LEGACY_SCRYPT_N,
    r: LEGACY_SCRYPT_R,
    p: LEGACY_SCRYPT_P,
  })
  return `scrypt:${LEGACY_SCRYPT_N}:${LEGACY_SCRYPT_R}:${LEGACY_SCRYPT_P}:${salt.toString('hex')}:${hash.toString('hex')}`
}
