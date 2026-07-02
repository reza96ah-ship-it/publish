/**
 * POST /api/outbox/[id]/replay — replay a dead-lettered outbox event (Issue #148).
 *
 * Admin-only (security.admin permission). Creates a new pending event from
 * the dead-lettered one, preserving the original. Writes an audit event.
 * Supports cancellation when the associated publication has been cancelled.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guard = await requirePermissionApi('security.admin')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  // Find the dead-lettered event — must belong to this workspace
  const original = await db.outboxEvent.findFirst({
    where: { id, workspaceId, status: 'dead_letter' },
  })

  if (!original) {
    return NextResponse.json({ error: 'رویداد dead-letter یافت نشد' }, { status: 404 })
  }

  // Check if the associated publication was cancelled — don't replay cancelled work
  const payload = original.payload as { publicationId?: string; jobId?: string }
  if (payload.publicationId) {
    const publication = await db.publication.findFirst({
      where: { id: payload.publicationId, workspaceId },
      select: { status: true },
    })
    if (publication?.status === 'cancelled') {
      return NextResponse.json(
        { error: 'انتشار مرتبط لغو شده است — نمی‌توان بازپخش کرد' },
        { status: 400 }
      )
    }
  }

  // Create a new pending event from the original payload
  const newEventId = randomUUID()
  await db.outboxEvent.create({
    data: {
      id: newEventId,
      workspaceId: original.workspaceId,
      aggregateType: original.aggregateType,
      aggregateId: original.aggregateId,
      eventType: original.eventType,
      payload: original.payload as Prisma.InputJsonValue,
      traceParent: original.traceParent,
      status: 'pending',
      attemptCount: 0,
      availableAt: new Date(),
      replayedFromId: original.id,
    },
  })

  // Write audit event
  await db.auditLog.create({
    data: {
      userId: guard.userId,
      workspaceId,
      action: 'outbox.replayed',
      resource: 'OutboxEvent',
      metadata: {
        originalEventId: id,
        newEventId,
        originalAttempts: original.attemptCount,
      },
    },
  })

  return NextResponse.json({
    ok: true,
    newEventId,
    message: 'رویداد بازپخش شد — در چرخه بعدی dispatcher پردازش خواهد شد',
  })
}
