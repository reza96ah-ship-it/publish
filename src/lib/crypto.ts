/**
 * Token encryption — AES-256-GCM with key rotation support (Issue #120).
 *
 * Previous format: "enc:v1:<iv>:<ciphertext>:<tag>"
 *   - Single key derived from AUTH_SECRET via scryptSync
 *   - No rotation mechanism — compromised key = all credentials exposed
 *
 * New format: "enc:<keyId>:<iv>:<ciphertext>:<tag>"
 *   - keyId identifies which encryption key was used
 *   - Multiple keys supported via ENCRYPTION_KEY_V1, ENCRYPTION_KEY_V2, etc.
 *   - ACTIVE_ENCRYPTION_KEY_ID env var selects the key used for new encryptions
 *   - Decryption checks keyId prefix → selects correct key (rotation without
 *     downtime — old values decrypt with old key until re-encrypted)
 *
 * Backward compatibility:
 *   - "enc:v1:..." values (old format) decrypt with the V1 key
 *   - Plaintext values pass through decrypt() unchanged (dev migration)
 *
 * Key derivation: each ENCRYPTION_KEY_V{n} env var is a base64/random secret
 * passed through scryptSync(salt=nashrino-key-{n}) to produce a 32-byte AES key.
 * If no ENCRYPTION_KEY_V* vars are set, falls back to AUTH_SECRET (legacy mode).
 */

import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // GCM standard IV length
const SALT_PREFIX = 'nashrino-token-encryption-salt-'

interface EncryptionKey {
  id: string
  key: Buffer
}

// Cache of keyId → derived key (populated lazily on first use)
const keyCache = new Map<string, EncryptionKey>()

/**
 * Derive a 32-byte AES key from an env var secret using scrypt.
 * Each key gets a unique salt so keys are independent even if secrets overlap.
 */
function deriveKey(keyId: string, secret: string): Buffer {
  return scryptSync(secret, SALT_PREFIX + keyId, 32)
}

/**
 * Load all encryption keys from environment variables.
 * Looks for ENCRYPTION_KEY_V1, ENCRYPTION_KEY_V2, etc.
 * Falls back to AUTH_SECRET/NEXTAUTH_SECRET as V1 if no V-keys set (legacy).
 */
function loadKeys(): Map<string, EncryptionKey> {
  if (keyCache.size > 0) return keyCache

  const keys = new Map<string, EncryptionKey>()

  // Look for versioned keys: ENCRYPTION_KEY_V1, ENCRYPTION_KEY_V2, ...
  for (let v = 1; v <= 10; v++) {
    const envVal = process.env[`ENCRYPTION_KEY_V${v}`]
    if (envVal) {
      const keyId = `v${v}`
      keys.set(keyId, { id: keyId, key: deriveKey(keyId, envVal) })
    }
  }

  // Legacy fallback: if no versioned keys, use AUTH_SECRET as v1
  // This maintains backward compat with existing "enc:v1:..." values.
  if (keys.size === 0) {
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
    if (secret) {
      keys.set('v1', { id: 'v1', key: deriveKey('v1', secret) })
    } else if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'ENCRYPTION_KEY_V1 or AUTH_SECRET is required for token encryption in production'
      )
    } else {
      // Dev-only fallback (so local dev works without env setup)
      keys.set('v1', { id: 'v1', key: deriveKey('v1', 'nashrino-dev-secret') })
    }
  }

  // Populate cache
  for (const [id, k] of keys) keyCache.set(id, k)
  return keyCache
}

/**
 * Get the active encryption key (used for new encryptions).
 * Controlled by ACTIVE_ENCRYPTION_KEY_ID env var; defaults to first available key.
 */
function getActiveKey(): EncryptionKey {
  const keys = loadKeys()
  const activeId = process.env.ACTIVE_ENCRYPTION_KEY_ID
  if (activeId && keys.has(activeId)) {
    return keys.get(activeId)!
  }
  // Default: the first key (lowest version number)
  const first = keys.values().next()
  if (first.done) throw new Error('No encryption keys configured')
  return first.value
}

/**
 * Get a specific key by ID (for decryption during rotation).
 */
function getKey(keyId: string): EncryptionKey | undefined {
  return loadKeys().get(keyId)
}

// ── Public API ─────────────────────────────────────────────────

export function isEncrypted(value: string): boolean {
  return value?.startsWith('enc:') ?? false
}

/**
 * Encrypt plaintext using the active key.
 * Format: "enc:<keyId>:<iv_hex>:<ciphertext_hex>:<tag_hex>"
 */
export function encrypt(plaintext: string): string {
  const activeKey = getActiveKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, activeKey.key, iv)
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex')
  ciphertext += cipher.final('hex')
  const tag = cipher.getAuthTag()
  return `enc:${activeKey.id}:${iv.toString('hex')}:${ciphertext}:${tag.toString('hex')}`
}

/**
 * Decrypt an encrypted value.
 * Reads the keyId from the value prefix and selects the correct key.
 * Supports old "enc:v1:..." format (backward compat).
 * Returns plaintext values unchanged (dev migration).
 */
export function decrypt(value: string): string {
  if (!isEncrypted(value)) return value
  const parts = value.split(':')
  if (parts.length !== 5) throw new Error('Invalid encrypted token format')
  // parts[0] = "enc", parts[1] = keyId, parts[2] = iv, parts[3] = ct, parts[4] = tag
  const keyId = parts[1]
  const iv = Buffer.from(parts[2], 'hex')
  const ciphertext = Buffer.from(parts[3], 'hex')
  const tag = Buffer.from(parts[4], 'hex')

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

/**
 * Encrypt a value only if it isn't already encrypted (idempotent).
 */
export function ensureEncrypted(value: string): string {
  if (isEncrypted(value)) return value
  return encrypt(value)
}

/**
 * Issue #120: Check if a value was encrypted with a non-active (old) key.
 * Used by the background re-encryption job to find values needing rotation.
 */
export function wasEncryptedWithOldKey(value: string): boolean {
  if (!isEncrypted(value)) return false
  const parts = value.split(':')
  if (parts.length !== 5) return false
  const keyId = parts[1]
  return keyId !== getActiveKey().id
}

/**
 * Issue #120: Re-encrypt a value with the active key.
 * Returns the original value if it's not encrypted or already uses the active key.
 */
export function reencryptWithActiveKey(value: string): string {
  if (!isEncrypted(value)) return encrypt(value)
  if (!wasEncryptedWithOldKey(value)) return value
  const plaintext = decrypt(value)
  return encrypt(plaintext)
}

/**
 * Get the active key ID (for logging/diagnostics).
 */
export function getActiveKeyId(): string {
  return getActiveKey().id
}

/**
 * Clear the key cache (test-only — allows tests to change env vars between cases).
 * @internal
 */
export function _clearKeyCacheForTesting(): void {
  keyCache.clear()
}
