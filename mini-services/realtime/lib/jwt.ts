/**
 * Issue #151: Realtime JWT verification using the `jose` library.
 *
 * Previously this service hand-rolled HMAC-SHA256 verification with
 * `crypto.createHmac`. The audit requires using a standard JOSE/JWT library
 * so we get well-reviewed claim validation, algorithm pinning, and signing.
 *
 * Token profile (all 9 claims required, per issue #151):
 *   - iss   — issuer (nashrino-realtime)
 *   - aud   — audience (nashrino-realtime-service)
 *   - sub   — subject (userId)
 *   - iat   — issued-at (set automatically by jose)
 *   - nbf   — not-before (with clock skew tolerance)
 *   - exp   — expiry (short-lived)
 *   - jti   — JWT ID (unique per token, for replay tracking)
 *   - purpose — token purpose (realtime-socket) — guards against token use
 *               across services (e.g., an auth session JWT can't be replayed here)
 *   - kid   — key ID (supports overlapping keys during rotation)
 *
 * Security:
 *   - Algorithm pinned to HS256 (rejects `none`, RS256, etc.).
 *   - Wrong issuer/audience/purpose -> rejected.
 *   - Expired tokens -> rejected.
 *   - Future tokens beyond clock skew -> rejected.
 *   - Missing required claims -> rejected.
 *   - Unsupported algorithms -> rejected before signature verification.
 */

import { jwtVerify, SignJWT, errors as joseErrors, type JWTPayload } from 'jose'

// -- Expected claim values --
export const JWT_ISSUER = 'nashrino-realtime'
export const JWT_AUDIENCE = 'nashrino-realtime-service'
export const JWT_PURPOSE = 'realtime-socket'
export const JWT_ALG = 'HS256'
/** Clock skew tolerance in seconds -- applies to nbf and exp. */
export const JWT_SKEW_SECONDS = 5
/** Default token lifetime in seconds (1 hour). */
export const JWT_DEFAULT_LIFETIME_SECONDS = 60 * 60
/** Default key ID -- production should override via REALTIME_JWT_KID env var. */
export const DEFAULT_JWT_KID = 'realtime-v1'

export interface SessionData {
  userId: string
  activeWorkspaceId: string | null
}

export interface RealtimeJwtPayload extends JWTPayload {
  purpose: string
  activeWorkspaceId?: string | null
}

/**
 * Convert a textual secret into a Uint8Array key suitable for HMAC signing.
 * `jose` requires a `CryptoKey`/`KeyLike` rather than a raw string.
 */
export async function hmacSecretKey(secret: string): Promise<Uint8Array> {
  return new TextEncoder().encode(secret)
}

/**
 * Verify a realtime JWT and return the session data, or null if invalid.
 *
 * Returns null (rather than throwing) so socket middleware can convert the
 * failure into a clean `next(new Error('unauthorized'))` call.
 *
 * Rejects:
 *   - Malformed tokens (JWSInvalid, JWTInvalid)
 *   - Wrong signature (JWSSignatureVerificationFailed)
 *   - Unsupported algorithm -- pinned to HS256 via `algorithms` option
 *   - Wrong issuer (`iss` claim mismatch)
 *   - Wrong audience (`aud` claim mismatch)
 *   - Missing `purpose` claim or wrong value
 *   - Missing `sub` claim
 *   - Expired token (JWTExpired)
 *   - Future token beyond clock skew (nbf in the future)
 */
export async function verifyRealtimeJwt(
  token: string,
  secret: string,
  options: { skewSeconds?: number; now?: number } = {}
): Promise<SessionData | null> {
  const skew = options.skewSeconds ?? JWT_SKEW_SECONDS
  const now = options.now ?? Date.now()

  try {
    const key = await hmacSecretKey(secret)
    const { payload, protectedHeader } = await jwtVerify(token, key, {
      algorithms: [JWT_ALG], // pin algorithm -- rejects `none`, RS256, etc.
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      clockTolerance: skew,
    })

    // jose verifies iss/aud/exp/nbf -- but we still need to enforce `purpose`
    // (a custom claim) and `sub` non-empty.
    const p = payload as RealtimeJwtPayload
    if (p.purpose !== JWT_PURPOSE) {
      console.warn('[realtime] JWT rejected: wrong purpose', p.purpose)
      return null
    }
    if (typeof p.sub !== 'string' || p.sub.length === 0) {
      console.warn('[realtime] JWT rejected: missing or empty sub')
      return null
    }
    // kid is in the JWT protected header (not the payload) — supports key rotation
    const kid = protectedHeader?.kid
    if (typeof kid !== 'string' || kid.length === 0) {
      console.warn('[realtime] JWT rejected: missing kid')
      return null
    }
    if (typeof p.jti !== 'string' || p.jti.length === 0) {
      console.warn('[realtime] JWT rejected: missing jti')
      return null
    }
    // iat and nbf are verified by jose via clockTolerance, but we require them present
    if (typeof p.iat !== 'number') {
      console.warn('[realtime] JWT rejected: missing iat')
      return null
    }
    if (typeof p.nbf !== 'number') {
      console.warn('[realtime] JWT rejected: missing nbf')
      return null
    }

    return {
      userId: p.sub,
      activeWorkspaceId: typeof p.activeWorkspaceId === 'string' ? p.activeWorkspaceId : null,
    }
  } catch (err) {
    // Distinguish common errors for log clarity (but never leak secret material)
    if (err instanceof joseErrors.JWTExpired) {
      console.warn('[realtime] JWT rejected: expired')
    } else if (err instanceof joseErrors.JWSSignatureVerificationFailed) {
      console.warn('[realtime] JWT rejected: bad signature')
    } else if (err instanceof joseErrors.JWTClaimValidationFailed) {
      console.warn('[realtime] JWT rejected: claim validation failed --', err.message)
    } else if (err instanceof joseErrors.JWSInvalid) {
      console.warn('[realtime] JWT rejected: malformed token')
    } else {
      // Includes JWTInvalid, JWSVerificationFailed, etc.
      console.warn('[realtime] JWT rejected:', (err as Error)?.name || 'unknown error')
    }
    return null
  }
}

/**
 * Sign a realtime JWT -- primarily used by tests and by an issuer endpoint.
 * Production tokens are issued by the NextAuth-adjacent token issuer, but
 * sharing this helper guarantees the verification profile matches exactly.
 */
export async function signRealtimeJwt(params: {
  secret: string
  userId: string
  activeWorkspaceId?: string | null
  jti: string
  kid?: string
  lifetimeSeconds?: number
  issuer?: string
  audience?: string
  purpose?: string
  now?: number
}): Promise<string> {
  const {
    secret,
    userId,
    activeWorkspaceId = null,
    jti,
    kid = DEFAULT_JWT_KID,
    lifetimeSeconds = JWT_DEFAULT_LIFETIME_SECONDS,
    issuer = JWT_ISSUER,
    audience = JWT_AUDIENCE,
    purpose = JWT_PURPOSE,
    now = Date.now(),
  } = params

  const key = await hmacSecretKey(secret)
  const iat = Math.floor(now / 1000)
  const exp = iat + lifetimeSeconds
  // nbf set to "now" -- the clock skew tolerance allows minor forward drift.
  const nbf = iat

  const signer = new SignJWT({
    sub: userId,
    purpose,
    jti,
    activeWorkspaceId,
  })
    .setProtectedHeader({ alg: JWT_ALG, kid })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt(iat)
    .setNotBefore(nbf)
    .setExpirationTime(exp)

  return signer.sign(key)
}

/**
 * Inspect a JWT's header without verifying -- used by tests to assert
 * algorithm pinning is honored at the header level.
 */
export function peekHeader(token: string): { alg?: string; kid?: string; typ?: string } {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return {}
    const headerB64 = parts[0]
    if (!headerB64) return {}
    const json = Buffer.from(
      headerB64.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8')
    return JSON.parse(json) as { alg?: string; kid?: string; typ?: string }
  } catch {
    return {}
  }
}
