/**
 * Realtime JWT helper — thin app-side re-export of the shared implementation.
 *
 * The shared module (`shared/realtime-jwt.ts`) is the single source of truth
 * so the app's `/api/realtime-token` issuer and the realtime mini-service's
 * socket.io verifier use exactly the same claim profile, algorithm pinning,
 * and clock-skew tolerance.
 *
 * Pattern mirrors `src/lib/provider-capabilities.ts` (Issue #150).
 */

export * from '../../shared/realtime-jwt'
