/**
 * Issue #151: Fail-closed configuration for the realtime service.
 *
 * In production, required secrets MUST be set as environment variables -- no
 * development defaults. In development, we allow fallbacks for convenience.
 *
 * Exports `loadRealtimeConfig()` which returns the validated config or
 * terminates the process with `process.exit(1)`. Extracted from `index.ts`
 * so it can be unit-tested by stubbing `process.env` and `process.exit`.
 */

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

/** Default key id -- must be set explicitly via REALTIME_JWT_KID in production rotation. */
export const DEFAULT_JWT_KID = 'realtime-v1'

/**
 * Read a required secret from the environment. In production, missing secrets
 * cause `process.exit(1)`. In development, fall back to a dev default with a
 * loud warning.
 *
 * `exitFn` is injectable for tests so we can assert the function is called
 * without actually terminating the test process.
 */
export function requireSecret(
  name: string,
  devDefault: string,
  opts: {
    isProduction?: boolean
    env?: NodeJS.ProcessEnv
    exitFn?: (code: number) => void
    log?: (msg: string) => void
  } = {}
): string {
  const env = opts.env ?? process.env
  const isProduction = opts.isProduction ?? env.NODE_ENV === 'production'
  const exit = opts.exitFn ?? ((code: number) => process.exit(code))
  const log = opts.log ?? console.error

  const val = env[name]
  if (val) return val
  if (isProduction) {
    log(`[realtime] FATAL: ${name} is not set. Refusing to start in production.`)
    exit(1)
    // Tests may stub exitFn to no-op; return empty so the caller still sees
    // a non-undefined value (the process would have exited otherwise).
    return ''
  }
  console.warn(`[realtime] WARNING: ${name} not set -- using dev default. DO NOT USE IN PRODUCTION.`)
  return devDefault
}

/**
 * Load and validate the realtime service configuration.
 *
 * Returns the validated config. In production, missing secrets cause
 * `exitFn(1)` to be invoked (defaults to `process.exit(1)`).
 */
export function loadRealtimeConfig(opts: {
  env?: NodeJS.ProcessEnv
  exitFn?: (code: number) => void
  log?: (msg: string) => void
} = {}): RealtimeConfig {
  const env = opts.env ?? process.env
  const isProduction = env.NODE_ENV === 'production'
  const exit = opts.exitFn ?? ((code: number) => process.exit(code))
  const log = opts.log ?? console.error

  const port = parseInt(env.REALTIME_PORT || '3003', 10)

  const emitSecret = requireSecret('EMIT_SECRET', 'nashrino-dev-emit-secret', {
    env,
    isProduction,
    exitFn: exit,
    log,
  })

  // Issue #151: REALTIME_JWT_SECRET must be separate from NEXTAUTH_SECRET in production.
  // In dev, allow it to fall back to NEXTAUTH_SECRET for convenience (single-machine dev).
  const realtimeJwtSecret = requireSecret(
    'REALTIME_JWT_SECRET',
    env.NEXTAUTH_SECRET || 'nashrino-dev-jwt-secret',
    { env, isProduction, exitFn: exit, log }
  )

  // Issue #151: CORS must be an explicit allowlist in production -- no wildcard.
  const corsOriginRaw = env.REALTIME_CORS_ORIGIN || (isProduction ? '' : '*')
  if (isProduction && (!corsOriginRaw || corsOriginRaw === '*')) {
    log(
      '[realtime] FATAL: REALTIME_CORS_ORIGIN must be set to an explicit allowlist in production.'
    )
    exit(1)
  }
  // Allow comma-separated list (e.g., "https://app.example.com,https://staging.example.com")
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
