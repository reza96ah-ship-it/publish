/**
 * GET /api/outbox/[id] — detail view of a single dead-lettered outbox event
 * (Issue #148).
 *
 * Admin-only (security.admin permission), same as the list endpoint at
 * /api/outbox/dead-letter. Reuses the same field selection/redaction rules —
 * never returns the raw payload (may contain sensitive routing data).
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guard = await requirePermissionApi('security.admin')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const event = await db.outboxEvent.findFirst({
    where: {
      id,
      workspaceId,
      status: 'dead_letter',
    },
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

  if (!event) {
    return NextResponse.json({ error: 'رویداد dead-letter یافت نشد' }, { status: 404 })
  }

  return NextResponse.json({
    data: {
      id: event.id,
      contentId: event.aggregateId,
      eventType: event.eventType,
      attempts: event.attemptCount,
      errorCategory: event.lastErrorCategory,
      safeError: event.lastSafeError,
      rawError: event.lastError, // safe — no secrets in outbox error messages
      deadLetteredAt: event.deadLetteredAt?.toISOString() ?? null,
      firstAttempt: event.createdAt.toISOString(),
      lastAttempt: event.updatedAt.toISOString(),
      isReplay: !!event.replayedFromId,
      originalEventId: event.replayedFromId,
    },
  })
}
