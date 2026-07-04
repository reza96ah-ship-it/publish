/**
 * Issue #200: Publications module — route-helper utilities.
 *
 * Pure functions that the publish route handler uses for error mapping and
 * author-name resolution. Kept in the module (not the route) so the route
 * handler stays under 100 lines. No Next.js transport imports — returns
 * plain structured results that the caller maps to NextResponse.
 */

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { structuredLogger } from '@/lib/structured-logger'
import type { TraceContext } from '@/lib/tracing'
import { PublicationError } from './errors'

export interface PublishErrorResponse {
  error: string
  status: number
}

/**
 * Map a thrown error from PublicationsService.create() to an HTTP-friendly
 * structured response. Emits the same structured warn/error log lines the
 * original inline route handler did, so dashboards/alerts are unaffected.
 */
export function mapPublishError(
  err: unknown,
  workspaceId: string,
  trace: TraceContext,
): PublishErrorResponse {
  if (err instanceof PublicationError) {
    structuredLogger.warn({
      trace,
      operation: 'publish.route',
      workspaceId,
      outcome: 'permanent_failure',
      errorCategory: 'validation',
      msg: err.userMessage ?? err.message,
    })
    return { error: err.userMessage ?? err.message, status: err.statusCode }
  }
  structuredLogger.error({
    trace,
    operation: 'publish.route',
    workspaceId,
    outcome: 'permanent_failure',
    errorCategory: 'internal',
    msg: 'unexpected error in publish route',
    extra: { error: err instanceof Error ? err.message : String(err) },
  })
  return { error: 'خطای داخلی سرور', status: 500 }
}

/**
 * Resolve the author display name for a content record. Falls back to the
 * workspace member's name, then to an em-dash. Extracted from the route
 * handler so the publish route stays thin.
 */
export async function resolveAuthorName(userId?: string): Promise<string> {
  const session = await getServerSession(authOptions)
  if (session?.user?.name) return session.user.name
  const membership = await db.workspaceMember.findFirst({
    where: { userId: session?.user?.id ?? userId },
    select: { name: true },
  })
  return membership?.name ?? '—'
}

/** Resolve the session user ID for the auth context. */
export async function resolveUserId(): Promise<string> {
  const session = await getServerSession(authOptions)
  return session?.user?.id ?? ''
}
