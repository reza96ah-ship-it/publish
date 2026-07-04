/**
 * POST /api/publish — create content + queue publish jobs.
 *
 * Issue #200: thin transport layer. Business logic + telemetry live in
 * src/modules/publications/service.ts; error mapping + author resolution
 * live in src/modules/publications/route-helpers.ts.
 *
 * Flow: trace → auth guard → resolve author → validate body → service.create()
 *       → JSON response. Domain errors map to HTTP via mapPublishError.
 */

import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, publishSchema } from '@/lib/validations'
import {
  extractFromHeaders,
  startTrace,
  withSpan,
  type TraceContext,
} from '@/lib/tracing'
import {
  publicationsService,
  mapPublishError,
  resolveAuthorName,
  resolveUserId,
  type AuthContext,
  type PublishRequest,
} from '@/modules/publications'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // Issue #155: accept incoming W3C trace context (or mint a new one) so the
  // entire publish lifecycle can be correlated across API → DB → outbox → worker.
  const trace: TraceContext = extractFromHeaders(req.headers) ?? startTrace('publish.request')

  return withSpan(
    'publish.route',
    async () => {
      const guard = await requirePermissionApi('content.publish')
      if (guard.error) return guard.error

      const [authorName, userId] = await Promise.all([resolveAuthorName(), resolveUserId()])

      const raw = await req.json().catch(() => null)
      if (!raw) return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
      const validation = validateBody(publishSchema, raw)
      if (!validation.success) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
      }

      const auth: AuthContext = {
        workspaceId: guard.workspaceId,
        userId,
        authorName,
        role: guard.role,
        trace,
      }

      try {
        const result = await publicationsService.create(auth, validation.data as PublishRequest)
        return NextResponse.json(result, { status: 201 })
      } catch (err) {
        const mapped = mapPublishError(err, auth.workspaceId, trace)
        return NextResponse.json({ error: mapped.error }, { status: mapped.status })
      }
    },
    { workspaceId: '', operation: 'publish.route' },
  )
}
