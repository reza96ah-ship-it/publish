import * as Sentry from '@sentry/nextjs'

/**
 * Sentry server-side configuration.
 * Only activates if SENTRY_DSN is set in the environment.
 */

const SENTRY_DSN = process.env.SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version || '0.1.0',
    // Don't send errors in dev unless explicitly enabled
    beforeSend(event) {
      if (process.env.NODE_ENV !== 'production' && !process.env.SENTRY_DEV) {
        return null
      }
      return event
    },
  })
}
