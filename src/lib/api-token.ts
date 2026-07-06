/**
 * Issue #255: Public API token generation + hashing.
 * API tokens are 256-bit random bearer credentials. Only the hash is stored.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const TOKEN_PREFIX = 'nsh_'
const TOKEN_BYTES = 32

export function generateApiToken(): { plaintext: string; hash: string; prefix: string } {
  const plaintext = TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString('base64url')
  return { plaintext, hash: hashToken(plaintext), prefix: plaintext.substring(0, 12) }
}

/** Hash a token using scrypt (memory-hard, CodeQL-approved). */
export function hashToken(plaintext: string): string {
  const salt = Buffer.from('nashrino-api-token-salt', 'utf8')
  return scryptSync(plaintext, salt, 64).toString('hex')
}

export function verifyToken(plaintext: string, storedHash: string): boolean {
  const computed = Buffer.from(hashToken(plaintext), 'hex')
  const stored = Buffer.from(storedHash, 'hex')
  return computed.length === stored.length && timingSafeEqual(computed, stored)
}
