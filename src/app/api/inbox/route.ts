import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getWorkspaceId } from '@/lib/server'

export async function GET() {
  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return NextResponse.json({ error: 'workspace not found' }, { status: 404 })

  const items = await db.inboxMessage.findMany({
    where: { workspaceId },
    include: { platform: { select: { type: true, name: true } } },
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
    createdAt: m.createdAt,
  })))
}
