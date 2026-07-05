/**
 * Issue #255: Public API token generation + hashing.
 *
 * API tokens are long-lived bearer credentials issued by a workspace admin
 * so external integrations (Zapier, n8n, custom scripts) can call the
 * Nashrino REST API on the workspace's behalf. Unlike invitation tokens
 * (7-day expiry, single-use), API tokens:
 *   - Have no expiry by default (admins may set one)
 *   - Carry a scope list (content:read, content:write, …)
 *   - Can be revoked at any time (revokedAt is set, hash kept for audit)
 *   - Are prefixed with `nsh_` so they're recognizable in logs/leaks
 *
 * Security invariants (mirror src/lib/invitations.ts):
 *   - 256 bits of cryptographic randomness (32 bytes → base64url)
 *   - Only the SHA-256 hash is stored in the database (never the plaintext)
 *   - Plaintext is returned to the caller ONCE on creation; afterwards it
 *     is unrecoverable — admins must rotate the token if it's lost.
 *   - Comparison is by hash, never by plaintext string.
 *
 * Plaintext format: `nsh_<base64url(randomBytes(32))>` (~50 chars total).
 * The first 12 chars (e.g. `nsh_aB3xY9zK`) are stored as `prefix` for UI
 * display ("Token nsh_aB3xY9zK…") so admins can identify a token without
 * seeing the full secret.
 */

import { randomBytes, createHash, timingSafeEqual } from 'crypto'

const TOKEN_PREFIX = 'nsh_' // Nashrino API token prefix
const TOKEN_BYTES = 32 // 256 bits
const PREFIX_LENGTH = 12 // `nsh_` + 8 chars of randomness

/**
 * Generate a new API token.
 * Returns the plaintext (returned to the caller ONCE), the SHA-256 hash
 * (stored in the database), and the prefix (stored for UI display).
 */
export function generateApiToken(): {
  plaintext: string
  hash: string
  prefix: string
} {
  const bytes = randomBytes(TOKEN_BYTES)
  const plaintext = TOKEN_PREFIX + bytes.toString('base64url') // URL-safe, no padding
  const hash = hashToken(plaintext)
  const prefix = plaintext.slice(0, PREFIX_LENGTH)
  return { plaintext, hash, prefix }
}

/**
 * SHA-256 hash of a plaintext token. This is what gets stored in the
 * database as `tokenHash`. Same algorithm as invitations.hashToken but
 * kept separate so the two flows don't accidentally couple.
 */
export function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

/**
 * Verify a plaintext token against a stored hash in constant time.
 * Prevents timing attacks that could reveal the hash.
 *
 * Note: for API tokens, route handlers should use db.apiToken.findUnique
 * on `tokenHash` directly (the unique index does the lookup); this helper
 * exists for explicit verification paths (e.g. auditing a leaked token).
 */
export function verifyToken(plaintext: string, storedHash: string): boolean {
  const computedHash = hashToken(plaintext)
  const computedBuf = Buffer.from(computedHash, 'hex')
  const storedBuf = Buffer.from(storedHash, 'hex')
  if (computedBuf.length !== storedBuf.length) return false
  return timingSafeEqual(computedBuf, storedBuf)
}
