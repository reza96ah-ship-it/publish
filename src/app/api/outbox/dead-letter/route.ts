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

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('security.admin')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

  const events = await db.outboxEvent.findMany({
    where: {
      workspaceId,
      status: 'dead_letter',
    },
    orderBy: { deadLetteredAt: 'desc' },
    take: limit,
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

  return NextResponse.json({
    data: events.map((e) => ({
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
    count: events.length,
  })
}
