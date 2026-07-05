/**
 * Issue #255: Webhook HMAC signing + verification (GitHub/Stripe style).
 *
 * Webhook deliveries are signed with an HMAC-SHA256 of `${timestamp}.${payload}`
 * using the per-webhook secret. The receiver verifies the signature to
 * authenticate that the delivery came from Nashrino and was not tampered
 * with. The timestamp is included in the signed payload to enable replay
 * protection — receivers SHOULD reject deliveries whose timestamp is more
 * than 5 minutes from the current time.
 *
 * Headers sent with every delivery:
 *   X-Nashrino-Signature: sha256=<hex>
 *   X-Nashrino-Timestamp: <unix seconds>
 *
 * Verification algorithm (receiver-side):
 *   1. Recompute `sha256(secret, "${timestamp}.${rawBody}")`.
 *   2. Compare with the signature header in constant time.
 *   3. Reject if `|now - timestamp| > 5 minutes`.
 *
 * The secret is generated per-webhook on creation, encrypted at rest with
 * src/lib/crypto.ts (AES-256-GCM, key-rotatable), and shown to the admin
 * exactly once. It is never logged.
 */

import { createHmac, timingSafeEqual } from 'crypto'

const ALGORITHM = 'sha256'
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000 // 5 minutes — replay protection

/**
 * Compute the expected HMAC-SHA256 signature for a given secret + timestamp + payload.
 * The signed message is `${timestamp}.${payload}` — the dot prevents an attacker
 * from reinterpreting the boundary between the two fields.
 */
export function computeSignature(
  secret: string,
  timestamp: string,
  payload: string
): string {
  return createHmac(ALGORITHM, secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')
}

/**
 * Sign a webhook payload. Returns the headers to send with the delivery.
 *
 *   signature — `sha256=<hex>` (GitHub/Stripe style)
 *   timestamp — unix seconds as a string
 *
 * Pass an explicit `timestamp` only in tests; in production the default
 * `Math.floor(Date.now() / 1000)` is correct.
 */
export function signWebhook(
  secret: string,
  payload: string,
  timestamp: number = Math.floor(Date.now() / 1000)
): {
  signature: string
  timestamp: string
} {
  const ts = String(timestamp)
  const hex = computeSignature(secret, ts, payload)
  return {
    signature: `${ALGORITHM}=${hex}`,
    timestamp: ts,
  }
}

/**
 * Verify a webhook signature. Returns true iff:
 *   - the signature header matches the recomputed HMAC (constant-time), AND
 *   - `|now - timestamp| <= 5 minutes` (replay protection).
 *
 * The signature header is `sha256=<hex>`; if the receiver received a
 * different scheme, verification fails closed (returns false).
 *
 * Pass an explicit `now` (unix ms) only in tests.
 */
export function verifyWebhookSignature(
  secret: string,
  signatureHeader: string,
  timestamp: string,
  payload: string,
  now: number = Date.now()
): boolean {
  // Replay protection — reject stale or future timestamps first so we
  // never even attempt to verify a delivery outside the tolerance window.
  const tsMs = Number.parseInt(timestamp, 10) * 1000
  if (!Number.isFinite(tsMs)) return false
  if (Math.abs(now - tsMs) > TIMESTAMP_TOLERANCE_MS) return false

  // Expect "sha256=<hex>" — fail closed on any other scheme.
  const expected = `${ALGORITHM}=`
  if (!signatureHeader.startsWith(expected)) return false
  const received = signatureHeader.slice(expected.length)

  const expectedHex = computeSignature(secret, timestamp, payload)
  const receivedBuf = Buffer.from(received, 'hex')
  const expectedBuf = Buffer.from(expectedHex, 'hex')
  if (receivedBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(receivedBuf, expectedBuf)
}
