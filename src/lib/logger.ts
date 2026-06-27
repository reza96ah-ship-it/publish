/**
 * Structured logging — pino with request ID correlation.
 *
 * Usage in API routes:
 *   import { logger } from '@/lib/logger'
 *   logger.info({ msg: 'publish started', jobId, workspaceId })
 *
 * Usage with request context:
 *   import { createRequestLogger } from '@/lib/logger'
 *   const log = createRequestLogger(req)
 *   log.info({ msg: 'content created', contentId })
 */

import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'
const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info')

export const logger = pino({
  level: logLevel,
  base: {
    service: 'nashrino-app',
    version: process.env.npm_package_version || '0.1.0',
  },
  // In dev: pretty-print for readability. In prod: JSON for log aggregation.
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname,service,version',
        },
      }
    : undefined,
  redact: {
    // Never log secrets
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      '*.token',
      '*.tokenSecret',
      '*.password',
      '*.secret',
      '*.apiKey',
    ],
    censor: '[REDACTED]',
  },
})

/**
 * Generate or extract a request ID from incoming headers.
 * Checks X-Request-Id, then X-Correlation-Id, then generates a UUID.
 */
export function getRequestId(req: Request): string {
  const headerVal =
    req.headers.get('x-request-id') ||
    req.headers.get('x-correlation-id')
  if (headerVal) return headerVal

  // Generate a short ID (8 chars is enough for correlation)
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36).slice(-4)
}

/**
 * Create a child logger scoped to a specific request.
 * Includes requestId, method, url in every log line.
 */
export function createRequestLogger(req: Request) {
  const requestId = getRequestId(req)
  const url = new URL(req.url)
  return {
    requestId,
    logger: logger.child({
      requestId,
      method: req.method,
      path: url.pathname,
    }),
  }
}

/**
 * Create a child logger for a specific context (worker, adapter, etc).
 */
export function createScopedLogger(scope: string, extra?: Record<string, unknown>) {
  return logger.child({ scope, ...extra })
}
