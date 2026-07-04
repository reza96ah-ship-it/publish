/**
 * Realtime JWT verification + signing.
 *
 * The canonical implementation lives in `shared/realtime-jwt.ts` so the Next.js
 * app (`src/app/api/realtime-token/route.ts`) and the realtime mini-service
 * (this file) share the SAME issuer/verifier profile. Without that, the
 * realtime service would silently reject every token issued by the app.
 *
 * This file re-exports the shared implementation for backwards compatibility
 * with existing imports (`mini-services/realtime/lib/jwt`).
 */

export * from '../../../shared/realtime-jwt'
