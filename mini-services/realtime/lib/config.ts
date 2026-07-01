/**
 * Centralized configuration loader for the realtime service.
 * Uses the shared validation runner to enforce fail-closed security.
 */

import { bootstrapServiceConfig } from '../../../shared/config-validator'

export interface RealtimeConfig {
  port: number
  emitSecret: string
  realtimeJwtSecret: string
  corsOrigin: string | string[]
  corsOriginRaw: string
  redisUrl: string
  isProduction: boolean
  isDev: boolean
  jwtKid: string
}

export const DEFAULT_JWT_KID = 'realtime-v1'

/**
 * Load configuration. Runs bootstrapServiceConfig inside so that
 * tests can override env and exitFn.
 */
export function loadRealtimeConfig(opts: {
  env?: Record<string, string | undefined>
  exitFn?: (code: number) => void
} = {}): RealtimeConfig {
  const env = opts.env ?? process.env
  const exitFn = opts.exitFn ?? ((code) => process.exit(code))
  const isProduction = env.NODE_ENV === 'production'

  // Run the centralized config validation
  bootstrapServiceConfig('realtime', env, exitFn)

  const port = parseInt(env.REALTIME_PORT || '3003', 10)
  const emitSecret = env.EMIT_SECRET || 'nashrino-dev-emit-secret'
  const realtimeJwtSecret = env.REALTIME_JWT_SECRET || env.NEXTAUTH_SECRET || 'nashrino-dev-jwt-secret'
  const corsOriginRaw = env.REALTIME_CORS_ORIGIN || (isProduction ? '' : '*')

  const corsOrigin: string | string[] =
    corsOriginRaw.includes(',') && corsOriginRaw !== '*'
      ? corsOriginRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : corsOriginRaw

  const redisUrl = env.REDIS_CACHE_URL || env.REDIS_URL || ''
  const isDev = env.DISABLE_AUTH === '1'
  const jwtKid = env.REALTIME_JWT_KID || DEFAULT_JWT_KID

  return {
    port,
    emitSecret,
    realtimeJwtSecret,
    corsOrigin,
    corsOriginRaw,
    redisUrl,
    isProduction,
    isDev,
    jwtKid,
  }
}
