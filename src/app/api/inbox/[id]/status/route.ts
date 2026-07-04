import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { writeAuditLog } from '@/lib/audit'

const VALID_STATUSES = ['new', 'assigned', 'in_progress', 'resolved'] as const
type InboxStatus = (typeof VALID_STATUSES)[number]

const TRANSITIONS: Record<InboxStatus, InboxStatus[]> = {
  new: ['assigned', 'in_progress'],
  assigned: ['in_progress', 'resolved'],
  in_progress: ['resolved', 'assigned'],
  resolved: ['new'], // reopen
}

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('inbox.reply')
  if (guard.error) return guard.error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const next = body?.status as InboxStatus | undefined

  if (!next || !VALID_STATUSES.includes(next)) {
    return NextResponse.json({ error: 'وضعیت نامعتبر' }, { status: 400 })
  }

  const message = await db.inboxMessage.findFirst({
    where: { id, workspaceId: guard.workspaceId },
  })
  if (!message) {
    return NextResponse.json({ error: 'پیام یافت نشد' }, { status: 404 })
  }

  const current = (message.status as InboxStatus) ?? 'new'
  if (!TRANSITIONS[current].includes(next)) {
    return NextResponse.json(
      { error: `انتقال از "${current}" به "${next}" مجاز نیست` },
      { status: 422 }
    )
  }

  const now = new Date()
  const updates: Record<string, unknown> = { status: next }
  if (!message.slaStartedAt) updates.slaStartedAt = now
  if (next === 'resolved' && !message.resolvedAt) updates.resolvedAt = now

  const updated = await db.inboxMessage.update({
    where: { id },
    data: updates,
    select: { id: true, status: true, resolvedAt: true, slaStartedAt: true },
  })

  await writeAuditLog({
    action: 'inbox.status_changed',
    workspaceId: guard.workspaceId,
    userId: guard.userId,
    metadata: { messageId: id, from: current, to: next },
  })

  return NextResponse.json(updated)
}
