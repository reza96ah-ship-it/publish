/**
 * Token encryption — AES-256-GCM for platform tokens at rest.
 *
 * Uses a key derived from AUTH_SECRET via scryptSync (same KDF as passwords).
 * Storage format: "enc:v1:<iv_hex>:<ciphertext_hex>:<tag_hex>"
 *
 * If AUTH_SECRET is missing, falls back to plaintext (dev only).
 * In production, throws — never store plaintext tokens.
 */

import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // GCM standard IV length
const SALT = 'nashrino-token-encryption-salt'

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET is required for token encryption in production')
    }
    return scryptSync('nashrino-dev-secret', SALT, 32)
  }
  return scryptSync(secret, SALT, 32)
}

export function isEncrypted(value: string): boolean {
  return value?.startsWith('enc:v1:') ?? false
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex')
  ciphertext += cipher.final('hex')
  const tag = cipher.getAuthTag()
  return `enc:v1:${iv.toString('hex')}:${ciphertext}:${tag.toString('hex')}`
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
  let plaintext: string = decipher.update(ciphertext as any, 'hex', 'utf8') as string
  plaintext += decipher.final('utf8') as string
  return plaintext
}

export function ensureEncrypted(value: string): string {
  if (isEncrypted(value)) return value
  return encrypt(value)
}
