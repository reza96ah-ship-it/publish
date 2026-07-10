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
  status: string
  slaStartedAt: Date | null
  firstResponseAt: Date | null
  resolvedAt: Date | null
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
    status: m.status,
    slaStartedAt: m.slaStartedAt,
    firstResponseAt: m.firstResponseAt,
    resolvedAt: m.resolvedAt,
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

  /** Message + the platform credential fields needed to send a real reply. */
  async findWithPlatform(id: string, workspaceId: string) {
    return db.inboxMessage.findFirst({
      where: { id, workspaceId },
      include: {
        platform: { select: { type: true, tokenSecret: true, targetId: true } },
      },
    })
  }

  async findMemberInWorkspace(memberId: string, workspaceId: string) {
    return db.workspaceMember.findFirst({ where: { id: memberId, workspaceId } })
  }

  async markRead(id: string) {
    await db.inboxMessage.update({ where: { id }, data: { isRead: true } })
  }

  async markUnread(id: string) {
    await db.inboxMessage.update({ where: { id }, data: { isRead: false } })
  }

  async assign(id: string, assigneeId: string | null) {
    // #208: assigning moves the workflow forward and starts the SLA clock.
    // Un-assigning an unresolved message returns it to `new`.
    const current = await db.inboxMessage.findUnique({
      where: { id },
      select: { status: true, slaStartedAt: true },
    })
    const isResolved = current?.status === 'resolved'
    return db.inboxMessage.update({
      where: { id },
      data: {
        assigneeId,
        ...(isResolved
          ? {}
          : assigneeId
            ? { status: 'assigned', slaStartedAt: current?.slaStartedAt ?? new Date() }
            : { status: 'new' }),
      },
    })
  }

  async reply(id: string, replyText: string) {
    // #208: first reply stamps firstResponseAt for first-response-time metrics.
    const current = await db.inboxMessage.findUnique({
      where: { id },
      select: { firstResponseAt: true },
    })
    return db.inboxMessage.update({
      where: { id },
      data: {
        reply: replyText.trim(),
        isReplied: true,
        isRead: true,
        ...(current?.firstResponseAt ? {} : { firstResponseAt: new Date() }),
      },
    })
  }
}
