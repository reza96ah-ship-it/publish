import { db } from '@/lib/db'
import type { InboxListQuery, InboxMessage } from './types'

function toMessage(m: {
  id: string
  senderName: string | null
  senderAvatar: string | null
  message: string | null
  isRead: boolean
  isReplied: boolean
  reply: string | null
  platformType: string
  messageType: string | null
  assigneeId: string | null
  createdAt: Date
  platform: { type: string; name: string } | null
}): InboxMessage {
  return {
    id: m.id,
    senderName: m.senderName,
    senderAvatar: m.senderAvatar,
    message: m.message,
    isRead: m.isRead,
    isReplied: m.isReplied,
    reply: m.reply,
    platform: m.platform?.type ?? m.platformType,
    platformName: m.platform?.name ?? m.platformType,
    messageType: m.messageType,
    assigneeId: m.assigneeId,
    createdAt: m.createdAt,
  }
}

export class InboxRepository {
  async list(workspaceId: string, query: InboxListQuery) {
    const rows = await db.inboxMessage.findMany({
      where: {
        workspaceId,
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      include: { platform: { select: { type: true, name: true } } },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
    })
    return rows.map(toMessage)
  }

  async findInWorkspace(id: string, workspaceId: string) {
    return db.inboxMessage.findFirst({ where: { id, workspaceId } })
  }

  async findMemberInWorkspace(memberId: string, workspaceId: string) {
    return db.workspaceMember.findFirst({ where: { id: memberId, workspaceId } })
  }

  async markRead(id: string) {
    await db.inboxMessage.update({ where: { id }, data: { isRead: true } })
  }

  async assign(id: string, assigneeId: string | null) {
    return db.inboxMessage.update({ where: { id }, data: { assigneeId } })
  }

  async reply(id: string, replyText: string) {
    return db.inboxMessage.update({
      where: { id },
      data: { reply: replyText.trim(), isReplied: true, isRead: true },
    })
  }
}
