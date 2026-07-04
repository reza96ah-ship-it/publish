import * as Sentry from '@sentry/nextjs'

/**
 * Sentry client-side configuration.
 * Only activates if SENTRY_DSN is set and NEXT_PUBLIC_SENTRY_DSN is set.
 */

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN

if (SENTRY_DSN && process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version || '0.1.0',
  })
}
