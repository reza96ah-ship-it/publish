import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWorkspaceApi } from '@/lib/auth-guards'

export async function GET() {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id

  const items = await db.inboxMessage.findMany({
    where: { workspaceId },
    include: {
      platform: { select: { type: true, name: true } },
      assignee: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json(items.map((m) => ({
    id: m.id,
    senderName: m.senderName,
    senderAvatar: m.senderAvatar,
    message: m.message,
    isRead: m.isRead,
    isReplied: m.isReplied,
    reply: m.reply,
    platform: m.platform.type,
    platformName: m.platform.name,
    messageType: m.messageType,
    assigneeId: m.assigneeId,
    assigneeName: m.assignee?.name ?? null,
    assigneeAvatar: m.assignee?.avatarUrl ?? null,
    createdAt: m.createdAt,
  })))
}
