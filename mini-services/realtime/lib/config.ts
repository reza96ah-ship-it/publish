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
 * Require an environment variable, failing closed in production.
 * In development, falls back to devDefault with a console.warn.
 */
export function requireSecret(
  envKey: string,
  devDefault: string,
  opts: {
    env?: Record<string, string | undefined>
    isProduction?: boolean
    exitFn?: (code: number) => void
    log?: (msg: string) => void
  } = {}
): string {
  const env = opts.env ?? process.env
  const isProduction = opts.isProduction ?? (env.NODE_ENV === 'production')
  const exitFn = opts.exitFn ?? ((code) => process.exit(code))
  const log = opts.log ?? console.error

  const value = env[envKey]
  if (value) return value

  if (isProduction) {
    log(`FATAL: required secret "${envKey}" is missing in production`)
    exitFn(1)
    return ''
  }

  console.warn(`[config] WARNING: "${envKey}" is not set. Using dev default.`)
  return devDefault
}

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
