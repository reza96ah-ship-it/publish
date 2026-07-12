import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'
import type {
  InboxThreadAttachment,
  InboxListQuery,
  InboxMessage,
  InboxThreadDetail,
  InboxThreadMessage,
  InboxThreadSummary,
} from './types'

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

type ThreadMessageRow = {
  id: string
  providerMessageId: string
  direction: string
  messageType: string
  senderExternalId: string | null
  senderName: string
  body: string
  payload: Prisma.JsonValue
  createdAt: Date
}

type MemberRef = {
  id: string
  name: string
  avatarUrl: string | null
}

type ThreadSummaryRow = {
  id: string
  providerThreadId: string
  providerUserId: string | null
  title: string
  messageType: string
  status: string
  assigneeId: string | null
  assignedAt: Date | null
  priority: string
  tags: string[]
  lockedById: string | null
  lockedAt: Date | null
  lockExpiresAt: Date | null
  unreadCount: number
  lastMessageAt: Date
  slaStartedAt: Date
  firstResponseAt: Date | null
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
  platform: { type: string; name: string } | null
  assignee: MemberRef | null
  lockedBy: MemberRef | null
  messages: ThreadMessageRow[]
}

function asJsonRecord(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : null
}

function stringFromJson(value: Prisma.JsonValue | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function toThreadAttachments(payload: Prisma.JsonValue): InboxThreadAttachment[] {
  const root = asJsonRecord(payload)
  const attachments = Array.isArray(root?.attachments) ? root.attachments : []
  return attachments.flatMap((value) => {
    const record = asJsonRecord(value)
    if (!record) return []
    return {
      type: stringFromJson(record.type) ?? 'attachment',
      title: stringFromJson(record.title) ?? 'Attachment',
      url: stringFromJson(record.url),
      providerId: stringFromJson(record.providerId),
    }
  })
}

function toThreadMessage(message: ThreadMessageRow): InboxThreadMessage {
  return {
    id: message.id,
    providerMessageId: message.providerMessageId,
    direction: message.direction,
    messageType: message.messageType,
    senderExternalId: message.senderExternalId,
    senderName: message.senderName,
    body: message.body,
    attachments: toThreadAttachments(message.payload),
    createdAt: message.createdAt,
  }
}

function toThreadSummary(
  thread: ThreadSummaryRow,
  lastMessage: ThreadMessageRow | null = thread.messages[0] ?? null
): InboxThreadSummary {
  const title =
    thread.title || lastMessage?.senderName || thread.providerUserId || thread.providerThreadId

  return {
    id: thread.id,
    providerThreadId: thread.providerThreadId,
    providerUserId: thread.providerUserId,
    title,
    platform: thread.platform?.type ?? 'instagram',
    platformName: thread.platform?.name ?? 'instagram',
    messageType: thread.messageType,
    status: thread.status,
    assigneeId: thread.assigneeId,
    assigneeName: thread.assignee?.name ?? null,
    assigneeAvatar: thread.assignee?.avatarUrl ?? null,
    priority: thread.priority,
    tags: thread.tags,
    lockedById: thread.lockedById,
    lockedByName: thread.lockedBy?.name ?? null,
    lockExpiresAt: thread.lockExpiresAt,
    unreadCount: thread.unreadCount,
    lastMessageAt: thread.lastMessageAt,
    slaStartedAt: thread.slaStartedAt,
    firstResponseAt: thread.firstResponseAt,
    resolvedAt: thread.resolvedAt,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    lastMessage: lastMessage ? toThreadMessage(lastMessage) : null,
  }
}

function toThreadDetail(thread: ThreadSummaryRow): InboxThreadDetail {
  const messages = thread.messages.map(toThreadMessage)
  return {
    ...toThreadSummary(thread, thread.messages[thread.messages.length - 1] ?? null),
    messages,
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
    const mirrorCandidates = rows.flatMap((row) =>
      row.externalId ? [{ platformId: row.platformId, providerMessageId: row.externalId }] : []
    )
    const mirrored =
      mirrorCandidates.length > 0
        ? await db.inboxThreadMessage.findMany({
            where: { workspaceId, OR: mirrorCandidates },
            select: { platformId: true, providerMessageId: true },
          })
        : []
    const mirroredKeys = new Set(
      mirrored.map((message) => `${message.platformId}:${message.providerMessageId}`)
    )
    return rows
      .filter((row) => !row.externalId || !mirroredKeys.has(`${row.platformId}:${row.externalId}`))
      .map(toMessage)
  }

  async listThreads(workspaceId: string, query: InboxListQuery) {
    const rows = await db.inboxThread.findMany({
      where: { workspaceId },
      include: {
        platform: { select: { type: true, name: true } },
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        lockedBy: { select: { id: true, name: true, avatarUrl: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            providerMessageId: true,
            direction: true,
            messageType: true,
            senderExternalId: true,
            senderName: true,
            body: true,
            payload: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
    })
    return rows.map((row) => toThreadSummary(row))
  }

  async findThreadInWorkspace(id: string, workspaceId: string) {
    return db.inboxThread.findFirst({ where: { id, workspaceId } })
  }

  async getThread(id: string, workspaceId: string) {
    const thread = await db.inboxThread.findFirst({
      where: { id, workspaceId },
      include: {
        platform: { select: { type: true, name: true } },
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        lockedBy: { select: { id: true, name: true, avatarUrl: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 100,
          select: {
            id: true,
            providerMessageId: true,
            direction: true,
            messageType: true,
            senderExternalId: true,
            senderName: true,
            body: true,
            payload: true,
            createdAt: true,
          },
        },
      },
    })
    return thread ? toThreadDetail(thread) : null
  }

  async findThreadWithPlatform(id: string, workspaceId: string) {
    return db.inboxThread.findFirst({
      where: { id, workspaceId },
      include: {
        platform: {
          select: { id: true, type: true, tokenSecret: true, targetId: true },
        },
        messages: {
          where: { direction: 'inbound' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            providerMessageId: true,
            messageType: true,
            senderExternalId: true,
          },
        },
      },
    })
  }

  async getThreadProviderMessageIds(id: string, workspaceId: string) {
    const messages = await db.inboxThreadMessage.findMany({
      where: { threadId: id, workspaceId },
      select: { providerMessageId: true },
    })
    return messages.map((message) => message.providerMessageId)
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

  async findMemberByUserInWorkspace(userId: string, workspaceId: string) {
    return db.workspaceMember.findFirst({ where: { userId, workspaceId } })
  }

  async markRead(id: string) {
    await db.inboxMessage.update({ where: { id }, data: { isRead: true } })
  }

  async markUnread(id: string) {
    await db.inboxMessage.update({ where: { id }, data: { isRead: false } })
  }

  async markThreadRead(id: string, workspaceId: string) {
    const providerMessageIds = await this.getThreadProviderMessageIds(id, workspaceId)
    await db.inboxThread.update({ where: { id }, data: { unreadCount: 0 } })
    if (providerMessageIds.length > 0) {
      await db.inboxMessage.updateMany({
        where: { workspaceId, externalId: { in: providerMessageIds } },
        data: { isRead: true },
      })
    }
  }

  async markThreadUnread(id: string, workspaceId: string) {
    const providerMessageIds = await this.getThreadProviderMessageIds(id, workspaceId)
    await db.inboxThread.update({ where: { id }, data: { unreadCount: 1 } })
    if (providerMessageIds.length > 0) {
      await db.inboxMessage.updateMany({
        where: { workspaceId, externalId: { in: providerMessageIds } },
        data: { isRead: false },
      })
    }
  }

  async setThreadStatus(id: string, workspaceId: string, status: string) {
    const providerMessageIds = await this.getThreadProviderMessageIds(id, workspaceId)
    const updated = await db.inboxThread.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === 'resolved' ? new Date() : null,
      },
      select: { id: true, status: true, resolvedAt: true },
    })
    if (providerMessageIds.length > 0) {
      await db.inboxMessage.updateMany({
        where: { workspaceId, externalId: { in: providerMessageIds } },
        data: { status },
      })
    }
    return updated
  }

  async assignThread(id: string, workspaceId: string, assigneeId: string | null) {
    const providerMessageIds = await this.getThreadProviderMessageIds(id, workspaceId)
    const current = await db.inboxThread.findUnique({
      where: { id },
      select: { status: true },
    })
    const isResolved = current?.status === 'resolved'
    const now = new Date()
    const updated = await db.inboxThread.update({
      where: { id },
      data: {
        assigneeId,
        assignedAt: assigneeId ? now : null,
        ...(isResolved ? {} : { status: assigneeId ? 'assigned' : 'new' }),
      },
      select: { id: true, assigneeId: true, status: true, assignedAt: true },
    })

    if (providerMessageIds.length > 0) {
      await db.inboxMessage.updateMany({
        where: { workspaceId, externalId: { in: providerMessageIds } },
        data: {
          assigneeId,
          ...(isResolved ? {} : { status: assigneeId ? 'assigned' : 'new' }),
        },
      })
    }

    return updated
  }

  async claimThread(id: string, workspaceId: string, memberId: string, leaseMinutes = 10) {
    const now = new Date()
    const lockExpiresAt = new Date(now.getTime() + leaseMinutes * 60_000)
    const result = await db.inboxThread.updateMany({
      where: {
        id,
        workspaceId,
        OR: [
          { lockedById: null },
          { lockExpiresAt: null },
          { lockExpiresAt: { lt: now } },
          { lockedById: memberId },
        ],
      },
      data: {
        assigneeId: memberId,
        assignedAt: now,
        status: 'assigned',
        lockedById: memberId,
        lockedAt: now,
        lockExpiresAt,
      },
    })

    if (result.count === 0) return null

    const providerMessageIds = await this.getThreadProviderMessageIds(id, workspaceId)
    if (providerMessageIds.length > 0) {
      await db.inboxMessage.updateMany({
        where: { workspaceId, externalId: { in: providerMessageIds } },
        data: { assigneeId: memberId, status: 'assigned' },
      })
    }

    return { ok: true, assigneeId: memberId, lockExpiresAt }
  }

  async updateThreadTags(id: string, tags: string[]) {
    return db.inboxThread.update({
      where: { id },
      data: { tags },
      select: { id: true, tags: true },
    })
  }

  async updateThreadPriority(id: string, priority: string) {
    return db.inboxThread.update({
      where: { id },
      data: { priority },
      select: { id: true, priority: true },
    })
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

  async markLegacyRepliedByExternalId(
    workspaceId: string,
    platformId: string,
    providerMessageId: string,
    replyText: string
  ) {
    const current = await db.inboxMessage.findFirst({
      where: { workspaceId, platformId, externalId: providerMessageId },
      select: { id: true, firstResponseAt: true },
    })
    if (!current) return null
    return db.inboxMessage.update({
      where: { id: current.id },
      data: {
        reply: replyText.trim(),
        isReplied: true,
        isRead: true,
        ...(current.firstResponseAt ? {} : { firstResponseAt: new Date() }),
      },
    })
  }

  async appendThreadReply(
    threadId: string,
    workspaceId: string,
    platformId: string,
    messageType: string,
    replyText: string
  ) {
    const now = new Date()
    const threadMessage = await db.inboxThreadMessage.create({
      data: {
        threadId,
        workspaceId,
        platformId,
        providerMessageId: `outbound:${threadId}:${randomUUID()}`,
        direction: 'outbound',
        messageType,
        senderName: 'You',
        body: replyText.trim(),
        payload: { source: 'app-reply' },
        createdAt: now,
      },
    })

    await db.inboxThread.update({
      where: { id: threadId },
      data: {
        unreadCount: 0,
        status: 'in_progress',
        lastMessageAt: now,
      },
    })
    await db.inboxThread.updateMany({
      where: { id: threadId, firstResponseAt: null },
      data: { firstResponseAt: now },
    })

    return threadMessage
  }
}
