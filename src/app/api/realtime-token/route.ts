/**
 * GET /api/realtime-token — issue a short-lived HS256 JWT for socket.io
 * realtime handshake auth.
 *
 * ASVS L2 V3.5.2 / V9.2.1: the issued token MUST satisfy the verifier's
 * claim profile. Previously this endpoint hand-rolled an HMAC-SHA256 JWT
 * with only 4 claims (`userId`, `activeWorkspaceId`, `iat`, `exp`) — which
 * the realtime service (mini-services/realtime/lib/jwt.ts) rejects because
 * it requires all 9 claims (iss, aud, sub, iat, nbf, exp, jti, purpose, kid)
 * and pins the algorithm to HS256 via `jose`. In dev the realtime service
 * bypasses auth (DISABLE_AUTH=1), so the mismatch was masked — but in
 * production every realtime connection would silently fail handshake auth.
 *
 * The fix shares `signRealtimeJwt()` between this issuer and the verifier so
 * the profiles cannot drift again.
 *
 * Token lifetime: 1 hour (realtime connections refresh on reconnect).
 * Signing secret: REALTIME_JWT_SECRET (separate from NEXTAUTH_SECRET, per
 * Issue #151 — verified by shared/config-validator.ts at boot).
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { randomUUID } from 'crypto'
import { signRealtimeJwt, DEFAULT_JWT_KID, JWT_DEFAULT_LIFETIME_SECONDS } from '@/lib/realtime-jwt'

export const dynamic = 'force-dynamic'

function resolveSigningSecret(): string {
  // REALTIME_JWT_SECRET is the canonical secret. We do NOT fall back to
  // NEXTAUTH_SECRET — Issue #151 requires separate secrets so compromise of
  // one token type does not impact the other. Config-validator enforces
  // presence of REALTIME_JWT_SECRET at boot in production.
  const secret = process.env.REALTIME_JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production' && !process.env.CI) {
      throw new Error('REALTIME_JWT_SECRET is required in production')
    }
    // Dev-only fallback so local development keeps working without env setup.
    // config-validator.ts already warns loudly at boot.
    return 'nashrino-dev-jwt-secret'
  }
  return secret
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  }

  // session.user.id is injected by the jwt() callback in authOptions.
  // Fall back to an explicit 401 if it's missing rather than issuing a token
  // with an empty subject (the realtime verifier rejects empty `sub`).
  const userId = (session.user as { id?: string }).id
  if (!userId) {
    return NextResponse.json({ error: 'invalid session' }, { status: 401 })
  }

  const activeWorkspaceId =
    (session as { activeWorkspaceId?: string | null }).activeWorkspaceId ?? null

  // jti: unique per token, used for replay tracking. crypto.randomUUID is
  // available in Node 18+ and Edge runtimes.
  const jti = randomUUID()
  const kid = process.env.REALTIME_JWT_KID || DEFAULT_JWT_KID

  const token = await signRealtimeJwt({
    secret: resolveSigningSecret(),
    userId,
    activeWorkspaceId,
    jti,
    kid,
    lifetimeSeconds: JWT_DEFAULT_LIFETIME_SECONDS,
  })

  return NextResponse.json({ token })
}
