/**
 * POST /api/publish — create content + queue publish jobs.
 *
 * Issue #124: Route handler is now a thin transport layer.
 * All business logic lives in src/modules/publications/service.ts.
 *
 * Flow: auth guard → permission check → validate body → service.create() → JSON response.
 */

import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, publishSchema } from '@/lib/validations'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { publishJobsAccepted } from '@/lib/metrics'
import {
  extractFromHeaders,
  startTrace,
  withSpan,
  type TraceContext,
} from '@/lib/tracing'
import { structuredLogger } from '@/lib/structured-logger'
import { track } from '@/lib/track'
import {
  publicationsService,
  PermissionDeniedError,
  InvalidBodyError,
  PublicationError,
  type AuthContext,
  type PublishRequest,
} from '@/modules/publications'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // Issue #155: accept incoming W3C trace context (or mint a new one) so the
  // entire publish lifecycle can be correlated across API → DB → outbox →
  // worker → provider → realtime.
  const incomingTrace = extractFromHeaders(req.headers)
  const trace: TraceContext = incomingTrace ?? startTrace('publish.request')

  return withSpan(
    'publish.route',
    async () => {
      // Issue #142: requirePermissionApi combines workspace membership + content.publish permission
      const guard = await requirePermissionApi('content.publish')
      if (guard.error) return guard.error

  // Resolve author name for the content record
  const session = await getServerSession(authOptions)
  const authorName =
    session?.user?.name ||
    (
      await db.workspaceMember.findFirst({
        where: { userId: session?.user?.id },
        select: { name: true },
      })
    )?.name ||
    '—'

  // 4. Validate request body
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  const validation = validateBody(publishSchema, raw)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  // 5. Call the service layer (all business logic + DB transaction lives there)
  const auth: AuthContext = {
    workspaceId: guard.workspaceId,
    userId: session?.user?.id ?? '',
    authorName,
    role: guard.role,
    trace,
  }

  try {
    const result = await publicationsService.create(auth, validation.data as PublishRequest)
    // Issue #126: increment accepted counter per platform (for dashboards)
    for (const job of result.jobs) {
      publishJobsAccepted.inc({ workspace: auth.workspaceId, platform: job.platform })
    }
    // Fire-and-forget product analytics — never block the response
    void Promise.allSettled(
      result.jobs.map((job) =>
        track({
          event: 'publication_queued',
          workspaceId: auth.workspaceId,
          userId: auth.userId,
          jobId: job.id,
          platformType: job.platform,
          scheduleType: (validation.data as PublishRequest).scheduleMode ?? 'now',
        }),
      ),
    )
    structuredLogger.info({
      trace,
      operation: 'publish.route',
      workspaceId: auth.workspaceId,
      contentId: result.contentId,
      outcome: 'success',
      msg: `accepted ${result.jobs.length} publish job(s)`,
      extra: { platforms: result.jobs.map((j) => j.platform) },
    })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    // Map domain errors to HTTP responses
    if (err instanceof PublicationError) {
      structuredLogger.warn({
        trace,
        operation: 'publish.route',
        workspaceId: auth.workspaceId,
        outcome: 'permanent_failure',
        errorCategory: 'validation',
        msg: err.userMessage ?? err.message,
      })
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    structuredLogger.error({
      trace,
      operation: 'publish.route',
      workspaceId: auth.workspaceId,
      outcome: 'permanent_failure',
      errorCategory: 'internal',
      msg: 'unexpected error in publish route',
      extra: { error: err instanceof Error ? err.message : String(err) },
    })
    return NextResponse.json({ error: 'خطای داخلی سرور' }, { status: 500 })
  }
    },
    {
      workspaceId: '',
      operation: 'publish.route',
    }
  )
}
