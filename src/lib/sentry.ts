/**
 * Sentry initialization — error tracking + performance monitoring.
 *
 * Only activates if SENTRY_DSN is set. In dev without SENTRY_DSN,
 * the functions are no-ops (safe to call everywhere).
 *
 * Usage:
 *   import { captureError, captureMessage } from '@/lib/sentry'
 *   try { ... } catch (err) {
 *     captureError(err, { extra: { jobId, workspaceId } })
 *   }
 */

import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN

export const isSentryEnabled = !!SENTRY_DSN

/**
 * Capture an exception with optional context.
 * No-op if SENTRY_DSN is not configured.
 */
export function captureError(error: unknown, context?: {
  tags?: Record<string, string | number>
  extra?: Record<string, unknown>
  user?: { id: string; email?: string }
}) {
  if (!isSentryEnabled) return
  Sentry.captureException(error, {
    tags: context?.tags,
    extra: context?.extra,
    user: context?.user,
  })
}

/**
 * Capture a custom message (info level).
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  if (!isSentryEnabled) return
  Sentry.captureMessage(message, level)
}

/**
 * Set the current user context for Sentry.
 */
export function setUser(user: { id: string; email?: string; workspaceId?: string } | null) {
  if (!isSentryEnabled) return
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email })
    Sentry.setTag('workspaceId', user.workspaceId || '')
  } else {
    Sentry.setUser(null)
  }
}
