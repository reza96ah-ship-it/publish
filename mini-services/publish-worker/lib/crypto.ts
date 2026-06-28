/**
 * Token encryption helpers for the publish worker — AES-256-GCM with key rotation (Issue #120).
 *
 * KEEP IN SYNC with src/lib/crypto.ts (canonical). The worker Docker image copies
 * mini-services/publish-worker but not src/, so it needs its own runtime helper.
 *
 * The worker only needs DECRYPTION (to read platform tokens before publishing).
 * Encryption is done by the app (src/lib/crypto.ts) when platforms connect.
 * We include encrypt() for completeness and testing parity.
 */

import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const SALT_PREFIX = 'nashrino-token-encryption-salt-'

interface EncryptionKey {
  id: string
  key: Buffer
}

const keyCache = new Map<string, EncryptionKey>()

function deriveKey(keyId: string, secret: string): Buffer {
  return scryptSync(secret, SALT_PREFIX + keyId, 32)
}

function loadKeys(): Map<string, EncryptionKey> {
  if (keyCache.size > 0) return keyCache

  const keys = new Map<string, EncryptionKey>()

  for (let v = 1; v <= 10; v++) {
    const envVal = process.env[`ENCRYPTION_KEY_V${v}`]
    if (envVal) {
      const keyId = `v${v}`
      keys.set(keyId, { id: keyId, key: deriveKey(keyId, envVal) })
    }
  }

  if (keys.size === 0) {
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
    if (secret) {
      keys.set('v1', { id: 'v1', key: deriveKey('v1', secret) })
    } else if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'ENCRYPTION_KEY_V1 or AUTH_SECRET is required for token decryption in production'
      )
    } else {
      keys.set('v1', { id: 'v1', key: deriveKey('v1', 'nashrino-dev-secret') })
    }
  }

  for (const [id, k] of keys) keyCache.set(id, k)
  return keys
}

function getActiveKey(): EncryptionKey {
  const keys = loadKeys()
  const activeId = process.env.ACTIVE_ENCRYPTION_KEY_ID
  if (activeId && keys.has(activeId)) {
    return keys.get(activeId)!
  }
  const first = keys.values().next()
  if (first.done) throw new Error('No encryption keys configured')
  return first.value
}

function getKey(keyId: string): EncryptionKey | undefined {
  return loadKeys().get(keyId)
}

export function isEncrypted(value: string): boolean {
  return value?.startsWith('enc:') ?? false
}

export function encrypt(plaintext: string): string {
  const activeKey = getActiveKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, activeKey.key, iv)
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex')
  ciphertext += cipher.final('hex')
  const tag = cipher.getAuthTag()
  return `enc:${activeKey.id}:${iv.toString('hex')}:${ciphertext}:${tag.toString('hex')}`
}

export function decrypt(value: string): string {
  if (!isEncrypted(value)) return value
  const parts = value.split(':')
  if (parts.length !== 5) throw new Error('Invalid encrypted token format')
  // noUncheckedIndexedAccess: parts[N] is string | undefined — guard explicitly
  const keyId = parts[1]
  const ivHex = parts[2]
  const ctHex = parts[3]
  const tagHex = parts[4]
  if (!keyId || !ivHex || !ctHex || !tagHex) {
    throw new Error('Invalid encrypted token format — missing segments')
  }
  const iv = Buffer.from(ivHex, 'hex')
  const ciphertext = Buffer.from(ctHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')

  const encryptionKey = getKey(keyId)
  if (!encryptionKey) {
    throw new Error(
      `Encryption key "${keyId}" not found — set ENCRYPTION_KEY_${keyId.toUpperCase()} to decrypt this value`
    )
  }

  const decipher = createDecipheriv(ALGORITHM, encryptionKey.key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

export function ensureEncrypted(value: string): string {
  if (isEncrypted(value)) return value
  return encrypt(value)
}

export function wasEncryptedWithOldKey(value: string): boolean {
  if (!isEncrypted(value)) return false
  const parts = value.split(':')
  if (parts.length !== 5) return false
  const keyId = parts[1]
  return keyId !== getActiveKey().id
}

export function reencryptWithActiveKey(value: string): string {
  if (!isEncrypted(value)) return encrypt(value)
  if (!wasEncryptedWithOldKey(value)) return value
  const plaintext = decrypt(value)
  return encrypt(plaintext)
}

export function getActiveKeyId(): string {
  return getActiveKey().id
}
