/**
 * Issue #255: Public API token generation + hashing.
 *
 * API tokens are long-lived bearer credentials (NOT user passwords).
 * They are 256-bit cryptographically random values, not human-chosen
 * secrets, so SHA-256 hashing is appropriate (unlike passwords which
 * need Argon2id/bcrypt). Only the hash is stored; plaintext is shown
 * once on creation and is unrecoverable.
 */

import { randomBytes, createHash, timingSafeEqual } from 'crypto'

const TOKEN_PREFIX = 'nsh_'
const TOKEN_BYTES = 32

export function generateApiToken(): { plaintext: string; hash: string; prefix: string } {
  const plaintext = TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString('base64url')
  return { plaintext, hash: hashToken(plaintext), prefix: plaintext.substring(0, 12) }
}

export function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

export function verifyToken(plaintext: string, storedHash: string): boolean {
  const computed = Buffer.from(hashToken(plaintext), 'hex')
  const stored = Buffer.from(storedHash, 'hex')
  return computed.length === stored.length && timingSafeEqual(computed, stored)
}
