/**
 * Centralized Startup Configuration Validator — shared between all services.
 * Refuses startup in production if required environment variables are missing
 * or set to known development defaults.
 */

const KNOWN_DEV_DEFAULTS = [
  'nashrino-dev-jwt-secret',
  'nashrino-dev-emit-secret',
  'nashrino-dev-auth-secret',
  'test-secret-not-for-production',
  'build-time-dummy-secret-not-used-at-runtime',
  'nashrino', // Default Bull Board password
  'nashrino-dev-jwt-secret-fallback',
  'nashrino-dev-emit-secret-fallback',
]

/**
 * Returns true if a value is a known development default or placeholder.
 */
export function isDevDefault(value: string | undefined): boolean {
  if (!value) return false
  const norm = value.trim().toLowerCase()
  return KNOWN_DEV_DEFAULTS.some((d) => norm.includes(d))
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

/**
 * Validate configuration for a specific service.
 * In production (NODE_ENV === 'production'), missing or dev-default secrets
 * will trigger validation errors.
 */
export function validateServiceConfig(
  service: 'app' | 'worker' | 'realtime' | 'migrate',
  env: Record<string, string | undefined> = process.env
): ValidationResult {
  const errors: string[] = []
  // GitHub Actions sets CI=true; skip strict prod checks in CI so test secrets
  // don't block the standalone server during Load Gate and E2E jobs.
  const isProd = env.NODE_ENV === 'production' && env.CI !== 'true'

  function checkSecret(name: string, requiredFor: typeof service[]) {
    if (!requiredFor.includes(service)) return

    const val = env[name]
    if (!val) {
      if (isProd) {
        errors.push(`FATAL: required environment variable "${name}" is missing.`)
      } else {
        console.warn(`[config] WARNING: "${name}" is not set.`)
      }
      return
    }

    if (isProd && isDevDefault(val)) {
      errors.push(`FATAL: "${name}" is set to a known development default/placeholder.`)
    }
  }

  // NextAuth Session Secret (separate from realtime token)
  checkSecret('NEXTAUTH_SECRET', ['app'])

  // Realtime JWT signing secret (separate from NextAuth session)
  checkSecret('REALTIME_JWT_SECRET', ['app', 'realtime'])

  // Worker-to-realtime shared secret
  checkSecret('EMIT_SECRET', ['worker', 'realtime'])

  // Token encryption secret
  checkSecret('AUTH_SECRET', ['app', 'worker'])

  // Database checks
  if (['app', 'worker', 'migrate'].includes(service)) {
    const dbUrl = env.DATABASE_URL
    if (!dbUrl) {
      if (isProd) {
        errors.push('FATAL: "DATABASE_URL" is missing.')
      } else {
        console.warn('[config] WARNING: "DATABASE_URL" is not set.')
      }
    } else if (isProd && !dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
      errors.push('FATAL: "DATABASE_URL" must use a PostgreSQL connection string in production.')
    }
  }

  // Redis checks
  if (['app', 'worker', 'realtime'].includes(service)) {
    // Realtime can fallback to REDIS_URL, worker uses REDIS_QUEUE_URL or REDIS_URL
    const redisUrl = env.REDIS_QUEUE_URL || env.REDIS_URL || env.REDIS_CACHE_URL
    if (!redisUrl) {
      if (isProd) {
        errors.push('FATAL: Redis connection URL (REDIS_URL / REDIS_QUEUE_URL / REDIS_CACHE_URL) is missing.')
      } else {
        console.warn('[config] WARNING: Redis URL is not set.')
      }
    }
  }

  // Realtime CORS checks
  if (service === 'realtime') {
    const cors = env.REALTIME_CORS_ORIGIN
    if (!cors || cors === '*') {
      if (isProd) {
        errors.push('FATAL: REALTIME_CORS_ORIGIN must be set to an explicit allowlist in production (no wildcards or empty).')
      }
    }
  }

  // Bull Board password check
  if (service === 'worker') {
    const boardPwd = env.BOARD_PASSWORD
    if (isProd && (!boardPwd || isDevDefault(boardPwd))) {
      errors.push('FATAL: BOARD_PASSWORD is not set or uses default "nashrino" in production.')
    }
  }

  // Encryption key rotation checks
  if (['app', 'worker'].includes(service)) {
    const activeKeyId = env.ACTIVE_ENCRYPTION_KEY_ID
    if (!activeKeyId) {
      if (isProd) {
        errors.push('FATAL: "ACTIVE_ENCRYPTION_KEY_ID" must be set for token encryption.')
      }
    } else {
      const activeKeyVal = env[`ENCRYPTION_KEY_V${activeKeyId}`]
      if (!activeKeyVal) {
        errors.push(`FATAL: "ENCRYPTION_KEY_V${activeKeyId}" corresponding to active key ID is missing.`)
      } else if (isProd && isDevDefault(activeKeyVal)) {
        errors.push(`FATAL: "ENCRYPTION_KEY_V${activeKeyId}" is set to a development default.`)
      }
    }
  }

  // NextAuth URL check for app
  if (service === 'app') {
    const authUrl = env.NEXTAUTH_URL
    if (isProd && (!authUrl || authUrl.includes('localhost') || authUrl.includes('127.0.0.1'))) {
      errors.push('FATAL: NEXTAUTH_URL must be set to a production domain in production.')
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  }
}

/**
 * Bootstrap config validation for a service.
 * Aborts process with exit code 1 in production if validation fails.
 */
export function bootstrapServiceConfig(
  service: 'app' | 'worker' | 'realtime' | 'migrate',
  env: Record<string, string | undefined> = process.env,
  exitFn: (code: number) => void = (code) => process.exit(code)
): void {
  const result = validateServiceConfig(service, env)
  if (!result.ok) {
    console.error(`\n[config] ❌ Configuration validation failed for service: ${service.toUpperCase()}`)
    result.errors.forEach((err) => console.error(`[config]   ${err}`))
    console.error('[config] Refusing to start service.\n')
    exitFn(1)
  } else {
    console.log(`[config] ✅ Configuration validated for service: ${service.toUpperCase()}`)
  }
}
