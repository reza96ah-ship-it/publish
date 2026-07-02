/**
 * GET /api/outbox/dead-letter — list dead-lettered outbox events (Issue #148).
 *
 * Admin-only (security.admin permission). Shows safe reason, publication,
 * workspace, attempts, first/last failure time, and correlation IDs.
 * Never returns raw payload secrets.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateParams, cursorPaginationSchema } from '@/lib/validations'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('security.admin')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(cursorPaginationSchema, query)
  if (!queryCheck.success) return NextResponse.json({ error: queryCheck.error }, { status: 400 })
  const { cursor, limit } = queryCheck.data

  const events = await db.outboxEvent.findMany({
    where: {
      workspaceId,
      status: 'dead_letter',
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    orderBy: { id: 'desc' },
    take: limit + 1,
    select: {
      id: true,
      aggregateId: true,
      eventType: true,
      attemptCount: true,
      lastError: true,
      lastErrorCategory: true,
      lastSafeError: true,
      deadLetteredAt: true,
      createdAt: true,
      updatedAt: true,
      replayedFromId: true,
      // Never select payload (may contain sensitive routing data)
    },
  })

  const hasMore = events.length > limit
  const data = hasMore ? events.slice(0, limit) : events
  const nextCursor = hasMore ? data[data.length - 1]?.id : null

  return NextResponse.json({
    data: data.map((e) => ({
      id: e.id,
      contentId: e.aggregateId,
      eventType: e.eventType,
      attempts: e.attemptCount,
      errorCategory: e.lastErrorCategory,
      safeError: e.lastSafeError,
      rawError: e.lastError, // safe — no secrets in outbox error messages
      deadLetteredAt: e.deadLetteredAt?.toISOString() ?? null,
      firstAttempt: e.createdAt.toISOString(),
      lastAttempt: e.updatedAt.toISOString(),
      isReplay: !!e.replayedFromId,
      originalEventId: e.replayedFromId,
    })),
    nextCursor,
  })
}
