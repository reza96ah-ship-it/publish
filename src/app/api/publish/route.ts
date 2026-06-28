/**
 * POST /api/publish — create content + queue publish jobs.
 *
 * Issue #124: Route handler is now a thin transport layer.
 * All business logic lives in src/modules/publications/service.ts.
 *
 * Flow: auth guard → permission check → validate body → service.create() → JSON response.
 */

import { NextResponse } from 'next/server'
import { requireWorkspaceApi } from '@/lib/auth-guards'
import { validateBody, publishSchema } from '@/lib/validations'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { publishJobsAccepted } from '@/lib/metrics'
import {
  publicationsService,
  canPublish,
  PermissionDeniedError,
  InvalidBodyError,
  PublicationError,
  type AuthContext,
  type PublishRequest,
} from '@/modules/publications'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // 1. Auth guard — returns 401/403 JSON if unauthorized
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error

  // 2. Permission check — content.publish required
  if (guard.session && !canPublish(guard.role)) {
    return NextResponse.json({ error: 'دسترسی کافی برای انتشار ندارید' }, { status: 403 })
  }

  // 3. Resolve author name for the content record
  const session = await getServerSession(authOptions)
  const authorName =
    (session?.user as any)?.name ||
    (
      await db.workspaceMember.findFirst({
        where: { userId: (session?.user as any)?.id },
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
    workspaceId: guard.workspace.id,
    userId: (session?.user as any)?.id ?? '',
    authorName,
    role: guard.role,
  }

  try {
    const result = await publicationsService.create(auth, validation.data as PublishRequest)
    // Issue #126: increment accepted counter per platform (for dashboards)
    for (const job of result.jobs) {
      publishJobsAccepted.inc({ workspace: auth.workspaceId, platform: job.platform })
    }
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    // Map domain errors to HTTP responses
    if (err instanceof PublicationError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    console.error('[publish] unexpected error:', err)
    return NextResponse.json({ error: 'خطای داخلی سرور' }, { status: 500 })
  }
}
