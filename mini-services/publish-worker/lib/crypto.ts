/**
 * Token encryption helpers for the publish worker.
 *
 * Keep this compatible with src/lib/crypto.ts. The worker Docker image copies
 * mini-services/publish-worker but not src/, so it needs its own runtime helper.
 */

import { createDecipheriv, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const SALT = 'nashrino-token-encryption-salt'

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET is required for token decryption in production')
    }
    return scryptSync('nashrino-dev-secret', SALT, 32)
  }
  return scryptSync(secret, SALT, 32)
}

export function isEncrypted(value: string): boolean {
  return value?.startsWith('enc:v1:') ?? false
}

export function decrypt(value: string): string {
  if (!isEncrypted(value)) return value
  const key = getKey()
  const parts = value.split(':')
  if (parts.length !== 5) throw new Error('Invalid encrypted token format')
  const iv = Buffer.from(parts[2], 'hex')
  const ciphertext = Buffer.from(parts[3], 'hex')
  const tag = Buffer.from(parts[4], 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
